"""Per-player feedback generation from tracking data.

Aggregates per-player stats from the tracks dict, generates rule-based
coaching tips, and optionally calls OpenRouter for LLM-powered insights.
"""

import json
import os
import sys

import requests as http_requests


def safe_mean(values):
    if not values:
        return 0.0
    return float(sum(values) / len(values))


def build_feedback(stats):
    """Generate rule-based coaching feedback from player stats."""
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


def openrouter_rewrite(model, api_key, payload, timeout_s=30):
    """Call OpenRouter LLM to generate rich coaching insights."""
    if not api_key:
        return None
    url = "https://openrouter.ai/api/v1/chat/completions"
    system = (
        "You are a UEFA-licensed soccer coach and performance analyst.\n"
        "You analyze ONE player using ONLY the provided evidence window.\n"
        "You reason about patterns that appear within this window only.\n"
        "\n"
        "Rules:\n"
        "- Integrate numerical metrics directly into your analysis\n"
        "- Use advanced coaching terminology when supported by evidence\n"
        "  (e.g., cover shadow, half-space occupation, third-man run, rest defense,\n"
        "   counter-press, weak-side positioning, line-breaking support, tempo control).\n"
        "- Tie each insight to specific metrics or time windows\n"
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
        '  "quantitative_summary": {\n'
        '    "ball_control": "...",\n'
        '    "movement": "...",\n'
        '    "pressure_context": "..."\n'
        "  },\n"
        '  "insights": [\n'
        "    {\n"
        '      "title": "...",\n'
        '      "what_happened": "...",\n'
        '      "why_it_matters": "...",\n'
        '      "how_to_improve": ["...", "...", "..."],\n'
        '      "technical_terms_used": ["...", "..."],\n'
        '      "evidence_used": {"...": "..."}\n'
        "    }\n"
        "  ],\n"
        '  "action_plan": {\n'
        '    "focus": "...",\n'
        '    "next_step": "...",\n'
        '    "success_indicator": "..."\n'
        "  }\n"
        "}\n"
        "Use 2-3 insights max. Embed control percentages in quantitative_summary and evidence_used.\n"
        "If you use advanced terms, explicitly justify them using evidence metrics."
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
        resp = http_requests.post(url, json=body, headers=headers, timeout=timeout_s)
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        return json.loads(content)
    except Exception as e:
        print(f"LLM error: {e}", file=sys.stderr)
        return None


def _build_windows(frame_idxs, fps):
    """Convert a list of frame indices into time windows [{t0, t1}, ...]."""
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
        windows.append({"t0": round(start / fps, 2), "t1": round(prev / fps, 2)})
        start = f
        prev = f
    windows.append({"t0": round(start / fps, 2), "t1": round(prev / fps, 2)})
    return windows


def generate_player_feedback(tracks, fps, video_id, output_folder="output_videos",
                              min_presence_sec=10.0, use_llm=True,
                              llm_model="openai/gpt-4o-mini", llm_timeout=30):
    """Generate per-player feedback from tracks and save as JSON.

    Args:
        tracks: dict with keys "players", "ball", "referees" from tracker pipeline
        fps: video frames per second
        video_id: unique identifier for this video
        output_folder: where to save the JSON file
        min_presence_sec: skip players present less than this
        use_llm: whether to call OpenRouter for LLM insights
        llm_model: model ID for OpenRouter
        llm_timeout: LLM request timeout in seconds

    Returns:
        list of player feedback dicts (also saved to disk)
    """
    api_key = os.getenv("OPENROUTER_API_KEY") if use_llm else None

    # Aggregate per-player stats
    raw_stats = {}
    total_possession_frames = 0

    for frame_num, player_track in enumerate(tracks["players"]):
        for player_id, track in player_track.items():
            if player_id not in raw_stats:
                raw_stats[player_id] = {
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
                    "movement_frames": set(),
                }
            s = raw_stats[player_id]
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

    # Compute relative position ranks using transformed X
    avg_x_by_player = {}
    for player_id, s in raw_stats.items():
        xs = [pos[0] for _, pos in s["pos_frames_with_pos_t"] if pos is not None]
        if xs:
            avg_x_by_player[player_id] = sum(xs) / len(xs)

    sorted_players = sorted(avg_x_by_player.items(), key=lambda x: x[1])
    for rank, (player_id, _) in enumerate(sorted_players):
        pct = (rank / max(len(sorted_players) - 1, 1)) * 100
        raw_stats[player_id]["position_rank_pct"] = round(pct, 2)
        if pct >= 66:
            raw_stats[player_id]["position_role"] = "advanced"
        elif pct <= 33:
            raw_stats[player_id]["position_role"] = "deep"
        else:
            raw_stats[player_id]["position_role"] = "mid"

    # Per-frame role counts
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
            if pid in raw_stats:
                raw_stats[pid]["role_counts"][role] += 1

    # Build output
    output = []

    for player_id, s in raw_stats.items():
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

        possession_windows = _build_windows(s["possession_frame_idxs"], fps)
        presence_windows = _build_windows(s["presence_frame_idxs"], fps)

        # Top speed moment
        top_speed_t = None
        if s["speed_samples_with_frame"]:
            _, top_frame = max(s["speed_samples_with_frame"], key=lambda x: x[0])
            top_speed_t = round(top_frame / fps, 2)

        presence_total_s = 0.0
        for w in presence_windows:
            try:
                presence_total_s += float(w["t1"]) - float(w["t0"])
            except Exception:
                pass

        if min_presence_sec and presence_total_s <= min_presence_sec:
            continue

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
            "position_role": s.get("position_role"),
            "ball_control_pct": ball_control_pct,
            "field_control_adv_pct": field_control_adv_pct,
            "field_control_mid_pct": field_control_mid_pct,
            "field_control_deep_pct": field_control_deep_pct,
            "movement_control_pct": movement_control_pct,
            "pressure_control_pct": pressure_control_pct,
        }

        # Rule-based feedback
        rule_feedback = build_feedback(player_stats)
        player_stats["feedback"] = rule_feedback

        # LLM feedback
        if api_key:
            llm_payload = {
                "player_id": player_stats["player_id"],
                "team": player_stats["team"],
                "avg_speed_kmh": player_stats["avg_speed_kmh"],
                "max_speed_kmh": player_stats["max_speed_kmh"],
                "distance_m": player_stats["distance_m"],
                "possession_pct_of_present": player_stats["possession_pct_of_present"],
                "possession_pct_of_total": player_stats["possession_pct_of_total"],
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
                "evidence_note": "Use only timestamps and metrics above. Do not extrapolate or add drills.",
            }
            llm = openrouter_rewrite(llm_model, api_key, llm_payload, timeout_s=llm_timeout)
            player_stats["llm_feedback"] = llm
        else:
            player_stats["llm_feedback"] = None

        output.append(player_stats)

    output.sort(key=lambda x: (-x["possession_frames"], -x["distance_m"]))

    # Save to disk
    os.makedirs(output_folder, exist_ok=True)
    out_path = os.path.join(output_folder, f"{video_id}_feedback.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(f"Wrote {len(output)} player feedback entries to {out_path}")
    return output
