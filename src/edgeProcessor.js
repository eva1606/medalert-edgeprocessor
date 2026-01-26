/**
 * EdgeProcessor
 * --------------
 * Central orchestration component of the MedAlert system.
 *
 * Responsible for:
 * - Validating incoming measurements
 * - Ensuring offline-safe persistence of raw data
 * - Managing sliding windows per patient and measurement type
 * - Performing anomaly detection (threshold & trend)
 * - Handling alert generation, debouncing, and delivery
 *
 */
const fs = require("fs");
const path = require("path");
const SignalValidator = require("./modules/signalValidator");
const SignalProcessor = require("./modules/signalProcessor");
const AnomalyDetector = require("./modules/anomalyDetector");
const AlertManager = require("./modules/alertManager");
const OfflineCacheManager = require("./modules/offlineCacheManager");
const HistoryRepository = require("./repositories/HistoryRepository");  /* Basel Added */
const { warn, info } = require("./utils/logger");

/**
 * EdgeProcessor orchestrates the full edge-side processing pipeline.
 *
 * Design notes:
 * - Raw measurements are cached before any processing to ensure reliability.
 * - Sliding windows store raw data only.
 * - Noise filtering is applied only during analysis (not on stored data).
 * - Offline cache and alert delivery are handled transparently.
 */

