function nowIso() {
    return new Date().toISOString();
  }
  
  function toMs(ts) {
    return new Date(ts).getTime();
  }
  
  module.exports = { nowIso, toMs };
  