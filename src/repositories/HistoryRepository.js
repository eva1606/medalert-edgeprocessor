const fs = require("fs");
const path = require("path");

class HistoryRepository {
  constructor({ storageDir } = {}) {
    this.storageDir = storageDir || path.join(__dirname, "..", "data");
    this.measurementsFile = path.join(this.storageDir, "measurements.json");
    this.alertsFile = path.join(this.storageDir, "alerts.json");

    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    if (!fs.existsSync(this.measurementsFile)) fs.writeFileSync(this.measurementsFile, "[]", "utf-8");
    if (!fs.existsSync(this.alertsFile)) fs.writeFileSync(this.alertsFile, "[]", "utf-8");
  }

  _readJson(file) {
    try {
      return JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch {
      return [];
    }
  }

  _append(file, obj) {
    const arr = this._readJson(file);
    arr.push(obj);
    fs.writeFileSync(file, JSON.stringify(arr, null, 2), "utf-8");
  }

  saveMeasurement(m) {
    this._append(this.measurementsFile, m);
  }

  saveAlert(a) {
    this._append(this.alertsFile, a);
  }

  // optionnel (si tu veux afficher l’historique plus tard)
  getRecentMeasurements(limit = 50) {
    const arr = this._readJson(this.measurementsFile);
    return arr.slice(-limit).reverse();
  }

  getRecentAlerts(limit = 50) {
    const arr = this._readJson(this.alertsFile);
    return arr.slice(-limit).reverse();
  }
}

module.exports = HistoryRepository;
