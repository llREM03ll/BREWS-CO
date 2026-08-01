// Safety fallback — if settings.js failed to load, define a no-op
if (typeof getSettings !== "function") {
  const _D = {
    prices:{ M:29,L:39,S:25,MC:35,LC:45,HC:45,FTM:29,FTL:39 },
    addonPrices:{"Pearl":6,"Nata":6,"Coffee Jelly":6,"Oreo":6,"Cream Cheese":10,"Espresso Shot":6},
    salaryBase:350,salaryBonusThreshold:3000,salaryBonusPerK:50,
    quotaStart:3000,lowStock:5,
    flavors:{
      milktea:["Chocolate","Red Velvet","Dark Chocolate","Choco Kisses","Nutella","Black Forest","Mocha","Taro","Cheesecake","Strawberry","Mango Cheesecake","Winter Melon","Okinawa","Salted Caramel","Matcha","Cookies & Cream","Cappuccino","Avocado","Buko Pandan","Vanilla","Hokkaido"],
      fruittea:["Lychee","Blueberry","Green Apple","Mango","Four Seasons","Passion Fruit","Lemon","Kiwi","Strawberry Ft"],
      icedcoffee:["Caramel Macchiato","Vanilla","Matcha","Dark Chocolate","Salted Caramel","Mocha","Spanish Latte","Chocolate","Brewsco"],
      hotcoffee:["Matcha","Chocolate","Brewsko","Caramel Latte","Spanish Latte"],
    }
  };
  window.getSettings  = () => JSON.parse(JSON.stringify(_D));
  window.saveSettings = () => {};
  window.resetSettings= () => {};
}
const FLAVOR_OOS_KEY = "brewsFlavorOOS";
// Storage format:
//   plain "FlavorName"   → shared across milktea, icedcoffee, hotcoffee (same physical containers)
//   "FT:FlavorName"      → fruit tea only (separate containers)

function flavorKey(cat, flavor) {
  return cat === "fruittea" ? "FT:" + flavor : flavor;
}
function getOOSFlavors() {
  try { return new Set(JSON.parse(localStorage.getItem(FLAVOR_OOS_KEY) || "[]")); } catch { return new Set(); }
}
function saveOOSFlavors(set) {
  localStorage.setItem(FLAVOR_OOS_KEY, JSON.stringify([...set]));
}
function isFlavorOOS(cat, flavor) {
  return getOOSFlavors().has(flavorKey(cat, flavor));
}
function toggleFlavorOOS(cat, flavor) {
  const set = getOOSFlavors();
  const key = flavorKey(cat, flavor);
  if (set.has(key)) set.delete(key); else set.add(key);
  saveOOSFlavors(set);
}

function openFlavorSettings() {
  renderFlavorSettings();
  document.getElementById("flavorSettingsModal").classList.add("open");
}
function closeFlavorSettings() {
  document.getElementById("flavorSettingsModal").classList.remove("open");
  // Refresh drink buttons in case oos status changed
  renderDrinkButtons();
}
function handleFlavorSettingsOverlay(e) {
  if (e.target === document.getElementById("flavorSettingsModal")) closeFlavorSettings();
}

function renderFlavorSettings() {
  const body = document.getElementById("flavorSettingsBody");
  const CAT_LABELS = { milktea:"Milk Tea", fruittea:"Fruit Tea", icedcoffee:"Iced Coffee", hotcoffee:"Hot Coffee" };
  const SHARED_GROUP = ["milktea","icedcoffee","hotcoffee"];

  // Build shared map within the coffee/milktea group
  const sharedMap = {};
  SHARED_GROUP.forEach(cat => {
    (FLAVORS[cat] || []).forEach(f => {
      if (!sharedMap[f]) sharedMap[f] = [];
      sharedMap[f].push(cat);
    });
  });

  body.innerHTML = `
    <div style="background:#fdf5eb;border:1.5px solid var(--latte);border-radius:11px;padding:10px 13px;font-size:0.78rem;color:var(--bark);margin-bottom:14px;line-height:1.55;">
      ☕ Same-named flavors in Milk Tea, Iced Coffee & Hot Coffee share one container — toggling one marks it out across all three. Fruit Tea has separate containers.
    </div>` +
  Object.entries(FLAVORS).map(([cat, flavors]) => {
    const sorted = [...flavors].sort((a,b) => a.localeCompare(b));
    const pills = sorted.map(f => {
      const oos = isFlavorOOS(cat, f);
      return `<button class="fsettings-pill${oos?" oos":""}"
        onclick="toggleFlavorOOS('${cat}','${f.replace(/'/g,"\\'")}');renderFlavorSettings();">
        <span style="flex:1;text-align:left;">${f}</span>
        <span class="fsettings-dot"></span>
      </button>`;
    }).join("");
    return `<div class="fsettings-cat">
      <div class="fsettings-cat-title">${CAT_LABELS[cat] || cat}</div>
      <div class="fsettings-grid">${pills}</div>
    </div>`;
  }).join("");
}

// ════════════════════════════════════════════════════
//  CATALOGUE  (built from settings at runtime)
// ════════════════════════════════════════════════════

function buildCatalogue() {
  const cfg = getSettings();
  const p   = cfg.prices;
  const ap  = cfg.addonPrices;

  DRINKS.length = 0;
  DRINKS.push(
    { code:"M",   name:"Milktea M",     icon:"🧋", price:p.M   ?? 29, cup:"M"  },
    { code:"L",   name:"Milktea L",     icon:"🧋", price:p.L   ?? 39, cup:"L"  },
    { code:"MC",  name:"Iced Coffee M", icon:"☕", price:p.MC  ?? 35, cup:"M"  },
    { code:"LC",  name:"Iced Coffee L", icon:"☕", price:p.LC  ?? 45, cup:"L"  },
    { code:"HC",  name:"Hot Coffee",    icon:"☕", price:p.HC  ?? 45, cup:"HC" },
    { code:"S",   name:"Milktea S",     icon:"🧋", price:p.S   ?? 25, cup:"S"  },
    { code:"FTM", name:"Fruit Tea M",   icon:"🍵", price:p.FTM ?? 29, cup:"M"  },
    { code:"FTL", name:"Fruit Tea L",   icon:"🍵", price:p.FTL ?? 39, cup:"L"  }
  );

  ADDONS.length = 0;
  Object.entries(ap).forEach(([name, price]) => ADDONS.push({ name, price }));

  Object.assign(FLAVORS, cfg.flavors);
}

const DRINKS  = [];
const ADDONS  = [];
const FLAVORS = {};

const DRINK_FLAVOR_CAT = {
  M:"milktea", L:"milktea", S:"milktea",
  FTM:"fruittea", FTL:"fruittea",
  MC:"icedcoffee", LC:"icedcoffee",
  HC:"hotcoffee",
};

const RECEIPT_MS       = 5500;
const POS_KEY          = "brewsPOSState";
const SHIFT_KEY        = "brewsShiftResult";
const SHIFT_ACTIVE_KEY = "brewsShiftActive";

function getLowStock() { return getSettings().lowStock ?? 5; }
function getQuotaStart() { return getSettings().quotaStart ?? 3000; }

// ════════════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════════════
let state = {
  begM:0, begL:0, begS:0, begHC:0,
  currentItems:  [],       // each item now carries its own { addons: {name: qty} }
  orders:        [],
  shiftTotal:    0,
  expenses:      [],
  pendingPaidOnline: false, // Paid Online (GCash) toggle for the order being built
  shiftStartTime: null,  // timestamp ms
};

const GCASH_EXPENSE_NAME = "GCash (Paid Online)";

