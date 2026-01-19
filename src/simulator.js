const EdgeProcessor = require("./edgeProcessor");
const { nowIso } = require("./utils/time");

const edge = new EdgeProcessor();

function meas(patientId, type, value, quality = 1.0) {
  return {
    measurementId: `M-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    patientId,
    measurementType: type,
    value,
    timestamp: nowIso(),
    signalQuality: quality
  };
}

const patientId = "P001";

const stream = [
  meas(patientId, "HEART_RATE", 78),
  meas(patientId, "SPO2", 98),
  meas(patientId, "TEMPERATURE", 36.9),

  meas(patientId, "HEART_RATE", 85),
  meas(patientId, "HEART_RATE", 132), // 🚨 alert

  { cmd: "offline" },
  meas(patientId, "SPO2", 95),
  meas(patientId, "SPO2", 93),
  meas(patientId, "SPO2", 91), // 🚨 alert but cached (offline)
  meas(patientId, "SPO2", 90),

  { cmd: "online" },
  { cmd: "flush" },

  meas(patientId, "HEART_RATE", 82),
  meas(patientId, "SPO2", 97)
];

let i = 0;
const interval = setInterval(() => {
  if (i >= stream.length) {
    clearInterval(interval);
    console.log("\n✅ Simulation finished.");
    return;
  }

  const item = stream[i++];

  if (item.cmd === "offline") {
    console.log("\n🌐 Connectivity: OFFLINE");
    edge.setOnline(false);
    return;
  }
  if (item.cmd === "online") {
    console.log("\n🌐 Connectivity: ONLINE");
    edge.setOnline(true);
    return;
  }
  if (item.cmd === "flush") {
    const res = edge.flushCachedData();
    console.log("📤 Flush result:", res.status);
    return;
  }

  const res = edge.ingestMeasurement(item);

  if (res.status === "ok") {
    console.log(`OK  | ${item.measurementType}=${item.value} (q=${item.signalQuality})`);
  } else if (res.status === "alert") {
    console.log(
      `🚨 ALERT | ${res.alert.severityLevel} | ${res.anomaly.message} | value=${res.anomaly.observedValue}`
    );
  } else {
    console.log(`❌ DISCARDED | ${res.reason}`);
  }
}, 1000);
