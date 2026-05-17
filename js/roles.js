/**
 * roles.js
 * Admin / Employee role system for BREWS.CO
 *
 * Roles:
 *   "admin"    — full access to all settings; can push & pull cloud data
 *   "employee" — OOS toggles only; auto-pushes history after shift end
 *   null       — not yet set up (shows pairing screen)
 *
 * How pairing works:
 *   1. Admin opens Settings → sets a Pairing Code (any string they choose).
 *      That code is saved locally AND pushed to Firebase as shopPairingCode.
 *   2. Employee opens the app for the first time → sees role screen.
 *      They tap "I'm an Employee" → enter the code → if it matches cloud,
 *      their device is marked as employee.
 *   3. Admin taps "I'm the Admin" → enters the same code → marked admin.
 */

const ROLE_KEY        = "brewsDeviceRole";   // "admin" | "employee"
const PAIRING_KEY     = "brewsPairingCode";  // the code stored locally on admin

function getRole()    { return localStorage.getItem(ROLE_KEY); }
function isAdmin()    { return getRole() === "admin"; }
function isEmployee() { return getRole() === "employee"; }
function hasRole()    { return !!getRole(); }

function setRole(role) {
  localStorage.setItem(ROLE_KEY, role);
}

function clearRole() {
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(PAIRING_KEY);
}

/**
 * Admin sets their pairing code locally.
 * The code also gets pushed to Firebase in the next syncPush().
 * We store it in brewsSettings so it travels with the settings sync.
 */
function setAdminPairingCode(code) {
  localStorage.setItem(PAIRING_KEY, code.trim());
  // Embed in settings so it syncs via the existing SYNC_KEYS mechanism
  try {
    const s = JSON.parse(localStorage.getItem("brewsSettings") || "{}");
    s._pairingCode = code.trim();
    localStorage.setItem("brewsSettings", JSON.stringify(s));
  } catch {}
}

function getLocalPairingCode() {
  // Try dedicated key first, fall back to settings
  const direct = localStorage.getItem(PAIRING_KEY);
  if (direct) return direct;
  try {
    const s = JSON.parse(localStorage.getItem("brewsSettings") || "{}");
    return s._pairingCode || null;
  } catch { return null; }
}

/**
 * Fetch the pairing code from Firebase to verify employee input.
 * Returns the code string or null.
 */
async function fetchCloudPairingCode() {
  try {
    if (!firebase.apps.length) return null;
    const db   = firebase.firestore();
    const snap = await db.doc("shops/brews-co-main").get();
    if (!snap.exists) return null;
    const data = snap.data();
    // It's embedded in brewsSettings JSON
    const s = JSON.parse(data.brewsSettings || "{}");
    return s._pairingCode || null;
  } catch { return null; }
}

/**
 * Attempt to pair as employee.
 * Returns { ok: true } or { ok: false, error: "..." }
 */
async function pairAsEmployee(enteredCode) {
  if (!enteredCode.trim()) return { ok: false, error: "Please enter the code." };
  try {
    const cloudCode = await fetchCloudPairingCode();
    if (!cloudCode) return { ok: false, error: "No pairing code found in cloud. Ask the admin to push their settings first." };
    if (cloudCode.trim().toLowerCase() !== enteredCode.trim().toLowerCase())
      return { ok: false, error: "Wrong code. Ask your admin for the correct pairing code." };
    setRole("employee");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "Connection error: " + (e.message || "check your internet.") };
  }
}

/**
 * Pair as admin using a code they created.
 * Just saves locally — no cloud check needed (they own the code).
 */
function pairAsAdmin(code) {
  if (!code.trim()) return { ok: false, error: "Please enter a pairing code." };
  setRole("admin");
  setAdminPairingCode(code.trim());
  return { ok: true };
}