let flavorToastTimer = null;
function showFlavorToast(msg) {
  const t = document.getElementById("flavorToast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  if (flavorToastTimer) clearTimeout(flavorToastTimer);
  flavorToastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}
let receiptTimer       = null;
let clockInterval      = null;
let nextQuotaThreshold = 0; // set properly on startShift/resumeShift from settings

// ════════════════════════════════════════════════════
//  PERSISTENCE
// ════════════════════════════════════════════════════
function saveState() { localStorage.setItem(POS_KEY, JSON.stringify(state)); }
function loadState() {
  try { const r = localStorage.getItem(POS_KEY); if (r) state = JSON.parse(r); } catch {}
}
function clearPOSState() {
  localStorage.removeItem(POS_KEY);
  localStorage.removeItem(SHIFT_ACTIVE_KEY);
}

// ════════════════════════════════════════════════════
//  SALES TALLY — persistent, all-time best-seller tracking
//  (separate from the shift-scoped order log; never reset by End Shift)
// ════════════════════════════════════════════════════
const SALES_TALLY_KEY = "brewsSalesTally";

function getSalesTally() {
  try { return JSON.parse(localStorage.getItem(SALES_TALLY_KEY)) || {}; } catch { return {}; }
}
function saveSalesTally(t) { localStorage.setItem(SALES_TALLY_KEY, JSON.stringify(t)); }

// qtyDelta is a raw cup count (+/-), applied against one cart/order item.
function bumpSalesTallyDelta(item, qtyDelta) {
  if (!qtyDelta) return;
  const tally = getSalesTally();
  const key = item.code + "|" + (item.flavor || "");
  if (!tally[key]) tally[key] = { name: item.name, flavor: item.flavor || "", qty: 0, revenue: 0 };
  const unitRevenue = item.unitPrice + getItemAddonTotal(item); // per-cup, incl. its own add-ons
  tally[key].qty     += qtyDelta;
  tally[key].revenue += unitRevenue * qtyDelta;
  if (tally[key].qty <= 0) delete tally[key];
  saveSalesTally(tally);
}

// Applies a whole order's items at once (sign = +1 to add, -1 to reverse/void/undo).
function bumpSalesTally(items, sign) {
  (items || []).forEach(it => bumpSalesTallyDelta(it, sign * it.qty));
}


// ════════════════════════════════════════════════════
//  ORDER LOG — save full shift orders for history page
// ════════════════════════════════════════════════════
const ORDER_LOG_KEY  = "brewsOrderLog";
const RETENTION_KEY  = "brewsOrderRetention";

function saveOrderLog() {
  const logDate = new Date().toISOString().split("T")[0];
  const logs    = JSON.parse(localStorage.getItem(ORDER_LOG_KEY) || "[]");
  const idx     = logs.findIndex(l => l.date === logDate);
  const entry   = { date: logDate, orders: state.orders, savedAt: Date.now() };
  if (idx >= 0) logs[idx] = entry; else logs.push(entry);
  localStorage.setItem(ORDER_LOG_KEY, JSON.stringify(logs));
}

function cleanupOrderLogs() {
  const days   = parseInt(localStorage.getItem(RETENTION_KEY) || "7");
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const logs   = JSON.parse(localStorage.getItem(ORDER_LOG_KEY) || "[]");
  const kept   = logs.filter(l => {
    const ts = l.savedAt || new Date(l.date + "T23:59:59").getTime();
    return ts > cutoff;
  });
  localStorage.setItem(ORDER_LOG_KEY, JSON.stringify(kept));
}

// ════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════
function fmt(v) {
  return "₱" + Number(v||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});
}
function timeNow() {
  return new Date().toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"});
}
function vibrate(p) { if (navigator.vibrate) navigator.vibrate(p); }

function remainingCups() {
  const used = {M:0,L:0,S:0,HC:0};
  state.orders.forEach(o => o.items.forEach(i => {
    const d = DRINKS.find(d=>d.code===i.code);
    if (d) used[d.cup] = (used[d.cup]||0) + i.qty;
  }));
  state.currentItems.forEach(i => { used[i.cup] = (used[i.cup]||0) + i.qty; });
  const del = state.deliveries || {M:0,L:0,S:0,HC:0};
  const dmg = state.damages    || {M:0,L:0,S:0,HC:0};
  return {
    M:  state.begM  + (del.M||0)  - (dmg.M||0)  - (used.M||0),
    L:  state.begL  + (del.L||0)  - (dmg.L||0)  - (used.L||0),
    S:  state.begS  + (del.S||0)  - (dmg.S||0)  - (used.S||0),
    HC: state.begHC + (del.HC||0) - (dmg.HC||0) - (used.HC||0),
  };
}

function getQtyForCode(code) {
  return state.currentItems.filter(i=>i.code===code).reduce((s,i)=>s+i.qty,0);
}

function getItemTotal() {
  return state.currentItems.reduce((s,i) => s + i.unitPrice * i.qty, 0);
}

// Add-ons now live on each cart item (per-cup), e.g. item.addons = { "Pearl": 1 }
// The qty stored is "per cup" and scales with the item's own qty.
function getItemAddonTotal(item) {
  return Object.entries(item.addons || {}).reduce((s,[name,qty]) => {
    const a = ADDONS.find(a=>a.name===name);
    return s + (a ? a.price * qty : 0);
  }, 0);
}

function getAddonTotal() {
  return state.currentItems.reduce((s,item) => s + getItemAddonTotal(item) * item.qty, 0);
}

function getOrderTotal() { return getItemTotal() + getAddonTotal(); }

// Aggregate an already-placed order's per-item add-ons into a flat { name: totalQty } map
// (totalQty already accounts for each item's cup quantity).
function aggregateOrderAddons(order) {
  const map = {};
  (order.items || []).forEach(it => {
    Object.entries(it.addons || {}).forEach(([name, qty]) => {
      map[name] = (map[name] || 0) + qty * it.qty;
    });
  });
  return map;
}

