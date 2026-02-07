const fs = require("fs");
const path = require("path");
const express = require("express");
const WebSocket = require("ws");
const Database = require("better-sqlite3");
const { getDrill } = require("./drills");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "visionxi.db");
const BUS_URL = process.env.BUS_URL || "ws://localhost:8080/ws";
const HTTP_PORT = Number(process.env.HTTP_PORT || 4000);

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  sessionId TEXT PRIMARY KEY,
  startedAt REAL,
  mode TEXT,
  playerLabel TEXT
);
CREATE TABLE IF NOT EXISTS windows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId TEXT,
  t0 REAL,
  t1 REAL,
  event_type TEXT,
  pressure REAL,
  confidence REAL,
  risk_flag TEXT,
  note TEXT,
  evidence TEXT
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId TEXT,
  ts REAL,
  event TEXT,
  severity REAL,
  label TEXT
);
CREATE TABLE IF NOT EXISTS insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId TEXT,
  ts REAL,
  title TEXT,
  json TEXT
);
CREATE TABLE IF NOT EXISTS stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId TEXT,
  ts REAL,
  kind TEXT,
  json TEXT
);
`);

const liveStats = new Map();
const activeSessions = new Set();

function getLive(sessionId) {
  if (!liveStats.has(sessionId)) {
    liveStats.set(sessionId, {
      counts: {},
      pressureSum: 0,
      pressureCount: 0,
      riskCount: 0
    });
  }
  return liveStats.get(sessionId);
}

function updateStatsFromWindow(sessionId, win) {
  const live = getLive(sessionId);
  const et = win.event_type || "none";
  live.counts[et] = (live.counts[et] || 0) + 1;
  if (typeof win.pressure === "number") {
    live.pressureSum += win.pressure;
    live.pressureCount += 1;
  }
  if (win.risk_flag && win.risk_flag !== "none") {
    live.riskCount += 1;
  }
}

function buildStatsPayload(sessionId) {
  const live = getLive(sessionId);
  const counts = live.counts;
  let topEvent = "none";
  let topCount = 0;
  Object.keys(counts).forEach((k) => {
    if (counts[k] > topCount) {
      topCount = counts[k];
      topEvent = k;
    }
  });
  const avgPressure = live.pressureCount
    ? live.pressureSum / live.pressureCount
    : 0;
  return {
    counts,
    avgPressure,
    topEvent,
    riskCount: live.riskCount
  };
}

function saveStat(sessionId, ts, kind, payload) {
  const stmt = db.prepare(
    "INSERT INTO stats (sessionId, ts, kind, json) VALUES (?, ?, ?, ?)"
  );
  stmt.run(sessionId, ts, kind, JSON.stringify(payload));
}

function saveEvent(sessionId, ts, event, severity, label) {
  const stmt = db.prepare(
    "INSERT INTO events (sessionId, ts, event, severity, label) VALUES (?, ?, ?, ?, ?)"
  );
  stmt.run(sessionId, ts, event, severity, label);
}

let ws = null;

function sendToBus(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function connectBus() {
  ws = new WebSocket(BUS_URL);
  ws.on("open", () => {
    console.log("bus connected");
  });
  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleEvent(msg);
    } catch (e) {
      // ignore
    }
  });
  ws.on("close", () => {
    console.log("bus disconnected, retrying");
    setTimeout(connectBus, 2000);
  });
  ws.on("error", () => {
    // ignore; close event will handle reconnect
  });
}

function handleSessionStarted(msg) {
  const { sessionId, ts, payload } = msg;
  db.prepare(
    "INSERT OR REPLACE INTO sessions (sessionId, startedAt, mode, playerLabel) VALUES (?, ?, ?, ?)"
  ).run(sessionId, ts, payload?.mode || "team", payload?.playerLabel || null);
  activeSessions.add(sessionId);
}

function handleVisionWindow(msg) {
  const { sessionId, ts, payload } = msg;
  if (!payload) return;
  const json = payload.json || {};
  const win = {
    sessionId,
    t0: payload.t0,
    t1: payload.t1,
    event_type: json.event_type || "none",
    pressure: typeof json.pressure === "number" ? json.pressure : null,
    confidence: typeof json.confidence === "number" ? json.confidence : 0,
    risk_flag: json.risk_flag || "none",
    note: json.coaching_note || null,
    evidence: json.evidence || null
  };
  db.prepare(
    "INSERT INTO windows (sessionId, t0, t1, event_type, pressure, confidence, risk_flag, note, evidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    win.sessionId,
    win.t0,
    win.t1,
    win.event_type,
    win.pressure,
    win.confidence,
    win.risk_flag,
    win.note,
    win.evidence
  );

  updateStatsFromWindow(sessionId, win);

  if (win.event_type !== "none" && win.confidence > 0.6) {
    const ev = {
      type: "event.detected",
      sessionId,
      ts,
      payload: {
        event: win.event_type,
        severity: win.confidence,
        label: win.event_type
      }
    };
    sendToBus(ev);
    saveEvent(sessionId, ts, win.event_type, win.confidence, win.event_type);
  }
  if (win.risk_flag && win.risk_flag !== "none") {
    const ev = {
      type: "event.detected",
      sessionId,
      ts,
      payload: {
        event: "risk",
        severity: 0.7,
        label: win.risk_flag
      }
    };
    sendToBus(ev);
    saveEvent(sessionId, ts, "risk", 0.7, win.risk_flag);
  }
}

function buildInsight(sessionId, ts, mode, question) {
  const rows = db
    .prepare(
      "SELECT * FROM windows WHERE sessionId = ? AND t1 >= ? AND t1 <= ?"
    )
    .all(sessionId, ts - 2, ts + 2);

  let dominant = "none";
  const counts = {};
  let riskFlag = "none";
  rows.forEach((r) => {
    counts[r.event_type] = (counts[r.event_type] || 0) + 1;
    if (r.risk_flag && r.risk_flag !== "none") riskFlag = r.risk_flag;
  });
  Object.keys(counts).forEach((k) => {
    if (counts[k] > (counts[dominant] || 0)) dominant = k;
  });

  const drill = getDrill(dominant);
  const pronoun = mode === "player" ? "You" : "Your team";
  const title =
    dominant === "none"
      ? "No Clear Event"
      : `${dominant[0].toUpperCase()}${dominant.slice(1)} Moment`;

  const insight = {
    title,
    what_happened:
      dominant === "none"
        ? `${pronoun} had a neutral phase with no clear event.`
        : `${pronoun} had a ${dominant} under pressure.`,
    why_it_matters:
      dominant === "turnover"
        ? "Turnovers here trigger dangerous transitions."
        : "This moment affects decision speed and team shape.",
    how_to_improve: [
      "Scan earlier before the ball arrives.",
      "Use first touch away from pressure.",
      "Choose the simple outlet if options are tight."
    ],
    injury_note:
      riskFlag !== "none"
        ? "This pattern may increase risk; reduce load and focus on clean mechanics."
        : null,
    drill,
    evidence: {
      windows: rows.map((r) => Math.round(r.t1)),
      events: []
    },
    question: question || null
  };

  return insight;
}

function handleClick(msg) {
  const { sessionId, ts, payload } = msg;
  const mode = payload?.mode || "team";
  const question = payload?.question || null;
  const insight = buildInsight(sessionId, ts, mode, question);
  const out = {
    type: "insight.generated",
    sessionId,
    ts,
    payload: insight
  };
  db.prepare(
    "INSERT INTO insights (sessionId, ts, title, json) VALUES (?, ?, ?, ?)"
  ).run(sessionId, ts, insight.title, JSON.stringify(insight));
  sendToBus(out);
  return out;
}

function handleSessionEnded(msg) {
  const { sessionId, ts } = msg;
  const payload = buildStatsPayload(sessionId);
  const out = {
    type: "stats.final",
    sessionId,
    ts,
    payload
  };
  saveStat(sessionId, ts, "final", payload);
  sendToBus(out);
  activeSessions.delete(sessionId);
}

function handleEvent(msg) {
  switch (msg.type) {
    case "session.started":
      handleSessionStarted(msg);
      break;
    case "vision.window":
      handleVisionWindow(msg);
      break;
    case "click.request":
      handleClick(msg);
      break;
    case "session.ended":
      handleSessionEnded(msg);
      break;
    default:
      break;
  }
}

function startStatsLoop() {
  setInterval(() => {
    const ts = Date.now() / 1000;
    activeSessions.forEach((sessionId) => {
      const payload = buildStatsPayload(sessionId);
      const out = {
        type: "stats.live",
        sessionId,
        ts,
        payload
      };
      saveStat(sessionId, ts, "live", payload);
      sendToBus(out);
    });
  }, 5000);
}

function startHttp() {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/sessions", (req, res) => {
    const rows = db.prepare("SELECT * FROM sessions").all();
    res.json(rows);
  });

  app.get("/sessions/:id/report", (req, res) => {
    const sessionId = req.params.id;
    const stats = db
      .prepare("SELECT * FROM stats WHERE sessionId = ? ORDER BY ts DESC")
      .all(sessionId);
    const insights = db
      .prepare("SELECT * FROM insights WHERE sessionId = ? ORDER BY ts DESC")
      .all(sessionId);
    res.json({ stats, insights });
  });

  app.post("/click", (req, res) => {
    const { sessionId, ts, mode, question } = req.body || {};
    if (!sessionId || typeof ts !== "number") {
      res.status(400).json({ error: "sessionId and ts required" });
      return;
    }
    const out = handleClick({
      type: "click.request",
      sessionId,
      ts,
      payload: { mode, question, source: "http" }
    });
    res.json(out);
  });

  app.listen(HTTP_PORT, () => {
    console.log(`http listening on ${HTTP_PORT}`);
  });
}

function ingestJsonl(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      handleEvent(msg);
    } catch (e) {
      // ignore
    }
  }
  console.log(`ingested ${lines.length} events`);
}

function main() {
  const args = process.argv.slice(2);
  const ingestIdx = args.indexOf("--ingest");
  if (ingestIdx >= 0) {
    const filePath = args[ingestIdx + 1];
    if (!filePath) {
      console.error("missing --ingest path");
      process.exit(1);
    }
    ingestJsonl(filePath);
    return;
  }

  connectBus();
  startStatsLoop();
  startHttp();
}

main();
