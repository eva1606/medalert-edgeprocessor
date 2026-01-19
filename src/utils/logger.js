function info(msg, obj) {
    console.log(`[INFO] ${msg}`, obj ? obj : "");
  }
  
  function warn(msg, obj) {
    console.log(`[WARN] ${msg}`, obj ? obj : "");
  }
  
  function error(msg, obj) {
    console.log(`[ERROR] ${msg}`, obj ? obj : "");
  }
  
  module.exports = { info, warn, error };
  