// ════════════════════════════════════════════════════
//  CLOCK + SHIFT TIMER
// ════════════════════════════════════════════════════
function fmtElapsed(ms) {
  const total = Math.floor(ms / 1000);
  const h     = Math.floor(total / 3600);
  const m     = Math.floor((total % 3600) / 60);
  const s     = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2,"0")}m`;
  return `${m}m ${String(s).padStart(2,"0")}s`;
}

function startClock() {
  const tick = () => {
    const clockEl = document.getElementById("posClock");
    if (clockEl) clockEl.textContent = timeNow();
    const timerEl = document.getElementById("shiftTimer");
    if (timerEl && state.shiftStartTime)
      timerEl.textContent = fmtElapsed(Date.now() - state.shiftStartTime);
  };
  tick();
  clockInterval = setInterval(tick, 1000);
}

// ════════════════════════════════════════════════════
//  SETUP → START SHIFT
// ════════════════════════════════════════════════════
function startShift() {
  const begM  = Math.max(0, +document.getElementById("setupBegM").value  || 0);
  const begL  = Math.max(0, +document.getElementById("setupBegL").value  || 0);
  const begS  = Math.max(0, +document.getElementById("setupBegS").value  || 0);
  const begHC = Math.max(0, +document.getElementById("setupBegHC").value || 0);

  if (begM + begL + begS + begHC === 0) {
    const err = document.getElementById("setupError");
    err.textContent = "⚠ Enter at least one cup count before starting the shift.";
    err.style.display = "block";
    setTimeout(() => { err.style.display = "none"; }, 3500);
    return;
  }

  state.begM  = begM;
  state.begL  = begL;
  state.begS  = begS;
  state.begHC = begHC;
  state.currentItems=[]; state.pendingPaidOnline=false; state.orders=[]; state.shiftTotal=0; state.expenses=[];
  state.deliveries = {M:0,L:0,S:0,HC:0};
  state.damages    = {M:0,L:0,S:0,HC:0};
  state.shiftStartTime = Date.now();
  nextQuotaThreshold = getQuotaStart();
  localStorage.removeItem("brewsResumeShift");
  localStorage.setItem(SHIFT_ACTIVE_KEY, "1");
  saveState(); showPOS();
}

function showSetup() {
  document.getElementById("setupScreen").style.display="flex";
  document.getElementById("posScreen").style.display="none";
  if(clockInterval) clearInterval(clockInterval);
  const resumeSec = document.getElementById("resumeSection");
  if (resumeSec) resumeSec.style.display = localStorage.getItem("brewsResumeShift") ? "block" : "none";
}

function showPOS() {
  document.getElementById("setupScreen").style.display="none";
  document.getElementById("posScreen").style.display="flex";
  renderDrinkButtons(); renderCurrentOrder();
  renderOrdersLog(); updateHeaderStats(); startClock();
  renderPosExpenses();
  renderStockInputs();
  // Attach swipe-to-dismiss on all modal overlays
  attachSwipeToDismiss("flavorModal",         closeFlavorModal);
  attachSwipeToDismiss("itemAddonModal",      closeItemAddonModal);
  attachSwipeToDismiss("receiptModal",        closeReceiptModal);
  attachSwipeToDismiss("endShiftModal",       closeEndShift);
  attachSwipeToDismiss("flavorSettingsModal", closeFlavorSettings);
}

function resumeShift() {
  const raw = localStorage.getItem("brewsResumeShift");
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    state.begM  = s.begM  || 0; state.begL  = s.begL  || 0;
    state.begS  = s.begS  || 0; state.begHC = s.begHC || 0;
    state.orders      = s.orders      || [];
    state.shiftTotal  = s.shiftTotal  || 0;
    state.expenses    = s.expenses    || [];
    state.deliveries = s.deliveries || {M:0,L:0,S:0,HC:0};
    state.damages    = s.damages    || {M:0,L:0,S:0,HC:0};
    state.currentItems  = [];
    state.pendingPaidOnline = false;
    // Restore correct next quota milestone
    const cupsSoFar = state.orders.reduce((t,o)=>t+o.items.reduce((s,i)=>s+i.unitPrice*i.qty,0),0);
    const qs = getQuotaStart();
    nextQuotaThreshold = Math.max(qs, (Math.floor(cupsSoFar / 1000) + 1) * 1000);
    localStorage.removeItem("brewsResumeShift");
    localStorage.setItem(SHIFT_ACTIVE_KEY, "1");
    saveState(); showPOS();
  } catch { localStorage.removeItem("brewsResumeShift"); }
}

// ════════════════════════════════════════════════════
//  DRINK BUTTONS
// ════════════════════════════════════════════════════
function renderDrinkButtons() {
  const rem  = remainingCups();
  const grid = document.getElementById("drinksGrid");
  grid.innerHTML = "";

  DRINKS.forEach(d => {
    const qty  = getQtyForCode(d.code);
    const left = rem[d.cup] ?? 999;
    const low  = left > 0 && left <= getLowStock();
    const out  = left <= 0;
    const cls  = ["drink-btn",
      qty > 0 ? "has-qty"   : "",
      low      ? "low-stock" : "",
      out      ? "out-stock" : "",
    ].filter(Boolean).join(" ");

    const btn = document.createElement("button");
    btn.className = cls;
    btn.innerHTML = `
      <span class="qty-badge" id="badge-${d.code}">${qty}</span>
      <span class="drink-btn-icon">${d.icon}</span>
      <span class="drink-btn-code">${d.code}</span>
      <span class="drink-btn-name">${d.name}</span>
      <span class="drink-btn-price">${fmt(d.price)}</span>
      <span class="stock-pill">${out ? "OUT" : low ? `${left} left` : left}</span>
    `;
    if (!out) btn.addEventListener("click", () => openFlavorModal(d));
    grid.appendChild(btn);
  });
}

// ════════════════════════════════════════════════════
//  FLAVOR MODAL
// ════════════════════════════════════════════════════
function openFlavorModal(drink) {
  pendingDrink = drink;
  document.getElementById("flavorModal").classList.add("open");
  const search = document.getElementById("flavorSearchInput");
  search.value = "";
  refreshFlavorGrid(drink);
}

function refreshFlavorGrid(drink) {
  document.getElementById("flavorModalTitle").textContent = drink.name;
  document.getElementById("flavorModalSub").textContent   =
    fmt(drink.price) + " per cup  ·  tap to add  ·  hold 2s to close";

  const cat     = DRINK_FLAVOR_CAT[drink.code] || "milktea";
  const flavors = [...(FLAVORS[cat] || [])].sort((a,b) => a.localeCompare(b));
  const grid    = document.getElementById("flavorGrid");
  grid.innerHTML = "";

  const countInOrder = (flavor) =>
    state.currentItems.filter(i => i.code === drink.code && i.flavor === flavor)
                       .reduce((s, i) => s + i.qty, 0);

  // Attach hold-to-close on any button
  function attachHold(btn, onHold) {
    let holdTimer = null;
    const start = () => { holdTimer = setTimeout(() => { onHold(); vibrate(40); }, 500); };
    const cancel = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } };
    btn.addEventListener("mousedown",   start);
    btn.addEventListener("touchstart",  start, { passive: true });
    btn.addEventListener("mouseup",     cancel);
    btn.addEventListener("mouseleave",  cancel);
    btn.addEventListener("touchend",    cancel);
    btn.addEventListener("touchcancel", cancel);
  }

  // No flavor option (always visible, exempt from search filtering)
  const noCount  = countInOrder("");
  const noFlavor = document.createElement("button");
  noFlavor.className = "flavor-btn no-flavor";
  noFlavor.innerHTML = noCount > 0
    ? `— No Flavor — <span class="flavor-count">${noCount}</span>`
    : "— No Flavor / Skip —";
  noFlavor.addEventListener("click", () => addItemToOrder(drink, ""));
  attachHold(noFlavor, () => { addItemToOrder(drink, ""); closeFlavorModal(); });
  grid.appendChild(noFlavor);

  flavors.forEach(f => {
    const count  = countInOrder(f);
    const cat    = DRINK_FLAVOR_CAT[drink.code] || "milktea";
    const oos    = isFlavorOOS(cat, f);
    const btn    = document.createElement("button");
    btn.className = "flavor-btn" + (count > 0 ? " selected" : "") + (oos ? " oos-flavor" : "");
    btn.dataset.name = f.toLowerCase();
    if (oos) {
      btn.style.opacity = ".45"; btn.style.textDecoration = "line-through"; btn.style.cursor = "not-allowed";
      btn.disabled = true;
    }
    btn.innerHTML = count > 0
      ? `<span class="flavor-btn-label">${f}</span> <span class="flavor-count">${count}</span>`
      : `<span class="flavor-btn-label">${f}</span>`;
    if (!oos) {
      btn.addEventListener("click", () => addItemToOrder(drink, f));
      attachHold(btn, () => { addItemToOrder(drink, f); closeFlavorModal(); });
    }
    grid.appendChild(btn);
  });
}

// Live-filters the flavor grid as the person types (name substring match).
function filterFlavorGrid(query) {
  const q     = query.trim().toLowerCase();
  const grid  = document.getElementById("flavorGrid");
  const btns  = grid.querySelectorAll(".flavor-btn:not(.no-flavor)");
  let visible = 0;
  btns.forEach(btn => {
    const match = !q || (btn.dataset.name || "").includes(q);
    btn.style.display = match ? "" : "none";
    if (match) visible++;
  });
  let empty = grid.querySelector(".flavor-empty-msg");
  if (!visible && q) {
    if (!empty) {
      empty = document.createElement("div");
      empty.className = "flavor-empty-msg";
      empty.textContent = "No flavors match “" + query.trim() + "”";
      grid.appendChild(empty);
    }
  } else if (empty) {
    empty.remove();
  }
}

function closeFlavorModal() {
  document.getElementById("flavorModal").classList.remove("open");
  pendingDrink = null;
}

function handleFlavorOverlay(e) {
  if (e.target === document.getElementById("flavorModal")) closeFlavorModal();
}

// ════════════════════════════════════════════════════
//  CURRENT ORDER
// ════════════════════════════════════════════════════
function addItemToOrder(drink, flavor) {
  const rem  = remainingCups();
  const left = rem[drink.cup] ?? 0;
  if (left <= 0) {
    vibe("error");
    showFlavorToast(`Out of ${drink.cup} cups!`);
    // Shake the flavor grid
    const grid = document.getElementById("flavorGrid");
    grid.style.animation = "none";
    void grid.offsetWidth;
    grid.style.animation = "shakeGrid .35s ease";
    return;
  }

  vibe("tap"); playSound("tap");
  const key = drink.code + "||" + flavor;
  const existing = state.currentItems.find(i => i.key === key);
  if (existing) { existing.qty++; }
  else {
    state.currentItems.push({ key, code:drink.code, name:drink.name, icon:drink.icon,
      flavor, qty:1, unitPrice:drink.price, cup:drink.cup, addons:{} });
  }
  saveState(); renderDrinkButtons(); renderCurrentOrder();
  const badge = document.getElementById(`badge-${drink.code}`);
  if (badge) { badge.classList.remove("pop"); void badge.offsetWidth; badge.classList.add("pop"); }
  refreshFlavorGrid(drink);
}

function setItemQty(key, qty) {
  vibe("tap");
  if (qty <= 0) state.currentItems = state.currentItems.filter(i => i.key !== key);
  else { const it = state.currentItems.find(i=>i.key===key); if(it) it.qty = qty; }
  saveState(); renderDrinkButtons(); renderCurrentOrder();
}

function clearCurrentOrder() {
  state.currentItems=[]; state.pendingPaidOnline=false;
  document.getElementById("givenInput").value="";
  document.getElementById("changeDisplay").textContent="Change: —";
  saveState(); renderDrinkButtons(); renderCurrentOrder();
}

function renderCurrentOrder() {
  const container = document.getElementById("orderItems");
  const subtotal  = getOrderTotal();
  document.getElementById("orderSubtotal").textContent = fmt(subtotal);
  document.getElementById("placeOrderBtn").disabled    = state.currentItems.length === 0;
  updatePendingPaidOnlineBtn();

  // Undo button visibility
  const undoBtn = document.getElementById("undoBtn");
  if (state.orders.length > 0) undoBtn.classList.add("visible");
  else undoBtn.classList.remove("visible");

  if (!state.currentItems.length) {
    container.innerHTML = `<div class="empty-order">Tap a drink to start an order</div>`;
    updateChange(); return;
  }

  container.innerHTML = state.currentItems.map(item => {
    const keyEsc      = item.key.replace(/'/g,"\\'");
    const addonEntries = Object.entries(item.addons || {});
    const addonChips  = addonEntries.map(([name,qty]) => `<span class="addon-chip">${qty}× ${name}</span>`).join("");
    const lineTotal   = item.unitPrice * item.qty + getItemAddonTotal(item) * item.qty;
    return `
    <div class="order-item">
      <div class="order-item-info" onclick="openItemAddonModal('${keyEsc}')">
        <div class="order-item-name">${item.name} <span style="opacity:.5;font-size:.75em">(${item.code})</span></div>
        ${item.flavor ? `<div class="order-item-flavor">${item.flavor}</div>` : ""}
        ${addonChips
          ? `<div class="order-item-addons">${addonChips}</div>`
          : `<div class="order-item-addons muted">+ Add-ons</div>`}
      </div>
      <div class="order-item-qty-controls">
        <button class="qty-btn" aria-label="Decrease quantity of ${item.name}" onclick="event.stopPropagation();setItemQty('${keyEsc}', ${item.qty-1})">−</button>
        <span class="order-item-qty">${item.qty}</span>
        <button class="qty-btn" aria-label="Increase quantity of ${item.name}" onclick="event.stopPropagation();setItemQty('${keyEsc}', ${item.qty+1})">+</button>
      </div>
      <span class="order-item-total">${fmt(lineTotal)}</span>
    </div>
  `; }).join("");

  updateChange();
}

// ════════════════════════════════════════════════════
//  ADD-ONS  (per cup — tap a cup in the current order to open this)
// ════════════════════════════════════════════════════
let pendingAddonItemKey = null;

function openItemAddonModal(key) {
  const item = state.currentItems.find(i => i.key === key);
  if (!item) return;
  pendingAddonItemKey = key;
  document.getElementById("itemAddonModalTitle").textContent =
    item.name + (item.flavor ? " · " + item.flavor : "");
  document.getElementById("itemAddonModalSub").textContent =
    `Applies to all ${item.qty} cup${item.qty>1?"s":""} of this item · tap to add, hold/right-click to remove`;
  document.getElementById("itemAddonModal").classList.add("open");
  renderItemAddonGrid();
}

function closeItemAddonModal() {
  document.getElementById("itemAddonModal").classList.remove("open");
  pendingAddonItemKey = null;
  renderCurrentOrder();
}

function handleItemAddonOverlay(e) {
  if (e.target === document.getElementById("itemAddonModal")) closeItemAddonModal();
}

function renderItemAddonGrid() {
  const grid = document.getElementById("itemAddonGrid");
  grid.innerHTML = "";
  const item = state.currentItems.find(i => i.key === pendingAddonItemKey);
  if (!item) return;
  if (!item.addons) item.addons = {};

  ADDONS.forEach(a => {
    const qty = item.addons[a.name] || 0;
    const pill = document.createElement("button");
    pill.className = "addon-pill" + (qty > 0 ? " active" : "");
    pill.innerHTML = qty > 0
      ? `${a.name} <span class="addon-pill-qty">×${qty}</span> <span style="opacity:.6;font-size:.7em">+${fmt(a.price)}</span>`
      : `${a.name} <span style="opacity:.5;font-size:.7em">+${fmt(a.price)}</span>`;
    pill.addEventListener("click", () => {
      vibe("tap");
      item.addons[a.name] = (item.addons[a.name] || 0) + 1;
      saveState(); renderItemAddonGrid(); renderCurrentOrder();
    });
    pill.addEventListener("contextmenu", e => {
      e.preventDefault(); vibe("tap");
      if (item.addons[a.name]) {
        item.addons[a.name]--;
        if (!item.addons[a.name]) delete item.addons[a.name];
        saveState(); renderItemAddonGrid(); renderCurrentOrder();
      }
    });
    grid.appendChild(pill);
  });
}

// ════════════════════════════════════════════════════
//  PAID ONLINE (GCash) — pending toggle for the order being built
// ════════════════════════════════════════════════════
function togglePendingPaidOnline() {
  vibe("tap");
  state.pendingPaidOnline = !state.pendingPaidOnline;
  saveState();
  updatePendingPaidOnlineBtn();
}

function updatePendingPaidOnlineBtn() {
  const btn = document.getElementById("pendingPaidOnlineBtn");
  if (!btn) return;
  btn.classList.toggle("active", !!state.pendingPaidOnline);
  btn.textContent = state.pendingPaidOnline ? "✓ Paid Online (GCash)" : "📱 Paid Online (GCash)";
}

// ════════════════════════════════════════════════════
//  CHANGE CALCULATOR
// ════════════════════════════════════════════════════
function updateChange() {
  const given    = parseFloat(document.getElementById("givenInput").value) || 0;
  const subtotal = getOrderTotal();
  const display  = document.getElementById("changeDisplay");
  if (!given || subtotal === 0) { display.textContent="Change: —"; display.className="change-display"; return; }
  const change = given - subtotal;
  display.textContent = change >= 0 ? `Change: ${fmt(change)}` : `Short: ${fmt(Math.abs(change))}`;
  display.className   = "change-display" + (change < 0 ? " negative" : "");
}

// ════════════════════════════════════════════════════
//  PLACE ORDER
// ════════════════════════════════════════════════════
function placeOrder() {
  if (!state.currentItems.length) return;
  vibe("place");
  playSound("place");

  const given      = parseFloat(document.getElementById("givenInput").value) || 0;
  const addonTotal = getAddonTotal();
  const total      = getItemTotal() + addonTotal;
  const order = {
    id: state.orders.length + 1, // in-shift sequential id, used for on-screen lookups only
    uuid: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
    // ^ stable, device-unique identity so cross-device sync (sync.js) can merge orders
    //   within the same day instead of one device's orders replacing another's.
    items: [...state.currentItems], // each item carries its own addons
    total,
    time: timeNow(),
    given,
    paidOnline: !!state.pendingPaidOnline,
    done: false,
  };

  state.orders.push(order);
  state.shiftTotal += total;
  bumpSalesTally(order.items, 1);
  state.currentItems=[]; state.pendingPaidOnline=false;
  document.getElementById("givenInput").value="";
  saveState();
  syncGcashExpense();

  // Notify at ₱3,000 then every ₱1,000 milestone (cup sales only)
  const _cupSales = computeShiftCupTotal();
  while (_cupSales >= nextQuotaThreshold) {
    showQuotaToast(nextQuotaThreshold);
    nextQuotaThreshold += 1000;
  }

  renderDrinkButtons(); renderCurrentOrder();
  renderOrdersLog(); updateHeaderStats(); showReceipt(order);

  const badge=document.getElementById("ordersCountBadge");
  badge.classList.remove("pulse"); void badge.offsetWidth; badge.classList.add("pulse");
}

// ════════════════════════════════════════════════════
//  MID-SHIFT STOCK (DELIVERIES & DAMAGES)
// ════════════════════════════════════════════════════
function toggleStockPanel() {
  const body   = document.getElementById("posStockBody");
  const toggle = document.getElementById("stockToggle");
  const isOpen = body.classList.toggle("open");
  toggle.classList.toggle("open", isOpen);
}

function saveStockInputs() {
  const g = id => Math.max(0, parseInt(document.getElementById(id)?.value) || 0);
  state.deliveries = { M:g("sDelM"), L:g("sDelL"), S:g("sDelS"), HC:g("sDelHC") };
  state.damages    = { M:g("sDmgM"), L:g("sDmgL"), S:g("sDmgS"), HC:g("sDmgHC") };
  saveState();
  renderDrinkButtons(); // refresh stock counts on drink buttons immediately
  // Update badge in panel header
  const totalDel = Object.values(state.deliveries).reduce((a,b)=>a+b,0);
  const totalDmg = Object.values(state.damages).reduce((a,b)=>a+b,0);
  const badge = document.getElementById("stockBadge");
  if (badge) {
    if (totalDel > 0 || totalDmg > 0) {
      const parts = [];
      if (totalDel > 0) parts.push(`+${totalDel} del`);
      if (totalDmg > 0) parts.push(`−${totalDmg} dmg`);
      badge.textContent = parts.join(" · ");
      badge.style.display = "inline";
    } else {
      badge.style.display = "none";
    }
  }
}

function renderStockInputs() {
  const del = state.deliveries || {M:0,L:0,S:0,HC:0};
  const dmg = state.damages    || {M:0,L:0,S:0,HC:0};
  const sv = (id, val) => { const el=document.getElementById(id); if(el) el.value = val||""; };
  sv("sDelM",del.M); sv("sDelL",del.L); sv("sDelS",del.S); sv("sDelHC",del.HC);
  sv("sDmgM",dmg.M); sv("sDmgL",dmg.L); sv("sDmgS",dmg.S); sv("sDmgHC",dmg.HC);
  saveStockInputs(); // refresh badge
}

// ════════════════════════════════════════════════════
//  UNDO LAST ORDER
// ════════════════════════════════════════════════════
function undoLastOrder() {
  if (!state.orders.length) return;
  vibe("undo");
  const last = state.orders.pop();
  state.shiftTotal -= last.total;
  bumpSalesTally(last.items, -1);
  saveState(); renderDrinkButtons(); renderCurrentOrder(); renderOrdersLog(); updateHeaderStats();
  if (last.paidOnline) syncGcashExpense();
}

function toggleOrderDone(id) {
  const order = state.orders.find(o => o.id === id);
  if (order) { order.done = !order.done; saveState(); renderOrdersLog(); }
}

// ── Void a specific order (any position, not just the last one) ──────────────
async function voidOrder(id) {
  const order = state.orders.find(o => o.id === id);
  if (!order) return;
  const ok = await BrewsDialog.confirm(`Void this order (${fmt(order.total)})? This can't be undone.`, { okLabel: "Void Order", danger: true });
  if (!ok) return;
  vibe("undo");
  state.orders = state.orders.filter(o => o.id !== id);
  state.shiftTotal -= order.total;
  bumpSalesTally(order.items, -1);
  saveState();
  renderDrinkButtons(); renderCurrentOrder(); renderOrdersLog(); updateHeaderStats();
  if (order.paidOnline) syncGcashExpense();
}

