#!/usr/bin/env python3
import argparse
import json
import os
import sys

import pickle
import cv2
import requests

from utils import read_video, get_center_of_bbox, get_foot_position
from camera_movement_estimator import CameraMovementEstimator
from view_transformer import ViewTransformer
from speed_and_distance_estimator import SpeedAndDistance_Estimator


def parse_args():
    p = argparse.ArgumentParser(description="Per-player feedback from tracking model")
    p.add_argument("--video", required=True, help="Path to input video")
    p.add_argument("--model", default="models/best.pt", help="YOLO model path")
    p.add_argument("--use-stub", action="store_true", help="Use stubbed tracks/camera")
    p.add_argument("--track-stub", default="stubs/track_stubs.pkl")
    p.add_argument("--camera-stub", default="stubs/camera_movement_stub.pkl")
    p.add_argument("--out", default="output_videos/player_feedback.json")
    p.add_argument("--player-id", type=int, help="Only output feedback for this player_id")
    p.add_argument("--llm", action="store_true", help="Use OpenRouter LLM to rewrite feedback")
    p.add_argument("--llm-model", default=os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini"))
    p.add_argument("--llm-debug", action="store_true", help="Print LLM errors")
    p.add_argument("--llm-limit", type=int, default=0, help="Limit LLM calls to N players (0 = no limit)")
    p.add_argument("--llm-timeout", type=int, default=30, help="LLM request timeout seconds")
    p.add_argument("--min-presence-sec", type=float, default=10.0, help="Skip players with total presence <= this")
    return p.parse_args()


def safe_mean(values):
    if not values:
        return 0.0
    return float(sum(values) / len(values))


def build_feedback(stats):
    feedback = []
    avg_speed = stats["avg_speed_kmh"]
    max_speed = stats["max_speed_kmh"]
    pos_role = stats.get("position_role")
    pos_rank = stats.get("position_rank_pct")
    ball_control = stats.get("ball_control_pct")
    field_adv = stats.get("field_control_adv_pct")
    field_deep = stats.get("field_control_deep_pct")
    move_control = stats.get("movement_control_pct")
    pressure_control = stats.get("pressure_control_pct")

    if pos_role == "advanced":
        feedback.append("You stay high relative to teammates. Check timing of runs to stay onside and available.")
    elif pos_role == "deep":
        feedback.append("You play deeper than most teammates. Look for earlier forward support runs.")
    elif pos_role == "wide":
        feedback.append("You hold wider positions. Use width to create passing lanes and isolate defenders.")

    if avg_speed < 5:
        feedback.append("Low movement is recorded in this window. Add one clear movement action in similar moments.")
    elif avg_speed > 8:
        feedback.append("High movement is recorded in this window. Keep your movement quality consistent.")

    if max_speed < 18:
        feedback.append("Maximum speed is low in this window. Add a short acceleration action in similar moments.")
    elif max_speed > 24:
        feedback.append("Strong maximum speed is recorded. Use that speed to create separation in similar moments.")

    if pos_rank is not None:
        if pos_rank >= 80:
            feedback.append("You are among the most advanced players in this window. Stay available without drifting too high.")
        elif pos_rank <= 20:
            feedback.append("You are among the deepest players in this window. Offer a nearby support option.")

    if ball_control is not None:
        if ball_control < 5:
            feedback.append("Ball control percentage is low. Look for small check-ins to get a touch.")
        elif ball_control > 20:
            feedback.append("Ball control percentage is high. Keep your first touch clean to keep tempo.")

    if field_adv is not None and field_deep is not None:
        if field_adv > 50:
            feedback.append("You spend most of your time advanced. Stay connected to avoid getting isolated.")
        elif field_deep > 50:
            feedback.append("You spend most of your time deep. Step in to support the next pass when safe.")

    if move_control is not None:
        if move_control < 20:
            feedback.append("Movement control is low. Add one clear movement action to create a new option.")
        elif move_control > 60:
            feedback.append("Movement control is high. Maintain your scanning so runs are timed.")

    if pressure_control is not None:
        if pressure_control > 50:
            feedback.append("Pressure control is high. Use that stability to help the team reset.")

    if not feedback:
        feedback.append("Stable performance. Focus on movement timing and support angles.")

    return feedback


def openrouter_rewrite(model, api_key, payload, debug=False, timeout_s=30):
    if not api_key:
        if debug:
            print("LLM: missing OPENROUTER_API_KEY", file=sys.stderr)
        return None
    url = "https://openrouter.ai/api/v1/chat/completions"
    system = (
        "You are a soccer coach and performance educator.\n"
        "You analyze ONE player using ONLY the provided evidence window.\n"
        "You reason about patterns that appear within this window only.\n"
        "\n"
        "Rules:\n"
        "- Integrate numerical metrics directly into your analysis\n"
        "- Use correct soccer terminology\n"
        "- Do not invent events or statistics\n"
        "- Do not extrapolate beyond the evidence window\n"
        "- Do not make medical diagnoses\n"
        "- If evidence is insufficient, state that clearly\n"
        "\n"
        "Output must match the PRD structure exactly."
    )
    user = (
        "Player evidence (use only this):\n"
        + json.dumps(payload, indent=2)
        + "\nReturn STRICT JSON with this structure:\n"
        "{\n"
        "  \"quantitative_summary\": {\n"
        "    \"ball_control\": \"...\",\n"
        "    \"movement\": \"...\",\n"
        "    \"pressure_context\": \"...\"\n"
        "  },\n"
        "  \"insights\": [\n"
        "    {\n"
        "      \"title\": \"...\",\n"
        "      \"what_happened\": \"...\",\n"
        "      \"why_it_matters\": \"...\",\n"
        "      \"how_to_improve\": [\"...\", \"...\", \"...\"],\n"
        "      \"technical_terms_used\": [\"...\", \"...\"],\n"
        "      \"evidence_used\": {\"...\": \"...\"}\n"
        "    }\n"
        "  ],\n"
        "  \"action_plan\": {\n"
        "    \"focus\": \"...\",\n"
        "    \"next_step\": \"...\",\n"
        "    \"success_indicator\": \"...\"\n"
        "  }\n"
        "}\n"
        "Use 2-3 insights max. Embed control percentages in quantitative_summary and evidence_used."
    )
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    try:
        if debug:
            print("LLM: sending request", file=sys.stderr)
        resp = requests.post(url, json=body, headers=headers, timeout=timeout_s)
        if debug:
            print("LLM: status", resp.status_code, file=sys.stderr)
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        return json.loads(content)
    except Exception as e:
        if debug:
            try:
                print("LLM error:", str(e), file=sys.stderr)
                print("LLM response:", resp.text[:500], file=sys.stderr)  # type: ignore
            except Exception:
                pass
        return None


def main():
    args = parse_args()
    if not os.path.exists(args.video):
        print(f"error: video not found: {args.video}", file=sys.stderr)
        sys.exit(1)

    cap = cv2.VideoCapture(args.video)
    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    cap.release()

    frames = read_video(args.video)
    if not frames:
        print("error: no frames read from video", file=sys.stderr)
        sys.exit(1)

    if args.use_stub:
        if not os.path.exists(args.track_stub):
            print(f"error: stub not found: {args.track_stub}", file=sys.stderr)
            sys.exit(1)
        with open(args.track_stub, "rb") as f:
            tracks = pickle.load(f)
    else:
        try:
            from trackers import Tracker
        except Exception as e:
            print(f"error: missing model deps (ultralytics/supervision): {e}", file=sys.stderr)
            sys.exit(1)
        tracker = Tracker(args.model)
        tracks = tracker.get_object_tracks(
            frames,
            read_from_stub=False,
            stub_path=None,
        )

    # Add positions if missing
    for obj, obj_tracks in tracks.items():
        for frame_num, track in enumerate(obj_tracks):
            for track_id, track_info in track.items():
                if "position" in track_info:
                    continue
                bbox = track_info["bbox"]
                if obj == "ball":
                    position = get_center_of_bbox(bbox)
                else:
                    position = get_foot_position(bbox)
                tracks[obj][frame_num][track_id]["position"] = position

    camera = CameraMovementEstimator(frames[0])
    camera_movement = camera.get_camera_movement(
        frames,
        read_from_stub=args.use_stub,
        stub_path=args.camera_stub,
    )
    camera.add_adjust_positions_to_tracks(tracks, camera_movement)

    view = ViewTransformer()
    view.add_transformed_position_to_tracks(tracks)

    # Interpolate ball positions with simple forward/back fill
    ball_positions = []
    for frame in tracks["ball"]:
        if 1 in frame and "bbox" in frame[1]:
            ball_positions.append(frame[1]["bbox"])
        else:
            ball_positions.append(None)
    last = None
    for i in range(len(ball_positions)):
        if ball_positions[i] is None and last is not None:
            ball_positions[i] = last
        elif ball_positions[i] is not None:
            last = ball_positions[i]
    # backfill start
    first = next((b for b in ball_positions if b is not None), None)
    if first is not None:
        for i in range(len(ball_positions)):
            if ball_positions[i] is None:
                ball_positions[i] = first
            else:
                break
    rebuilt_ball = []
    for b in ball_positions:
        if b is None:
            rebuilt_ball.append({})
        else:
            rebuilt_ball.append({1: {"bbox": b}})
    tracks["ball"] = rebuilt_ball

    speed_estimator = SpeedAndDistance_Estimator()
    speed_estimator.add_speed_and_distance_to_tracks(tracks)

    # Team assignment (optional if sklearn not installed)
    try:
        from team_assigner import TeamAssigner
        team_assigner = TeamAssigner()
        if tracks["players"] and tracks["players"][0]:
            team_assigner.assign_team_color(frames[0], tracks["players"][0])
        for frame_num, player_track in enumerate(tracks["players"]):
            for player_id, track in player_track.items():
                team = team_assigner.get_player_team(
                    frames[frame_num], track["bbox"], player_id
                )
                tracks["players"][frame_num][player_id]["team"] = team
    except Exception:
        pass

    # Ball possession assignment
    try:
        from player_ball_assigner import PlayerBallAssigner
        player_assigner = PlayerBallAssigner()
        for frame_num, player_track in enumerate(tracks["players"]):
            if not tracks["ball"][frame_num]:
                continue
            ball_bbox = tracks["ball"][frame_num][1]["bbox"]
            assigned_player = player_assigner.assign_ball_to_player(
                player_track, ball_bbox
            )
            if assigned_player != -1:
                tracks["players"][frame_num][assigned_player]["has_ball"] = True
    except Exception:
        pass

    # Aggregate per-player stats
    stats = {}
    total_possession_frames = 0
    for frame_num, player_track in enumerate(tracks["players"]):
        for player_id, track in player_track.items():
            if player_id not in stats:
                stats[player_id] = {
                    "player_id": int(player_id),
                    "team": track.get("team"),
                    "frames_present": 0,
                    "possession_frames": 0,
                    "speed_samples": [],
                    "distance_samples": [],
                    "possession_frame_idxs": [],
                    "speed_samples_with_frame": [],
                    "presence_frame_idxs": [],
                    "pos_frames_with_pos": [],
                    "pos_frames_with_pos_t": [],
                    "role_counts": {"deep": 0, "mid": 0, "advanced": 0},
                    "movement_frames": set()
                }
            s = stats[player_id]
            s["frames_present"] += 1
            s["presence_frame_idxs"].append(frame_num)
            if track.get("has_ball"):
                s["possession_frames"] += 1
                total_possession_frames += 1
                s["possession_frame_idxs"].append(frame_num)
            if "speed" in track:
                s["speed_samples"].append(track["speed"])
                s["speed_samples_with_frame"].append((track["speed"], frame_num))
                if track["speed"] > 0:
                    s["movement_frames"].add(frame_num)
            if "distance" in track:
                s["distance_samples"].append(track["distance"])
            if "position_adjusted" in track:
                s["pos_frames_with_pos"].append((frame_num, track["position_adjusted"]))
            elif "position" in track:
                s["pos_frames_with_pos"].append((frame_num, track["position"]))
            if "position_transformed" in track and track["position_transformed"] is not None:
                s["pos_frames_with_pos_t"].append((frame_num, track["position_transformed"]))

    # Build output
    output = []
    llm_calls = 0
    api_key = os.getenv("OPENROUTER_API_KEY")
    # Compute relative position ranks using transformed X (field length axis)
    avg_x_by_player = {}
    for player_id, s in stats.items():
        if args.player_id is not None and int(player_id) != args.player_id:
            continue
        xs = [pos[0] for _, pos in s["pos_frames_with_pos_t"] if pos is not None]
        if xs:
            avg_x_by_player[player_id] = sum(xs) / len(xs)

    sorted_players = sorted(avg_x_by_player.items(), key=lambda x: x[1])
    for rank, (player_id, avg_x) in enumerate(sorted_players):
        pct = (rank / max(len(sorted_players) - 1, 1)) * 100
        stats[player_id]["position_rank_pct"] = round(pct, 2)
        if pct >= 66:
            stats[player_id]["position_role"] = "advanced"
        elif pct <= 33:
            stats[player_id]["position_role"] = "deep"
        else:
            stats[player_id]["position_role"] = "mid"

    # Per-frame role counts based on frame-wise rank
    if tracks.get("players"):
        for frame_num, player_track in enumerate(tracks["players"]):
            if not player_track:
                continue
            xs = []
            for pid, track in player_track.items():
                pos_t = track.get("position_transformed")
                if pos_t is None:
                    continue
                xs.append((pid, pos_t[0]))
            if len(xs) < 2:
                continue
            xs.sort(key=lambda x: x[1])
            for idx, (pid, _) in enumerate(xs):
                pct = (idx / max(len(xs) - 1, 1)) * 100
                role = "mid"
                if pct >= 66:
                    role = "advanced"
                elif pct <= 33:
                    role = "deep"
                if pid in stats:
                    stats[pid]["role_counts"][role] += 1

    for player_id, s in stats.items():
        distance = max(s["distance_samples"]) if s["distance_samples"] else 0.0
        avg_speed = safe_mean(s["speed_samples"])
        max_speed = max(s["speed_samples"]) if s["speed_samples"] else 0.0
        possession_pct_present = (
            (s["possession_frames"] / s["frames_present"]) * 100
            if s["frames_present"] > 0
            else 0.0
        )
        possession_pct_total = (
            (s["possession_frames"] / total_possession_frames) * 100
            if total_possession_frames > 0
            else 0.0
        )

        def build_windows(frame_idxs):
            windows = []
            if not frame_idxs:
                return windows
            sorted_frames = sorted(frame_idxs)
            start = sorted_frames[0]
            prev = start
            for f in sorted_frames[1:]:
                if f == prev + 1:
                    prev = f
                    continue
                windows.append(
                    {"t0": round(start / fps, 2), "t1": round(prev / fps, 2)}
                )
                start = f
                prev = f
            windows.append(
                {"t0": round(start / fps, 2), "t1": round(prev / fps, 2)}
            )
            return windows

        possession_windows = build_windows(s["possession_frame_idxs"])
        presence_windows = build_windows(s["presence_frame_idxs"])

        # Top speed moment
        top_speed_t = None
        if s["speed_samples_with_frame"]:
            top_speed, top_frame = max(
                s["speed_samples_with_frame"], key=lambda x: x[0]
            )
            top_speed_t = round(top_frame / fps, 2)
        else:
            # Fallback: compute pixel displacement speed from positions
            if len(s["pos_frames_with_pos"]) >= 2:
                s["pos_frames_with_pos"].sort(key=lambda x: x[0])
                max_disp = 0.0
                max_frame = None
                prev_f, prev_pos = s["pos_frames_with_pos"][0]
                for f, pos in s["pos_frames_with_pos"][1:]:
                    if prev_pos is None or pos is None:
                        prev_f, prev_pos = f, pos
                        continue
                    dt = (f - prev_f) / fps
                    if dt <= 0:
                        prev_f, prev_pos = f, pos
                        continue
                    dx = pos[0] - prev_pos[0]
                    dy = pos[1] - prev_pos[1]
                    disp = (dx * dx + dy * dy) ** 0.5 / dt
                    if disp > max_disp:
                        max_disp = disp
                        max_frame = f
                    prev_f, prev_pos = f, pos
                if max_frame is not None:
                    top_speed_t = round(max_frame / fps, 2)

        # Choose a timestamp for phrasing
        if possession_windows:
            ts_for_phrase = possession_windows[0]["t0"]
        elif presence_windows:
            ts_for_phrase = presence_windows[0]["t0"]
        else:
            ts_for_phrase = top_speed_t

        presence_total_s = 0.0
        for w in presence_windows:
            try:
                presence_total_s += float(w["t1"]) - float(w["t0"])
            except Exception:
                pass

        player_stats = {
            "player_id": int(player_id),
            "team": int(s["team"]) if s.get("team") is not None else None,
            "frames_present": s["frames_present"],
            "possession_frames": s["possession_frames"],
            "possession_pct_of_present": round(possession_pct_present, 2),
            "possession_pct_of_total": round(possession_pct_total, 2),
            "distance_m": round(distance, 2),
            "avg_speed_kmh": round(avg_speed, 2),
            "max_speed_kmh": round(max_speed, 2),
            "top_speed_time_s": top_speed_t,
            "possession_windows_s": possession_windows[:10],
            "presence_windows_s": presence_windows[:10],
            "presence_total_s": round(presence_total_s, 2),
            "position_rank_pct": s.get("position_rank_pct"),
            "position_role": s.get("position_role")
        }
        frames_present = max(s["frames_present"], 1)
        ball_control_pct = round((s["possession_frames"] / frames_present) * 100, 2)
        adv = s["role_counts"]["advanced"]
        mid = s["role_counts"]["mid"]
        deep = s["role_counts"]["deep"]
        field_control_adv_pct = round((adv / frames_present) * 100, 2)
        field_control_mid_pct = round((mid / frames_present) * 100, 2)
        field_control_deep_pct = round((deep / frames_present) * 100, 2)
        movement_control_pct = round((len(s["movement_frames"]) / frames_present) * 100, 2)
        pressure_control_pct = round((deep / frames_present) * 100, 2)

        player_stats["ball_control_pct"] = ball_control_pct
        player_stats["field_control_adv_pct"] = field_control_adv_pct
        player_stats["field_control_mid_pct"] = field_control_mid_pct
        player_stats["field_control_deep_pct"] = field_control_deep_pct
        player_stats["movement_control_pct"] = movement_control_pct
        player_stats["pressure_control_pct"] = pressure_control_pct
        if args.min_presence_sec and presence_total_s <= args.min_presence_sec:
            continue
        rule_feedback = build_feedback(player_stats)
        player_stats["feedback"] = rule_feedback
        player_stats["formatted_feedback"] = (
            f"I noticed {', '.join(rule_feedback[:1])} "
            f"from {ts_for_phrase if ts_for_phrase is not None else 'N/A'} second video "
            f"and this is my feedback: {' '.join(rule_feedback)} "
            f"(control%: ball={ball_control_pct}, field_adv={field_control_adv_pct}, "
            f"field_mid={field_control_mid_pct}, field_deep={field_control_deep_pct}, "
            f"movement={movement_control_pct}, pressure={pressure_control_pct})"
        )
        if args.llm:
            if args.llm_limit and llm_calls >= args.llm_limit:
                output.append(player_stats)
                continue
            llm_payload = {
                "player_id": player_stats["player_id"],
                "team": player_stats["team"],
                "avg_speed_kmh": player_stats["avg_speed_kmh"],
                "max_speed_kmh": player_stats["max_speed_kmh"],
                "distance_m": player_stats["distance_m"],
                "position_rank_pct": player_stats["position_rank_pct"],
                "position_role": player_stats["position_role"],
                "top_speed_time_s": player_stats["top_speed_time_s"],
                "possession_windows_s": player_stats["possession_windows_s"],
                "presence_windows_s": player_stats["presence_windows_s"],
                "presence_total_s": player_stats["presence_total_s"],
                "ball_control_pct": player_stats["ball_control_pct"],
                "field_control_adv_pct": player_stats["field_control_adv_pct"],
                "field_control_mid_pct": player_stats["field_control_mid_pct"],
                "field_control_deep_pct": player_stats["field_control_deep_pct"],
                "movement_control_pct": player_stats["movement_control_pct"],
                "pressure_control_pct": player_stats["pressure_control_pct"],
                "evidence_note": "Use only timestamps and metrics above. Do not extrapolate or add drills."
            }
            llm = openrouter_rewrite(
                args.llm_model,
                api_key,
                llm_payload,
                debug=args.llm_debug,
                timeout_s=args.llm_timeout,
            )
            player_stats["llm_feedback"] = llm
            llm_calls += 1
        output.append(player_stats)

    output.sort(key=lambda x: (-x["possession_frames"], -x["distance_m"]))

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(f"Wrote {len(output)} player feedback entries to {args.out}")


if __name__ == "__main__":
    main()
