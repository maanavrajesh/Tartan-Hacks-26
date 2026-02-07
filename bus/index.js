const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const PORT = Number(process.env.PORT || 8080);
const MAX_BUFFER = Number(process.env.MAX_BUFFER || 2000);

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: "/ws" });

const buffer = [];

function addToBuffer(msg) {
  buffer.push(msg);
  if (buffer.length > MAX_BUFFER) buffer.shift();
}

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (e) {
      return;
    }
    addToBuffer(msg);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(msg));
      }
    });
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true, clients: wss.clients.size });
});

app.get("/replay", (req, res) => {
  res.json({ count: buffer.length, events: buffer });
});

server.listen(PORT, () => {
  console.log(`event bus listening on ${PORT}`);
});