// ── Paid Online (GCash): toggling a placed order auto adds/removes its total
//    from a dedicated "GCash (Paid Online)" shift expense, so the cash count
//    at end-of-shift only expects the cash-paid orders. ─────────────────────
function toggleOrderPaidOnline(id) {
  vibe("tap");
  const order = state.orders.find(o => o.id === id);
  if (!order) return;
  order.paidOnline = !order.paidOnline;
  syncGcashExpense();
  renderOrdersLog();
  setTimeout(() => {
    const card = document.getElementById("ordercard-" + id);
    if (card) card.classList.add("expanded");
  }, 20);
}

function syncGcashExpense() {
  const total = state.orders.filter(o => o.paidOnline).reduce((s,o) => s + o.total, 0);
  const idx = state.expenses.findIndex(e => e.name === GCASH_EXPENSE_NAME);
  if (total > 0) {
    if (idx >= 0) state.expenses[idx].price = total;
    else state.expenses.push({ name: GCASH_EXPENSE_NAME, price: total });
  } else if (idx >= 0) {
    state.expenses.splice(idx, 1);
  }
  saveState();
  renderPosExpenses();
}

function renderOrdersLog() {
  const list  = document.getElementById("ordersLogList");
  const badge = document.getElementById("ordersCountBadge");
  badge.textContent = state.orders.length;

  if (!state.orders.length) {
    list.innerHTML=`<div class="no-orders">No orders yet — get brewing! ☕</div>`; return;
  }

  const CODE_LABELS = {
    M:   "Medium",             L:   "Large",
    FTM: "Fruit Tea Medium",   FTL: "Fruit Tea Large",
    MC:  "Iced Coffee Medium", LC:  "Iced Coffee Large",
    S:   "Small",              HC:  "Hot Coffee",
  };
  const CODE_SHORT = {
    M:   "Medium",      L:   "Large",
    FTM: "Fruit Tea M", FTL: "Fruit Tea L",
    MC:  "Iced Coffee M", LC: "Iced Coffee L",
    S:   "Small",       HC:  "Hot Coffee",
  };
  const CODE_ORDER = ["M","L","FTM","FTL","MC","LC","S","HC"];

  list.innerHTML = [...state.orders].reverse().map(order => {
    // ── Summary line: counts by drink type ──
    const codeCounts = {};
    order.items.forEach(i => { codeCounts[i.code] = (codeCounts[i.code]||0) + i.qty; });
    const desc = CODE_ORDER.filter(c => codeCounts[c])
      .map(c => `${codeCounts[c]}× ${CODE_SHORT[c]||c}`).join(", ");

    // ── Expanded detail: items grouped by drink type+size ──
    const byCode = {};
    order.items.forEach(i => {
      const g = i.code || "M";
      if (!byCode[g]) byCode[g] = [];
      byCode[g].push(i);
    });

    const editRows = CODE_ORDER.filter(g => byCode[g]?.length).map(g => {
      const groupItems = byCode[g];
      const groupQty   = groupItems.reduce((s, i) => s + i.qty, 0);

      const rows = groupItems.map(i => `
        <div class="order-edit-row">
          <div class="order-edit-name">
            ${i.flavor || `<em style="opacity:.45;font-style:italic">No Flavor</em>`}
          </div>
          <div class="order-edit-qty-wrap">
            <button class="order-edit-btn remove" aria-label="Decrease quantity"
              onclick="event.stopPropagation();editOrderItem(${order.id},'${i.key.replace(/'/g,"\\'")}','dec')">−</button>
            <span class="order-edit-qty">${i.qty}</span>
            <button class="order-edit-btn" aria-label="Increase quantity"
              onclick="event.stopPropagation();editOrderItem(${order.id},'${i.key.replace(/'/g,"\\'")}','inc')">+</button>
          </div>
          <span class="order-edit-total">${fmt(i.unitPrice*i.qty)}</span>
        </div>`).join("");

      return `<div style="margin-bottom:2px;">
        <div style="display:flex;align-items:center;justify-content:space-between;
          padding:5px 14px 3px;background:var(--parchment);
          border-top:1px solid rgba(226,201,168,0.4);border-bottom:1px solid rgba(226,201,168,0.4);">
          <span style="font-size:0.63rem;font-weight:800;letter-spacing:0.09em;
            text-transform:uppercase;color:var(--mahogany);">${CODE_LABELS[g]||g}</span>
          <span style="font-size:0.62rem;font-weight:600;color:var(--dust);letter-spacing:0;">
            ${groupQty} cup${groupQty > 1 ? "s" : ""}
          </span>
        </div>
        ${rows}
      </div>`;
    }).join("");

    const addonRows = Object.entries(aggregateOrderAddons(order)).map(([name,qty])=>{
      const a=ADDONS.find(a=>a.name===name);
      return `<div class="order-log-detail-row"><span>${qty}× ${name}</span><span>${fmt((a?.price||0)*qty)}</span></div>`;
    }).join("");

    const totalRow = `<div class="order-log-detail-row" style="font-weight:700;color:var(--mahogany);border-top:1px solid var(--latte);margin-top:6px;padding-top:6px;"><span>Total</span><span>${fmt(order.total)}</span></div>`;

    const paymentSection = `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 14px 2px;border-top:1px dashed rgba(226,201,168,0.5);margin-top:4px;">
        <span style="font-size:0.75rem;color:var(--mahogany);font-weight:700;white-space:nowrap;flex-shrink:0;">Given</span>
        <input type="number" id="given-input-${order.id}"
          style="flex:1;min-width:0;padding:5px 9px;border:1.5px solid var(--sand-border);border-radius:8px;
                 font-size:0.84rem;font-family:'Plus Jakarta Sans',sans-serif;
                 background:var(--pearl);color:var(--espresso);"
          value="${order.given || ''}" placeholder="₱0"
          onclick="event.stopPropagation();"
          oninput="event.stopPropagation();updateOrderGiven(${order.id},this.value);">
        <span id="given-change-${order.id}"
          style="font-size:0.82rem;font-weight:700;min-width:82px;text-align:right;
                 font-variant-numeric:tabular-nums;flex-shrink:0;
                 color:${order.given > 0 ? (order.given >= order.total ? 'var(--success-dark)' : 'var(--danger-soft)') : 'var(--bark)'};">
          ${order.given > 0
            ? (order.given >= order.total
                ? `Change: ${fmt(order.given - order.total)}`
                : `Short: ${fmt(order.total - order.given)}`)
            : 'Change: —'}
        </span>
      </div>
      <div style="padding:6px 14px 2px;display:flex;gap:6px;">
        <button class="paid-online-btn small${order.paidOnline?" active":""}" style="flex:1;"
          onclick="event.stopPropagation();toggleOrderPaidOnline(${order.id})">
          ${order.paidOnline ? "✓ Paid Online (GCash)" : "📱 Mark Paid Online (GCash)"}
        </button>
        <button class="void-order-btn" onclick="event.stopPropagation();voidOrder(${order.id})">🗑 Void</button>
      </div>`;

    const doneLabel = order.done ? "✓ Done" : "Mark Done";
    return `<div class="order-log-item${order.done?" order-done":""}" id="ordercard-${order.id}" onclick="this.classList.toggle('expanded')">
      <div class="order-log-summary">
        <div class="order-log-left">
          <span class="order-log-num">Order #${order.id} · ${order.time}</span>
          <span class="order-log-desc">${desc}</span>
        </div>
        <div class="order-log-right">
          ${order.paidOnline ? `<span style="font-size:0.62rem;font-weight:700;color:var(--info);background:var(--info-bg);border:1px solid var(--info-border);border-radius:6px;padding:2px 6px;flex-shrink:0;">GCash</span>` : ""}
          <button class="order-done-btn${order.done?" done":""}"
            onclick="event.stopPropagation();toggleOrderDone(${order.id})">${doneLabel}</button>
          <span class="order-log-total">${fmt(order.total)}</span>
          <span class="order-log-chevron">▼</span>
        </div>
      </div>
      <div class="order-log-detail" style="padding:0 0 10px;">
        <div class="order-edit-header" style="padding:6px 14px 4px;">
          <span class="order-edit-label">Items by Cup</span>
          <span style="font-size:0.68rem;color:var(--bark);">tap − / + to edit qty</span>
        </div>
        ${editRows}
        ${addonRows ? `<div style="padding:4px 14px 0;border-top:1px dashed rgba(226,201,168,0.5);margin-top:4px;">${addonRows}</div>` : ""}
        <div style="padding:0 14px;">${totalRow}</div>
        ${paymentSection}
      </div>
    </div>`;
  }).join("");
}

