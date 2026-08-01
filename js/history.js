/**
 * history.js
 * CRUD helpers for the daily results history stored in localStorage.
 */

const HISTORY_KEY = "inventoryHistory";

function getAllHistory() {
  const history = BrewsStore.readJSON(HISTORY_KEY, []);
  return [...history].sort((a, b) => (a.date > b.date ? -1 : 1));
}

function saveHistory(date, results) {
  const history = BrewsStore.readJSON(HISTORY_KEY, []);
  const idx     = history.findIndex(h => h.date === date);
  const entry   = { date, results };
  if (idx >= 0) history[idx] = entry;
  else history.push(entry);
  BrewsStore.writeJSON(HISTORY_KEY, history);
}

function deleteHistoryByDate(date) {
  const history = BrewsStore.readJSON(HISTORY_KEY, []);
  BrewsStore.writeJSON(HISTORY_KEY, history.filter(h => h.date !== date));
}

function clearAllHistory() {
  localStorage.removeItem(HISTORY_KEY);
}
