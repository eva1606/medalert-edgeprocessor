const fs = require("fs");
const path = require("path");

const SignalValidator = require("./modules/signalValidator");
const SignalProcessor = require("./modules/signalProcessor");
const AnomalyDetector = require("./modules/anomalyDetector");
const AlertManager = require("./modules/alertManager");
const OfflineCache = require("./modules/offlineCache");

const { warn, info } = require("./utils/logger");

class EdgeProcessor {
  constructor({ configPath } = {}) {
    const cfgFile =
      configPath || path.join(__dirname, "config", "thresholds.json");
    const cfg = JSON.parse(fs.readFileSync(cfgFile, "utf-8"));

    this.cfg = cfg;

    this.signalValidator = new SignalValidator({
      plausibleRanges: cfg.plausibleRanges
    });
    this.signalProcessor = new SignalProcessor({ windowSize: cfg.windowSize });
    this.anomalyDetector = new AnomalyDetector({
      thresholds: cfg.thresholds,
      trendConfig: cfg.trend
    });
    this.alertManager = new AlertManager({ debounceMs: cfg.debounceMs });
    this.offlineCache = new OfflineCache();
  }

  setOnline(flag) {
    this.offlineCache.setOnline(flag);
  }

  ingestMeasurement(measurement) {
    // 1) Validate
    const validation = this.signalValidator.buildValidationResult(measurement);
    if (!validation.ok) {
      warn("Measurement discarded", {
        reason: validation.reason,
        measurement
      });
      return { status: "discarded", reason: validation.reason };
    }

    // 2) Processing + window update
    const filtered = this.signalProcessor.applyNoiseFiltering(measurement);
    const window = this.signalProcessor.updateMeasurementWindow(
      filtered.patientId,
      filtered.measurementType,
      filtered
    );

    // 3) Anomaly detection
    const finding = this.anomalyDetector.buildAnomalyFinding(
      window,
      filtered.measurementType
    );

    // Always handle measurement delivery (online/offline)
    this._handleMeasurementDelivery(filtered);

    if (!finding) {
      return { status: "ok", measurement: filtered };
    }

    // 4) Alert handling (debounce)
    const canEmit = this.alertManager.applyDebounceRules(
      filtered.patientId,
      finding
    );
    if (!canEmit) {
      return { status: "ok", measurement: filtered, note: "debounced" };
    }

    const alertEvent = this.alertManager.buildAlertEvent(
      filtered.patientId,
      finding,
      { measurementType: filtered.measurementType }
    );

    const deliveredAlert = this._handleAlertDelivery(alertEvent);

    return { status: "alert", alert: deliveredAlert, anomaly: finding };
  }

  flushCachedData() {
    if (!this.offlineCache.checkConnectivityStatus()) {
      return { status: "offline", flushed: null };
    }
    const flushed = this.offlineCache.flushCachedData();
    info("Flushed cached data", {
      measurements: flushed.measurements.length,
      alerts: flushed.alerts.length
    });
    return { status: "flushed", flushed };
  }

  _handleMeasurementDelivery(measurement) {
    if (this.offlineCache.checkConnectivityStatus()) {
      // Real system: send to backend (API Gateway). Demo: do nothing.
      return;
    }
    this.offlineCache.storeMeasurement(measurement);
  }

  _handleAlertDelivery(alertEvent) {
    if (this.offlineCache.checkConnectivityStatus()) {
      return this.alertManager.emitAlert(alertEvent);
    }
    this.offlineCache.storeAlert(alertEvent);
    return alertEvent;
  }
}

module.exports = EdgeProcessor;
