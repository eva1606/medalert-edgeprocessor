/**
 * SignalProcessor
 * ----------------
 * Manages sliding windows of raw measurements and provides
 * derived views (e.g., smoothed windows) for analysis.
 *
 * Raw measurements are preserved as-is.
 * Any preprocessing (e.g., smoothing) is applied only
 * to derived data and does not modify stored values.
 */
class SignalProcessor {
    /**
     * Initializes the SignalProcessor.
     *
     * Design notes:
     * - Sliding windows are maintained per patient and measurement type.
     * - Window size is configurable to support different monitoring policies.
     */
    constructor({ windowSize }) {
      this.windowSize = windowSize;
      this.windows = new Map();                                                       // Map key format: patientId|measurementType
    }
    /**
     * Updates the sliding window for a given patient and measurement type.
     *
     * The window stores raw measurements only.
     * Older measurements are discarded when the window exceeds the configured size.
     *
     * @param {string} patientId
     * @param {string} measurementType
     * @param {Object} measurement - Raw measurement data
     * @returns {Array} Updated sliding window
     */
    updateMeasurementWindow(patientId, measurementType, measurement) {
      const key = `${patientId}|${measurementType}`;
      const arr = this.windows.get(key) || [];
      arr.push(measurement);
      while (arr.length > this.windowSize) arr.shift();                                 // Enforce fixed-size sliding window by removing oldest entries
      this.windows.set(key, arr);
      return arr;
    }
    /**
     * Returns the current raw sliding window for a given patient and measurement type.
     *
     * @param {string} patientId
     * @param {string} measurementType
     * @returns {Array} Sliding window of raw measurements
     */
    getSlidingWindow(patientId, measurementType) {
      const key = `${patientId}|${measurementType}`;
      return this.windows.get(key) || [];
    }
    /**
     * Returns a smoothed version of the sliding window for analysis purposes.
     *
     * Smoothing is implemented as a simple moving average over the raw window.
     * This method does NOT modify the stored raw measurements.
     *
     * @param {string} patientId
     * @param {string} measurementType
     * @returns {Array} Smoothed sliding window
     */
    getSmoothedWindow(patientId, measurementType) {
      const rawWindow = this.getSlidingWindow(patientId, measurementType);
      if (!rawWindow || rawWindow.length === 0) return rawWindow;
      const values = rawWindow.map(m => m.value);
      const avg =
      values.reduce((a, b) => a + b, 0) / values.length;                                    // Simple moving average used as lightweight noise filtering
      return rawWindow.map(m => ({m,value: avg}));                                          // Return a derived window; raw measurements remain unchanged
    }
  }
  module.exports = SignalProcessor;
  