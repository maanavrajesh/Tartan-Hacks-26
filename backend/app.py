"""Flask web app for football video analysis with async processing."""

import os
import subprocess
import uuid
import threading
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
import numpy as np

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = Path("uploads")
OUTPUT_FOLDER = Path("output_videos")
UPLOAD_FOLDER.mkdir(exist_ok=True)
OUTPUT_FOLDER.mkdir(exist_ok=True)

app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024  # 500 MB

ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv"}

# In-memory job status tracker: { videoId: { status, progress, currentStep, error } }
jobs = {}


def allowed_file(filename):
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


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

        tracker = Tracker("models/best.pt")
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
