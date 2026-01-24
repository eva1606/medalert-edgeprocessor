/**
 * Creates a raw measurement object.
 *
 * @param {Object} params
 * @param {string} params.measurementId - Unique measurement identifier
 * @param {string} params.patientId - Patient identifier
 * @param {string} params.measurementType - Type of measurement
 * @param {number} params.value - Measured value
 * @param {string} params.timestamp - ISO timestamp of measurement
 * @param {number} [params.signalQuality=1.0] - Signal quality indicator
 *
 * @returns {Object} Measurement object
 */
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
  