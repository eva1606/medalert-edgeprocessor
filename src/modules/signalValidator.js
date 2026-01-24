const MIN_SIGNAL_QUALITY = 0.3;
const { toMs } = require("../utils/time");
/**
 * SignalValidator
 * ----------------
 * Validates incoming measurements before they enter the processing pipeline.
 *
 * This module ensures:
 * - Structural correctness of measurements
 * - Acceptable signal quality
 * - Plausible value ranges
 * - Monotonic timestamp order per data stream
 *
 * Measurements that fail validation are discarded early.
 */
class SignalValidator {
  /**
 * Initializes the signal validator.
 *
 * Design notes:
 * - Timestamp consistency is tracked per patient and measurement type.
 */
  constructor({ plausibleRanges }) {
    this.plausibleRanges = plausibleRanges;
    this.lastTimestampByStream = new Map();                                         // Tracks last timestamp per patient and measurement stream
  }
  /**
 * Validates the signal quality of a measurement.
 *
 * Measurements with low signal quality are discarded
 * to avoid false detections.
 *
 * @param {Object} m - Measurement
 * @returns {boolean} True if signal quality is acceptable
 */
  validateSignalQuality(m) {
    return typeof m.signalQuality === "number" && m.signalQuality >= MIN_SIGNAL_QUALITY;            
  }
  /**
   * Checks whether the measurement value is within plausible physiological limits.
   *
   * @param {Object} m - Measurement
   * @returns {boolean} True if value is numeric and within configured range
   */
  checkValuePlausibility(m) {
    const r = this.plausibleRanges[m.measurementType];
    if (!r) return false;                                                                             // Unknown measurement types are rejected
    return typeof m.value === "number" && m.value >= r.min && m.value <= r.max;
  }
  /**
 * Verifies temporal consistency of incoming measurements.
 *
 * Ensures timestamps are valid and monotonically increasing
 * per patient and measurement stream.
 *
 * @param {Object} m - Measurement
 * @returns {Object} Validation result
 */
  verifyTimestampConsistency(m) {
    const key = `${m.patientId}|${m.measurementType}`;
    const ms = toMs(m.timestamp);                                                                     // Convert timestamp to milliseconds for consistent comparison
    if (!Number.isFinite(ms)) return { ok: false, reason: "invalid timestamp" };

    const last = this.lastTimestampByStream.get(key);
    if (last !== undefined && ms < last) {
      return { ok: false, reason: "out-of-order timestamp" };
    }
    this.lastTimestampByStream.set(key, ms);
    return { ok: true };
  }
  /**
 * Performs full validation of an incoming measurement.
 *
 * Validation includes:
 * - Required fields
 * - Signal quality
 * - Value plausibility
 * - Timestamp consistency
 *
 * @param {Object} m - Measurement
 * @returns {Object} Validation result with status and reason
 */
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