// ── Edit placed order item qty ────────────────────────────────────────────────
function editOrderItem(orderId, itemKey, dir) {
  vibe("tap");
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;
  const item = order.items.find(i => i.key === itemKey);
  if (!item) return;

  if (dir === "inc") {
    const rem = remainingCups();
    if ((rem[item.cup] ?? 0) <= 0) { vibe("error"); return; }
    item.qty++;
    bumpSalesTallyDelta(item, 1);
  } else {
    item.qty--;
    bumpSalesTallyDelta(item, -1);
    if (item.qty <= 0) order.items = order.items.filter(i => i.key !== itemKey);
  }

  // Recalculate order total
  const cupTotal   = order.items.reduce((s,i) => s + i.unitPrice * i.qty, 0);
  const addonTotal = order.items.reduce((s,i) => s + getItemAddonTotal(i) * i.qty, 0);
  const diff  = (cupTotal + addonTotal) - order.total;
  order.total = cupTotal + addonTotal;
  state.shiftTotal += diff;

  saveState();
  renderDrinkButtons();
  updateHeaderStats();
  renderOrdersLog();
  if (order.paidOnline) syncGcashExpense();

  // Re-expand the card
  setTimeout(() => {
    const card = document.getElementById("ordercard-" + orderId);
    if (card) card.classList.add("expanded");
  }, 20);
}

