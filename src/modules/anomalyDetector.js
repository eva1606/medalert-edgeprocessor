const { slope } = require("../utils/stats");
const { nowIso } = require("../utils/time");
const { createAnomaly } = require("../models/anomaly");
/**
 * AnomalyDetector
 * ----------------
 * Detects medical anomalies based on threshold violations
 * and trend analysis over sliding windows.
 *
 * This module is purely analytical and stateless.
 * It does not manage persistence, alerts, or connectivity.
 */
class AnomalyDetector {
  /**
 * Initializes the anomaly detector.
 */
  constructor({ thresholds, trendConfig }) {
    this.thresholds = thresholds;
    this.trendConfig = trendConfig;
  }

  /**
 * Detects threshold-based anomalies using the latest value
 * in the sliding window.
 *
 * @param {Array} window - Sliding window of raw measurements
 * @param {string} measurementType
 * @returns {Object|null} Detected anomaly or null
 */
  detectThresholdAnomaly(window, measurementType) {
    if (!window.length) return null;
    const t = this.thresholds[measurementType];
    if (!t) return null;
    const last = window[window.length - 1];
    if (measurementType === "SPO2" && last.value < t.min) {
      return createAnomaly({
        anomalyType: "THRESHOLD_LOW",
        measurementType,
        observedValue: last.value,
        expectedRange: t,
        detectionTimestamp: nowIso(),
        message: `${measurementType} too low`,
        context: { last }
      });
    }
    if (
      measurementType === "HEART_RATE" && last.value > t.max
    ) {    
      return createAnomaly({
        anomalyType: "THRESHOLD_HIGH",
        measurementType,
        observedValue: last.value,
        expectedRange: t,
        detectionTimestamp: nowIso(),
        message: `${measurementType} too high`,
        context: { last }
      });
    }
    if (measurementType === "TEMPERATURE" && last.value >= t.max) {
      return createAnomaly({
        anomalyType: "THRESHOLD_HIGH",
        measurementType,
        observedValue: last.value,
        expectedRange: t,
        detectionTimestamp: nowIso(),
        message: `${measurementType} too high`,
        context: { last }
      });
    }    
    return null;
  }
/**
 * Detects trend-based anomalies using linear regression slope
 * over the sliding window.
 *
 * @param {Array} window - Sliding window of measurements
 * @param {string} measurementType
 * @returns {Object|null} Detected anomaly or null
 */
  detectTrendAnomaly(window, measurementType) {
    if (window.length < this.trendConfig.minPoints) return null;
    const values = window.map((m) => m.value);
    const s = slope(values);                                                             // Compute linear trend (slope) over the sliding window values.
    const limit = this.trendConfig.slopeThresholds[measurementType];
    if (limit === undefined) return null;
    const badTrend =                                                                     // For SPO2, decreasing trends are dangerous; for other metrics, increasing trends are critical.
      (measurementType === "SPO2" && s <= limit) ||
      (measurementType !== "SPO2" && s >= limit);
    if (!badTrend) return null;
    const last = window[window.length - 1];                                              // Evaluate only the most recent measurement
    return createAnomaly({
      anomalyType: "TREND",
      measurementType,
      observedValue: last.value,
      expectedRange: null,                                                               // Trend anomalies are not associated with a fixed expected range.
      detectionTimestamp: nowIso(),
      message: `${measurementType} trend anomaly (slope=${s.toFixed(2)})`,
      context: { slope: s, last }
    });
  }
}
module.exports = AnomalyDetector;
