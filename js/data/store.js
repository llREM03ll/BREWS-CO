/**
 * store.js
 * Small safe wrapper around localStorage JSON read/write.
 *
 * Before this file existed, every module repeated its own
 * `JSON.parse(localStorage.getItem(k) || "[]")` inline, and not
 * all of them guarded against corrupted/partial data the same way —
 * e.g. history.js's getAllHistory() used to throw on a corrupted
 * value while settings.js's getSettings() safely fell back to
 * defaults. Centralizing it here means every caller gets the same
 * (safe) behavior, in one place.
 */
(function () {
  function readJSON(key, fallback) {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (e) {
      console.warn(`store.js: corrupted JSON for "${key}", using fallback.`, e);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      // Most commonly QuotaExceededError on very old/full devices.
      console.error(`store.js: failed to write "${key}".`, e);
      return false;
    }
  }

  window.BrewsStore = { readJSON, writeJSON };
})();
