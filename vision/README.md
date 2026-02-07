# VisionXI Vision Worker (Person B)

Python worker that emits `vision.window` events from MP4 files or replays JSONL.

## Quick start

1. Install deps:
   - `pip install opencv-python websockets requests`
2. Run file mode (mocked if no Overshoot key):
   - `python vision/worker.py --video input_videos/sample.mp4 --session S123 --bus ws://localhost:8080/ws`
3. Replay mode:
   - `python vision/worker.py --replay vision/out.jsonl --session S123 --bus ws://localhost:8080/ws`

## Environment

- `OVERSHOOT_API_KEY` (optional)
- `OVERSHOOT_URL` (optional, default in code)

If no API key is set or `--mock` is used, the worker generates deterministic mock JSON.

## Output

Each emitted event is also appended to `vision/out.jsonl` unless `--out` is set.

