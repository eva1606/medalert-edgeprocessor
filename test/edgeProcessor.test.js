const test = require("node:test");
const assert = require("node:assert/strict");

const EdgeProcessor = require("../src/edgeProcessor");
const { nowIso } = require("../src/utils/time");

function meas(patientId, type, value, quality = 1.0) {
  return {
    measurementId: `T-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    patientId,
    measurementType: type,
    value,
    timestamp: nowIso(),
    signalQuality: quality
  };
}

test("Normal values should NOT generate an alert", () => {
  const edge = new EdgeProcessor();
  const res = edge.ingestMeasurement(meas("P001", "HEART_RATE", 80));
  assert.equal(res.status, "ok");
});

test("High Heart Rate should generate an alert", () => {
  const edge = new EdgeProcessor();
  const res = edge.ingestMeasurement(meas("P001", "HEART_RATE", 140));
  assert.equal(res.status, "alert");
  assert.equal(res.anomaly.measurementType, "HEART_RATE");
});

test("Low SpO2 should generate an alert", () => {
  const edge = new EdgeProcessor();
  const res = edge.ingestMeasurement(meas("P001", "SPO2", 89));
  assert.equal(res.status, "alert");
  assert.equal(res.anomaly.measurementType, "SPO2");
});

test("Low signal quality should discard the measurement", () => {
  const edge = new EdgeProcessor();
  const res = edge.ingestMeasurement(meas("P001", "HEART_RATE", 80, 0.1));
  assert.equal(res.status, "discarded");
});

test("Offline mode should cache and flush when online", () => {
  const edge = new EdgeProcessor();

  edge.setOnline(false);
  edge.ingestMeasurement(meas("P001", "SPO2", 90)); // alert but cached offline

  edge.setOnline(true);
  const flush = edge.flushCachedData();

  assert.equal(flush.status, "flushed");
  assert.ok(flush.flushed.alerts.length >= 1);
});
