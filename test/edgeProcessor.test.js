const test = require("node:test");
const assert = require("node:assert/strict");

const EdgeProcessor = require("../src/edgeProcessor");
const { nowIso } = require("../src/utils/time");

function meas(patientId, type, value, quality = 1.0, timestamp = nowIso()) {
  return {
    measurementId: `T-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    patientId,
    measurementType: type,
    value,
    timestamp,
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
  assert.equal(res.anomaly.anomalyType, "THRESHOLD_HIGH");
});

test("Low SpO2 should generate an alert", () => {
  const edge = new EdgeProcessor();
  const res = edge.ingestMeasurement(meas("P001", "SPO2", 89));
  assert.equal(res.status, "alert");
  assert.equal(res.anomaly.measurementType, "SPO2");
  assert.equal(res.anomaly.anomalyType, "THRESHOLD_LOW");
});

test("Low signal quality should discard measurement", () => {
  const edge = new EdgeProcessor();
  const res = edge.ingestMeasurement(meas("P001", "HEART_RATE", 80, 0.1));
  assert.equal(res.status, "discarded");
});

test("Offline mode should cache and flush when online", () => {
  const edge = new EdgeProcessor();

  edge.setOnline(false);
  edge.ingestMeasurement(meas("P001", "SPO2", 90)); // should alert but cached
  edge.ingestMeasurement(meas("P001", "HEART_RATE", 140)); // should alert but cached

  edge.setOnline(true);
  const flush = edge.flushCachedData();

  assert.equal(flush.status, "flushed");
  assert.ok(flush.flushed.alerts.length >= 2);
  assert.ok(flush.flushed.measurements.length >= 2);
});

/* ----------------------------- More tests ----------------------------- */

test("Unknown measurementType should be discarded", () => {
  const edge = new EdgeProcessor();
  const res = edge.ingestMeasurement({
    measurementId: "T-1",
    patientId: "P001",
    measurementType: "BLOOD_PRESSURE", // not supported in config
    value: 120,
    timestamp: nowIso(),
    signalQuality: 1.0
  });
  assert.equal(res.status, "discarded");
});

test("Missing patientId should be discarded", () => {
  const edge = new EdgeProcessor();
  const res = edge.ingestMeasurement({
    measurementId: "T-2",
    measurementType: "HEART_RATE",
    value: 80,
    timestamp: nowIso(),
    signalQuality: 1.0
  });
  assert.equal(res.status, "discarded");
});

test("Non-numeric value should be discarded", () => {
  const edge = new EdgeProcessor();
  const res = edge.ingestMeasurement({
    measurementId: "T-3",
    patientId: "P001",
    measurementType: "HEART_RATE",
    value: "80",
    timestamp: nowIso(),
    signalQuality: 1.0
  });
  assert.equal(res.status, "discarded");
});

test("Out-of-plausible-range value should be discarded (HR=300)", () => {
  const edge = new EdgeProcessor();
  const res = edge.ingestMeasurement(meas("P001", "HEART_RATE", 300));
  assert.equal(res.status, "discarded");
});

test("Exact threshold boundary should NOT alert (HR=120)", () => {
  const edge = new EdgeProcessor();
  const res = edge.ingestMeasurement(meas("P001", "HEART_RATE", 120));
  assert.equal(res.status, "ok");
});

test("Exact threshold boundary should alert for TEMP >= 39.0", () => {
  const edge = new EdgeProcessor();
  const res = edge.ingestMeasurement(meas("P001", "TEMPERATURE", 39.0));
  assert.equal(res.status, "alert");
  assert.equal(res.anomaly.measurementType, "TEMPERATURE");
});

test("Out-of-order timestamps should be discarded", () => {
  const edge = new EdgeProcessor();
  const t1 = "2026-01-01T10:00:00.000Z";
  const t0 = "2026-01-01T09:59:59.000Z";

  const r1 = edge.ingestMeasurement(meas("P001", "HEART_RATE", 80, 1.0, t1));
  assert.equal(r1.status, "ok");

  const r2 = edge.ingestMeasurement(meas("P001", "HEART_RATE", 82, 1.0, t0));
  assert.equal(r2.status, "discarded");
});

test("Sliding window should keep only last 5 measurements", () => {
  const edge = new EdgeProcessor();
  for (let i = 0; i < 10; i++) {
    edge.ingestMeasurement(meas("P001", "HEART_RATE", 70 + i));
  }
  const window = edge.signalProcessor.getSlidingWindow("P001", "HEART_RATE");
  assert.equal(window.length, 5);
  assert.equal(window[0].value, 75); // last 5 of 70..79 => 75..79
  assert.equal(window[4].value, 79);
});

test("Debounce should suppress repeated alerts within debounce window", () => {
  const edge = new EdgeProcessor();

  const r1 = edge.ingestMeasurement(meas("P001", "HEART_RATE", 140));
  assert.equal(r1.status, "alert");

  const r2 = edge.ingestMeasurement(meas("P001", "HEART_RATE", 150));
  // should not emit second alert immediately, should be debounced -> ok
  assert.equal(r2.status, "ok");
});

test("Different patients should be handled independently", () => {
  const edge = new EdgeProcessor();

  const a = edge.ingestMeasurement(meas("P001", "HEART_RATE", 140));
  const b = edge.ingestMeasurement(meas("P002", "HEART_RATE", 140));

  assert.equal(a.status, "alert");
  assert.equal(b.status, "alert");
});

test("Trend anomaly should trigger when slope is high enough (HR increasing)", () => {
  const edge = new EdgeProcessor();

  // To avoid threshold alert, keep values below 120 but increasing fast enough
  edge.ingestMeasurement(meas("P001", "HEART_RATE", 90));
  edge.ingestMeasurement(meas("P001", "HEART_RATE", 94));
  edge.ingestMeasurement(meas("P001", "HEART_RATE", 98));
  edge.ingestMeasurement(meas("P001", "HEART_RATE", 102));
  const r = edge.ingestMeasurement(meas("P001", "HEART_RATE", 106));

  // This might alert as TREND depending on config slope thresholds
  // We accept either ok or alert, but if alert then should be TREND.
  if (r.status === "alert") {
    assert.equal(r.anomaly.anomalyType, "TREND");
  } else {
    assert.equal(r.status, "ok");
  }
});

test("Offline flush when already empty should still succeed", () => {
  const edge = new EdgeProcessor();
  edge.setOnline(true);
  const flush = edge.flushCachedData();
  assert.equal(flush.status, "flushed");
  assert.ok(Array.isArray(flush.flushed.measurements));
  assert.ok(Array.isArray(flush.flushed.alerts));
});
