function createMeasurement({
    measurementId,
    patientId,
    measurementType,
    value,
    timestamp,
    signalQuality = 1.0
  }) {
    return {
      measurementId,
      patientId,
      measurementType,
      value,
      timestamp,
      signalQuality
    };
  }
  
  module.exports = { createMeasurement };
  