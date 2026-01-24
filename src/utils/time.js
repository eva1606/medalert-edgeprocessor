/**
 * Time Utilities
 * ---------------
 * Provides helper functions for timestamp handling and conversion.
 */
/**
 * Returns the current timestamp in ISO 8601 format.
 *
 * @returns {string} ISO timestamp
 */
function nowIso() {
    return new Date().toISOString();
  }
/**
 * Converts a timestamp to milliseconds since epoch.
 *
 * Used to enable numeric comparison of timestamps.
 *
 * @param {string} ts - Timestamp
 * @returns {number} Milliseconds since epoch
 */
function toMs(ts) {
  return new Date(ts).getTime();                                                    // Convert timestamp to numeric value for reliable ordering
}
module.exports = { nowIso, toMs };
  