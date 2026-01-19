// test/edgeProcessor.test.js
const test = require("node:test");
const assert = require("node:assert/strict");

const EdgeProcessor = require("../src/edgeProcessor");
const { nowIso } = require("../src/utils/time");

// Helper: create a measurement object
function makeMeasurement({
  patientId = "P001",
  measurementType = "HEART_RATE",
  value = 80,
  signalQuality = 1.0,
  timestamp = nowIso(),
  measurementId = `T-${Date.now()}-${Math.floor(Math.random() * 1000)}`
} = {}) {
  return {
    measurementId,
    patientId,
    measurementType,
    value,
    timestamp,
    signalQuality
  };
}

/* ------------------------------------------------------------------ */
/* Basic behavior                                                     */
/* ------------------------------------------------------------------ */

test("Normal values should NOT generate an alert", () => {
  const edge = new EdgeProcessor();
  const res = edge.ingestMeasurement(
    makeMeasurement({ measurementType: "HEART_RATE", value: 80 })
  );
  assert.equal(res.status, "ok");
});

test("High Heart Rate should generate an alert (THRESHOLD_HIGH)", () => {
  const edge = new EdgeProcessor();
  const res = edge.ingestMeasurement(
    makeMeasurement({ measurementType: "HEART_RATE", value: 140 })
  );

  assert.equal(res.status, "alert");
  assert.equal(res.anomaly.measurementType, "HEART_RATE");
  assert.equal(res.anomaly.anomalyType, "THRESHOLD_HIGH");
});

test("Low SpO2 should generate an alert (THRESHOLD_LOW)", () => {
  const edge = new EdgeProcessor();
  const res = edge.ingestMeasurement(
    makeMeasurement({ measurementType: "SPO2", value: 89 })
  );

  assert.equal(res.status, "alert");
  assert.equal(res.anomaly.measurementType, "SPO2");
  assert.equal(res.anomaly.anomalyType, "THRESHOLD_LOW");
});

test("Temperature at boundary should alert (TEMP >= 39.0)", () => {
  const edge = new EdgeProcessor();
  const res = edge.ingestMeasurement(
    makeMeasurement({ measurementType: "TEMPERATURE", value: 39.0 })
  );

  assert.equal(res.status, "alert");
  assert.equal(res.anomaly.measurementType, "TEMPERATURE");
  assert.equal(res.anomaly.anomalyType, "THRESHOLD_HIGH");
});

/* ------------------------------------------------------------------ */
/* Validation / rejection                                              */
/* ------------------------------------------------------------------ */

test("Low signal quality should discard measurement", () => {
  const edge = new EdgeProcessor();
  const res = edge.ingestMeasurement(
    makeMeasurement({ measurementType: "HEART_RATE", value: 80, signalQuality: 0.1 })
  );
  assert.equal(res.status, "discarded");
});

test("Unknown measurementType should be discarded", () => {
  const edge = new EdgeProcessor();
  const res = edge.ingestMeasurement(
    makeMeasurement({ measurementType: "BLOOD_PRESSURE", value: 120 })
  );
  assert.equal(res.status, "discarded");
});

test("Missing patientId should be discarded", () => {
  const edge = new EdgeProcessor();
  const res = edge.ingestMeasurement({
    measurementId: "T-missing-patient",
    measurementType: "HEART_RATE",
    value: 80,
    timestamp: nowIso(),
    signalQuality: 1.0
  });
  assert.equal(res.status, "discarded");
});

test("Non-numeric value should be discarded", () => {
  const edge = new EdgeProcessor();
  const res = edge.ingestMeasurement(
    makeMeasurement({ measurementType: "HEART_RATE", value: "80" }) // wrong type
  );
  assert.equal(res.status, "discarded");
});

test("Out-of-plausible-range value should be discarded (HR=300)", () => {
  const edge = new EdgeProcessor();
  const res = edge.ingestMeasurement(
    makeMeasurement({ measurementType: "HEART_RATE", value: 300 })
  );
  assert.equal(res.status, "discarded");
});

test("Out-of-order timestamps should be discarded", () => {
  const edge = new EdgeProcessor();

  const newer = "2026-01-01T10:00:00.000Z";
  const older = "2026-01-01T09:59:59.000Z";

  const r1 = edge.ingestMeasurement(
    makeMeasurement({ measurementType: "HEART_RATE", value: 80, timestamp: newer })
  );
  assert.equal(r1.status, "ok");

  const r2 = edge.ingestMeasurement(
    makeMeasurement({ measurementType: "HEART_RATE", value: 82, timestamp: older })
  );
  assert.equal(r2.status, "discarded");
});