class EdgeProcessor {
  /**
 * Initializes the EdgeProcessor and loads static configuration (v1).
 * Configuration is loaded once at startup and is not updated at runtime.
 */
  constructor({ configPath } = {}) {
    const cfgFile =
      configPath || path.join(__dirname, "config", "thresholds.json");                    // Load configuration file.
    const cfg = JSON.parse(fs.readFileSync(cfgFile, "utf-8"));
    this.cfg = cfg;                                                                       // Store full configuration for potential future use or extensions.
    this.signalValidator = new SignalValidator({
      plausibleRanges: cfg.plausibleRanges
    });
    this.signalProcessor = new SignalProcessor({ windowSize: cfg.windowSize });           // Initialize sliding window size from configuration (configurable behavior).
    this.anomalyDetector = new AnomalyDetector({                                          // Anomaly detector supports both threshold-based and trend-based detection.   
      thresholds: cfg.thresholds,
      trendConfig: cfg.trend
    });
    this.alertManager = new AlertManager({                                                // Severity levels are determined by a configurable policy (not hardcoded).
  debounceMs: cfg.debounceMs,
  severityPolicy: cfg.severityPolicy
});
    this.offlineCacheManager = new OfflineCacheManager();
    this.historyRepository = new HistoryRepository();                                     // add the history repository 
  }

/**
 * Updates the current connectivity state of the edge processor.
 *
 * When set to offline, measurements and alerts are cached locally.
 * When online, data is delivered immediately.
 *
 * @param {boolean} flag - Connectivity status
 */
  setOnline(flag) {
    this.offlineCacheManager.setOnline(flag);
  }

/**
 * Validates the quality and structure of an incoming measurement.
 *
 * Wrapper method:
 * This abstraction allows the validation logic or validation module
 * to be replaced or extended in the future without changing
 * the EdgeProcessor workflow.
 *
 * @param {Object} measurement - Raw measurement data
 * @returns {Object} Validation result
 */
  checkQuality(measurement) {                            
    return this.signalValidator.buildValidationResult(measurement);
  }

/**
 * Performs threshold-based anomaly detection on a sliding window.
 *
 * Wrapper method:
 * Allows the anomaly detection strategy or module implementation
 * to be replaced without affecting the orchestration logic.
 *
 * @param {Array} window - Sliding window of measurements
 * @param {string} type - Measurement type
 * @returns {Object|null} Detected anomaly or null
 */
  analyzeThreshold(window, type) {                       
    return this.anomalyDetector.detectThresholdAnomaly(window, type);
  }

/**
 * Performs trend-based anomaly detection on a sliding window.
 *
 * Wrapper method:
 * Encapsulates trend detection logic to support future
 * algorithmic changes or additional detection strategies.
 *
 * @param {Array} window - Sliding window of measurements
 * @param {string} type - Measurement type
 * @returns {Object|null} Detected anomaly or null
 */
  detectTrend(window, type) {                            
    return this.anomalyDetector.detectTrendAnomaly(window, type);
  }

/**
 * Caches a raw measurement event for offline operation.
 *
 * Wrapper method:
 * Provides a semantic abstraction over the offline cache module,
 * allowing the caching mechanism to be replaced or extended.
 *
 * @param {Object} measurement - Raw measurement data
 */
  cacheEvent(measurement) {                              
    this.offlineCacheManager.storeMeasurement(measurement);
  }

/**
 * Flushes cached events when connectivity is restored.
 *
 * Wrapper method:
 * Separates orchestration logic from cache implementation details.
 *
 * @returns {Array} Flushed cached events
 */
  syncCachedEvents() {                                  
    return this.offlineCacheManager.flushCachedData();
  }

/**
 * Ingests a single measurement and executes the full processing pipeline:
 * 1. Validation
 * 2. Offline-safe caching of raw data
 * 3. Sliding window update (raw)
 * 4. Anomaly detection using smoothed data
 * 5. Alert generation, debouncing, and delivery
 *
 * @param {Object} measurement - Raw measurement data
 * @returns {Object} Processing result (status / alert / anomaly)
 */
  ingestMeasurement(measurement) {
    const validation = this.checkQuality(measurement);                                //Validation check                     
    if (!validation.ok) {
      warn("Measurement discarded", {
        reason: validation.reason,
        measurement
      });
      return { status: "discarded", reason: validation.reason };
    }
    this._handleMeasurementDelivery(measurement);                                     // Cache raw measurement before any processing to ensure offline reliability.
      this.signalProcessor.updateMeasurementWindow(                                   // Processing + window update
      measurement.patientId,
      measurement.measurementType,
      measurement
    );
    this.historyRepository.saveMeasurement(measurement);                              // Save raw measurement locally
  const smoothedWindow = this.signalProcessor.getSmoothedWindow(                      // Use smoothed window for analysis only; raw data is preserved in storage.
  measurement.patientId,
  measurement.measurementType
  );
  const finding =
  this.analyzeThreshold(smoothedWindow, measurement.measurementType) ||
  this.detectTrend(smoothedWindow, measurement.measurementType);
    if (!finding) {                                                                   // Always handle measurement delivery (online/offline)
      return { status: "ok", measurement };
    }
    const canEmit = this.alertManager.applyDebounceRules(                             // Prevent alert flooding by suppressing repeated alerts within a time window.
      measurement.patientId,
      finding
    );
    if (!canEmit) {
      return { status: "ok", measurement, note: "debounced" };
    }
    const alertEvent = this.alertManager.createAlert(
      measurement.patientId,
      finding,
      { measurementType: measurement.measurementType }
    );
    const deliveredAlert = this._handleAlertDelivery(alertEvent);
    this.historyRepository.saveAlert(alertEvent);
    return { status: "alert", alert: deliveredAlert, anomaly: finding };
  }
  flushCachedData() {
    if (!this.offlineCacheManager.checkConnectivityStatus()) {
    return { status: "offline", flushed: null };
  }
  const events = this.syncCachedEvents();
  const flushed = {                                                                     // Adapter for backward compatibility (tests + legacy API)
    measurements: events
      .filter(e => e.type === "measurement")
      .map(e => e.payload),
    alerts: events
      .filter(e => e.type === "alert")
      .map(e => e.payload)
  };
  info("Flushed cached events", {
    totalEvents: events.length
  });
    return { status: "flushed", flushed };
  }

  /**
 * Handles delivery of a raw measurement based on connectivity status.
 * When offline, the measurement is cached locally.
 */
  _handleMeasurementDelivery(measurement) {
    if (this.offlineCacheManager.checkConnectivityStatus()) {
      // Real system: send to backend (API Gateway). Demo: do nothing.
      return;
    }
    this.cacheEvent(measurement);   //modified
  }

/**
 * Handles alert delivery.
 * Alerts are published immediately when online or cached when offline.
 */
  _handleAlertDelivery(alertEvent) {
    if (this.offlineCacheManager.checkConnectivityStatus()) {
      return this.alertManager.publishAlert(alertEvent);
    }
    this.offlineCacheManager.storeAlert(alertEvent);
    return alertEvent;
  }
}
module.exports = EdgeProcessor;
