# BREWS.CO Inventory & POS System

A Progressive Web App for running daily shifts, sales, and inventory at BREWS.CO — a static, no-build, no-framework PWA (plain HTML/CSS/JS) that syncs across devices through a single Firebase Firestore document.

This README, `docs/ARCHITECTURE.md`, `docs/FIREBASE_SETUP.md`, `docs/DEPLOYMENT.md`, and `CHANGELOG.md` were added as part of the engineering audit → implementation pass documented in `CHANGELOG.md`. Business logic (pricing, discounts, inventory math, salary computation) was **not** touched during that pass — only the surrounding software engineering.

## Quick start (local development)

No build step, no npm install. This is plain static files:

```bash
# from the project root
python3 -m http.server 8080
# then open http://localhost:8080/index.html
```

Any static file server works — the app just needs to be served over `http`/`https` (not opened via `file://`), because the service worker and `localStorage` both require a real origin.

## Pages

| File | Purpose |
|---|---|
| `index.html` | Home / manager dashboard, settings, cloud sync, theming |
| `pos.html` | The till — order entry, checkout, shift open/close |
| `calendar.html` | History browser — past shifts, order logs |
| `calculate.html` | End-of-shift cup-count calculation |

## Where things live

```
├── index.html / pos.html / calendar.html / calculate.html   (thin-ish page shells)
├── manifest.json, service-worker.js, offline.html            (PWA)
├── firestore.rules                                            (deploy via Firebase CLI — see docs/FIREBASE_SETUP.md)
├── css/
│   ├── styles.css      (shared design tokens + components used on every page)
│   ├── dialog.css       (themed alert/confirm replacement — see js/ui/dialog.js)
│   └── pos.css, calendar.css, index.css  (page-specific styles, extracted from what used
│                                            to be large inline <style> blocks)
├── js/
│   ├── InventorySystem.js, settings.js     (pure business logic + config — do not touch
│   │                                          without checking with whoever owns pricing)
│   ├── storage.js, history.js, sync.js      (persistence + Firestore sync)
│   ├── data/store.js                         (safe localStorage JSON read/write helper)
│   ├── theme.js, nav.js, header.js            (shared UI chrome)
│   ├── ui/dialog.js, ui/sw-register.js         (themed dialogs, service-worker lifecycle)
│   └── pages/pos.js, pages/calendar.js,
│       pages/index.js                           (per-page logic, extracted from what used
│                                                   to be inline <script> blocks in each HTML file)
```

## `localStorage` key inventory

| Key | Holds | Synced? |
|---|---|---|
| `brewsSettings` | Prices, salary config, flavor lists, add-ons | Yes — settings-only, pushed by manager devices |
| `inventoryHistory` | One end-of-day calculation per date | Yes — merged by date |
| `brewsOrderLog` | Orders placed, grouped by date | Yes — merged **per order**, not per day (see `docs/ARCHITECTURE.md`) |
| `brewsFlavorOOS` | Which flavors are currently out of stock | Yes |
| `brewsLastEndingCups` | Carry-over cup counts between shifts | Yes |
| `brewsOrderRetention` | How many days of history to keep locally | Yes |
| `brewsShiftActive`, `brewsShiftResult`, `brewsInputState` | In-progress shift/session state | No — device-local only |
| `brewsDeviceRole` | `"worker"` or `"manager"` — a UI mode, not an access-control credential (see security note below) | No — device-local only |
| `brewsThemeAccent`, `brewsThemeBg` | Per-device theming | No |
| `brewsMonthlyExp_*` | Monthly expense entries (one key per month) | Yes |
| `brewsLastSync` | Timestamp of last successful sync | No |

## Security note (read this before deploying to a new device or shop)

`brewsDeviceRole` is a convenience UI toggle, not a security boundary — anyone with the app open can switch a device to "manager" mode. Real protection comes from `firestore.rules` (now included in this repo) plus Firebase Authentication, which needs a one-time setup step in the Firebase console — see **`docs/FIREBASE_SETUP.md`**. Until that setup step is done, the rules file alone still closes the "no rules at all" gap that existed before this pass, but does not yet enforce worker vs. manager permissions at the database level.

## Further reading

- `docs/ARCHITECTURE.md` — how the app is structured, and the reasoning behind the sync/merge strategy
- `docs/FIREBASE_SETUP.md` — one-time Firebase console steps (Anonymous Auth, deploying rules)
- `docs/DEPLOYMENT.md` — how to ship an update, including the service-worker cache version bump
- `CHANGELOG.md` — what changed in this engineering pass, and why