// ── Edit the "given" (cash tendered) amount on a placed order ─────────────────
function updateOrderGiven(orderId, value) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;
  order.given = parseFloat(value) || 0;
  saveState();
  // Update the inline change display without re-rendering the whole log
  const disp = document.getElementById(`given-change-${orderId}`);
  if (!disp) return;
  const g = order.given, t = order.total;
  if (g > 0) {
    const ch = g - t;
    disp.textContent = ch >= 0 ? `Change: ${fmt(ch)}` : `Short: ${fmt(-ch)}`;
    disp.style.color  = ch >= 0 ? 'var(--success-dark)' : 'var(--danger-soft)';
  } else {
    disp.textContent = 'Change: —';
    disp.style.color  = 'var(--bark)';
  }
}

// ════════════════════════════════════════════════════
//  HEADER STATS
// ════════════════════════════════════════════════════
function computeShiftCupTotal() {
  return state.orders.reduce((s, o) =>
    s + o.items.reduce((si, i) => si + i.unitPrice * i.qty, 0), 0);
}

function showQuotaToast(milestone) {
  vibe("quota");
  playSound("quota");
  const toast = document.getElementById("quotaToast");
  toast.textContent = milestone === 3000
    ? "🎉 Quota hit! ₱3,000 in cup sales!"
    : `🚀 ₱${milestone.toLocaleString()} milestone! Keep it up!`;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 4500);
}

function updateHeaderStats() {
  const cupSales = computeShiftCupTotal();
  document.getElementById("shiftTotalDisplay").textContent = fmt(cupSales);
  document.getElementById("headerOrderCount").textContent  = state.orders.length;
  updateQuotaBar(cupSales);
}

let _barInBonusMode = false; // track so we don't re-trigger the flash on every render

function updateQuotaBar(cupSales) {
  const quota = getQuotaStart();
  const fill  = document.getElementById("quotaBarFill");
  const label = document.getElementById("quotaBarLabel");
  const amt   = document.getElementById("quotaBarAmt");
  if (!fill) return;

  if (cupSales >= quota) {
    const over      = cupSales - quota;
    const intoBlock = over % 1000;
    const bonusPct  = Math.min((intoBlock / 1000) * 100, 100);
    const remaining = 1000 - intoBlock;
    const nextMile  = quota + (Math.floor(over / 1000) + 1) * 1000;

    if (!_barInBonusMode) {
      // ── First time crossing quota: green flash → teal bonus ──
      _barInBonusMode = true;
      fill.className   = "quota-bar-fill hit flashing";
      fill.style.width = "100%";
      setTimeout(() => {
        fill.classList.remove("hit","flashing","exceed");
        fill.classList.add("bonus");
        fill.style.width = (bonusPct || 4) + "%";
        label.textContent = intoBlock === 0
          ? "🚀 Bonus unlocked!"
          : `+₱${Math.ceil(remaining).toLocaleString("en-PH")} to ₱${nextMile.toLocaleString("en-PH")}`;
        amt.textContent = `+${fmt(over)} over`;
      }, 620);
    } else {
      // ── Already in bonus mode: just update width + labels smoothly ──
      fill.className   = "quota-bar-fill bonus";
      fill.style.width = (bonusPct || 4) + "%";
      label.textContent = intoBlock === 0
        ? "🚀 Bonus unlocked!"
        : `+₱${Math.ceil(remaining).toLocaleString("en-PH")} to ₱${nextMile.toLocaleString("en-PH")}`;
      amt.textContent = `+${fmt(over)} over`;
    }

  } else {
    // ── Pre-quota ──
    _barInBonusMode = false;
    const pct       = Math.min((cupSales / quota) * 100, 100);
    const near      = pct >= 80;
    const remaining = quota - cupSales;
    fill.style.width = pct + "%";
    fill.className   = "quota-bar-fill" + (near ? " near" : "");
    label.textContent = near ? "🔥 Almost there!" : "To Quota";
    amt.textContent   = `₱${Math.ceil(remaining).toLocaleString("en-PH")} left`;
  }
}

// ════════════════════════════════════════════════════
//  POS EXPENSES
// ════════════════════════════════════════════════════
function toggleExpenses() {
  const body    = document.getElementById("posExpensesBody");
  const toggle  = document.getElementById("expensesToggle");
  const isOpen  = body.classList.toggle("open");
  toggle.classList.toggle("open", isOpen);
}

function addPosExpenseRow(name="", price="") {
  const container = document.getElementById("posExpensesContainer");
  const isAuto = name === GCASH_EXPENSE_NAME;
  const row = document.createElement("div");
  row.className = "expense-row" + (isAuto ? " auto-expense" : "");
  row.innerHTML = isAuto
    ? `
    <input type="text"   class="exp-name"  value="${name}" readonly>
    <input type="number" class="exp-price" value="${price}" readonly>
    <span class="exp-auto-tag">auto</span>
  `
    : `
    <input type="text"   class="exp-name"  placeholder="Expense name" value="${name}">
    <input type="number" class="exp-price" placeholder="₱0"           value="${price}">
    <button type="button" onclick="this.parentElement.remove(); savePosExpenses();">x</button>
  `;
  if (!isAuto) row.addEventListener("input", savePosExpenses);
  container.appendChild(row);
}

