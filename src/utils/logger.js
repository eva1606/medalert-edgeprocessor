/**
 * Logger Utility
 * ---------------
 * Lightweight logging utility providing basic log levels.
 *
 * This implementation is intentionally simple and used for
 * debugging and demonstration purposes (v1).
 */
/**
 * Logs an informational message.
 *
 * @param {string} msg - Log message
 * @param {Object} [obj] - Optional contextual data
 */
function info(msg, obj) {
    console.log(`[INFO] ${msg}`, obj ? obj : "");
  }
/**
 * Logs a warning message.
 *
 * Used to indicate recoverable issues such as invalid or discarded measurements.
 *
 * @param {string} msg
 * @param {Object} [obj]
 */  
function warn(msg, obj) {
  console.log(`[WARN] ${msg}`, obj ? obj : "");
}
module.exports = { info, warn };
  