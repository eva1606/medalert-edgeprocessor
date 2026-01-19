function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  
  // Simple linear regression slope (x = index)
  function slope(values) {
    const n = values.length;
    if (n < 2) return 0;
  
    // x: 0..n-1
    const xMean = (n - 1) / 2;
    const yMean = mean(values);
  
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      const dx = i - xMean;
      const dy = values[i] - yMean;
      num += dx * dy;
      den += dx * dx;
    }
    return den === 0 ? 0 : num / den;
  }
  
  module.exports = { mean, slope };
  