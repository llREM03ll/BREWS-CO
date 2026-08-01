/**
 * sw-register.js
 * Registers the service worker on EVERY page (previously only index.html did
 * this — a device that was ever deep-linked straight into pos.html without
 * visiting index.html first never got offline support at all).
 *
 * Also implements the missing "update available" flow: the old service
 * worker called self.skipWaiting() unconditionally on install, which meant
 * a newly-cached version could take control of a tab whose in-memory JS was
 * still the OLD version, with no prompt — a version-skew bug, not just a
 * missing nicety. Now the new worker waits; this module asks the user (via
 * the themed dialog, once it's loaded) before activating it and reloading.
 */
(function () {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").then(reg => {
      // A worker may already be waiting (e.g. this tab was opened after an
      // update was cached by another tab).
      if (reg.waiting) promptUpdate(reg);

      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            promptUpdate(reg);
          }
        });
      });
    }).catch(err => console.warn("Service worker registration failed:", err));

    // Reload once the new worker takes control, so the tab picks up the new
    // cached assets instead of running old JS against a new cache.
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });

  async function promptUpdate(reg) {
    // BrewsDialog is loaded on every page alongside this script; fall back
    // to a no-op prompt if somehow unavailable so an update is never silently
    // lost forever.
    const ask = window.BrewsDialog
      ? () => BrewsDialog.confirm("A new version of BREWS.CO is ready.\n\nUpdate now?", { okLabel: "Update", cancelLabel: "Later" })
      : () => Promise.resolve(true);
    const ok = await ask();
    if (ok && reg.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  }
})();
