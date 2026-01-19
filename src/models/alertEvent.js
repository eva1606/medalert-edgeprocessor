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
  