/**
 * sync.js — Firebase Firestore sync for BREWS.CO
 *
 * WORKER  → push: merges history + data  | pull: settings replace + history merge
 * MANAGER → push: settings only          | pull: everything (full replace)
 *
 * History merge rule ("inventoryHistory" — one end-of-day calculation per date):
 *   Cloud entries + local entries are combined by date.
 *   Local always wins on same-date conflict — the device that closed that shift's
 *   calculation is the source of truth for that day. A date only ever has one
 *   calculation, so whole-entry replacement on conflict is correct here.
 *
 * Order-log merge rule ("brewsOrderLog" — many orders can exist per date, placed
 * from multiple devices/tills on the same day):
 *   Unlike inventoryHistory, a date entry here is a CONTAINER of individual orders,
 *   not a single value. Two devices can both take orders on the same calendar day,
 *   so a whole-day replace would silently drop one device's orders if both pushed
 *   before pulling each other's data. Instead, orders are merged INSIDE each date
 *   entry, keyed by each order's stable `uuid` (see pos.html's placeOrder()) —
 *   cloud + local orders are unioned, de-duplicated by uuid, local wins only on an
 *   actual uuid collision (i.e. the same order edited on two devices).
 *
 * This means:
 *   - Workers can SEE all shifts from all devices (cross-check) ✓
 *   - Workers can never accidentally overwrite another worker's day of orders ✓
 *   - Manager sees everything after pulling ✓
 */

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyC7mrSF39Z95nkZUb1ZJ_Cz_c0rf_lz1-Y",
  authDomain:        "brews-co.firebaseapp.com",
  projectId:         "brews-co",
  storageBucket:     "brews-co.firebasestorage.app",
  messagingSenderId: "616181567630",
  appId:             "1:616181567630:web:bd1d78bf8ced49f29f39df",
};

const SHOP_DOC = "shops/brews-co-main";
const SYNC_TS  = "brewsLastSync";
const ROLE_KEY = "brewsDeviceRole"; // "worker" | "manager" — stored locally, never synced

// How many days of order-log / history entries to keep in the CLOUD document.
// Mirrors the local retention setting so the single Firestore document can't
// silently grow past Firestore's 1 MiB per-document limit. See docs/ARCHITECTURE.md.
const CLOUD_RETENTION_DAYS_DEFAULT = 90;

// Worker pushes/pulls these. Array keys are always MERGED, never replaced.
const DATA_KEYS = [
  "inventoryHistory",
  "brewsOrderLog",
  "brewsFlavorOOS",
  "brewsLastEndingCups",
  "brewsOrderRetention",
];

// Manager pushes only these.
const SETTINGS_KEYS = ["brewsSettings"];

// These DATA_KEYS hold arrays of {date,...} objects and use the whole-entry
// date merge strategy (one value per date — see comment block above).
const MERGE_ARRAY_KEYS = ["inventoryHistory"];

// This key holds arrays of {date, orders:[...]} and uses the order-level
// merge strategy instead (many orders per date — see comment block above).
const ORDER_LOG_KEY = "brewsOrderLog";

// ── Role helpers ──────────────────────────────────────────────────────────────
function getDeviceRole() {
  return localStorage.getItem(ROLE_KEY) || "worker";
}
function setDeviceRole(role) {
  localStorage.setItem(ROLE_KEY, role === "manager" ? "manager" : "worker");
}

// ── DB init ───────────────────────────────────────────────────────────────────
let _db = null;
let _authReady = null;

// Anonymous auth is opt-in and feature-detected: if the Firebase project has
// "Anonymous" enabled under Authentication → Sign-in method, every device gets
// a stable request.auth.uid that firestore.rules (see /firestore.rules) can
// require. If it is NOT enabled yet, this fails silently and sync falls back
// to today's unauthenticated behavior — this file does not assume the console
// configuration described in docs/FIREBASE_SETUP.md has been applied yet.
function _ensureAuth(db) {
  if (_authReady) return _authReady;
  _authReady = (async () => {
    try {
      if (typeof firebase === "undefined" || !firebase.auth) return null;
      const auth = firebase.auth();
      if (auth.currentUser) return auth.currentUser;
      const cred = await auth.signInAnonymously();
      return cred.user;
    } catch (e) {
      console.warn("Anonymous auth unavailable — continuing without it. " +
        "See docs/FIREBASE_SETUP.md to enable it.", e.code || e);
      return null;
    }
  })();
  return _authReady;
}

