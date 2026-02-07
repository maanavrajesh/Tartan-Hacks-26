# VisionXI Insights Engine (Person C)

Node service that consumes `vision.window` events and emits:

- `event.detected`
- `stats.live` every 5s
- `stats.final` on `session.ended`
- `insight.generated` on `click.request`

## Quick start

1. Install deps:
   - `cd insights && npm install`
2. Start service:
   - `BUS_URL=ws://localhost:8080/ws npm start`
3. Optional HTTP:
   - `POST /click` with `{ "sessionId":"S123", "ts":73.2, "mode":"player" }`

## Env

- `BUS_URL` WebSocket bus URL
- `DB_PATH` SQLite file (default `insights/visionxi.db`)
- `HTTP_PORT` (default 4000)

## Ingest JSONL for testing

`node insights/index.js --ingest insights/sample_events.jsonl`

