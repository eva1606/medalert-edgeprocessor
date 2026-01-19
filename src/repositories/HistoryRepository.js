
class HistoryRepository {
  constructor() {
    this.measurements = [];
    this.alerts = [];
  }

  saveMeasurement(measurement) {
    this.measurements.push(measurement);
  }

  saveAlert(alert) {
    this.alerts.push(alert);
  }

  getMeasurements(patientId) {
    return this.measurements.filter(
      (m) => m.patientId === patientId
    );
  }

  getAlerts(patientId) {
    return this.alerts.filter(
      (a) => a.patientId === patientId
    );
  }
}

module.exports = HistoryRepository;
