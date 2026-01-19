class SignalProcessor {
    constructor({ windowSize }) {
      this.windowSize = windowSize;
      this.windows = new Map(); // patientId|type -> measurements[]
    }
  
    applyNoiseFiltering(m) {
      // Lightweight filtering (v1): pass-through
      return m;
    }
  
    updateMeasurementWindow(patientId, measurementType, measurement) {
      const key = `${patientId}|${measurementType}`;
      const arr = this.windows.get(key) || [];
      arr.push(measurement);
  
      while (arr.length > this.windowSize) arr.shift();
  
      this.windows.set(key, arr);
      return arr;
    }
  
    getSlidingWindow(patientId, measurementType) {
      const key = `${patientId}|${measurementType}`;
      return this.windows.get(key) || [];
    }
  }
  
  module.exports = SignalProcessor;
  