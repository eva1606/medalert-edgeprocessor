// src/uiServer.js — Node built-in only + connect to EdgeProcessor

const http = require("http");
const fs = require("fs");
const path = require("path");

// Connect to the real EdgeProcessor (uiServer.js is inside src/)
const EdgeProcessor = require("./edgeProcessor");
const edge = new EdgeProcessor();

const PORT = 6001;

// UI cache (for quick display, not persistence)
const uiCache = {
  online: true,
  patients: new Map(), // patientId -> { lastMeasurements: {TYPE: measurement}, alerts: [] }
};

function ensurePatient(patientId) {
  if (!uiCache.patients.has(patientId)) {
    uiCache.patients.set(patientId, { lastMeasurements: {}, alerts: [] });
  }
  return uiCache.patients.get(patientId);
}

function sendJson(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function nowIso() {
  return new Date().toISOString();
}

function makeMeasurement({ patientId, measurementType, value, signalQuality }) {
  return {
    measurementId: `M-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    patientId,
    measurementType,
    value: Number(value),
    timestamp: nowIso(),
    signalQuality: signalQuality === undefined ? 1.0 : Number(signalQuality),
  };
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);

  // ---------------- API ----------------

  // GET /status?patientId=p1
  if (req.method === "GET" && urlObj.pathname === "/status") {
    const patientId = urlObj.searchParams.get("patientId") || "p1";
    const p = ensurePatient(patientId);

    return sendJson(res, 200, {
      online: uiCache.online,
      patientId,
      measurements: p.lastMeasurements,
      alerts: p.alerts.slice(0, 20),
    });
  }

  // POST /online  { online: true/false }
  if (req.method === "POST" && urlObj.pathname === "/online") {
    try {
      const body = await readBody(req);
      uiCache.online = !!body.online;
      edge.setOnline(uiCache.online);
      return sendJson(res, 200, { ok: true, online: uiCache.online });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: e.message });
    }
  }

  // POST /ingest  { patientId, measurementType, value, signalQuality }
  if (req.method === "POST" && urlObj.pathname === "/ingest") {
    try {
      const body = await readBody(req);
      const { patientId, measurementType, value, signalQuality } = body;

      if (!patientId || !measurementType) {
        return sendJson(res, 400, { ok: false, error: "missing patientId or measurementType" });
      }

      const measurement = makeMeasurement({ patientId, measurementType, value, signalQuality });
      const result = edge.ingestMeasurement(measurement);

      // update UI cache for quick status display
      const p = ensurePatient(patientId);
      p.lastMeasurements[measurementType] = measurement;

      if (result?.status === "alert" && result.alert) {
        p.alerts.unshift(result.alert);
        p.alerts = p.alerts.slice(0, 50);
      }

      return sendJson(res, 200, { ok: true, measurement, result });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: e.message });
    }
  }

  // POST /flush
  if (req.method === "POST" && urlObj.pathname === "/flush") {
    const out = edge.flushCachedData();
    return sendJson(res, 200, { ok: true, out });
  }

  // ✅ GET /history?patientId=p1
  // Loads persisted history from HistoryRepository (measurements.json + alerts.json)
  if (req.method === "GET" && urlObj.pathname === "/history") {
    try {
      const patientId = urlObj.searchParams.get("patientId"); // optional

      // methods exist if you created src/repositories/HistoryRepository.js from earlier
      const measurements = edge.historyRepository.getRecentMeasurements(50);
      const alerts = edge.historyRepository.getRecentAlerts(50);

      const mFiltered = patientId ? measurements.filter(x => x.patientId === patientId) : measurements;
      const aFiltered = patientId ? alerts.filter(x => x.patientId === patientId) : alerts;

      return sendJson(res, 200, { ok: true, measurements: mFiltered, alerts: aFiltered });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // ---------------- Static files ----------------
  // Serve files from src/ui/*
  const safePath = urlObj.pathname === "/" ? "/ui/index.html" : `/ui${urlObj.pathname}`;
  const filePath = path.join(__dirname, safePath);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not Found");
    }
    res.writeHead(200, { "Content-Type": getContentType(filePath) });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`UI server running at http://localhost:${PORT}`);
});