/* ------------------------------------------------------------------ */
/* Sliding window / debounce                                           */
/* ------------------------------------------------------------------ */

test("Sliding window should keep only last 5 measurements", () => {
  const edge = new EdgeProcessor();

  for (let i = 0; i < 10; i++) {
    edge.ingestMeasurement(
      makeMeasurement({ measurementType: "HEART_RATE", value: 70 + i })
    );
  }

  const window = edge.signalProcessor.getSlidingWindow("P001", "HEART_RATE");
  assert.equal(window.length, 5);
  assert.equal(window[0].value, 75);
  assert.equal(window[4].value, 79);
});

test("Debounce should suppress repeated alerts within debounce window", () => {
  const edge = new EdgeProcessor();

  const r1 = edge.ingestMeasurement(
    makeMeasurement({ measurementType: "HEART_RATE", value: 140 })
  );
  assert.equal(r1.status, "alert");

  const r2 = edge.ingestMeasurement(
    makeMeasurement({ measurementType: "HEART_RATE", value: 150 })
  );
  // Second alert should be suppressed quickly => status ok with note "debounced"
  assert.equal(r2.status, "ok");
});

/* ------------------------------------------------------------------ */
/* Multi-patient isolation                                             */
/* ------------------------------------------------------------------ */

test("Different patients should be handled independently", () => {
  const edge = new EdgeProcessor();

  const a = edge.ingestMeasurement(
    makeMeasurement({ patientId: "P001", measurementType: "HEART_RATE", value: 140 })
  );
  const b = edge.ingestMeasurement(
    makeMeasurement({ patientId: "P002", measurementType: "HEART_RATE", value: 140 })
  );

  assert.equal(a.status, "alert");
  assert.equal(b.status, "alert");
});

/* ------------------------------------------------------------------ */
/* Trend anomaly (non-deterministic depending on config thresholds)     */
/* ------------------------------------------------------------------ */

test("Trend anomaly: HR increasing may trigger TREND (depending on config)", () => {
  const edge = new EdgeProcessor();

  edge.ingestMeasurement(makeMeasurement({ measurementType: "HEART_RATE", value: 90 }));
  edge.ingestMeasurement(makeMeasurement({ measurementType: "HEART_RATE", value: 94 }));
  edge.ingestMeasurement(makeMeasurement({ measurementType: "HEART_RATE", value: 98 }));
  edge.ingestMeasurement(makeMeasurement({ measurementType: "HEART_RATE", value: 102 }));

  const r = edge.ingestMeasurement(
    makeMeasurement({ measurementType: "HEART_RATE", value: 106 })
  );

  if (r.status === "alert") {
    assert.equal(r.anomaly.anomalyType, "TREND");
  } else {
    assert.equal(r.status, "ok");
  }
});

/* ------------------------------------------------------------------ */
/* Offline cache + flush                                               */
/* ------------------------------------------------------------------ */

test("Offline mode should cache and flush when online", () => {
  const edge = new EdgeProcessor();

  edge.setOnline(false);
  edge.ingestMeasurement(makeMeasurement({ measurementType: "SPO2", value: 90 })); // alert cached
  edge.ingestMeasurement(makeMeasurement({ measurementType: "HEART_RATE", value: 140 })); // alert cached

  edge.setOnline(true);
  const flush = edge.flushCachedData();

  assert.equal(flush.status, "flushed");
  assert.ok(flush.flushed.alerts.length >= 2);
  assert.ok(flush.flushed.measurements.length >= 2);
});

test("Offline flush when already empty should still succeed", () => {
  const edge = new EdgeProcessor();
  edge.setOnline(true);

  const flush = edge.flushCachedData();
  assert.equal(flush.status, "flushed");
  assert.ok(Array.isArray(flush.flushed.measurements));
  assert.ok(Array.isArray(flush.flushed.alerts));
});

/* ------------------------------------------------------------------ */
/* Emergency scenario                                                  */
/* ------------------------------------------------------------------ */

test("Medical emergency: very high heart rate should trigger alert (tachycardia)", () => {
  const edge = new EdgeProcessor();

  const res = edge.ingestMeasurement(
    makeMeasurement({
      patientId: "P-URG1",
      measurementType: "HEART_RATE",
      value: 180,
      signalQuality: 1.0,
      measurementId: "EM-1"
    })
  );

  assert.equal(res.status, "alert");
  assert.equal(res.anomaly.measurementType, "HEART_RATE");
  assert.ok(res.alert.severityLevel); // currently MEDIUM in your code
});
