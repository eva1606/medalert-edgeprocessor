/**
 * AlertManager
 * -------------
 * Responsible for alert-related logic, including:
 * - Determining alert severity based on configurable policies
 * - Preventing alert flooding using debounce rules
 * - Creating alert event objects
 *
 * This module does not decide when an anomaly occurs,
 * but handles how alerts are generated and managed.
 */
class AlertManager {
  /**
 * Initializes the AlertManager.
 *
 * Design notes:
 * - Debounce state is tracked per patient, measurement type, and anomaly type.
 * - Severity is policy-driven and configurable (not hardcoded).
 */

  constructor({ debounceMs, severityPolicy = {} }) {
    this.debounceMs = debounceMs;
    this.severityPolicy = severityPolicy;
    this.lastAlertByKey = new Map();
  }
/**
 * Determines the severity level of an alert based on configuration.
 *
 * Severity is derived from the measurement type and resolved using
 * a configurable policy. If no policy is defined, a default level
 * of MEDIUM is used.
 *
 * @param {Object} anomaly - Detected anomaly
 * @returns {string} Severity level
 */
  classifySeverity(anomaly) {
    return (
      this.severityPolicy[anomaly.measurementType] || "MEDIUM"
    );
  }
/**
 * Applies debounce rules to prevent alert flooding.
 *
 * Alerts are suppressed if the same alert (per patient, measurement type,
 * and anomaly type) was emitted within the configured debounce interval.
 *
 * @param {string} patientId
 * @param {Object} anomaly
 * @returns {boolean} True if the alert may be emitted, false otherwise
 */
  applyDebounceRules(patientId, anomaly) {
    const key = `${patientId}|${anomaly.measurementType}|${anomaly.anomalyType}`;                   // Composite key ensures debounce is applied per specific alert type and patient.
    const now = Date.now();
    const last = this.lastAlertByKey.get(key);

    if (last && now - last < this.debounceMs) return false;

    this.lastAlertByKey.set(key, now);
    return true;
  }
/**
 * Creates an alert event object.
 *
 * The alert includes severity, timestamp, and contextual metadata
 * to support downstream handling or visualization.
 *
 * @param {string} patientId
 * @param {Object} anomaly - Detected anomaly
 * @param {Object} patientContext - Additional contextual information
 * @returns {Object} Alert event
 */
  createAlert(patientId, anomaly, patientContext = {}) {
    return {
      alertId: `A-${Date.now()}`,
      patientId,
      alertType: anomaly.anomalyType,
      severityLevel: this.classifySeverity(anomaly),
      timestamp: new Date().toISOString(),
      associatedAnomaly: anomaly,
      contextualMetadata: patientContext
    };
  }
/**
 * Publishes an alert event.
 *
 * In the current implementation (v1), this method returns the alert
 * object directly. In future versions, this method may forward the alert
 * to external systems or notification services.
 *
 * @param {Object} alertEvent
 * @returns {Object} Published alert
 */
  publishAlert(alertEvent) {
    return alertEvent;
  }
}

module.exports = AlertManager;