function savePosExpenses() {
  const rows = document.querySelectorAll("#posExpensesContainer .expense-row");
  // Preserve the auto-synced GCash row as-is; it's managed by syncGcashExpense().
  const gcash = state.expenses.find(e => e.name === GCASH_EXPENSE_NAME);
  state.expenses = gcash ? [gcash] : [];
  rows.forEach(r => {
    if (r.classList.contains("auto-expense")) return;
    const name  = r.querySelector(".exp-name").value.trim();
    const price = parseFloat(r.querySelector(".exp-price").value) || 0;
    if (name || price) state.expenses.push({name, price});
  });
  saveState();
}

function renderPosExpenses() {
  const container = document.getElementById("posExpensesContainer");
  container.innerHTML = "";
  if (state.expenses.length) state.expenses.forEach(e => addPosExpenseRow(e.name, e.price));
}

// ════════════════════════════════════════════════════
//  RECEIPT MODAL
// ════════════════════════════════════════════════════
function showReceipt(order) {
  document.getElementById("receiptOrderNum").textContent = `Order #${order.id} · ${order.time}`;

  let itemsHTML = order.items.map(i => {
    const itemAddonRows = Object.entries(i.addons||{}).map(([name,qty]) => {
      const a = ADDONS.find(a=>a.name===name);
      return `<div class="receipt-row addon-row"><span>↳ ${qty*i.qty}× ${name}</span><span>${fmt((a?.price||0)*qty*i.qty)}</span></div>`;
    }).join("");
    return `
    <div class="receipt-row">
      <span>${i.qty}× ${i.name} (${i.code})</span>
      <span>${fmt(i.unitPrice*i.qty)}</span>
    </div>
    ${i.flavor?`<div class="receipt-row flavor-sub"><span>↳ ${i.flavor}</span></div>`:""}
    ${itemAddonRows}
  `; }).join("");

  document.getElementById("receiptItems").innerHTML = itemsHTML;
  document.getElementById("receiptTotal").innerHTML = `<span>Total</span><span>${fmt(order.total)}</span>`;

  // Payment rows (given / change)
  let paymentHTML = "";
  if (order.paidOnline) {
    paymentHTML += `
      <hr class="modal-divider">
      <div class="receipt-row" style="font-weight:700;color:var(--info)"><span>📱 Paid via GCash</span><span></span></div>`;
  }
  if (order.given > 0) {
    const change = order.given - order.total;
    paymentHTML = `
      <hr class="modal-divider">
      <div class="receipt-row" style="color:var(--bark)"><span>Given</span><span>${fmt(order.given)}</span></div>
      <div class="receipt-row" style="font-weight:700;color:${change>=0?"var(--success-dark)":"var(--danger-soft)"}">
        <span>${change>=0?"Change":"Short"}</span><span>${fmt(Math.abs(change))}</span>
      </div>`;
  }
  const paymentEl = document.getElementById("receiptPayment");
  if (paymentEl) paymentEl.innerHTML = paymentHTML;

  const bar = document.getElementById("receiptProgressBar");
  bar.style.transition="none"; bar.style.width="100%";
  document.getElementById("receiptModal").classList.add("open");
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ bar.style.transition=`width ${RECEIPT_MS}ms linear`; bar.style.width="0%"; }));
  if(receiptTimer) clearTimeout(receiptTimer);
  receiptTimer = setTimeout(closeReceiptModal, RECEIPT_MS);
}

function closeReceiptModal() {
  if(receiptTimer){clearTimeout(receiptTimer);receiptTimer=null;}
  document.getElementById("receiptModal").classList.remove("open");
}

// ════════════════════════════════════════════════════
//  END SHIFT
// ════════════════════════════════════════════════════
function computeCupTotals() {
  const t={M:0,L:0,S:0,MC:0,LC:0,HC:0,FTM:0,FTL:0};
  state.orders.forEach(o=>o.items.forEach(i=>{t[i.code]=(t[i.code]||0)+i.qty;}));
  return t;
}

function computeAddonRevenue() {
  return state.orders.reduce((sum,o) =>
    sum + o.items.reduce((s,i) => s + getItemAddonTotal(i) * i.qty, 0), 0);
}

function openEndShift() {
  const t   = computeCupTotals();
  const del = state.deliveries || {M:0,L:0,S:0,HC:0};
  const dmg = state.damages    || {M:0,L:0,S:0,HC:0};
  // Physical remaining = beg + delivered - damaged - used_in_orders
  const endM  = state.begM  + (del.M||0)  - (dmg.M||0)  - t.M  - t.MC  - t.FTM;
  const endL  = state.begL  + (del.L||0)  - (dmg.L||0)  - t.L  - t.LC  - t.FTL;
  const endS  = state.begS  + (del.S||0)  - (dmg.S||0)  - t.S;
  const endHC = state.begHC + (del.HC||0) - (dmg.HC||0) - t.HC;
  const warn  = v => v<0 ? `<span style="color:var(--danger-soft);font-weight:700">${v} ⚠</span>` : v;
  const addonRev = computeAddonRevenue();
  const cupSales = computeShiftCupTotal();
  const expTotal = state.expenses.reduce((s,e)=>s+e.price,0);
  const gcashTotal = state.orders.filter(o=>o.paidOnline).reduce((s,o)=>s+o.total,0);
  const totalDel = (del.M||0)+(del.L||0)+(del.S||0)+(del.HC||0);
  const totalDmg = (dmg.M||0)+(dmg.L||0)+(dmg.S||0)+(dmg.HC||0);
  const delRow = totalDel>0 ? `<div class="end-shift-row" style="color:var(--success-dark);"><span>📦 Delivered</span><span>M+${del.M||0} L+${del.L||0} S+${del.S||0} HC+${del.HC||0}</span></div>` : "";
  const dmgRow = totalDmg>0 ? `<div class="end-shift-row" style="color:var(--danger-soft);"><span>💔 Damaged</span><span>M−${dmg.M||0} L−${dmg.L||0} S−${dmg.S||0} HC−${dmg.HC||0}</span></div>` : "";
  document.getElementById("endShiftSummary").innerHTML=`
    <div class="end-shift-row bold"><span>Orders Placed</span><span>${state.orders.length}</span></div>
    <div class="end-shift-row bold"><span>Cup Sales</span><span>${fmt(cupSales)}</span></div>
    ${addonRev?`<div class="end-shift-row"><span>Add-on Revenue</span><span>+ ${fmt(addonRev)}</span></div>`:""}
    <div class="end-shift-row" style="font-weight:700;border-top:1.5px solid var(--mochaccino);padding-top:8px;margin-top:4px;"><span>Total Revenue</span><span>${fmt(state.shiftTotal)}</span></div>
    ${gcashTotal?`<div class="end-shift-row" style="color:var(--info);"><span>📱 Paid Online (GCash)</span><span>${fmt(gcashTotal)}</span></div>`:""}
    ${expTotal?`<div class="end-shift-row"><span>Expenses (incl. GCash)</span><span>− ${fmt(expTotal)}</span></div>`:""}
    <div class="end-shift-row section-head"><span>Cup Counts → Auto-filled</span><span></span></div>
    ${delRow}${dmgRow}
    <div class="end-shift-row"><span>Medium (M)</span><span>${state.begM} → ${warn(endM)}</span></div>
    <div class="end-shift-row"><span>Large (L)</span><span>${state.begL} → ${warn(endL)}</span></div>
    <div class="end-shift-row"><span>Small (S)</span><span>${state.begS} → ${warn(endS)}</span></div>
    <div class="end-shift-row"><span>Hot Coffee (HC)</span><span>${state.begHC} → ${warn(endHC)}</span></div>
    <div class="end-shift-row"><span>MC Tally</span><span>${t.MC}</span></div>
    <div class="end-shift-row"><span>LC Tally</span><span>${t.LC}</span></div>
    <div class="end-shift-row"><span>FTM Tally</span><span>${t.FTM}</span></div>
    <div class="end-shift-row"><span>FTL Tally</span><span>${t.FTL}</span></div>
  `;
  document.getElementById("endShiftModal").classList.add("open");
}

function closeEndShift() { document.getElementById("endShiftModal").classList.remove("open"); }

