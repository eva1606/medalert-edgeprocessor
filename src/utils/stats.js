/**
 * Statistical Utilities
 * ----------------------
 * Provides basic statistical operations used for signal analysis.
 *
 * Implemented explicitly to keep the project self-contained
 * and avoid external dependencies.
 */
/**
 * Computes the arithmetic mean of a numeric array.
 *
 * @param {number[]} arr
 * @returns {number} Mean value or 0 if array is empty
 */
function mean(arr) {
    if (!arr.length) return 0;                                                      // Return 0 for empty input to avoid division by zero
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  
/**
 * Computes the linear regression slope over a sequence of values.
 *
 * The slope represents the trend direction and magnitude
 * and is used for trend-based anomaly detection.
 *
 * @param {number[]} values
 * @returns {number} Regression slope
 */
function slope(values) {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;                                                         // Mean of index positions (0..n-1) for regression calculation
  const yMean = mean(values);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - xMean;
    const dy = values[i] - yMean;
    num += dx * dy;
    den += dx * dx;
  }
  return den === 0 ? 0 : num / den;                                                  // Guard against division by zero in degenerate cases
}
module.exports = { mean, slope };
  