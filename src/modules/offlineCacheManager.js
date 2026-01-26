/**
 * OfflineCacheManager
 * --------------------
 * Manages temporary storage of measurement and alert events
 * during offline operation.
 *
 * Events are stored in-memory and flushed in chronological order
 * when connectivity is restored.
 *
 * This component provides offline reliability but does not
 * implement persistent storage.
 */
class OfflineCacheManager {
  /**
 * Initializes the offline cache.
 *
 * Design notes:
 * - Events are stored in-memory (v1 implementation).
 * - Both measurements and alerts are stored as unified events.
 * - Connectivity is assumed to be online by default.
 */
    constructor() {
      this.events=[];
      this.isOnline = true;
    }
    /**
   * Updates the current connectivity state.
   *
   * @param {boolean} flag - True if online, false if offline
   */
    setOnline(flag) {
      this.isOnline = !!flag;
    }
    /**
     * Returns the current connectivity status.
     *
     * Wrapper method allows the connectivity logic to be
     * replaced or extended in the future.
     */
    checkConnectivityStatus() {
      return this.isOnline;
    }
    /**
     * Stores a raw measurement event for offline operation.
     *
     * Measurements are wrapped as unified events to preserve
     * chronological ordering across different event types.
     *
     * @param {Object} measurement - Raw measurement data
     */
    storeMeasurement(measurement) {
      this.events.push({
        type: "measurement",
        payload: measurement,
        timestamp: new Date(measurement.timestamp).getTime(),                     // Use the original measurement timestamp to preserve true event order.
        synced: false                                                             // 'synced' flag reserved for future synchronization tracking (v1 placeholder).
      });
    }
    /**
     * Stores an alert event for offline operation.
     *
     * Alerts and measurements are stored in the same event queue
     * to allow unified, chronological synchronization.
     *
     * @param {Object} alertEvent - Generated alert event
     */
    storeAlert(alertEvent) {
      this.events.push({
        type: "alert",
        payload: alertEvent,
        timestamp: new Date(alertEvent.timestamp).getTime(),
        synced: false
      });
    }
    /**
     * Stores an alert event for offline operation.
     *
     * Alerts and measurements are stored in the same event queue
     * to allow unified, chronological synchronization.
     *
     * @param {Object} alertEvent - Generated alert event
     */
    flushCachedData() {
      const flushed =this.events.sort((a,b)=>a.timestamp-b.timestamp);                // Ensure events are synchronized in the order they originally occurred.
      this.events=[];
      return flushed;
    }
  }
  module.exports = OfflineCacheManager;
  