function _initDB() {
  if (_db) return _db;
  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _db = firebase.firestore();
    return _db;
  } catch (e) {
    console.error("Firebase init failed:", e);
    return null;
  }
}

// ── Merge helpers ─────────────────────────────────────────────────────────────
// Combines two {date,...} arrays. localArr wins on same-date conflict.
// Correct for single-value-per-date data (inventoryHistory). Do not reuse for
// brewsOrderLog — see _mergeOrderLog below.
function _mergeByDate(cloudArr, localArr) {
  const map = {};
  (cloudArr || []).forEach(e => { if (e.date) map[e.date] = e; });
  (localArr  || []).forEach(e => { if (e.date) map[e.date] = e; });
  return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
}

// Combines two brewsOrderLog arrays ({date, orders:[...], savedAt}) by merging
// the `orders` sub-array within each date, keyed by each order's `uuid`.
// Falls back to a synthetic key (time+id) for legacy orders saved before uuids
// existed, so old data is never dropped by this change.
function _orderKey(o) {
  return o.uuid || `legacy:${o.time || ""}:${o.id ?? ""}`;
}
function _mergeOrdersWithinDay(cloudOrders, localOrders) {
  const map = {};
  (cloudOrders || []).forEach(o => { map[_orderKey(o)] = o; });
  (localOrders || []).forEach(o => { map[_orderKey(o)] = o; }); // local wins only on a true uuid collision
  return Object.values(map).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}
function _mergeOrderLog(cloudArr, localArr) {
  const byDate = {};
  (cloudArr || []).forEach(e => { if (e.date) byDate[e.date] = { date: e.date, orders: e.orders || [], savedAt: e.savedAt || 0 }; });
  (localArr || []).forEach(e => {
    if (!e.date) return;
    const existing = byDate[e.date];
    if (!existing) { byDate[e.date] = { date: e.date, orders: e.orders || [], savedAt: e.savedAt || 0 }; return; }
    byDate[e.date] = {
      date: e.date,
      orders: _mergeOrdersWithinDay(existing.orders, e.orders || []),
      savedAt: Math.max(existing.savedAt || 0, e.savedAt || 0),
    };
  });
  return Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
}

// Trims a {date,...} array down to the retention window before it goes to the
// cloud, so the single Firestore document can't grow without bound (the old
// local-only cleanupOrderLogs() in pos.html never pruned the cloud copy).
function _pruneForCloud(arr, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return (arr || []).filter(e => {
    const ts = e.savedAt || new Date((e.date || "1970-01-01") + "T23:59:59").getTime();
    return ts > cutoff;
  });
}

