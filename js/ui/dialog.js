/**
 * dialog.js
 * Themed, accessible replacements for the browser's native alert()/confirm().
 *
 * Why: the rest of the app has a fully custom, themed UI — the native
 * dialogs were the one place that broke out into an unstyled browser popup
 * that also can't be positioned, keyboard-trapped, or read sensibly by a
 * screen reader. These do the same job (block for a yes/no or an
 * acknowledgement) with the same call shape apps typically expect, but as
 * a themed, focus-trapped, ESC-to-cancel modal.
 *
 * Usage:
 *   await BrewsDialog.alert("Saved!");
 *   const ok = await BrewsDialog.confirm("Delete this order?", { danger: true });
 *   if (ok) { ... }
 *
 * Both return Promises, so existing `if (confirm(...))` call sites become
 * `if (await BrewsDialog.confirm(...))` — a small, mechanical, behavior-
 * preserving change at each call site.
 */
(function () {
  let activeResolver = null;

  function buildRoot() {
    let root = document.getElementById("brewsDialogRoot");
    if (root) return root;
    root = document.createElement("div");
    root.id = "brewsDialogRoot";
    document.body.appendChild(root);
    return root;
  }

  function close(result) {
    const root = document.getElementById("brewsDialogRoot");
    if (root) root.innerHTML = "";
    document.removeEventListener("keydown", onKeydown, true);
    if (activeResolver) { const r = activeResolver; activeResolver = null; r(result); }
  }

  function onKeydown(e) {
    if (e.key === "Escape") { e.preventDefault(); close(false); }
    if (e.key === "Tab") {
      // simple focus trap between the two dialog buttons
      const root = document.getElementById("brewsDialogRoot");
      const focusables = root ? root.querySelectorAll("button") : [];
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function render({ message, okLabel, cancelLabel, danger }) {
    const root = buildRoot();
    root.innerHTML = `
      <div class="brews-dialog-backdrop" data-close="cancel">
        <div class="brews-dialog" role="alertdialog" aria-modal="true" aria-describedby="brewsDialogMsg">
          <p id="brewsDialogMsg" class="brews-dialog-msg"></p>
          <div class="brews-dialog-actions">
            ${cancelLabel ? `<button type="button" class="brews-dialog-btn brews-dialog-cancel" data-close="cancel">${cancelLabel}</button>` : ""}
            <button type="button" class="brews-dialog-btn brews-dialog-ok${danger ? " brews-dialog-danger" : ""}" data-close="ok">${okLabel}</button>
          </div>
        </div>
      </div>`;
    // Set message via textContent, not innerHTML, so arbitrary strings (order
    // names, flavor text, etc.) can never be interpreted as markup here.
    root.querySelector("#brewsDialogMsg").textContent = message;

    root.querySelectorAll("[data-close]").forEach(el => {
      el.addEventListener("click", (e) => {
        if (e.target !== el && !el.matches("button")) return; // ignore clicks bubbling from dialog interior on the backdrop
        close(el.getAttribute("data-close") === "ok");
      });
    });
    document.addEventListener("keydown", onKeydown, true);
    const okBtn = root.querySelector(".brews-dialog-ok");
    okBtn.focus();
  }

  function alertDialog(message, opts) {
    opts = opts || {};
    return new Promise(resolve => {
      activeResolver = resolve;
      render({ message, okLabel: opts.okLabel || "OK", cancelLabel: null, danger: false });
    });
  }

  function confirmDialog(message, opts) {
    opts = opts || {};
    return new Promise(resolve => {
      activeResolver = resolve;
      render({
        message,
        okLabel: opts.okLabel || "Confirm",
        cancelLabel: opts.cancelLabel || "Cancel",
        danger: !!opts.danger,
      });
    });
  }

  window.BrewsDialog = { alert: alertDialog, confirm: confirmDialog };
})();
