const fs = require("fs");
const path = require("path");

const SignalValidator = require("./modules/signalValidator");
const SignalProcessor = require("./modules/signalProcessor");
const AnomalyDetector = require("./modules/anomalyDetector");
const AlertService = require("./modules/alertService");
const OfflineCache = require("./modules/offlineCache");
const HistoryRepository = require("./repositories/HistoryRepository");  /* Basel Added */

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
    this.alertService = new AlertService({ debounceMs: cfg.debounceMs });
    this.offlineCache = new OfflineCache();
    this.historyRepository = new HistoryRepository(); /* add the history repository */
  }

  setOnline(flag) {
    this.offlineCache.setOnline(flag);
  }
  filterNoise(measurement) {                             // ADDED
    return this.signalProcessor.applyNoiseFiltering(measurement);
  }

  checkQuality(measurement) {                            // ADDED
    return this.signalValidator.buildValidationResult(measurement);
  }

  analyzeThreshold(window, type) {                       // ADDED
    return this.anomalyDetector.detectThresholdAnomaly(window, type);
  }

  detectTrend(window, type) {                            // ADDED
    return this.anomalyDetector.detectTrendAnomaly(window, type);
  }

  cacheEvent(measurement) {                              // ADDED
    this.offlineCache.storeMeasurement(measurement);
  }

  syncCachedEvents() {                                  // ADDED
    return this.offlineCache.flushCachedData();
  }

  ingestMeasurement(measurement) {
    // 1) Validate
    const validation = this.checkQuality(measurement);  // modified
    if (!validation.ok) {
      warn("Measurement discarded", {
        reason: validation.reason,
        measurement
      });
      return { status: "discarded", reason: validation.reason };
    }

    // 2) Processing + window update
    const filtered = this.filterNoise(measurement);   // modified
    const window = this.signalProcessor.updateMeasurementWindow(
      filtered.patientId,
      filtered.measurementType,
      filtered
    );

    this.historyRepository.saveMeasurement(filtered); /* save the measurement */

    const finding =
      this.analyzeThreshold(window, filtered.measurementType) || // modified
      this.detectTrend(window, filtered.measurementType);        // modified

    // Always handle measurement delivery (online/offline)
    this._handleMeasurementDelivery(filtered);

    if (!finding) {
      return { status: "ok", measurement: filtered };
    }

    const canEmit = this.alertService.applyDebounceRules( // CHANGED: alertService naming
      filtered.patientId,
      finding
    );

    if (!canEmit) {
      return { status: "ok", measurement: filtered, note: "debounced" };
    }

    const alertEvent = this.alertService.createAlert(
      filtered.patientId,
      finding,
      { measurementType: filtered.measurementType }
    );

    const deliveredAlert = this._handleAlertDelivery(alertEvent);
    this.historyRepository.saveAlert(alertEvent);

    return { status: "alert", alert: deliveredAlert, anomaly: finding };
  }

  flushCachedData() {
    if (!this.offlineCache.checkConnectivityStatus()) {
      return { status: "offline", flushed: null };
    }
    const flushed = this.syncCachedEvents(); //modified
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
    this.cacheEvent(measurement);   //modified
  }

  _handleAlertDelivery(alertEvent) {
    if (this.offlineCache.checkConnectivityStatus()) {
      return this.alertService.publishAlert(alertEvent);
    }
    this.offlineCache.storeAlert(alertEvent);
    return alertEvent;
  }
}

module.exports = EdgeProcessor;
