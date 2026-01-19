const { slope } = require("../utils/stats");
const { nowIso } = require("../utils/time");
const { createAnomaly } = require("../models/anomaly");

class AnomalyDetector {
  constructor({ thresholds, trendConfig }) {
    this.thresholds = thresholds;
    this.trendConfig = trendConfig;
  }

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
      (measurementType === "HEART_RATE" || measurementType === "TEMPERATURE") &&
      last.value > t.max
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

    return null;
  }

  detectTrendAnomaly(window, measurementType) {
    if (window.length < this.trendConfig.minPoints) return null;

    const values = window.map((m) => m.value);
    const s = slope(values);
    const limit = this.trendConfig.slopeThresholds[measurementType];
    if (limit === undefined) return null;

    const badTrend =
      (measurementType === "SPO2" && s <= limit) ||
      (measurementType !== "SPO2" && s >= limit);

    if (!badTrend) return null;

    const last = window[window.length - 1];
    return createAnomaly({
      anomalyType: "TREND",
      measurementType,
      observedValue: last.value,
      expectedRange: null,
      detectionTimestamp: nowIso(),
      message: `${measurementType} trend anomaly (slope=${s.toFixed(2)})`,
      context: { slope: s, last }
    });
  }

  buildAnomalyFinding(window, measurementType) {
    return (
      this.detectThresholdAnomaly(window, measurementType) ||
      this.detectTrendAnomaly(window, measurementType) ||
      null
    );
  }
}

module.exports = AnomalyDetector;
