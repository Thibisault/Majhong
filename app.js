const form = document.getElementById("score-form");
const positiveInput = document.getElementById("positive-score");
const negativeInput = document.getElementById("negative-score");
const formError = document.getElementById("form-error");
const halfResult = document.getElementById("half-result");
const resultMeta = document.getElementById("result-meta");
const historyBody = document.getElementById("history-body");
const clearHistoryButton = document.getElementById("clear-history");
const globalTotalText = document.getElementById("global-total");
const todaySessionText = document.getElementById("today-session-total");
const gameCountText = document.getElementById("game-count");

const DB_NAME = "majhong-history-db";
const DB_VERSION = 1;
const STORE_NAME = "games";

const numberFormat = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});

let db = null;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    db = await openDatabase();
    bindEvents();
    await renderHistory();
    registerServiceWorker();
  } catch (error) {
    showError("Impossible de lancer la base locale.");
    console.error(error);
  }
});

function bindEvents() {
  form.addEventListener("submit", onSubmit);

  positiveInput.addEventListener("input", () => {
    if (positiveInput.value.trim() !== "") {
      negativeInput.value = "";
    }
  });

  negativeInput.addEventListener("input", () => {
    if (negativeInput.value.trim() !== "") {
      positiveInput.value = "";
    }
  });

  clearHistoryButton.addEventListener("click", onClearHistory);
}

async function onSubmit(event) {
  event.preventDefault();
  clearError();

  const parsed = parseRawScore();
  if (parsed.error) {
    showError(parsed.error);
    return;
  }

  const rawScore = parsed.rawScore;
  const halfScore = rawScore / 2;

  try {
    const totalBefore = await getCurrentTotal();

    const game = {
      createdAt: new Date().toISOString(),
      rawScore,
      halfScore,
      cumulative: totalBefore + halfScore
    };

    await addGame(game);
    renderBigResult(game.halfScore, game.createdAt);
    form.reset();
    await renderHistory();
  } catch (error) {
    showError("Erreur pendant l'enregistrement.");
    console.error(error);
  }
}

function parseRawScore() {
  const positiveValue = positiveInput.value.trim();
  const negativeValue = negativeInput.value.trim();

  if (positiveValue && negativeValue) {
    return { error: "Remplis une seule case a la fois." };
  }

  if (!positiveValue && !negativeValue) {
    return { error: "Entre un score dans la case positive ou negative." };
  }

  if (positiveValue) {
    const value = Number(positiveValue);
    if (!Number.isFinite(value)) {
      return { error: "Score positif invalide." };
    }
    return { rawScore: Math.abs(value) };
  }

  const value = Number(negativeValue);
  if (!Number.isFinite(value)) {
    return { error: "Score negatif invalide." };
  }

  return { rawScore: -Math.abs(value) };
}

async function renderHistory() {
  const games = await getAllGames();

  historyBody.innerHTML = "";

  if (games.length === 0) {
    historyBody.innerHTML = '<tr><td colspan="5" class="empty-state">Aucune partie pour le moment.</td></tr>';
    updateTotals(0, 0, 0, 0);
    halfResult.textContent = "0";
    halfResult.className = "positive-text";
    resultMeta.textContent = "Aucune partie enregistree";
    return;
  }

  const sorted = [...games].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  let sinceThisGame = 0;

  for (const game of sorted) {
    sinceThisGame += Number(game.halfScore || 0);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${formatDate(game.createdAt)}</td>
      <td class="${numberClass(game.rawScore)}">${formatSigned(game.rawScore)}</td>
      <td class="${numberClass(game.halfScore)}">${formatSigned(game.halfScore)}</td>
      <td class="${numberClass(game.cumulative)}">${formatSigned(game.cumulative)}</td>
      <td class="${numberClass(sinceThisGame)}">${formatSigned(sinceThisGame)}</td>
    `;
    historyBody.appendChild(row);
  }

  const latest = sorted[0];
  renderBigResult(latest.halfScore, latest.createdAt);

  const total = games.reduce((sum, game) => sum + Number(game.halfScore || 0), 0);
  const todayKey = toDateKey(new Date());
  const todayGames = games.filter((game) => toDateKey(new Date(game.createdAt)) === todayKey);
  const todayTotal = todayGames.reduce((sum, game) => sum + Number(game.halfScore || 0), 0);
  updateTotals(games.length, total, todayTotal, todayGames.length);
}

function renderBigResult(value, dateIso) {
  halfResult.textContent = formatSigned(value);
  halfResult.className = numberClass(value);
  resultMeta.textContent = `Derniere partie: ${formatDate(dateIso)}`;
}

function updateTotals(count, total, todayTotal, todayCount) {
  gameCountText.textContent = `Parties: ${count}`;
  globalTotalText.innerHTML = `Total: <span class="${numberClass(total)}">${formatSigned(total)}</span>`;
  const suffix = todayCount > 1 ? "s" : "";
  todaySessionText.innerHTML = `Session aujourd'hui (${todayCount} partie${suffix}): <span class="${numberClass(todayTotal)}">${formatSigned(todayTotal)}</span>`;
}

async function getCurrentTotal() {
  const games = await getAllGames();
  return games.reduce((sum, game) => sum + Number(game.halfScore || 0), 0);
}

function onClearHistory() {
  const confirmClear = window.confirm("Voulez-vous effacer tout l'historique ?");
  if (!confirmClear) {
    return;
  }

  clearAllGames()
    .then(() => renderHistory())
    .catch((error) => {
      showError("Impossible d'effacer l'historique.");
      console.error(error);
    });
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const upgradedDb = event.target.result;
      if (!upgradedDb.objectStoreNames.contains(STORE_NAME)) {
        upgradedDb.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getStore(mode) {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function addGame(game) {
  return new Promise((resolve, reject) => {
    const request = getStore("readwrite").add(game);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllGames() {
  return new Promise((resolve, reject) => {
    const request = getStore("readonly").getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function clearAllGames() {
  return new Promise((resolve, reject) => {
    const request = getStore("readwrite").clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function formatSigned(value) {
  const number = Number(value) || 0;
  const prefix = number > 0 ? "+" : "";
  return `${prefix}${numberFormat.format(number)}`;
}

function formatDate(isoDate) {
  return dateFormat.format(new Date(isoDate));
}

function toDateKey(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function numberClass(value) {
  return Number(value) >= 0 ? "positive-text" : "negative-text";
}

function showError(message) {
  formError.textContent = message;
}

function clearError() {
  formError.textContent = "";
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.error("Service worker non enregistre", error);
    });
  });
}
