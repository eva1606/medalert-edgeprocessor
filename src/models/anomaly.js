function createAnomaly({
    anomalyType,
    measurementType,
    observedValue,
    expectedRange,
    detectionTimestamp,
    message,
    context
  }) {
    return {
      anomalyType,
      measurementType,
      observedValue,
      expectedRange,
      detectionTimestamp,
      message,
      context
    };
  }
  
  module.exports = { createAnomaly };
  