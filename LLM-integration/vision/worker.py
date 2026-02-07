#!/usr/bin/env python3
import argparse
import asyncio
import base64
import json
import os
import sys
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional

try:
    import cv2  # type: ignore
except Exception:
    cv2 = None

try:
    import websockets  # type: ignore
except Exception:
    websockets = None

try:
    import requests  # type: ignore
except Exception:
    requests = None


DEFAULT_OVERSHOOT_URL = "https://api.overshoot.ai/v1/vision/window"


@dataclass
class OvershootConfig:
    api_key: Optional[str]
    url: str
    mock: bool


def build_prompt() -> str:
    return (
        "You are a soccer video understanding model. "
        "Return STRICT JSON only with keys: "
        "event_type (none|pass|dribble|shot|tackle|turnover|press|clearance), "
        "pressure (0-5 int), confidence (0-1 float), who (player|team|unknown), "
        "risk_flag (none|fatigue|overuse|awkward_landing|cutting_risk), "
        "coaching_note (max 12 words), evidence (max 1 sentence)."
    )


def make_mock_json(t: float) -> Dict[str, Any]:
    # Deterministic mock based on timestamp to keep demos consistent
    event_cycle = ["none", "pass", "dribble", "turnover", "press", "shot", "tackle"]
    idx = int(t) % len(event_cycle)
    event_type = event_cycle[idx]
    pressure = min(5, (int(t) % 6))
    confidence = 0.7 if event_type != "none" else 0.4
    risk_flag = "fatigue" if int(t) % 13 == 0 else "none"
    return {
        "event_type": event_type,
        "pressure": pressure,
        "confidence": confidence,
        "who": "player" if idx % 2 == 0 else "team",
        "risk_flag": risk_flag,
        "coaching_note": "Scan earlier, avoid pressure",
        "evidence": "Player received under pressure and forced action.",
    }


def encode_frame_jpeg_b64(frame) -> str:
    ok, buf = cv2.imencode(".jpg", frame)
    if not ok:
        return ""
    return base64.b64encode(buf.tobytes()).decode("ascii")


def call_overshoot(cfg: OvershootConfig, frame, t0: float, t1: float) -> Dict[str, Any]:
    if cfg.mock or not cfg.api_key or requests is None or cv2 is None:
        return make_mock_json(t1)

    image_b64 = encode_frame_jpeg_b64(frame)
    if not image_b64:
        return make_mock_json(t1)

    payload = {
        "prompt": build_prompt(),
        "image_b64": image_b64,
        "t0": t0,
        "t1": t1,
    }
    headers = {"Authorization": f"Bearer {cfg.api_key}"}
    try:
        resp = requests.post(cfg.url, json=payload, headers=headers, timeout=20)
        resp.raise_for_status()
        text = resp.text.strip()
        return json.loads(text)
    except Exception:
        return make_mock_json(t1)


async def publish_ws(ws_url: str, message: Dict[str, Any]) -> None:
    if websockets is None:
        return
    try:
        async with websockets.connect(ws_url) as ws:
            await ws.send(json.dumps(message))
    except Exception:
        return


def write_jsonl(path: str, message: Dict[str, Any]) -> None:
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(message) + "\n")


def build_vision_window(
    session_id: str,
    t0: float,
    t1: float,
    json_obj: Optional[Dict[str, Any]],
    raw_text: Optional[str],
) -> Dict[str, Any]:
    return {
        "type": "vision.window",
        "sessionId": session_id,
        "ts": t1,
        "payload": {
            "t0": t0,
            "t1": t1,
            "json": json_obj,
            "rawText": raw_text,
        },
    }


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="VisionXI vision worker")
    p.add_argument("--video", help="Path to MP4")
    p.add_argument("--session", required=True, help="Session ID")
    p.add_argument("--bus", help="WebSocket bus URL, e.g. ws://localhost:8080/ws")
    p.add_argument("--rate", type=float, default=1.0, help="Windows per second")
    p.add_argument("--out", default="vision/out.jsonl", help="JSONL output path")
    p.add_argument("--replay", help="Replay JSONL file instead of model calls")
    p.add_argument("--mock", action="store_true", help="Force mock mode")
    p.add_argument("--overshoot-url", default=DEFAULT_OVERSHOOT_URL)
    p.add_argument("--no-bus", action="store_true", help="Disable bus publish")
    return p.parse_args()


def replay_mode(args: argparse.Namespace) -> None:
    if not args.replay:
        return
    with open(args.replay, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except Exception:
                continue
            if args.bus and not args.no_bus:
                asyncio.run(publish_ws(args.bus, msg))
            time.sleep(1.0 / max(args.rate, 0.1))


def file_mode(args: argparse.Namespace) -> None:
    if cv2 is None:
        raise RuntimeError("opencv-python is required for file mode")
    if not args.video:
        raise RuntimeError("--video is required unless --replay is used")

    cap = cv2.VideoCapture(args.video)
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open video: {args.video}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_idx = 0
    next_emit = 0.0
    interval = 1.0 / max(args.rate, 0.1)

    cfg = OvershootConfig(
        api_key=os.getenv("OVERSHOOT_API_KEY"),
        url=args.overshoot_url,
        mock=args.mock,
    )

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        t = frame_idx / fps
        frame_idx += 1

        if t + 1e-6 < next_emit:
            continue

        t0 = max(0.0, t - interval)
        t1 = t

        json_obj = call_overshoot(cfg, frame, t0, t1)
        raw_text = None
        if not isinstance(json_obj, dict):
            raw_text = str(json_obj)
            json_obj = None

        msg = build_vision_window(args.session, t0, t1, json_obj, raw_text)
        write_jsonl(args.out, msg)

        if args.bus and not args.no_bus:
            asyncio.run(publish_ws(args.bus, msg))

        next_emit = t + interval

    cap.release()


def main() -> None:
    args = parse_args()
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    if args.replay:
        replay_mode(args)
    else:
        file_mode(args)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"error: {e}", file=sys.stderr)
        sys.exit(1)

