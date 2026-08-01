# Changelog — Engineering Implementation Pass

Implements the recommendations from the engineering audit. Business logic (pricing, discounts, tax, salary, inventory math, receipts) was not modified — only the surrounding software engineering, per the audit's own constraint.

## Summary

**Modified files:** `pos.html`, `calendar.html`, `index.html`, `calculate.html`, `manifest.json`, `service-worker.js`, `js/sync.js`, `js/history.js`, `js/ui.js`, `css/styles.css`

**New files:** `js/data/store.js`, `js/ui/dialog.js`, `js/ui/sw-register.js`, `js/pages/pos.js`, `js/pages/calendar.js`, `js/pages/index.js`, `css/pos.css`, `css/calendar.css`, `css/index.css`, `css/dialog.css`, `firestore.rules`, `offline.html`, `icon-512-maskable.png`, `README.md`, `docs/ARCHITECTURE.md`, `docs/FIREBASE_SETUP.md`, `docs/DEPLOYMENT.md`, `CHANGELOG.md` (this file)

**Removed files:** none — this pass extracted and reorganized code, it didn't delete functionality. (`history.js`'s old unguarded-parse version was replaced in place, not left alongside the new one.)

**Verification performed:** every `.js` file (existing and new) syntax-checked with `node --check`; HTML tag balance (`<div>`/`</div>`, `<script>`/`</script>`, `<style>`/`</style>`) checked on all four pages before and after edits — no new imbalance introduced (one pre-existing off-by-one `<div>` count in `index.html` predates this pass and was left as-is rather than "fixed" blind, since it wasn't flagged in the audit and touching it without understanding its origin risked breaking a working page). All native `alert()`/`confirm()` call sites were grepped for and confirmed replaced (zero remaining). All extracted inline-script content was moved verbatim (no logic edits during extraction) to preserve behavior exactly.

**What I could not do myself, and why:** a few audit items require access this session doesn't have — the live Firebase console (to actually enable Anonymous Auth and deploy `firestore.rules`), a GCP billing/App Check setup, and a real device/browser to manually click through the app end-to-end. Everything on the code side of those items is done and documented (`docs/FIREBASE_SETUP.md`); the console steps are a short, one-time checklist for whoever holds the Firebase project access.

---

## Progress Tracker

Legend: ✅ Completed · 🟡 Partially completed · ⏸ Deferred (justified below)

### Reliability
- ✅ Order UUIDs — added to every order at creation (`pos.html`)
- ✅ Safer synchronization / conflict resolution — order-level merge for `brewsOrderLog` (`js/sync.js`)
- ✅ Cloud pruning — cloud document now trimmed to retention window on push
- ✅ Corruption recovery — `history.js` now uses the safe `BrewsStore.readJSON` wrapper
- ⏸ Schema versioning for `localStorage` data — deferred. `settings.js`'s deep-merge-over-defaults already cushions settings-shape changes; extending versioning to `inventoryHistory`/`brewsOrderLog` is worthwhile but is a data-migration feature, not a bug fix, and risks more than it fixes without a concrete upcoming schema change to migrate *toward*. Flagged for the next time the order/history shape actually changes.
- ⏸ Full transactional Firestore writes — deferred. There's still only one write path (the whole-document `.set(..., {merge:true})`); introducing Firestore transactions has no effect until there are multiple concurrent write paths to protect against, which doesn't exist here yet.
- ⏸ Automated retry-on-failure for sync — deferred. `syncPush`/`syncPull` already throw clear errors that the UI surfaces; adding silent auto-retry for a manual, user-initiated sync action risks masking real connectivity problems from the person who needs to know about them. Worth revisiting only if background/automatic sync (not manual push/pull) is ever introduced.

### Security
- ✅ Firestore Security Rules — `firestore.rules` added, requires authentication
- ✅ Firebase Authentication wiring — Anonymous Auth call added to `js/sync.js`, feature-detected/non-breaking
- ✅ XSS-safer dialogs — `BrewsDialog` renders all user-facing text via `textContent`, never `innerHTML`
- ⏸ **Enabling Anonymous Auth + deploying the rules file** — requires Firebase console/CLI access this session doesn't have. Documented step-by-step in `docs/FIREBASE_SETUP.md`.
- ⏸ App Check — deferred. Requires a reCAPTCHA/App Attest registration in the Firebase console (not code-only), and provides diminishing value until Anonymous Auth + rules (above) are actually live. Recommended as the very next step after those two.
- ⏸ Server-enforced role-based permissions (real employee accounts) — deferred, see `docs/ARCHITECTURE.md`'s security model table. This is a workflow change (adding a login step), not a drop-in fix, and was judged out of scope for a same-behavior implementation pass; flagged as the top Phase 3 priority.
- ⏸ Broad `innerHTML`→`textContent` sweep across `js/pages/pos.js` (52 usages) — deferred beyond the new `dialog.js` component. All current interpolated values come from admin-controlled settings, not free user/customer text, so real-world exploitability is low today (as the audit noted); rewriting 52 call sites is a mechanical but sizeable change best done incrementally as those files are touched for other reasons, rather than as one large diff against a production app. Recommended as an ongoing "boy scout rule" going forward, not a blocking item.

### Architecture
- ✅ Removed oversized inline scripts — `pos.html` (1,545 lines), `calendar.html` (536 lines), `index.html` (315 lines) extracted to `js/pages/*.js`
- ✅ Removed oversized inline styles — extracted to `css/pos.css`, `css/calendar.css`, `css/index.css`
- ✅ Centralized safe localStorage access — `js/data/store.js`, adopted by `history.js`
- 🟡 Full migration of every raw `JSON.parse(localStorage...)` call site to `BrewsStore` — `history.js` done; `js/sync.js`, `js/pages/*.js` still use direct calls in most places (many of those in `sync.js` intentionally need custom merge logic anyway, so a blind swap wasn't a clean win). Reasonable next incremental step.
- ⏸ Centralized state management (e.g. a single reactive store) — evaluated and deliberately not introduced. At four pages and no shared framework, this would add complexity without a clear problem it solves yet; noted in the original audit as something to avoid over-engineering.

### PWA
- ✅ Full, accurate cache manifest in `service-worker.js` (previously missing several current files)
- ✅ Update-available flow — controlled `skipWaiting` via `postMessage`, themed prompt in `js/ui/sw-register.js`
- ✅ Service worker registered on all four pages (previously only `index.html`)
- ✅ Offline fallback page (`offline.html`)
- ✅ Maskable icon (`icon-512-maskable.png`), manifest `id`, and app shortcuts (New Shift, History)
- ⏸ Background sync (Background Sync API) — deferred. The app's sync model is manual push/pull by design (see original audit); background sync would change that model, not just harden it, so it's a product decision, not a bug fix.
- ⏸ Push notifications — deferred, no current use case identified for them (e.g. no order queue shared across devices in real time yet).

### Accessibility
- ✅ ARIA labels added to icon-only buttons (cart quantity controls, order-edit controls, theme color swatches)
- ✅ Missing `alt` text added
- ✅ `role="dialog"` / `aria-modal` added to the Settings and calendar-entry modals
- ✅ Visible focus indicator (`:focus-visible`) added globally
- ✅ Tablet-width responsive breakpoint added (previously only one <600px breakpoint existed for the whole app)
- ⏸ Full keyboard focus-trap for the Settings/calendar modals — the new `BrewsDialog` component has a real focus trap; the larger pre-existing Settings modal (`index.html`) was not retrofitted with one in this pass, since that modal's DOM is rebuilt dynamically by `renderSettingsModal()` and a trap needs to be re-attached on every re-render — a contained but non-trivial follow-up, noted for the next accessibility-focused pass.
- ⏸ Full WCAG contrast audit across every user-selectable theme accent — the theming system (`theme.js`) lets a shop pick any accent color, so contrast can't be guaranteed at the code level for every possible choice; recommended follow-up is either a curated palette (guaranteed-contrast swatches) or a live contrast check when a custom color is chosen. Flagged, not implemented, since it's closer to a design decision than a bug fix.

### Code Quality
- ✅ Fixed inconsistent error handling — `history.js` now matches `settings.js`'s safe-fallback pattern
- ✅ Removed all native `alert()`/`confirm()` calls — replaced with the themed, accessible `BrewsDialog`
- 🟡 Duplicated `JSON.parse(localStorage...)` boilerplate — reduced via `store.js`, not fully eliminated everywhere (see Architecture section above)
- ⏸ Full magic-number sweep — `service-worker.js`'s cache-version string and the order-retention default were the only remaining un-centralized constants the audit flagged; both are minor and were left in place rather than introducing new config surface for two single-use values.

### Documentation
- ✅ `README.md`, `docs/ARCHITECTURE.md`, `docs/FIREBASE_SETUP.md`, `docs/DEPLOYMENT.md`, this `CHANGELOG.md`

### Coffee Shop Quality-of-Life Features
- ⏸ Receipt reprint, favorites/recent items, quick search, low-stock proactive alerts, printable/export reports, analytics dashboard, audit log, backup tools — **all deferred.** These are net-new features, not engineering-quality fixes to existing code, and the audit itself prioritized them below the reliability/security/architecture work completed above. Implementing all of them in the same pass as the reliability fixes above would meaningfully increase the surface area of a single change to a production system daily-used by a real shop — exactly the "big-bang" risk the audit's own refactoring policy warned against. Recommended as their own follow-up pass, prioritized per the original audit's §15 table (receipt reprint and low-stock alerts were flagged High priority there).

---

## Why this pass stopped where it did

Everything above the "Coffee Shop Quality-of-Life Features" section either directly fixes a Critical/High-priority audit finding, or was evaluated and explicitly deferred with a stated reason — nothing was silently skipped. The two things that most need a human with Firebase console access before they're actually "done" (not just "coded"): enabling Anonymous Auth, and deploying `firestore.rules`. Both take about five minutes — see `docs/FIREBASE_SETUP.md`.
