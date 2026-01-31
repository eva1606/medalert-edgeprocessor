/**
 * simulator.js
 * --------------
 * Validation and simulation script for the MedAlert EdgeProcessor.
 *
 * This script performs end-to-end validation of the system by injecting
 * synthetic measurement streams and simulating various operational scenarios:
 * - Normal operation
 * - Threshold-based anomalies
 * - Offline operation and cache flushing
 * - Alert debouncing
 * - Signal validation failures
 * - Trend-based anomaly detection
 */

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
/**
 * Validation stream
 * -----------------
 * Each block below corresponds to a validation scenario.
 */
const stream = [
  // =========================================================
  // TEST 1 – Normal operation (no anomalies expected)
  // =========================================================
  { log: "TEST 1: Normal Operation\n   Expected: Measurements processed, no alerts generated" },
  meas(patientId, "HEART_RATE", 78),
  meas(patientId, "HEART_RATE", 82),
  // =========================================================
  // TEST 2 – Threshold-based anomaly (tachycardia)
  // =========================================================
{ log: "TEST 2: Threshold Violation (Tachycardia)\n   Expected: Immediate alert generation" },
  meas(patientId, "HEART_RATE", 180),                         // ⚠️ urgence: tachycardie
  meas(patientId, "HEART_RATE", 78),
  meas(patientId, "SPO2", 98),
  meas(patientId, "TEMPERATURE", 36.9),
  // =========================================================
  // TEST 3 – Alert debouncing
  // =========================================================
 { log: "TEST 3: Alert Debouncing\n   Expected: Repeated alerts suppressed within debounce interval" },
  meas(patientId, "HEART_RATE", 85),
  meas(patientId, "HEART_RATE", 132),                         // 🚨 alert (debounced if repeated)
  // =========================================================
  // TEST 4 – Offline operation and caching
  // =========================================================
  { log: "TEST 4: Offline Operation\n   Expected: Measurements processed, alerts cached locally" },
  { cmd: "offline" },
  // Expected: anomalies detected but alerts cached locally
  meas(patientId, "SPO2", 95),
  meas(patientId, "SPO2", 93),
  meas(patientId, "SPO2", 91),                                // 🚨 anomaly (cached)
  meas(patientId, "SPO2", 90),
  // =========================================================
  // TEST 5 – Online recovery and cache flush
  // =========================================================
  { log: "TEST 5: Online Recovery\n   Expected: Cached events flushed in chronological order" },
  { cmd: "online" },
  { cmd: "flush" },                                                       // Expected: cached measurements + alerts flushed in order

  meas(patientId, "HEART_RATE", 82),
  meas(patientId, "SPO2", 97),
  // =========================================================
  // TEST 6 – Signal validation (low signal quality)
  // =========================================================
  { log: "TEST 6: Signal Quality Validation\n   Expected: Measurement discarded" },
  meas(patientId, "HEART_RATE", 90, 0.2),                                 // Expected: measurement discarded

  // =========================================================
  // TEST 7 – Timestamp consistency (out-of-order measurement)
  // =========================================================
  { log: "TEST 7: Timestamp Order Validation\n   Expected: Measurement rejected due to out-of-order timestamp" },
  meas(patientId, "HEART_RATE", 88, 1.0, "2025-01-01T00:00:00.000Z"),     // Expected: measurement discarded due to invalid timestamp order

  // =========================================================
  // TEST 8 – Trend-based anomaly detection (no threshold violation)
  // =========================================================
  { log:"TEST 8: Trend-Based Detection\n   Expected: Trend anomaly detected without threshold violation"},
  // Gradual increase should trigger trend anomaly
  meas(patientId, "HEART_RATE", 80),
  meas(patientId, "HEART_RATE", 85),
  meas(patientId, "HEART_RATE", 90),
  meas(patientId, "HEART_RATE", 95),
  meas(patientId, "HEART_RATE", 100)
];

let i = 0;
const interval = setInterval(() => {
  if (i >= stream.length) {
    clearInterval(interval);
    console.log("\n✅ Simulation finished.");
    return;
  }

  const item = stream[i++];

  if (item.log) {
    console.log("\n" + item.log);
    return;
  }
  
  if (item.cmd === "offline") {
    console.log("\n🌐 TEST – Connectivity switched to OFFLINE");
    edge.setOnline(false);
    return;
  }

  if (item.cmd === "online") {
    console.log("\n🌐 TEST – Connectivity switched to ONLINE");
    edge.setOnline(true);
    return;
  }

  if (item.cmd === "flush") {
    const res = edge.flushCachedData();
    console.log("📤 TEST – Flush cached data:", res.status);
    return;
  }

  const res = edge.ingestMeasurement(item);

  if (res.status === "ok") {
    console.log(`OK        | ${item.measurementType}=${item.value} (q=${item.signalQuality})`);
  } else if (res.status === "alert") {
    console.log(
      `🚨 ALERT   | ${res.alert.severityLevel} | ${res.anomaly.message} | value=${res.anomaly.observedValue}`
    );
  } else {
    console.log(`❌ REJECTED | ${res.reason}`);
  }
}, 1000);

