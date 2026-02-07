"""Flask web app for football video analysis with async processing."""

import os
import subprocess
import uuid
import threading
from datetime import datetime, timezone
from pathlib import Path
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS

from utils import read_video, save_video
from trackers import Tracker
from team_assigner import TeamAssigner
from player_ball_assigner import PlayerBallAssigner
from camera_movement_estimator import CameraMovementEstimator
from view_transformer import ViewTransformer
from speed_and_distance_estimator import SpeedAndDistance_Estimator
from player_feedback import generate_player_feedback
import numpy as np
import cv2
import json

app = Flask(__name__)
CORS(app)

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "best.pt"

UPLOAD_FOLDER = BASE_DIR / "uploads"
OUTPUT_FOLDER = BASE_DIR / "output_videos"
UPLOAD_FOLDER.mkdir(exist_ok=True)
OUTPUT_FOLDER.mkdir(exist_ok=True)

app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024  # 500 MB

ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv"}

# In-memory job status tracker: { videoId: { status, progress, currentStep, error } }
jobs = {}


def allowed_file(filename):
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


def _build_tracks_for_ui(tracks, frame_shape, fps, sample_step=5):
    height, width = frame_shape[:2]
    if width <= 0 or height <= 0:
        return []

    def clamp01(value):
        return max(0.0, min(1.0, value))

    def add_tracks(track_frames, cls_name, id_prefix=None, fixed_id=None):
        output = {}
        for frame_idx, frame_tracks in enumerate(track_frames):
            if sample_step > 1 and frame_idx % sample_step != 0:
                continue
            timestamp = round(frame_idx / fps, 2)
            for track_id, track_info in frame_tracks.items():
                bbox = track_info.get("bbox")
                if not bbox or len(bbox) < 4:
                    continue
                x1, y1, x2, y2 = bbox
                cx = clamp01(((x1 + x2) / 2) / width)
                cy = clamp01(((y1 + y2) / 2) / height)
                ui_id = fixed_id or f"{id_prefix}{track_id}"
                if ui_id not in output:
                    output[ui_id] = {
                        "id": ui_id,
                        "class": cls_name,
                        "positions": [],
                    }
                output[ui_id]["positions"].append(
                    {
                        "timestamp": timestamp,
                        "x": round(cx, 4),
                        "y": round(cy, 4),
                        "confidence": 1.0,
                    }
                )
        return list(output.values())

    players = add_tracks(tracks.get("players", []), "person", id_prefix="p_")
    ball = add_tracks(tracks.get("ball", []), "sports_ball", fixed_id="ball")
    return players + ball


def _build_metrics_from_feedback(feedback):
    if not feedback:
        return []

    avg_speeds = [f.get("avg_speed_kmh", 0) for f in feedback]
    max_speeds = [f.get("max_speed_kmh", 0) for f in feedback]
    distances = [f.get("distance_m", 0) for f in feedback]
    ball_control = [f.get("ball_control_pct", 0) for f in feedback]

    def safe_mean(values):
        vals = [v for v in values if isinstance(v, (int, float))]
        return round(sum(vals) / len(vals), 2) if vals else 0

    return [
        {
            "id": "avg_speed",
            "name": "Average Speed",
            "value": safe_mean(avg_speeds),
            "unit": "km/h",
            "description": "Mean player speed across tracked players",
            "context": "Team average",
        },
        {
            "id": "max_speed",
            "name": "Max Speed",
            "value": round(max(max_speeds) if max_speeds else 0, 2),
            "unit": "km/h",
            "description": "Top speed reached by any tracked player",
            "context": "Team peak",
        },
        {
            "id": "total_distance",
            "name": "Total Distance",
            "value": round(sum(distances), 2),
            "unit": "m",
            "description": "Sum of distances across tracked players",
            "context": "Team total",
        },
        {
            "id": "ball_control",
            "name": "Ball Control",
            "value": safe_mean(ball_control),
            "unit": "%",
            "description": "Average ball control percentage across players",
            "context": "Team average",
        },
    ]


def _build_insights_from_feedback(feedback):
    insights = []
    if not feedback:
        return insights

    # Prefer LLM feedback if present
    llm_source = next((f for f in feedback if f.get("llm_feedback")), None)
    if llm_source and llm_source.get("llm_feedback"):
        llm = llm_source["llm_feedback"]
        for idx, insight in enumerate(llm.get("insights", [])[:3]):
            title = insight.get("title") or "Insight"
            why = insight.get("why_it_matters") or ""
            action_list = insight.get("how_to_improve") or []
            insights.append(
                {
                    "id": f"llm_{llm_source.get('player_id', 'p')}_{idx}",
                    "claim": title,
                    "evidenceEvents": [],
                    "whyItMatters": why,
                    "action": action_list[0] if action_list else "Review film and adjust positioning",
                    "goal": llm.get("action_plan", {}).get("focus", "Improve performance"),
                }
            )
        return insights

    # Fall back to rule-based feedback from top player
    fallback = feedback[0].get("feedback") if feedback else []
    for idx, tip in enumerate(fallback[:3]):
        insights.append(
            {
                "id": f"rule_{idx}",
                "claim": tip,
                "evidenceEvents": [],
                "whyItMatters": "Derived from tracked movement and possession metrics.",
                "action": "Review footage and apply the coaching cue.",
                "goal": "Improve decision-making and positioning",
            }
        )
    return insights


