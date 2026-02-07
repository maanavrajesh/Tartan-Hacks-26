# Vision XI

Vision XI turns soccer match footage into tactical intelligence. Upload a match, and the platform produces team analytics, player dashboards, and AI coaching insights grounded in tracked movement, possession, and spatial context.

## What It Does
- Upload match film and run a full analysis pipeline.
- Track players, ball, and referees with YOLO + ByteTrack.
- Generate team analytics (movement, ball control, pressure).
- Generate player dashboards with key moments and coaching notes.
- Produce AI insights through OpenRouter for coach-grade feedback.

## Tech Stack
- Frontend: Next.js 14, React, TypeScript, Tailwind CSS
- Backend: Python, Flask, Flask-CORS
- CV/ML: Ultralytics YOLOv8, Supervision (ByteTrack), OpenCV, NumPy, Pandas, scikit-learn
- LLM: OpenRouter (default model: `openai/gpt-4o-mini`)
- Video: FFmpeg

## Project Structure
```
backend/           Flask API + video analysis pipeline
frontend-new/      Vision XI Next.js UI
```

## Setup

### Backend
1. Install Python dependencies:
```powershell
cd C:\Users\sadhi\OneDrive\Documents\GitHub\Tartan-Hacks-26
pip install -r backend\requirements.txt
```

2. (Optional) Enable LLM insights:
```powershell
$env:OPENROUTER_API_KEY="your_key_here"
$env:OPENROUTER_MODEL="openai/gpt-4o-mini"
```

3. Run the backend:
```powershell
python backend\app.py
```

### Frontend
```powershell
cd C:\Users\sadhi\OneDrive\Documents\GitHub\Tartan-Hacks-26\frontend-new
npm install
npm run dev
```

Open the URL printed by Next.js (usually `http://localhost:3000` or `http://localhost:3001`).

## Usage
1. Go to `/upload`.
2. Upload a match video.
3. Wait for processing to complete.
4. Review:
   - Viewer: `/viewer/<videoId>`
   - Report: `/report/<videoId>`
   - Player Dashboard: `/player/<videoId>?player=<playerId>`

## API Endpoints
- `POST /api/upload` -> `{ videoId }`
- `POST /api/process/<videoId>` -> start analysis
- `GET /api/status/<videoId>` -> status + progress
- `GET /api/video/<videoId>` -> processed video
- `GET /api/feedback/<videoId>` -> per-player feedback
- `GET /api/artifacts/<videoId>` -> UI artifacts (events, metrics, insights, tracks)

## Notes
- Processing time depends on video length and machine performance.
- Outputs are stored under `backend/output_videos/`.
- Jobs are in-memory (restart backend => re-upload).

## Demo Flow
- Use the upload page to create a new analysis.
- Use the viewer and report to validate event timing, risk spikes, and player dashboards.

