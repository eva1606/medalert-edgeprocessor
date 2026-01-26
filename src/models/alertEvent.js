/**
 * Creates an alert event object.
 *
 * This factory function ensures a consistent alert structure
 * across the system.
 *
 * @param {Object} params
 * @param {string} params.alertId - Unique alert identifier
 * @param {string} params.patientId - Patient identifier
 * @param {string} params.alertType - Type of alert/anomaly
 * @param {string} params.severityLevel - Severity level
 * @param {string} params.timestamp - ISO timestamp of alert creation
 * @param {Object} params.associatedAnomaly - Anomaly that triggered the alert
 * @param {Object} [params.contextualMetadata] - Optional contextual data
 *
 * @returns {Object} Alert event
 */
function createAlertEvent({
    alertId,
    patientId,
    alertType,
    severityLevel,
    timestamp,
    associatedAnomaly,
    contextualMetadata = {}
  }) {
    return {
      alertId,
      patientId,
      alertType,
      severityLevel,
      timestamp,
      associatedAnomaly,
      contextualMetadata
    };
  }
  module.exports = { createAlertEvent };
  