def run_pipeline(video_id, input_path, output_path):
    """Run the full analysis pipeline in a background thread."""
    try:
        # --- Detecting ---
        jobs[video_id]["status"] = "detecting"
        jobs[video_id]["progress"] = 10
        jobs[video_id]["currentStep"] = "Reading video and detecting objects"

        video_frames = read_video(input_path)
        if len(video_frames) == 0:
            raise ValueError(f"No frames read from video: {input_path}")

        tracker = Tracker(str(MODEL_PATH))
        tracks = tracker.get_object_tracks(video_frames, read_from_stub=False, stub_path=None)
        tracker.add_position_to_tracks(tracks)

        jobs[video_id]["progress"] = 30

        # --- Tracking ---
        jobs[video_id]["status"] = "tracking"
        jobs[video_id]["currentStep"] = "Tracking camera and player movement"

        camera_movement_estimator = CameraMovementEstimator(video_frames[0])
        camera_movement_per_frame = camera_movement_estimator.get_camera_movement(
            video_frames, read_from_stub=False, stub_path=None
        )
        camera_movement_estimator.add_adjust_positions_to_tracks(tracks, camera_movement_per_frame)

        view_transformer = ViewTransformer()
        view_transformer.add_transformed_position_to_tracks(tracks)

        tracks["ball"] = tracker.interpolate_ball_positions(tracks["ball"])

        jobs[video_id]["progress"] = 50

        # --- Analyzing ---
        jobs[video_id]["status"] = "analyzing"
        jobs[video_id]["currentStep"] = "Analyzing speed, teams, and possession"

        speed_and_distance_estimator = SpeedAndDistance_Estimator()
        speed_and_distance_estimator.add_speed_and_distance_to_tracks(tracks)

        team_assigner = TeamAssigner()
        first_players_frame = next(
            (i for i, players in enumerate(tracks["players"]) if len(players) > 0), None
        )
        if first_players_frame is not None:
            team_assigner.assign_team_color(
                video_frames[first_players_frame], tracks["players"][first_players_frame]
            )
            for frame_num, player_track in enumerate(tracks["players"]):
                for player_id, track in player_track.items():
                    team = team_assigner.get_player_team(
                        video_frames[frame_num], track["bbox"], player_id
                    )
                    tracks["players"][frame_num][player_id]["team"] = team
                    tracks["players"][frame_num][player_id]["team_color"] = (
                        team_assigner.team_colors[team]
                    )

        jobs[video_id]["progress"] = 70

        player_assigner = PlayerBallAssigner()
        team_ball_control = []
        for frame_num, player_track in enumerate(tracks["players"]):
            if 1 not in tracks["ball"][frame_num]:
                assigned_player = -1
            else:
                ball_bbox = tracks["ball"][frame_num][1]["bbox"]
                assigned_player = player_assigner.assign_ball_to_player(player_track, ball_bbox)

            if assigned_player != -1:
                tracks["players"][frame_num][assigned_player]["has_ball"] = True
                team_ball_control.append(tracks["players"][frame_num][assigned_player]["team"])
            else:
                team_ball_control.append(team_ball_control[-1] if team_ball_control else 0)
        team_ball_control = np.array(team_ball_control)

        # --- Player Feedback ---
        jobs[video_id]["progress"] = 82
        jobs[video_id]["currentStep"] = "Generating player feedback"

        cap = cv2.VideoCapture(input_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
        cap.release()

        feedback = generate_player_feedback(
            tracks, fps, video_id,
            output_folder=str(OUTPUT_FOLDER),
            min_presence_sec=10.0,
            use_llm=True,
            llm_model=os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini"),
            llm_timeout=30,
        )

        jobs[video_id]["progress"] = 85
        jobs[video_id]["currentStep"] = "Rendering annotated video"

        output_video_frames = tracker.draw_annotations(video_frames, tracks, team_ball_control)
        output_video_frames = camera_movement_estimator.draw_camera_movement(
            output_video_frames, camera_movement_per_frame
        )
        speed_and_distance_estimator.draw_speed_and_distance(output_video_frames, tracks)

        # Save as AVI first then convert to browser-playable MP4
        avi_path = output_path.replace(".mp4", ".avi")
        save_video(output_video_frames, avi_path)

        subprocess.run(
            ["ffmpeg", "-y", "-i", avi_path, "-c:v", "libx264",
             "-preset", "fast", "-crf", "23", output_path],
            check=True, capture_output=True,
        )
        if os.path.exists(avi_path):
            os.remove(avi_path)

        # Write artifacts for frontend UI
        try:
            frame_shape = video_frames[0].shape if video_frames else (0, 0, 0)
            sample_step = max(int(fps / 5), 1)
            ui_tracks = _build_tracks_for_ui(tracks, frame_shape, fps, sample_step=sample_step)

            duration_s = round(len(video_frames) / fps, 2) if fps else 0
            meta = {
                "id": video_id,
                "filename": jobs[video_id].get("filename", f"{video_id}.mp4"),
                "duration": duration_s,
                "width": int(frame_shape[1]) if frame_shape else 0,
                "height": int(frame_shape[0]) if frame_shape else 0,
                "fps": round(fps, 2),
                "sport": "soccer",
                "uploadedAt": jobs[video_id].get("uploaded_at", ""),
                "status": "complete",
            }

            artifacts = {
                "meta": meta,
                "events": [],
                "metrics": _build_metrics_from_feedback(feedback),
                "predictions": {"riskScores": [], "topRiskMoments": []},
                "insights": _build_insights_from_feedback(feedback),
                "tracks": ui_tracks,
            }

            artifacts_path = OUTPUT_FOLDER / f"{video_id}_artifacts.json"
            with open(artifacts_path, "w", encoding="utf-8") as f:
                json.dump(artifacts, f, indent=2)
        except Exception as e:
            print(f"Artifacts error: {e}")

        # Done
        jobs[video_id]["status"] = "complete"
        jobs[video_id]["progress"] = 100
        jobs[video_id]["currentStep"] = "done"

    except Exception as e:
        jobs[video_id]["status"] = "error"
        jobs[video_id]["error"] = str(e)
    finally:
        # Clean up uploaded file
        if os.path.exists(input_path):
            os.remove(input_path)


# ── API Endpoints ──────────────────────────────────────────────

@app.route("/")
def index():
    return jsonify({"status": "ok", "message": "VisionXI API running"})


@app.route("/api/upload", methods=["POST"])
def upload():
    """Accept video file, save it, return a videoId."""
    if "video" not in request.files:
        return jsonify({"error": "No video file provided"}), 400

    file = request.files["video"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed. Use mp4, avi, mov, or mkv."}), 400

    video_id = uuid.uuid4().hex[:10]
    ext = Path(file.filename).suffix
    input_path = str(UPLOAD_FOLDER / f"{video_id}{ext}")

    file.save(input_path)

    # Register job as uploaded
    jobs[video_id] = {
        "status": "uploaded",
        "progress": 0,
        "currentStep": "uploaded",
        "error": None,
        "input_path": input_path,
        "filename": file.filename,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }

    return jsonify({"videoId": video_id})


@app.route("/api/process/<video_id>", methods=["POST"])
def process(video_id):
    """Kick off background processing for a previously uploaded video."""
    if video_id not in jobs:
        return jsonify({"error": "Video not found"}), 404

    job = jobs[video_id]
    if job["status"] not in ("uploaded",):
        return jsonify({"error": "Video is already being processed"}), 409

    input_path = job["input_path"]
    output_path = str(OUTPUT_FOLDER / f"{video_id}_analyzed.mp4")

    job["status"] = "processing"
    job["progress"] = 5

    thread = threading.Thread(
        target=run_pipeline, args=(video_id, input_path, output_path), daemon=True
    )
    thread.start()

    return jsonify({"jobId": f"job_{video_id}"})


@app.route("/api/status/<video_id>")
def status(video_id):
    """Return current processing status for polling."""
    if video_id not in jobs:
        return jsonify({"error": "Video not found"}), 404

    job = jobs[video_id]
    return jsonify({
        "status": job["status"],
        "progress": job["progress"],
        "currentStep": job["currentStep"],
        "error": job.get("error"),
    })


@app.route("/api/video/<video_id>")
def serve_video(video_id):
    """Serve the processed MP4 video."""
    output_path = OUTPUT_FOLDER / f"{video_id}_analyzed.mp4"
    if not output_path.exists():
        return jsonify({"error": "Video not found"}), 404
    return send_file(output_path, mimetype="video/mp4", as_attachment=False)


@app.route("/api/feedback/<video_id>")
def feedback(video_id):
    """Serve the player feedback JSON."""
    feedback_path = OUTPUT_FOLDER / f"{video_id}_feedback.json"
    if not feedback_path.exists():
        return jsonify({"error": "Feedback not found"}), 404
    with open(feedback_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return jsonify(data)


@app.route("/api/artifacts/<video_id>")
def artifacts(video_id):
    """Serve combined analysis artifacts for the frontend UI."""
    artifacts_path = OUTPUT_FOLDER / f"{video_id}_artifacts.json"
    if not artifacts_path.exists():
        return jsonify({"error": "Artifacts not found"}), 404
    with open(artifacts_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return jsonify(data)


@app.route("/api/download/<video_id>")
def download_video(video_id):
    """Download the processed video."""
    output_path = OUTPUT_FOLDER / f"{video_id}_analyzed.mp4"
    if not output_path.exists():
        return jsonify({"error": "Video not found"}), 404
    return send_file(
        output_path,
        mimetype="video/mp4",
        as_attachment=True,
        download_name=f"analyzed_{video_id}.mp4",
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000)
