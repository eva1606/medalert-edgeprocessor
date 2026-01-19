class OfflineCache {
    constructor() {
      this.measurements = [];
      this.alerts = [];
      this.isOnline = true;
    }
  
    setOnline(flag) {
      this.isOnline = !!flag;
    }
  
    checkConnectivityStatus() {
      return this.isOnline;
    }
  
    storeMeasurement(measurement) {
      this.measurements.push({
        type: "measurement",
        payload: measurement,
        createdAt: Date.now(),
        synced: false
      });
    }
  
    storeAlert(alertEvent) {
      this.alerts.push({
        type: "alert",
        payload: alertEvent,
        createdAt: Date.now(),
        synced: false
      });
    }
  
    flushCachedData() {
      const flushed = {
        measurements: this.measurements.splice(0),
        alerts: this.alerts.splice(0)
      };
      return flushed;
    }
  }
  
  module.exports = OfflineCache;
  