function confirmEndShift() {
  const t   = computeCupTotals();
  const del = state.deliveries || {M:0,L:0,S:0,HC:0};
  const dmg = state.damages    || {M:0,L:0,S:0,HC:0};

  // Formula end: beg + del - cups_used_in_orders (no damage — damage is annotation only)
  // Matches how calculate.html treats damageX: shown on receipt but not in formula
  const formulaEndM  = state.begM  + (del.M||0)  - t.M  - t.MC  - t.FTM;
  const formulaEndL  = state.begL  + (del.L||0)  - t.L  - t.LC  - t.FTL;
  const formulaEndS  = state.begS  + (del.S||0)  - t.S;
  const formulaEndHC = state.begHC + (del.HC||0) - t.HC;

  // Physical end for carry-over = formula end minus damaged cups
  const physEndM  = formulaEndM  - (dmg.M||0);
  const physEndL  = formulaEndL  - (dmg.L||0);
  const physEndS  = formulaEndS  - (dmg.S||0);
  const physEndHC = formulaEndHC - (dmg.HC||0);

  localStorage.setItem("brewsLastEndingCups", JSON.stringify({
    endM: physEndM, endL: physEndL, endS: physEndS, endHC: physEndHC,
    date: new Date().toISOString().split("T")[0],
  }));

  localStorage.setItem(SHIFT_KEY, JSON.stringify({
    origBegM: state.begM,  begM: state.begM  + (del.M||0),  endM: formulaEndM,
    origBegL: state.begL,  begL: state.begL  + (del.L||0),  endL: formulaEndL,
    origBegS: state.begS,  begS: state.begS  + (del.S||0),  endS: formulaEndS,
    origBegHC:state.begHC, begHC:state.begHC + (del.HC||0), endHC:formulaEndHC,
    tallyMC:t.MC, tallyLC:t.LC, tallyFTM:t.FTM, tallyFTL:t.FTL,
    expenses: state.expenses,
    addonRevenue: computeAddonRevenue(),
    deliveredM:del.M||0, deliveredL:del.L||0, deliveredS:del.S||0, deliveredHC:del.HC||0,
    damageM:   dmg.M||0, damageL:   dmg.L||0, damageS:   dmg.S||0, damageHC:   dmg.HC||0,
  }));

  // Save resumable snapshot so staff can pick up again if needed
  localStorage.setItem("brewsResumeShift", JSON.stringify({
    begM:state.begM, begL:state.begL, begS:state.begS, begHC:state.begHC,
    orders:state.orders, shiftTotal:state.shiftTotal, expenses:state.expenses,
    deliveries: state.deliveries, damages: state.damages,
    savedAt: Date.now(),
  }));
  saveOrderLog();
  clearPOSState();
  if(clockInterval) clearInterval(clockInterval);
  window.location.href="calculate.html";
}

// ════════════════════════════════════════════════════
//  KEY SHORTCUTS
// ════════════════════════════════════════════════════
document.addEventListener("keydown", e => {
  if (e.key==="Escape") { closeFlavorModal(); closeReceiptModal(); closeEndShift(); closeFlavorSettings(); }
});

// ════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════
// Clamp all number inputs to 0+ globally
document.addEventListener("input", e => {
  if (e.target.type === "number") {
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && v < 0) e.target.value = 0;
  }
});

// ════════════════════════════════════════════════════
//  HAPTIC ENGINE
// ════════════════════════════════════════════════════
function vibe(type) {
  if (!navigator.vibrate) return;
  const patterns = {
    tap:   18,
    add:   25,
    place: [50, 30, 80],
    quota: [80, 40, 80, 40, 120],
    error: [30, 20, 30, 20, 30],
    undo:  40,
  };
  navigator.vibrate(patterns[type] ?? 18);
}

// ════════════════════════════════════════════════════
//  SOUND ENGINE  (Web Audio API — no files needed)
// ════════════════════════════════════════════════════
let _audioCtx = null;
function _getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

function playSound(type) {
  const cfg = getSettings();
  if (!cfg.soundEnabled) return;
  try {
    const ctx = _getAudioCtx();
    if (ctx.state === "suspended") ctx.resume();

    if (type === "tap") {
      // Soft click: quick sine burst
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = 700;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08);

    } else if (type === "place") {
      // Soft double-bell: two descending tones
      [[520, 0, 0.10], [420, 0.10, 0.18]].forEach(([freq, when, end]) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine"; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + when);
        gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + when + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + end);
        osc.start(ctx.currentTime + when); osc.stop(ctx.currentTime + end + 0.02);
      });

    } else if (type === "quota") {
      // Rising celebration: three ascending tones
      [[440, 0, 0.12], [550, 0.12, 0.26], [660, 0.26, 0.44]].forEach(([freq, when, end]) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "triangle"; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + when);
        gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + when + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + end);
        osc.start(ctx.currentTime + when); osc.stop(ctx.currentTime + end + 0.02);
      });
    }
  } catch (e) { /* audio blocked by browser policy — silent fail */ }
}

// ════════════════════════════════════════════════════
//  SWIPE TO DISMISS  (all modal overlays)
// ════════════════════════════════════════════════════
function attachSwipeToDismiss(overlayId, closeFunc) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  const modal = overlay.querySelector(".modal");
  if (!modal) return;

  let startY = 0, currentY = 0, dragging = false;

  overlay.addEventListener("touchstart", e => {
    if (e.target === overlay) return; // tapping backdrop = close (existing)
    startY   = e.touches[0].clientY;
    currentY = startY;
    dragging = true;
    modal.style.transition = "none";
  }, { passive: true });

  overlay.addEventListener("touchmove", e => {
    if (!dragging) return;
    currentY  = e.touches[0].clientY;
    const dy  = Math.max(0, currentY - startY); // only allow downward drag
    modal.style.transform = `translateY(${dy}px)`;
  }, { passive: true });

  overlay.addEventListener("touchend", () => {
    if (!dragging) return;
    dragging = false;
    const dy = Math.max(0, currentY - startY);
    modal.style.transition = "";
    if (dy > 90) {
      modal.style.transform = "";
      closeFunc();
    } else {
      modal.style.transform = "";
    }
  });
}

// ════════════════════════════════════════════════════
//  OFFLINE INDICATOR
// ════════════════════════════════════════════════════
function setOfflineBanner(offline) {
  const b = document.getElementById("offlineBanner");
  if (b) b.classList.toggle("visible", offline);
}

async function retryConnection() {
  setOfflineBanner(false);
  try {
    if (typeof syncPull === "function") await syncPull();
  } catch (e) {
    setOfflineBanner(true);
  }
}

window.addEventListener("online",  () => setOfflineBanner(false));
window.addEventListener("offline", () => setOfflineBanner(true));
// Initial check
if (!navigator.onLine) setOfflineBanner(true);

buildCatalogue();
loadState();
cleanupOrderLogs();
sessionStorage.setItem('brewsSession', '1');

// ── Restore quota threshold from saved shift so we never fire at ₱0 ──
(function restoreQuotaThreshold() {
  const cupsSoFar = state.orders.reduce(
    (t, o) => t + o.items.reduce((s, i) => s + i.unitPrice * i.qty, 0), 0);
  const qs = getQuotaStart();
  if (cupsSoFar < qs) {
    nextQuotaThreshold = qs;                                          // quota not hit yet
  } else {
    // next unfired milestone above current sales
    nextQuotaThreshold = qs + (Math.floor((cupsSoFar - qs) / 1000) + 1) * 1000;
    _barInBonusMode = true;   // already past quota — skip the flash animation on load
  }
})();

// ── Carryover: use yesterday's ending cups as today's beginning ───────────────
(function initPosCarryover() {
  const raw = localStorage.getItem("brewsLastEndingCups");
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    const wrap = document.getElementById("posCarryoverWrap");
    const meta = document.getElementById("posCarryoverMeta");
    if (wrap) wrap.style.display = "block";
    if (meta) meta.textContent = d.date ? `from ${d.date}` : "";
  } catch {}
})();

function posUseYesterdaysEnding() {
  const raw = localStorage.getItem("brewsLastEndingCups");
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    const map = { setupBegM: d.endM, setupBegL: d.endL, setupBegS: d.endS, setupBegHC: d.endHC };
    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = val ?? "";
      el.style.transition = "background .4s";
      el.style.background = "var(--success-bg-alt)";
      setTimeout(() => el.style.background = "", 900);
    });
  } catch {}
}
const hasShift = !!localStorage.getItem(SHIFT_ACTIVE_KEY) ||
                 state.orders.length > 0 || state.currentItems.length > 0 ||
                 state.begM || state.begL || state.begS || state.begHC;
if (hasShift) showPOS(); else showSetup();
