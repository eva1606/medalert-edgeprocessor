const { toMs } = require("../utils/time");

class SignalValidator {
  constructor({ plausibleRanges }) {
    this.plausibleRanges = plausibleRanges;
    this.lastTimestampByStream = new Map(); // patientId|type -> last timestamp (ms)
  }

  validateSignalQuality(m) {
    return typeof m.signalQuality === "number" && m.signalQuality >= 0.3;
  }

  checkValuePlausibility(m) {
    const r = this.plausibleRanges[m.measurementType];
    if (!r) return false;
    return typeof m.value === "number" && m.value >= r.min && m.value <= r.max;
  }

  verifyTimestampConsistency(m) {
    const key = `${m.patientId}|${m.measurementType}`;
    const ms = toMs(m.timestamp);
    if (!Number.isFinite(ms)) return { ok: false, reason: "invalid timestamp" };

    const last = this.lastTimestampByStream.get(key);
    if (last !== undefined && ms < last) {
      return { ok: false, reason: "out-of-order timestamp" };
    }
    this.lastTimestampByStream.set(key, ms);
    return { ok: true };
  }

  buildValidationResult(m) {
    if (!m || !m.patientId || !m.measurementType) {
      return { ok: false, reason: "missing fields" };
    }
    if (!this.validateSignalQuality(m)) {
      return { ok: false, reason: "low signal quality" };
    }
    if (!this.checkValuePlausibility(m)) {
      return { ok: false, reason: "implausible value" };
    }
    const ts = this.verifyTimestampConsistency(m);
    if (!ts.ok) return { ok: false, reason: ts.reason };
    return { ok: true };
  }
}

module.exports = SignalValidator;