// ── Push ──────────────────────────────────────────────────────────────────────
async function syncPush() {
  const db = _initDB();
  if (!db) throw new Error("Firebase unavailable — check your connection.");
  await _ensureAuth(db); // no-op if Anonymous auth isn't enabled yet — see docs/FIREBASE_SETUP.md

  const role = getDeviceRole();
  const retentionDays = parseInt(localStorage.getItem("brewsOrderRetention") || "", 10) || CLOUD_RETENTION_DAYS_DEFAULT;

  if (role === "manager") {
    // Manager: push settings only, leaves all worker data untouched in Firestore
    const data = {};
    SETTINGS_KEYS.forEach(k => {
      const v = localStorage.getItem(k);
      if (v != null) data[k] = v;
    });
    data._settingsPushedAt = new Date().toISOString();
    await _db.doc(SHOP_DOC).set(data, { merge: true });

  } else {
    // Worker: fetch cloud first so we can merge history arrays
    let cloudData = {};
    try {
      const snap = await _db.doc(SHOP_DOC).get();
      if (snap.exists) cloudData = snap.data();
    } catch (e) {
      console.warn("Could not fetch cloud for merge — pushing local only:", e);
    }

    const data = {};

    // Merge single-value-per-date history keys (cloud + local, local wins same date)
    MERGE_ARRAY_KEYS.forEach(k => {
      const cloudArr = JSON.parse(cloudData[k] || "[]");
      const localArr = JSON.parse(localStorage.getItem(k) || "[]");
      const merged   = _pruneForCloud(_mergeByDate(cloudArr, localArr), retentionDays);
      data[k] = JSON.stringify(merged);
      // Also update local so this worker sees all shifts after pushing
      localStorage.setItem(k, data[k]);
    });

    // Order log: merge ORDERS WITHIN each date, not whole date entries (see
    // header comment) — this is what prevents two tills' same-day orders
    // from overwriting one another.
    {
      const cloudArr = JSON.parse(cloudData[ORDER_LOG_KEY] || "[]");
      const localArr = JSON.parse(localStorage.getItem(ORDER_LOG_KEY) || "[]");
      const merged   = _pruneForCloud(_mergeOrderLog(cloudArr, localArr), retentionDays);
      data[ORDER_LOG_KEY] = JSON.stringify(merged);
      localStorage.setItem(ORDER_LOG_KEY, data[ORDER_LOG_KEY]);
    }

    // Non-array data keys: local wins outright
    DATA_KEYS.filter(k => k !== ORDER_LOG_KEY && !MERGE_ARRAY_KEYS.includes(k)).forEach(k => {
      const v = localStorage.getItem(k);
      if (v != null) data[k] = v;
    });

    // Dynamic monthly expense keys
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("brewsMonthlyExp_")) data[k] = localStorage.getItem(k);
    }

    data._dataPushedAt = new Date().toISOString();
    await _db.doc(SHOP_DOC).set(data, { merge: true });
  }

  const ts = new Date().toISOString();
  localStorage.setItem(SYNC_TS, ts);
  return ts;
}

// ── Pull ──────────────────────────────────────────────────────────────────────
async function syncPull() {
  const db = _initDB();
  if (!db) throw new Error("Firebase unavailable — check your connection.");
  await _ensureAuth(db);

  const snap = await _db.doc(SHOP_DOC).get();
  if (!snap.exists) throw new Error("No cloud data found yet.\nPush from a device first.");

  const data = snap.data();
  const role = getDeviceRole();

  if (role === "manager") {
    // Full replace — manager sees exactly what's in the cloud
    Object.entries(data).forEach(([k, v]) => {
      if (!k.startsWith("_") && v != null) localStorage.setItem(k, v);
    });

  } else {
    // Worker pull:
    // 1. Settings → replace (prices/flavors always current)
    SETTINGS_KEYS.forEach(k => {
      if (data[k] != null) localStorage.setItem(k, data[k]);
    });

    // 2. History arrays → MERGE by date (worker sees all shifts, local entries never lost)
    MERGE_ARRAY_KEYS.forEach(k => {
      const cloudArr = JSON.parse(data[k] || "[]");
      const localArr = JSON.parse(localStorage.getItem(k) || "[]");
      const merged   = _mergeByDate(cloudArr, localArr);
      localStorage.setItem(k, JSON.stringify(merged));
    });

    // 2b. Order log → MERGE ORDERS WITHIN each date (see header comment)
    {
      const cloudArr = JSON.parse(data[ORDER_LOG_KEY] || "[]");
      const localArr = JSON.parse(localStorage.getItem(ORDER_LOG_KEY) || "[]");
      const merged   = _mergeOrderLog(cloudArr, localArr);
      localStorage.setItem(ORDER_LOG_KEY, JSON.stringify(merged));
    }

    // 3. Everything else (brewsFlavorOOS, brewsLastEndingCups etc.) — keep local
  }

  const ts = new Date().toISOString();
  localStorage.setItem(SYNC_TS, ts);
  return ts;
}

function getLastSyncDisplay() {
  const t = localStorage.getItem(SYNC_TS);
  if (!t) return null;
  return new Date(t).toLocaleString("en-PH", {
    month:"short", day:"numeric", hour:"2-digit", minute:"2-digit"
  });
}
