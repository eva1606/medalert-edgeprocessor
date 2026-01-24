// uiServer.js — ZERO dependencies (Node built-in only)

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;

// Mock state (demo only)
let state = {
  online: true,
  measurements: {
    HEART_RATE: 82,
    SPO2: 91,
    TEMPERATURE: 36.8
  },
  alerts: [
    { alertType: "SPO2 below threshold", severityLevel: "HIGH" }
  ]
};

const server = http.createServer((req, res) => {
  if (req.url === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(state));
  }

  // Serve static files from /ui
  const filePath = path.join(
    __dirname,
    "ui",
    req.url === "/" ? "index.html" : req.url
  );

  const ext = path.extname(filePath);
  const contentType =
    ext === ".js" ? "text/javascript" :
    ext === ".html" ? "text/html" :
    "text/plain";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end("Not Found");
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`UI server running at http://localhost:${PORT}`);
  console.log(`Open your browser manually at the address above`);
});
