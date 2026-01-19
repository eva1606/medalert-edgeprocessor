const { createAlertEvent } = require("../models/alertEvent");
const { nowIso } = require("../utils/time");

class AlertManager {
  constructor({ debounceMs }) {
    this.debounceMs = debounceMs;
    this.lastAlertByKey = new Map(); // patientId|type|anomalyType -> timestamp
  }

  classifySeverity(anomaly) {
    if (anomaly.measurementType === "SPO2") return "HIGH";
    if (anomaly.measurementType === "TEMPERATURE") return "HIGH";
    return "MEDIUM";
  }

  applyDebounceRules(patientId, anomaly) {
    const key = `${patientId}|${anomaly.measurementType}|${anomaly.anomalyType}`;
    const now = Date.now();
    const last = this.lastAlertByKey.get(key);

    if (last && now - last < this.debounceMs) return false;

    this.lastAlertByKey.set(key, now);
    return true;
  }

  buildAlertEvent(patientId, anomaly, patientContext = {}) {
    return createAlertEvent({
      alertId: `A-${Date.now()}`,
      patientId,
      alertType: anomaly.anomalyType,
      severityLevel: this.classifySeverity(anomaly),
      timestamp: nowIso(),
      associatedAnomaly: anomaly,
      contextualMetadata: patientContext
    });
  }

  emitAlert(alertEvent) {
    // For demo: console output
    return alertEvent;
  }
}

module.exports = AlertManager;
