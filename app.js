const views = {
  lobby: document.getElementById("lobbyView"),
  mahjong: document.getElementById("mahjongView"),
  mole: document.getElementById("moleView"),
  slot: document.getElementById("slotView"),
  store: document.getElementById("storeView"),
  rules: document.getElementById("rulesView"),
};

const aiProfiles = {
  easy: { label: "一般", mistakeRate: 70, description: "電腦很笨，常打出沒有幫助的牌。" },
  normal: { label: "中等", mistakeRate: 50, description: "電腦普通，會保留一些可用牌，但仍常失誤。" },
  hard: { label: "困難", mistakeRate: 30, description: "電腦一般強，會優先保留對子與連續牌。" },
  expert: { label: "超困難", mistakeRate: 15, description: "電腦超強，會更積極保留好牌，但偶爾仍會出錯。" },
};

const state = {
  wall: [],
  hand: [],
  opponents: {
    "玩家 A": [],
    "玩家 B": [],
    "玩家 C": [],
  },
  selectedIndex: 0,
  dealer: null,
  lastDiscard: null,
  river: [],
  lastDrawSelf: false,
  ting: {
    你: false,
    "玩家 A": false,
    "玩家 B": false,
    "玩家 C": false,
  },
  turn: "setup",
  currentPlayer: "你",
  lastDiscardFrom: null,
  aiTimer: null,
  balance: 10000,
  aiDifficulty: "easy",
  dealerStreak: 0,
  roundWind: "東",
  playerMoney: {
    你: 10000,
    "玩家 A": 10000,
    "玩家 B": 10000,
    "玩家 C": 10000,
  },
  melds: {
    你: [],
    "玩家 A": [],
    "玩家 B": [],
    "玩家 C": [],
  },
};

const suits = [
  { name: "萬", values: ["一", "二", "三", "四", "五", "六", "七", "八", "九"] },
  { name: "筒", values: ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"] },
  { name: "條", values: ["1", "2", "3", "4", "5", "6", "7", "8", "9"] },
];
const honors = ["東", "南", "西", "北", "中", "發", "白"];
const flowers = ["春", "夏", "秋", "冬", "梅", "蘭", "竹", "菊"];
const winds = ["東", "南", "西", "北"];
const chineseRanks = ["一", "二", "三", "四", "伍", "六", "七", "八", "九"];
const turnOrder = ["你", "玩家 A", "玩家 B", "玩家 C"];
const windByPlayer = { 你: "東", "玩家 A": "南", "玩家 B": "西", "玩家 C": "北" };
const playerByWind = { 東: "你", 南: "玩家 A", 西: "玩家 B", 北: "玩家 C" };

const handEl = document.getElementById("playerHand");
const logEl = document.getElementById("gameLog");
const aiSelect = document.getElementById("aiDifficulty");
const promptActionsEl = document.getElementById("promptActions");
const riverTilesEl = document.getElementById("riverTiles");
const opponentEls = {
  "玩家 A": document.getElementById("opponentLeft"),
  "玩家 B": document.getElementById("opponentTop"),
  "玩家 C": document.getElementById("opponentRight"),
};

const slotSymbols = [
  { id: "seven", label: "777", icon: "777", pays: { 3: 80, 4: 260, 5: 1000 } },
  { id: "bar", label: "BAR", icon: "BAR", pays: { 3: 55, 4: 180, 5: 750 } },
  { id: "watermelon", label: "西瓜", icon: "🍉", pays: { 3: 35, 4: 100, 5: 400 } },
  { id: "bell", label: "鈴鐺", icon: "🔔", pays: { 3: 25, 4: 75, 5: 250 } },
  { id: "grape", label: "葡萄", icon: "🍇", pays: { 3: 20, 4: 60, 5: 180 } },
  { id: "orange", label: "柳丁", icon: "🍊", pays: { 3: 16, 4: 45, 5: 140 } },
  { id: "cherry", label: "櫻桃", icon: "🍒", pays: { 3: 10, 4: 30, 5: 90 } },
  { id: "lemon", label: "檸檬", icon: "🍋", pays: { 3: 8, 4: 24, 5: 70 } },
  { id: "wild", label: "WILD", icon: "WILD", wild: true, pays: { 3: 100, 4: 360, 5: 1500 } },
  { id: "scatter", label: "SCATTER", icon: "★", scatter: true, pays: { 3: 20, 4: 80, 5: 240 } },
];
const slotWeights = ["cherry", "lemon", "orange", "grape", "bell", "watermelon", "bar", "seven", "cherry", "lemon", "orange", "grape", "wild", "scatter"];
const paylines = [
  { type: "horizontal", row: 0, label: "上橫線" },
  { type: "horizontal", row: 1, label: "中橫線" },
  { type: "horizontal", row: 2, label: "下橫線" },
  { type: "vertical", reel: 0, label: "第 1 軸直線" },
  { type: "vertical", reel: 1, label: "第 2 軸直線" },
  { type: "vertical", reel: 2, label: "第 3 軸直線" },
  { type: "vertical", reel: 3, label: "第 4 軸直線" },
  { type: "vertical", reel: 4, label: "第 5 軸直線" },
];
const slotState = {
  betPerLine: 10,
  lines: 8,
  reels: [],
  finalReels: [],
  spinning: false,
  stopped: [true, true, true, true, true],
  timers: [],
  freeSpins: 0,
  pendingWin: 0,
  lastWin: 0,
  leverPulled: false,
};
let slotCellEls = [];

const moleState = {
  mode: "single",
  running: false,
  score: 0,
  levelScore: 0,
  level: 1,
  p1: 0,
  p2: 0,
  timeLeft: 30,
  target: 50,
  active: new Map(),
  timer: null,
  spawnTimer: null,
  lastPointerHitAt: 0,
  nextSpawnId: 1,
};
const moleCharacters = [
  { type: "mole", label: "地鼠", score: 5, miss: -1, className: "mole-good" },
  { type: "gold", label: "金地鼠", score: 10, miss: 0, className: "mole-gold" },
  { type: "rat", label: "老鼠", score: -3, miss: 0, className: "mole-bad" },
  { type: "mine", label: "地雷", score: -5, miss: 0, className: "mole-bomb" },
];
const moleHammerMarkup = '<span class="mole-hammer-head"></span><span class="mole-hammer-handle"></span>';

function showView(name) {
  Object.entries(views).forEach(([key, el]) => el.classList.toggle("active", key === name));
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === name && button.classList.contains("rail-btn"));
  });
}

function updateBalanceLabels() {
  const value = state.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById("coinBalance").textContent = value;
  document.getElementById("storeBalance").textContent = value;
  document.getElementById("slotCreditLabel").textContent = `點數：${value}`;
}

function symbolById(id) {
  return slotSymbols.find((symbol) => symbol.id === id);
}

function randomSlotSymbol() {
  return symbolById(slotWeights[Math.floor(Math.random() * slotWeights.length)]);
}

function buildSlotReels() {
  return Array.from({ length: 5 }, () => Array.from({ length: 3 }, randomSlotSymbol));
}

function initSlot() {
  slotState.reels = buildSlotReels();
  createSlotFrame();
  renderSlot();
  renderSlotLines();
  renderPaytable();
  slotLog("水果拉霸已開機，選擇線數與單線注後開始。");
}

function createSlotFrame() {
  const reelsEl = document.getElementById("slotReels");
  reelsEl.innerHTML = "";
  slotCellEls = [];
  for (let reelIndex = 0; reelIndex < 5; reelIndex += 1) {
    const reelEl = document.createElement("div");
    reelEl.className = "slot-reel";
    reelEl.dataset.reel = reelIndex;
    slotCellEls[reelIndex] = [];
    for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
      const cell = document.createElement("div");
      cell.className = "slot-symbol symbol-cherry";
      cell.textContent = "🍒";
      cell.dataset.reel = reelIndex;
      cell.dataset.row = rowIndex;
      reelEl.appendChild(cell);
      slotCellEls[reelIndex][rowIndex] = cell;
    }
    reelsEl.appendChild(reelEl);
  }
}

function renderSlot() {
  if (slotCellEls.length !== 5) createSlotFrame();
  slotState.reels.forEach((reel, reelIndex) => {
    const reelEl = slotCellEls[reelIndex]?.[0]?.parentElement;
    if (reelEl) reelEl.classList.toggle("spinning", slotState.spinning && !slotState.stopped[reelIndex]);
    reel.forEach((symbol, rowIndex) => {
      const cell = slotCellEls[reelIndex]?.[rowIndex];
      if (!cell) return;
      cell.className = `slot-symbol symbol-${symbol.id}`;
      cell.textContent = symbol.icon;
      cell.title = symbol.label;
    });
  });
  document.getElementById("slotLinesLabel").textContent = slotState.lines;
  document.getElementById("slotBetLabel").textContent = slotState.betPerLine;
  document.getElementById("slotFreeLabel").textContent = `免費局：${slotState.freeSpins}`;
  document.getElementById("slotWinLabel").textContent = `本局：${slotState.lastWin}`;
  document.getElementById("slotResult").textContent = slotState.pendingWin
    ? `可收分 ${slotState.pendingWin}，也可挑戰比倍。`
    : slotState.spinning
      ? "轉輪旋轉中，可手動停止各軸。"
      : `總注 ${slotState.lines * slotState.betPerLine}，按 SPIN 開始。`;
  document.getElementById("gambleBox").classList.toggle("active", slotState.pendingWin > 0 && !slotState.spinning);
  document.querySelectorAll("[data-stop-reel]").forEach((button) => {
    const index = Number(button.dataset.stopReel);
    button.disabled = !slotState.spinning || slotState.stopped[index];
  });
  document.getElementById("slotSpinBtn").disabled = slotState.spinning || slotState.pendingWin > 0;
  document.getElementById("slotLeverBtn").disabled = slotState.spinning || slotState.pendingWin > 0;
  document.getElementById("slotLeverBtn").classList.toggle("pulled", slotState.leverPulled);
  updateBalanceLabels();
}

function clearSlotTimers() {
  slotState.timers.forEach((timer) => {
    clearInterval(timer?.interval);
    clearTimeout(timer?.timeout);
  });
  slotState.timers = [];
}

function renderPaytable() {
  const table = document.getElementById("slotPaytable");
  table.innerHTML = "";
  slotSymbols.forEach((symbol) => {
    const row = document.createElement("div");
    row.className = "pay-row";
    row.innerHTML = `<span>${symbol.icon}</span><b>${symbol.label}</b><em>3:${symbol.pays[3]}x / 4:${symbol.pays[4]}x / 5:${symbol.pays[5]}x</em>`;
    table.appendChild(row);
  });
}

function changeSlotBet(delta) {
  if (slotState.spinning || slotState.pendingWin) return;
  slotState.betPerLine = Math.min(100, Math.max(1, slotState.betPerLine + delta));
  renderSlot();
}

function changeSlotLines(delta) {
  if (slotState.spinning || slotState.pendingWin) return;
  slotState.lines = Math.min(8, Math.max(1, slotState.lines + delta));
  renderSlot();
}

function spinSlot() {
  if (slotState.spinning || slotState.pendingWin) return;
  const totalBet = slotState.betPerLine * slotState.lines;
  const freeSpin = slotState.freeSpins > 0;
  if (!freeSpin && state.balance < totalBet) {
    slotLog("點數不足，請降低注額或到商城補點。");
    return;
  }
  if (freeSpin) slotState.freeSpins -= 1;
  else state.balance -= totalBet;
  clearSlotTimers();
  slotState.spinning = true;
  slotState.stopped = [false, false, false, false, false];
  slotState.finalReels = buildSlotReels();
  slotState.lastWin = 0;
  slotState.pendingWin = 0;
  renderSlotLines();
  slotLog(`${freeSpin ? "免費局" : "下注"} ${totalBet}，轉輪開始。`);

  slotState.reels.forEach((_, index) => {
    const interval = setInterval(() => {
      slotState.reels[index] = Array.from({ length: 3 }, randomSlotSymbol);
      renderSlot();
    }, 90);
    const timeout = setTimeout(() => stopSlotReel(index), 650 + index * 320);
    slotState.timers[index] = { interval, timeout };
  });
  slotState.timers.push({ timeout: setTimeout(forceFinishSlotSpin, 3200) });
  renderSlot();
}

function pullSlotLever() {
  if (slotState.spinning || slotState.pendingWin) return;
  slotState.leverPulled = true;
  renderSlot();
  setTimeout(() => {
    slotState.leverPulled = false;
    renderSlot();
    spinSlot();
  }, 260);
}

function stopSlotReel(index) {
  if (!slotState.spinning || slotState.stopped[index]) return;
  clearInterval(slotState.timers[index]?.interval);
  clearTimeout(slotState.timers[index]?.timeout);
  slotState.reels[index] = slotState.finalReels[index];
  slotState.stopped[index] = true;
  if (slotState.stopped.every(Boolean)) finishSlotSpin();
  renderSlot();
}

function finishSlotSpin() {
  clearSlotTimers();
  slotState.spinning = false;
  const result = evaluateSlotWin();
  slotState.lastWin = result.totalWin;
  slotState.pendingWin = result.totalWin;
  if (result.freeSpins) slotState.freeSpins += result.freeSpins;
  renderSlotLines(result.winningLines);
  if (result.totalWin > 0) {
    slotLog(`中獎 ${result.totalWin}，${result.message}`);
  } else {
    slotLog("未中獎，請再試一把。");
  }
}

function forceFinishSlotSpin() {
  if (!slotState.spinning) return;
  slotState.reels = slotState.finalReels.map((reel) => [...reel]);
  slotState.stopped = [true, true, true, true, true];
  finishSlotSpin();
  renderSlot();
}

function evaluateSlotWin() {
  let totalWin = 0;
  const winningLines = [];
  const activeLines = paylines.slice(0, slotState.lines);
  activeLines.forEach((line, lineIndex) => {
    const symbols = getPaylineSymbols(line);
    const result = evaluateLine(symbols);
    if (result.win > 0) {
      totalWin += result.win;
      winningLines.push(lineIndex);
    }
  });
  const scatterCount = slotState.reels.flat().filter((symbol) => symbol.scatter).length;
  let freeSpins = 0;
  if (scatterCount >= 3) {
    const scatterPay = symbolById("scatter").pays[Math.min(scatterCount, 5)] * slotState.betPerLine;
    totalWin += scatterPay;
    freeSpins = scatterCount + 2;
  }
  const lineText = winningLines.length ? `${winningLines.length} 條線中獎` : "Scatter 獎勵";
  const scatterText = freeSpins ? `，觸發 ${freeSpins} 次免費局` : "";
  return { totalWin, winningLines, freeSpins, message: `${lineText}${scatterText}` };
}

function getPaylineSymbols(line) {
  if (line.type === "horizontal") return slotState.reels.map((reel) => reel[line.row]);
  return slotState.reels[line.reel];
}

function evaluateLine(symbols) {
  const target = symbols.find((symbol) => !symbol.wild && !symbol.scatter) || symbols[0];
  if (!target || target.scatter) return { win: 0 };
  const matched = symbols.every((symbol) => symbol.id === target.id || symbol.wild);
  if (!matched) return { win: 0 };
  const count = symbols.length;
  return { win: target.pays[count] * slotState.betPerLine };
}

function renderSlotLines(winningLines = []) {
  const board = document.getElementById("slotLineBoard");
  const overlay = document.getElementById("slotWinLines");
  board.innerHTML = "";
  overlay.innerHTML = "";
  paylines.forEach((line, index) => {
    const item = document.createElement("span");
    item.className = winningLines.includes(index) ? "hit" : "";
    item.textContent = index + 1;
    item.title = line.label;
    board.appendChild(item);
    if (winningLines.includes(index)) {
      const mark = document.createElement("span");
      mark.className = `win-line ${line.type === "horizontal" ? `line-h${line.row}` : `line-v${line.reel}`}`;
      overlay.appendChild(mark);
    }
  });
}

function collectSlotWin() {
  if (!slotState.pendingWin) return;
  state.balance += slotState.pendingWin;
  slotLog(`收分 ${slotState.pendingWin}。`);
  slotState.pendingWin = 0;
  renderSlot();
}

function gambleSlot(choice) {
  if (!slotState.pendingWin || slotState.spinning) return;
  const result = Math.random() < 0.5 ? "red" : "black";
  if (choice === result) {
    slotState.pendingWin *= 2;
    slotLog(`比倍猜中 ${result === "red" ? "紅" : "黑"}，獎金變 ${slotState.pendingWin}。`);
  } else {
    slotLog(`比倍猜錯，開出 ${result === "red" ? "紅" : "黑"}，本次獎金歸零。`);
    slotState.pendingWin = 0;
    slotState.lastWin = 0;
  }
  renderSlot();
}

function slotLog(message) {
  const list = document.getElementById("slotLog");
  const item = document.createElement("li");
  item.textContent = message;
  list.prepend(item);
}

function initMole() {
  const board = document.getElementById("moleBoard");
  if (!board.querySelector(".mole-hole")) {
    for (let index = 0; index < 9; index += 1) {
      const hole = document.createElement("button");
      hole.type = "button";
      hole.className = "mole-hole";
      hole.dataset.index = index;
      hole.setAttribute("aria-label", `洞口 ${index + 1}`);
      hole.innerHTML = '<span class="mole-rim"></span><span class="mole-character"></span>';
      board.appendChild(hole);
    }
  }
  board.querySelectorAll(".mole-hole").forEach((hole, index) => {
    hole.dataset.index = index;
    hole.onclick = null;
    hole.onpointerdown = null;
    hole.ontouchstart = null;
  });
  if (!board.dataset.bound) {
    board.addEventListener("mousedown", handleMoleSimpleClick);
    board.addEventListener("touchstart", handleMoleSimpleClick, { passive: false });
    board.addEventListener("click", handleMoleSimpleClick);
    board.addEventListener("mousemove", moveMoleHammer);
    board.addEventListener("mouseenter", showMoleHammer);
    board.addEventListener("mouseleave", hideMoleHammer);
    document.addEventListener("mousemove", moveMoleHammer);
    board.dataset.bound = "true";
  }
  setupMoleHammerCursor();
  setMoleMode("single");
  resetMole();
}

function setMoleMode(mode) {
  if (moleState.running) return;
  moleState.mode = mode;
  moleState.target = 50;
  document.getElementById("moleModeLabel").textContent = mode === "single" ? "單人模式" : "雙人對戰";
  document.getElementById("moleSingleBtn").classList.toggle("active", mode === "single");
  document.getElementById("moleDuelBtn").classList.toggle("active", mode === "duel");
  document.getElementById("moleDuelScore").classList.toggle("active", mode === "duel");
  renderMole();
}

function startMole() {
  if (moleState.running) return;
  clearMoleTimers();
  moleState.running = true;
  moleState.score = 0;
  moleState.levelScore = 0;
  moleState.level = 1;
  moleState.p1 = 0;
  moleState.p2 = 0;
  moleState.timeLeft = 35;
  moleState.active.clear();
  moleState.nextSpawnId = 1;
  clearMoleBoard();
  document.getElementById("moleLog").innerHTML = "";
  document.getElementById("moleResult").textContent = "第 1 關開始，達 50 分進入下一關。";
  moleLog(moleState.mode === "single" ? "第 1 關開始。" : "雙人對戰開始，左半邊算左區，右半邊算右區。");
  moleState.timer = setInterval(() => {
    moleState.timeLeft -= 1;
    if (moleState.timeLeft <= 0) finishMole();
    renderMole();
  }, 1000);
  startMoleSpawner();
  spawnMole();
  renderMole();
}

function resetMole() {
  clearMoleTimers();
  moleState.running = false;
  moleState.score = 0;
  moleState.levelScore = 0;
  moleState.level = 1;
  moleState.p1 = 0;
  moleState.p2 = 0;
  moleState.timeLeft = 35;
  moleState.active.clear();
  clearMoleBoard();
  document.getElementById("moleLog").innerHTML = "";
  document.getElementById("moleResult").textContent = "選擇模式後按開始。";
  renderMole();
}

function clearMoleTimers() {
  clearInterval(moleState.timer);
  clearInterval(moleState.spawnTimer);
  moleState.timer = null;
  moleState.spawnTimer = null;
}

function startMoleSpawner() {
  clearInterval(moleState.spawnTimer);
  moleState.spawnTimer = setInterval(spawnMole, moleSpeed().spawn);
}

function moleSpeed() {
  if (moleState.level === 1) return { spawn: 800, stay: 1450 };
  if (moleState.level === 2) return { spawn: 620, stay: 1100 };
  return { spawn: 480, stay: 860 };
}

function clearMoleBoard() {
  document.querySelectorAll(".mole-hole").forEach((hole) => {
    hole.className = "mole-hole";
    hole.innerHTML = '<span class="mole-rim"></span><span class="mole-character"></span>';
    delete hole.dataset.character;
    delete hole.dataset.score;
    delete hole.dataset.miss;
    delete hole.dataset.spawnId;
    hole.disabled = false;
  });
}

function setupMoleHammerCursor() {
  if (document.querySelector(".mole-cursor-hammer")) return;
  const hammer = document.createElement("div");
  hammer.className = "mole-cursor-hammer";
  hammer.setAttribute("aria-hidden", "true");
  hammer.innerHTML = moleHammerMarkup;
  document.body.appendChild(hammer);
}

function spawnMole() {
  if (!moleState.running) return;
  const holes = [...document.querySelectorAll(".mole-hole")];
  const empty = holes.filter((hole) => !moleState.active.has(Number(hole.dataset.index)));
  if (!empty.length) return;
  const hole = empty[Math.floor(Math.random() * empty.length)];
  const index = Number(hole.dataset.index);
  const character = pickMoleCharacter();
  const spawnId = moleState.nextSpawnId;
  moleState.nextSpawnId += 1;
  moleState.active.set(index, { ...character, spawnId });
  hole.className = `mole-hole up ${character.className}`;
  hole.dataset.character = character.type;
  hole.dataset.score = String(character.score);
  hole.dataset.miss = String(character.miss);
  hole.dataset.spawnId = String(spawnId);
  hole.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (Date.now() - moleState.lastPointerHitAt < 80) return;
    moleState.lastPointerHitAt = Date.now();
    bonkMoleHammer(event);
    hitMole(hole);
  };
  hole.onmousedown = hole.onclick;
  hole.ontouchstart = hole.onclick;
  hole.innerHTML = `<span class="mole-rim"></span><span class="mole-character">${moleFaceMarkup(character.type)}</span><span class="mole-points">${character.score > 0 ? `+${character.score}` : character.score}</span>`;
  const stay = character.type === "gold" ? Math.max(360, moleSpeed().stay - 160) : moleSpeed().stay;
  setTimeout(() => missMole(index, spawnId), stay);
}

function moleFace(type) {
  if (type === "gold") return "🐹";
  if (type === "cat") return "😾";
  if (type === "bomb") return "💣";
  return "🐭";
}

function pickMoleCharacter() {
  const roll = Math.random();
  if (roll < 0.64) return moleCharacters[0];
  if (roll < 0.76) return moleCharacters[1];
  if (roll < 0.9) return moleCharacters[2];
  return moleCharacters[3];
}

function moleFaceMarkup(type) {
  if (type === "mine") return '<span class="mole-face mole-face-mine"><span></span></span>';
  if (type === "rat") return '<span class="mole-face mole-face-rat"><span></span></span>';
  return '<span class="mole-face mole-face-mole"><span></span></span>';
}

function whackMoleHole(index, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
    event.moleHandled = true;
    bonkMoleHammer(event);
  }
  const hole = (event && getMoleHitTarget(event)) || document.querySelector(`.mole-hole[data-index="${index}"]`);
  if (hole) hitMole(hole);
}

window.whackMoleHole = whackMoleHole;

function handleMoleBoardClick(event) {
  if (event.moleHandled) return;
  if (Date.now() - moleState.lastPointerHitAt < 220) return;
  const hole = getMoleHitTarget(event);
  if (!hole || !document.getElementById("moleBoard").contains(hole)) return;
  event.moleHandled = true;
  bonkMoleHammer(event);
  hitMole(hole);
}

function handleMoleBoardPointerDown(event) {
  if (event.moleHandled) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  const hole = getMoleHitTarget(event);
  if (!hole || !document.getElementById("moleBoard").contains(hole)) return;
  moleState.lastPointerHitAt = Date.now();
  event.moleHandled = true;
  event.preventDefault();
  bonkMoleHammer(event);
  hitMole(hole);
}

function handleMoleBoardTouchStart(event) {
  const touch = event.changedTouches[0];
  if (!touch) return;
  const hole = getMoleHitTarget(touch);
  if (!hole || !document.getElementById("moleBoard").contains(hole)) return;
  moleState.lastPointerHitAt = Date.now();
  event.moleHandled = true;
  event.preventDefault();
  hitMole(hole);
}

function handleMoleHolePointerDown(event) {
  if (event.moleHandled) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  moleState.lastPointerHitAt = Date.now();
  event.moleHandled = true;
  event.stopPropagation();
  event.preventDefault();
  bonkMoleHammer(event);
  hitMole(event.currentTarget);
}

function handleMoleHoleTouchStart(event) {
  if (event.moleHandled) return;
  if (Date.now() - moleState.lastPointerHitAt < 120) return;
  moleState.lastPointerHitAt = Date.now();
  event.moleHandled = true;
  event.stopPropagation();
  event.preventDefault();
  hitMole(event.currentTarget);
}

function handleMoleHoleClick(event) {
  if (event.moleHandled) return;
  event.stopPropagation();
  if (Date.now() - moleState.lastPointerHitAt < 450) return;
  event.moleHandled = true;
  bonkMoleHammer(event);
  hitMole(event.currentTarget);
}

function handleMoleDocumentPointerDown(event) {
  const board = document.getElementById("moleBoard");
  if (!board || !board.contains(event.target)) return;
  handleMoleAttempt(event);
}

function handleMoleSimpleClick(event) {
  if (!moleState.running || (typeof event.button === "number" && event.button !== 0)) return;
  if (Date.now() - moleState.lastPointerHitAt < 120) return;
  const hole = getMoleHitTarget(event);
  if (!hole) return;
  moleState.lastPointerHitAt = Date.now();
  event.preventDefault();
  event.stopPropagation();
  bonkMoleHammer(event);
  hitMole(hole);
}

function showMoleHammer(event) {
  moveMoleHammer(event);
  document.querySelector(".mole-cursor-hammer")?.classList.add("active");
  document.getElementById("moleBoard")?.classList.add("hammer-ready");
}

function hideMoleHammer() {
  document.querySelector(".mole-cursor-hammer")?.classList.remove("active", "bonk");
  document.getElementById("moleBoard")?.classList.remove("hammer-ready", "hammer-bonk");
}

function moveMoleHammer(event) {
  if (typeof event.clientX !== "number" || typeof event.clientY !== "number") return;
  const board = document.getElementById("moleBoard");
  const hammer = document.querySelector(".mole-cursor-hammer");
  if (!board || !hammer) return;
  hammer.style.left = `${event.clientX}px`;
  hammer.style.top = `${event.clientY}px`;
  hammer.classList.toggle("active", board.contains(event.target));
}

function bonkMoleHammer(event) {
  moveMoleHammer(event);
  const hammer = document.querySelector(".mole-cursor-hammer");
  if (!hammer) return;
  hammer.classList.add("active", "bonk");
  window.setTimeout(() => hammer.classList.remove("bonk"), 160);
}

function handleMoleAttempt(event) {
  if (event.moleHandled || !moleState.running || (typeof event.button === "number" && event.button !== 0)) return;
  if (Date.now() - moleState.lastPointerHitAt < 140) return;
  const board = document.getElementById("moleBoard");
  if (!board || !board.contains(event.target)) return;
  const hole = getMoleHitTarget(event);
  if (!hole) return;
  event.moleHandled = true;
  moleState.lastPointerHitAt = Date.now();
  event.preventDefault();
  event.stopPropagation();
  bonkMoleHammer(event);
  hitMole(hole);
}

function getMoleHitTarget(event) {
  const point = event.changedTouches?.[0] || event.touches?.[0] || event;
  if (typeof point.clientX !== "number" || typeof point.clientY !== "number") return null;
  const directHole = event.target.closest(".mole-hole");
  if (directHole && moleState.active.has(Number(directHole.dataset.index))) return directHole;
  let nearestHole = null;
  let nearestDistance = Infinity;
  moleState.active.forEach((_, index) => {
    const hole = document.querySelector(`.mole-hole[data-index="${index}"]`);
    if (!hole) return;
    const rect = hole.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.hypot(point.clientX - centerX, point.clientY - centerY);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestHole = hole;
    }
  });
  if (nearestDistance <= 170) return nearestHole;
  if (directHole) return directHole;
  return null;
}

function hitMole(hole) {
  if (!moleState.running) return;
  const index = Number(hole.dataset.index);
  const character = moleState.active.get(index) || characterFromHole(hole);
  if (!character) {
    moleLog("敲空洞。");
    return;
  }
  moleState.active.delete(index);
  if (hole) {
    hole.className = "mole-hole hit";
    delete hole.dataset.character;
    delete hole.dataset.score;
    delete hole.dataset.miss;
    delete hole.dataset.spawnId;
    hole.onclick = null;
    hole.onmousedown = null;
    hole.ontouchstart = null;
    const effectMarkup =
      character.score > 0
        ? '<span class="mole-stars" aria-hidden="true"><span>&#9733;</span><span>&#9733;</span><span>&#9733;</span></span>'
        : '<span class="mole-smoke" aria-hidden="true"><span></span><span></span><span></span></span>';
    hole.innerHTML = `<span class="mole-rim"></span><span class="mole-hit-face">${moleFaceMarkup(character.type)}</span>${effectMarkup}<span class="mole-hammer" aria-hidden="true">${moleHammerMarkup}</span><span class="mole-hit-score">${character.score > 0 ? `+${character.score}` : character.score}</span>`;
    setTimeout(() => {
      if (!moleState.active.has(index)) {
        hole.className = "mole-hole";
        hole.innerHTML = '<span class="mole-rim"></span><span class="mole-character"></span>';
      }
    }, 900);
  }
  addMoleScore(index, character.score);
  moleLog(`${character.label}${character.score > 0 ? "命中" : "誤打"}，${character.score > 0 ? "+" : ""}${character.score} 分。`);
  renderMole();
}

function characterFromHole(hole) {
  if (!hole.dataset.character) return null;
  const preset = moleCharacters.find((item) => item.type === hole.dataset.character);
  if (!preset) return null;
  return { ...preset, score: Number(hole.dataset.score), miss: Number(hole.dataset.miss) };
}

function missMole(index, spawnId) {
  if (!moleState.running || !moleState.active.has(index)) return;
  const character = moleState.active.get(index);
  if (character.spawnId !== spawnId) return;
  moleState.active.delete(index);
  const hole = document.querySelector(`.mole-hole[data-index="${index}"]`);
  if (hole) {
    hole.className = "mole-hole";
    delete hole.dataset.character;
    delete hole.dataset.score;
    delete hole.dataset.miss;
    delete hole.dataset.spawnId;
    hole.onclick = null;
    hole.onmousedown = null;
    hole.ontouchstart = null;
    hole.innerHTML = '<span class="mole-rim"></span><span class="mole-character"></span>';
  }
}

function addMoleScore(index, delta) {
  if (moleState.mode === "duel") {
    if (index % 3 === 0) moleState.p1 += delta;
    else if (index % 3 === 2) moleState.p2 += delta;
    else if (index < 4) moleState.p1 += delta;
    else moleState.p2 += delta;
    moleState.score = moleState.p1 + moleState.p2;
    moleState.levelScore += delta;
    checkMoleLevelUp();
    return;
  }
  moleState.score += delta;
  moleState.levelScore += delta;
  checkMoleLevelUp();
}

function checkMoleLevelUp() {
  if (!moleState.running || moleState.levelScore < moleState.target) return;
  if (moleState.level >= 3) {
    finishMole(true);
    return;
  }
  moleState.level += 1;
  moleState.levelScore = 0;
  moleState.timeLeft = 35;
  moleState.active.clear();
  clearMoleBoard();
  startMoleSpawner();
  document.getElementById("moleResult").textContent = `進入第 ${moleState.level} 關，速度提升。`;
  moleLog(`達到 50 分，進入第 ${moleState.level} 關。`);
}

function finishMole(cleared = false) {
  clearMoleTimers();
  moleState.running = false;
  moleState.active.clear();
  clearMoleBoard();
  if (cleared) {
    document.getElementById("moleResult").textContent = `全破，總分 ${moleState.score}`;
    moleLog("完成第 3 關，全破。");
    renderMole();
    return;
  }
  if (moleState.mode === "duel") {
    const result = moleState.p1 === moleState.p2 ? "平手" : moleState.p1 > moleState.p2 ? "左區勝利" : "右區勝利";
    document.getElementById("moleResult").textContent = `${result}，左區 ${moleState.p1}：右區 ${moleState.p2}`;
    moleLog(`時間到，${result}。`);
  } else {
    document.getElementById("moleResult").textContent = `失敗，第 ${moleState.level} 關分數 ${moleState.levelScore} / 50，總分 ${moleState.score}`;
    moleLog("時間到，未達本關 50 分。");
  }
  renderMole();
}

function renderMole() {
  document.getElementById("moleScoreLabel").textContent = `第 ${moleState.level} 關：${moleState.levelScore} / 50`;
  document.getElementById("moleTimeLabel").textContent = `時間：${moleState.timeLeft}`;
  document.getElementById("moleTargetLabel").textContent = `總分：${moleState.score}`;
  document.getElementById("moleP1Label").textContent = moleState.p1;
  document.getElementById("moleP2Label").textContent = moleState.p2;
  document.getElementById("moleStartBtn").disabled = moleState.running;
  document.getElementById("moleSingleBtn").disabled = moleState.running;
  document.getElementById("moleDuelBtn").disabled = moleState.running;
}

function moleLog(message) {
  const list = document.getElementById("moleLog");
  const item = document.createElement("li");
  item.textContent = message;
  list.prepend(item);
}

function buildWall() {
  const tiles = [];
  suits.forEach((suit) => {
    suit.values.forEach((value, index) => {
      for (let copy = 0; copy < 4; copy += 1) {
        tiles.push({ label: `${value}${suit.name}`, suit: suit.name, rank: index + 1 });
      }
    });
  });
  honors.forEach((label) => {
    for (let copy = 0; copy < 4; copy += 1) tiles.push({ label, suit: "字", rank: 0 });
  });
  flowers.forEach((label) => tiles.push({ label, suit: "花", rank: 0 }));
  return shuffle(tiles);
}

function shuffle(items) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function startRound() {
  clearAiTimer();
  state.wall = buildWall();
  state.river = [];
  state.hand = state.wall.splice(0, 16).sort(sortTile);
  Object.keys(state.opponents).forEach((name) => {
    state.opponents[name] = state.wall.splice(0, 16).sort(sortTile);
  });
  Object.keys(state.melds).forEach((name) => {
    state.melds[name] = [];
  });
  replaceFlowers("你", state.hand, true);
  Object.entries(state.opponents).forEach(([name, hand]) => replaceFlowers(name, hand, true));
  state.selectedIndex = 0;
  state.dealer = null;
  state.lastDiscard = null;
  state.lastDrawSelf = false;
  Object.keys(state.ting).forEach((name) => {
    state.ting[name] = false;
  });
  state.turn = "setup";
  state.currentPlayer = "你";
  state.lastDiscardFrom = null;
  document.getElementById("diceBox").textContent = "骰";
  logEl.innerHTML = "";
  log(`新局建立：AI 強度為 ${currentAi().label}，失誤率 ${currentAi().mistakeRate}%。請先抽位與起莊。`);
  render();
}

function currentAi() {
  return aiProfiles[state.aiDifficulty];
}

function handFor(player) {
  return player === "你" ? state.hand : state.opponents[player];
}

function giveOpeningTile(player) {
  if (!state.wall.length) return;
  const hand = handFor(player);
  if (!hand) {
    throw new Error(`找不到玩家 ${player} 的手牌。`);
  }
  hand.push(state.wall.shift());
  replaceFlowers(player, hand, false);
  hand.sort(sortTile);
  if (player === "你") state.selectedIndex = hand.length - 1;
}

function clearAiTimer() {
  if (!state.aiTimer) return;
  clearTimeout(state.aiTimer);
  state.aiTimer = null;
}

function scheduleAiTurn(shouldDraw) {
  clearAiTimer();
  state.aiTimer = setTimeout(() => {
    state.aiTimer = null;
    playAiTurn(state.currentPlayer, shouldDraw);
  }, 650);
}

function replaceFlowers(player, hand, quiet) {
  let flowerCount = 0;
  for (let index = hand.length - 1; index >= 0; index -= 1) {
    if (hand[index].suit !== "花") continue;
    const [flower] = hand.splice(index, 1);
    state.river.push({ tile: flower, from: player, flower: true });
    flowerCount += 1;
  }
  while (flowerCount > 0 && state.wall.length) {
    const supplement = state.wall.pop();
    hand.push(supplement);
    if (supplement.suit === "花") {
      const [flower] = hand.splice(hand.length - 1, 1);
      state.river.push({ tile: flower, from: player, flower: true });
      flowerCount += 1;
    }
    flowerCount -= 1;
  }
  hand.sort(sortTile);
  if (!quiet) render();
}

function setAiDifficulty(value) {
  state.aiDifficulty = value;
  const ai = currentAi();
  document.getElementById("aiDescription").textContent = ai.description;
  document.getElementById("aiStatusLabel").textContent = `AI：${ai.label}，失誤率 ${ai.mistakeRate}%`;
  document.querySelectorAll(".ai-seat-label").forEach((label) => {
    label.textContent = `AI ${ai.label}`;
  });
  log(`AI 強度切換為「${ai.label}」，失誤率 ${ai.mistakeRate}%。`);
  renderPromptActions();
}

function drawSeatAndDealer() {
  log("已按下「骰子 / 起莊」。");
  if (state.dealer) {
    log(`本局已起莊，莊家為 ${state.dealer}。要重新抽位請按「重新開局」。`);
    return;
  }
  const diceA = Math.ceil(Math.random() * 6);
  const diceB = Math.ceil(Math.random() * 6);
  const diceC = Math.ceil(Math.random() * 6);
  const total = diceA + diceB + diceC;
  const dealerIndex = (total - 1) % turnOrder.length;
  const dealerPlayer = turnOrder[dealerIndex];
  const dealerWind = windByPlayer[dealerPlayer];
  state.dealer = dealerWind;
  state.currentPlayer = dealerPlayer;
  state.turn = state.currentPlayer === "你" ? "player" : "ai";
  state.lastDrawSelf = true;
  state.lastDiscard = null;
  state.lastDiscardFrom = null;
  document.getElementById("diceBox").textContent = total;
  try {
    giveOpeningTile(state.currentPlayer);
  } catch (error) {
    log(`起莊補牌失敗：${error.message}`);
    state.turn = "setup";
    state.dealer = null;
    state.currentPlayer = "你";
    render();
    return;
  }
  render();
  log(`擲骰 ${diceA}+${diceB}+${diceC}=${total}，莊家為 ${dealerPlayer}（${dealerWind}）。`);
  if (state.currentPlayer === "你") {
    log("你是莊家，手牌已補成 17 張，請選一張牌打出。");
    render();
    return;
  }
  log(`${state.currentPlayer}是莊家，電腦準備先打。`);
  scheduleAiTurn(false);
}

function drawTile() {
  log("已按下「摸牌」。");
  if (!state.dealer) {
    log("尚未抽位起莊，請先按「抽位 / 起莊」。");
    return;
  }
  if (state.turn === "finished") {
    log("本局已結束，請重新開局。");
    return;
  }
  if (!state.wall.length) {
    endDrawnGame();
    return;
  }
  if (state.lastDrawSelf) {
    log("目前需要先出牌。");
    return;
  }
  if (state.currentPlayer !== "你") {
    log("目前還沒輪到你，請等電腦出完牌。");
    return;
  }
  if (state.lastDiscard && state.lastDiscardFrom !== "你") {
    const next = nextPlayer(state.lastDiscardFrom);
    log(`不吃碰槓胡 ${state.lastDiscard.label}，繼續摸牌。`);
    state.lastDiscard = null;
    state.lastDiscardFrom = null;
    if (next !== "你") {
      state.currentPlayer = next;
      state.turn = "ai";
      render();
      scheduleAiTurn(true);
      return;
    }
  }
  const tile = state.wall.shift();
  state.hand.push(tile);
  replaceFlowers("你", state.hand, true);
  state.selectedIndex = state.hand.length - 1;
  state.lastDrawSelf = true;
  state.turn = "player";
  log(`摸牌：${tile.label}。`);
  render();
}

function discardTile() {
  log("已按下「出牌」。");
  if (!state.dealer) {
    log("尚未抽位起莊，請先按「骰子 / 起莊」。");
    return;
  }
  if (state.turn === "finished") {
    log("本局已結束，請重新開局。");
    return;
  }
  if (state.currentPlayer !== "你") {
    log("目前還沒輪到你出牌。");
    return;
  }
  if (!state.lastDrawSelf) {
    if (state.hand.length !== 17) {
      log("請先摸牌，或先回應吃碰槓胡。");
      return;
    }
  }
  if (!state.hand.length) return;
  const [tile] = state.hand.splice(state.selectedIndex, 1);
  state.lastDiscard = tile;
  state.lastDiscardFrom = "你";
  state.river.push({ tile, from: "你" });
  state.lastDrawSelf = false;
  updateTingStatus("你", true);
  state.selectedIndex = Math.max(0, state.selectedIndex - 1);
  state.turn = "wait";
  log(`你打出 ${tile.label}。電腦依目前 AI 強度思考。`);
  render();
  resolveAfterDiscard("你");
}

function nextPlayer(name) {
  return turnOrder[(turnOrder.indexOf(name) + 1) % turnOrder.length];
}

function hasPlayerResponseToDiscard() {
  if (!state.lastDiscard || state.lastDiscardFrom === "你" || state.turn === "finished") return false;
  return canHuDiscard() || canChi() || canPon() || canKan();
}

function resolveAfterDiscard(from) {
  if (state.turn === "finished") return;
  if (from !== "你" && hasPlayerResponseToDiscard()) {
    state.currentPlayer = "你";
    state.turn = "player";
    log(`電腦打出 ${state.lastDiscard.label}，可吃、碰、槓、胡時會顯示動作；按「摸牌」可不吃碰槓胡。`);
    render();
    return;
  }
  const claimedBy = tryAiClaim(state.lastDiscard, from);
  if (claimedBy) {
    state.currentPlayer = claimedBy;
    state.turn = "ai";
    render();
    scheduleAiTurn(false);
    return;
  }
  const next = nextPlayer(from);
  state.currentPlayer = next;
  if (next === "你") {
    state.turn = "player";
    state.lastDrawSelf = false;
    log("輪到你摸牌。");
    render();
    return;
  }
  state.turn = "ai";
  render();
  scheduleAiTurn(true);
}

function playAiTurn(name, shouldDraw) {
  const hand = state.opponents[name];
  if (!hand) return false;
  if (shouldDraw) {
    if (!state.wall.length) {
      endDrawnGame();
      return false;
    }
    hand.push(state.wall.shift());
    replaceFlowers(name, hand, true);
    if (isPotentialWinningHand(hand, state.melds[name])) {
      settleWin({ winner: name, selfDraw: true });
      return true;
    }
  }
  const mistake = Math.random() * 100 < currentAi().mistakeRate;
  const discardIndex = chooseOpponentDiscard(hand, mistake);
  if (discardIndex < 0) {
    endDrawnGame();
    return false;
  }
  const [discarded] = hand.splice(discardIndex, 1);
  state.lastDiscard = discarded;
  state.lastDiscardFrom = name;
  state.river.push({ tile: discarded, from: name });
  updateTingStatus(name, true);
  const thinking = mistake ? "失誤亂打" : "保留好牌後出牌";
  log(`${name}（AI ${currentAi().label}）${shouldDraw ? "摸打一張" : "莊家先打"}，${thinking}：${discarded.label}。`);
  render();
  resolveAfterDiscard(name);
  return true;
}

function tryAiClaim(discarded, from) {
  if (!discarded) return null;
  const candidates = turnOrder.filter((name) => name !== "你" && name !== from);
  const huPlayer = candidates.find((name) => isPotentialWinningHand([...state.opponents[name], discarded], state.melds[name]));
  if (huPlayer) {
    settleWin({ winner: huPlayer, discarder: from, winningTile: discarded });
    return huPlayer;
  }
  const claim = candidates
    .map((name) => getAiClaim(name, discarded, from))
    .find(Boolean);
  if (!claim) return null;

  state.river.pop();
  state.lastDiscard = null;
  state.lastDiscardFrom = null;
  if (claim.action === "槓") removeTilesFromOpponent(claim.player, discarded.label, 3);
  if (claim.action === "碰") removeTilesFromOpponent(claim.player, discarded.label, 2);
  if (claim.action === "吃") removeOpponentSequenceForChi(claim.player, discarded);
  state.melds[claim.player].push({ action: claim.action, tile: discarded });
  if (claim.action === "槓" && state.wall.length) {
    state.opponents[claim.player].push(state.wall.pop());
  }
  log(`${claim.player}（AI ${currentAi().label}）${claim.action} ${discarded.label}，接著出牌。`);
  return claim.player;
}

function getAiClaim(name, discarded, from) {
  const hand = state.opponents[name];
  const mistake = Math.random() * 100 < currentAi().mistakeRate;
  const sameCount = hand.filter((tile) => tile.label === discarded.label).length;
  const canAiKan = sameCount >= 3;
  const canAiPon = sameCount >= 2;
  const canAiChi = nextPlayer(from) === name && canHandChi(hand, discarded);
  if (canAiKan && (!mistake || Math.random() < 0.35)) return { player: name, action: "槓" };
  if (canAiPon && (!mistake || Math.random() < 0.55)) return { player: name, action: "碰" };
  if (canAiChi && (!mistake || Math.random() < 0.5)) return { player: name, action: "吃" };
  return null;
}

function removeTilesFromOpponent(name, label, amount) {
  let removed = 0;
  state.opponents[name] = state.opponents[name].filter((tile) => {
    if (tile.label === label && removed < amount) {
      removed += 1;
      return false;
    }
    return true;
  });
}

function removeOpponentSequenceForChi(name, discarded) {
  const hand = state.opponents[name];
  const match = findChiRanks(hand, discarded);
  if (!match) return;
  match.forEach((rank) => {
    const index = hand.findIndex((tile) => tile.suit === discarded.suit && tile.rank === rank);
    if (index >= 0) hand.splice(index, 1);
  });
}

function chooseOpponentDiscard(hand, mistake) {
  if (mistake) return Math.floor(Math.random() * hand.length);
  let lowestScore = Number.POSITIVE_INFINITY;
  let targetIndex = 0;
  hand.forEach((tile, index) => {
    const score = tileKeepScore(tile, hand);
    if (score < lowestScore) {
      lowestScore = score;
      targetIndex = index;
    }
  });
  return targetIndex;
}

function tileKeepScore(tile, hand) {
  let score = 0;
  const sameCount = hand.filter((item) => item.label === tile.label).length;
  if (sameCount >= 2) score += 5;
  if (sameCount >= 3) score += 4;
  if (tile.suit !== "字" && tile.suit !== "花") {
    const ranks = hand.filter((item) => item.suit === tile.suit).map((item) => item.rank);
    if (ranks.includes(tile.rank - 1) || ranks.includes(tile.rank + 1)) score += 3;
    if (ranks.includes(tile.rank - 2) || ranks.includes(tile.rank + 2)) score += 1;
  }
  if (tile.suit === "花") score -= 2;
  return score;
}

function claim(action) {
  if (!state.lastDiscard) {
    log(`目前沒有可${action}的棄牌。`);
    return;
  }
  const sameCount = state.hand.filter((tile) => tile.label === state.lastDiscard.label).length;
  if (action === "碰" && sameCount < 2) {
    log(`不能碰 ${state.lastDiscard.label}：手上未滿兩張同牌。`);
    return;
  }
  if (action === "槓" && sameCount < 3) {
    log(`不能槓 ${state.lastDiscard.label}：手上未滿三張同牌。`);
    return;
  }
  if (action === "吃" && !canChi()) {
    log(`不能吃 ${state.lastDiscard.label}：手上沒有可組成順子的牌。`);
    return;
  }
  log(`${action}牌成立：以 ${state.lastDiscard.label} 組成面子。`);
  state.river.pop();
  if (action === "碰") removeTilesFromHand(state.lastDiscard.label, 2);
  if (action === "吃") removeSequenceForChi(state.lastDiscard);
  if (action === "槓") {
    removeTilesFromHand(state.lastDiscard.label, 3);
    if (state.wall.length) {
      const supplement = state.wall.pop();
      state.hand.push(supplement);
      log(`槓後從牌牆末端補 ${supplement.label}。`);
    }
  }
  state.melds["你"].push({ action, tile: state.lastDiscard });
  state.lastDiscard = null;
  state.lastDiscardFrom = null;
  state.lastDrawSelf = true;
  state.currentPlayer = "你";
  state.turn = "player";
  log("輪到你出牌。");
  render();
}

function handlePromptAction(action) {
  if (action === "pon") claim("碰");
  if (action === "chi") claim("吃");
  if (action === "kan") {
    if (state.lastDiscard) claim("槓");
    else concealedKan();
  }
  if (action === "hu") declareHu(false);
  if (action === "zimo") declareHu(true);
  if (action === "ting") {
    declareTing();
  }
  if (action === "pass") {
    const from = state.lastDiscardFrom;
    const next = from ? nextPlayer(from) : "你";
    log("不吃碰槓胡。");
    state.lastDiscard = null;
    state.lastDiscardFrom = null;
    state.lastDrawSelf = false;
    state.currentPlayer = next;
    if (next === "你") {
      state.turn = "player";
      log("輪到你摸牌。");
      render();
    } else {
      state.turn = "ai";
      render();
      scheduleAiTurn(true);
    }
  }
}

function removeSequenceForChi(discarded) {
  const match = findChiRanks(state.hand, discarded);
  if (!match) return;
  match.forEach((rank) => {
    const index = state.hand.findIndex((tile) => tile.suit === discarded.suit && tile.rank === rank);
    if (index >= 0) state.hand.splice(index, 1);
  });
}

function findChiRanks(hand, discarded) {
  const candidates = [
    [discarded.rank - 2, discarded.rank - 1],
    [discarded.rank - 1, discarded.rank + 1],
    [discarded.rank + 1, discarded.rank + 2],
  ];
  return candidates.find((ranks) =>
    ranks.every((rank) => rank >= 1 && rank <= 9 && hand.some((tile) => tile.suit === discarded.suit && tile.rank === rank)),
  );
}

function canHandChi(hand, discarded) {
  if (!discarded || discarded.suit === "字" || discarded.suit === "花") return false;
  return Boolean(findChiRanks(hand, discarded));
}

function concealedKan() {
  const entry = Object.entries(countTiles(state.hand)).find(([, count]) => count >= 4);
  if (!entry) {
    log("目前沒有可槓的四張同牌。");
    return;
  }
  const [label] = entry;
  removeTilesFromHand(label, 4);
  log(`暗槓成立：你槓 ${label}。`);
  if (state.wall.length) {
    const supplement = state.wall.pop();
    state.hand.push(supplement);
    state.lastDrawSelf = true;
    log(`槓後從牌牆末端補 ${supplement.label}。`);
  }
  render();
}

function declareHu(selfDraw) {
  if (selfDraw && !canSelfDraw()) {
    log("尚未達成自摸條件。");
    return;
  }
  if (!selfDraw && !canHuDiscard()) {
    log("目前棄牌未達胡牌條件。");
    return;
  }
  settleWin({
    winner: "你",
    selfDraw,
    discarder: selfDraw ? null : state.lastDiscardFrom,
    winningTile: selfDraw ? state.hand[state.hand.length - 1] : state.lastDiscard,
  });
}

function removeTilesFromHand(label, amount) {
  let removed = 0;
  state.hand = state.hand.filter((tile) => {
    if (tile.label === label && removed < amount) {
      removed += 1;
      return false;
    }
    return true;
  });
  state.selectedIndex = Math.min(state.selectedIndex, Math.max(0, state.hand.length - 1));
}

function getAvailablePrompts() {
  return {
    hu: canHuDiscard(),
    chi: canChi(),
    pon: canPon(),
    kan: canKan(),
    ting: canTing(),
    zimo: canSelfDraw(),
    pass: false,
  };
}

function canChi() {
  if (!state.lastDiscard || state.turn === "finished") return false;
  if (nextPlayer(state.lastDiscardFrom) !== "你") return false;
  return canHandChi(state.hand, state.lastDiscard);
}

function canPon() {
  if (state.turn === "finished") return false;
  return Boolean(state.lastDiscard) && state.lastDiscardFrom !== "你" && state.hand.filter((tile) => tile.label === state.lastDiscard.label).length >= 2;
}

function canKan() {
  if (state.turn === "finished") return false;
  if (state.lastDiscard) {
    return state.lastDiscardFrom !== "你" && state.hand.filter((tile) => tile.label === state.lastDiscard.label).length >= 3;
  }
  return Object.values(countTiles(state.hand)).some((count) => count >= 4);
}

function canHuDiscard() {
  if (!state.lastDiscard || state.turn === "finished") return false;
  if (state.lastDiscardFrom === "你") return false;
  return isPotentialWinningHand([...state.hand, state.lastDiscard], state.melds["你"]);
}

function canSelfDraw() {
  if (state.turn === "finished") return false;
  return state.lastDrawSelf && state.hand.length === concealedWinLength("你") && isPotentialWinningHand(state.hand, state.melds["你"]);
}

function concealedWinLength(player) {
  return 17 - (state.melds[player]?.length || 0) * 3;
}

function canTing() {
  if (state.turn === "finished") return false;
  if (state.ting["你"]) return false;
  return getTingOptions("你").length > 0;
}

function declareTing() {
  const options = getTingOptions("你");
  if (!options.length) {
    log("目前還沒有聽牌。");
    return;
  }
  const selected = state.hand[state.selectedIndex];
  const selectedOption = options.find((option) => option.discard?.label === selected?.label) || options[0];
  if (selectedOption.discard) {
    const index = state.hand.findIndex((tile) => tile === selectedOption.discard);
    if (index >= 0) state.selectedIndex = index;
    state.ting["你"] = true;
    log(`宣告聽牌，打出 ${selectedOption.discard.label} 後可聽 ${selectedOption.waits.map((tile) => tile.label).join("、")}。`);
    discardTile();
    return;
  }
  state.ting["你"] = true;
  log(`聽牌成立：可聽 ${selectedOption.waits.map((tile) => tile.label).join("、")}。`);
  render();
}

function uniqueTilesFromWallAndHand() {
  const map = new Map();
  [...state.wall, ...state.hand, ...allTileTypes()].forEach((tile) => {
    if (!map.has(tile.label)) map.set(tile.label, tile);
  });
  return [...map.values()];
}

function allTileTypes() {
  return [
    ...suits.flatMap((suit) => suit.values.map((value, index) => ({ label: `${value}${suit.name}`, suit: suit.name, rank: index + 1 }))),
    ...honors.map((label) => ({ label, suit: "字", rank: 0 })),
  ];
}

function getTingOptions(player) {
  const hand = handFor(player) || [];
  const melds = state.melds[player] || [];
  const readyLength = concealedWinLength(player) - 1;
  const winLength = concealedWinLength(player);
  if (hand.length === readyLength) {
    const waits = getWinningWaits(hand, melds);
    return waits.length ? [{ discard: null, waits }] : [];
  }
  if (hand.length !== winLength) return [];
  const seenDiscards = new Set();
  return hand
    .map((discard) => {
      if (seenDiscards.has(discard.label)) return null;
      seenDiscards.add(discard.label);
      const rest = hand.filter((tile) => tile !== discard);
      const waits = getWinningWaits(rest, melds);
      return waits.length ? { discard, waits } : null;
    })
    .filter(Boolean);
}

function getWinningWaits(hand, melds = []) {
  return uniqueTilesFromWallAndHand().filter((tile) => isPotentialWinningHand([...hand, tile], melds));
}

function updateTingStatus(player, force = false) {
  if (state.turn === "finished") return;
  if (force || player !== "你" || !state.ting["你"]) {
    state.ting[player] = getTingOptions(player).some((option) => !option.discard);
  }
}

function updateAllTingStatuses() {
  turnOrder.forEach((player) => updateTingStatus(player));
}

function isPotentialWinningHand(hand, melds = []) {
  const neededMelds = 5 - melds.length;
  if (neededMelds < 0) return false;
  if (hand.length !== neededMelds * 3 + 2) return false;
  const counts = countTiles(hand);
  return Object.entries(counts).some(([label, count]) => {
    if (count < 2) return false;
    const remaining = { ...counts, [label]: count - 2 };
    return canFormMelds(remaining, neededMelds);
  });
}

function canFormMelds(counts, meldsNeeded) {
  if (meldsNeeded === 0) return Object.values(counts).every((count) => count === 0);
  const label = Object.keys(counts).find((key) => counts[key] > 0);
  if (!label) return false;
  if (counts[label] >= 3) {
    counts[label] -= 3;
    if (canFormMelds(counts, meldsNeeded - 1)) return true;
    counts[label] += 3;
  }
  const tile = tileFromLabel(label);
  if (tile && tile.suit !== "字" && tile.suit !== "花" && tile.rank <= 7) {
    const suit = suits.find((item) => item.name === tile.suit);
    const labels = [tile.rank, tile.rank + 1, tile.rank + 2].map((rank) => `${suit.values[rank - 1]}${tile.suit}`);
    if (labels.every((item) => counts[item] > 0)) {
      labels.forEach((item) => {
        counts[item] -= 1;
      });
      if (canFormMelds(counts, meldsNeeded - 1)) return true;
      labels.forEach((item) => {
        counts[item] += 1;
      });
    }
  }
  return false;
}

function tileFromLabel(label) {
  if (honors.includes(label)) return { label, suit: "字", rank: 0 };
  if (flowers.includes(label)) return { label, suit: "花", rank: 0 };
  const suit = suits.find((item) => label.endsWith(item.name));
  if (!suit) return null;
  const value = label.slice(0, -suit.name.length);
  const rank = suit.values.indexOf(value) + 1;
  if (!rank) return null;
  return { label, suit: suit.name, rank };
}

function endDrawnGame() {
  state.turn = "finished";
  state.lastDiscard = null;
  state.lastDiscardFrom = null;
  state.lastDrawSelf = false;
  log(`牌牆已摸完，本局流局。莊家 ${playerByWind[state.dealer] || "未定"} 連莊保留。`);
  render();
}

function settleWin({ winner, selfDraw = false, discarder = null, winningTile = null }) {
  const tai = calculateTai(winner, { selfDraw, winningTile });
  const base = 100;
  const taiValue = 20;
  const payment = base + tai * taiValue;
  const losers = selfDraw ? turnOrder.filter((name) => name !== winner) : [discarder].filter(Boolean);
  losers.forEach((loser) => {
    state.playerMoney[loser] -= payment;
    state.playerMoney[winner] += payment;
  });
  state.balance = state.playerMoney["你"];
  const resultText = selfDraw
    ? `${winner} 自摸，其他三家各付 ${payment}（${tai} 台）。`
    : `${winner} 胡 ${winningTile?.label || state.lastDiscard?.label || ""}，${discarder} 放槍付 ${payment}（${tai} 台）。`;
  log(resultText);
  log(`目前金額：你 ${state.playerMoney["你"]}，玩家 A ${state.playerMoney["玩家 A"]}，玩家 B ${state.playerMoney["玩家 B"]}，玩家 C ${state.playerMoney["玩家 C"]}。`);
  if (winner === playerByWind[state.dealer]) {
    state.dealerStreak += 1;
    log(`莊家胡牌，連莊 ${state.dealerStreak}。`);
  } else {
    state.dealerStreak = 0;
  }
  state.turn = "finished";
  state.lastDiscard = null;
  state.lastDiscardFrom = null;
  state.lastDrawSelf = false;
  render();
}

function calculateTai(player, { selfDraw = false } = {}) {
  let tai = 0;
  if (player === playerByWind[state.dealer]) tai += 1;
  if (state.dealerStreak > 0 && player === playerByWind[state.dealer]) tai += state.dealerStreak * 2 + 1;
  if (selfDraw) tai += 1;
  if (!state.melds[player]?.length) tai += 1;
  const hand = handFor(player) || [];
  if (isAllTriplets(hand, state.melds[player])) tai += 4;
  tai += countDragonTripletTai(hand, state.melds[player]);
  return Math.max(1, tai);
}

function isAllTriplets(hand, melds = []) {
  if (melds.some((meld) => meld.action === "吃")) return false;
  const counts = countTiles(hand);
  let pairUsed = false;
  return Object.values(counts).every((count) => {
    if (count === 3 || count === 0) return true;
    if (count === 2 && !pairUsed) {
      pairUsed = true;
      return true;
    }
    return false;
  });
}

function countDragonTripletTai(hand, melds = []) {
  const counts = countTiles(hand);
  return ["中", "發", "白"].reduce((total, label) => {
    const inHand = counts[label] >= 3 ? 1 : 0;
    const inMeld = melds.some((meld) => meld.tile?.label === label && (meld.action === "碰" || meld.action === "槓")) ? 1 : 0;
    return total + Math.max(inHand, inMeld);
  }, 0);
}

function countTiles(hand) {
  return hand.reduce((map, tile) => {
    map[tile.label] = (map[tile.label] || 0) + 1;
    return map;
  }, {});
}

function sortTile(a, b) {
  const order = { 萬: 1, 筒: 2, 條: 3, 字: 4, 花: 5 };
  return order[a.suit] - order[b.suit] || a.rank - b.rank || a.label.localeCompare(b.label, "zh-Hant");
}

function render() {
  updateAllTingStatuses();
  state.hand.sort(sortTile);
  handEl.innerHTML = "";
  state.hand.forEach((tile, index) => {
    const button = document.createElement("button");
    button.className = `tile tile-${tile.suit}${index === state.selectedIndex ? " selected" : ""}${index === state.hand.length - 1 && state.lastDrawSelf ? " drawn" : ""}`;
    button.setAttribute("aria-label", tile.label);
    button.type = "button";
    button.appendChild(createTileFace(tile));
    button.addEventListener("click", () => {
      if (state.selectedIndex === index && canDiscardSelectedTile()) {
        discardTile();
        return;
      }
      state.selectedIndex = index;
      render();
    });
    handEl.appendChild(button);
  });
  document.getElementById("wallLabel").textContent = `牌牆：${state.wall.length}`;
  document.getElementById("roundRemain").textContent = `剩牌:${state.wall.length}張`;
  document.getElementById("moneyLabel").textContent = `你:${state.playerMoney["你"]}`;
  const dealerPlayer = state.dealer ? playerByWind[state.dealer] : "";
  document.getElementById("dealerLabel").textContent = `莊家：${state.dealer ? `${dealerPlayer}（${state.dealer}）` : "抽位中"}`;
  document.getElementById("lastDiscard").textContent = `棄牌：${state.lastDiscard ? state.lastDiscard.label : "無"}`;
  document.getElementById("turnLabel").textContent = getTurnText();
  document.getElementById("playerSeatStatus").textContent = state.ting["你"] ? `聽 ${state.hand.length}` : `手牌 ${state.hand.length}`;
  document.getElementById("seatDrawBtn").disabled = false;
  document.getElementById("drawBtn").disabled = false;
  document.getElementById("discardBtn").disabled = false;
  document.querySelectorAll(".seat-marker").forEach((seat) => {
    seat.classList.toggle("dealer-seat", seat.dataset.wind === state.dealer);
    seat.classList.toggle("current", seat.dataset.wind === windByPlayer[state.currentPlayer]);
  });
  renderOpponents();
  renderRiver();
  renderPromptActions();
  updateBalanceLabels();
}

function canDiscardSelectedTile() {
  if (!state.dealer || state.turn === "finished") return false;
  if (state.currentPlayer !== "你") return false;
  return state.lastDrawSelf || state.hand.length === concealedWinLength("你");
}

function renderOpponents() {
  Object.entries(opponentEls).forEach(([name, el]) => {
    el.innerHTML = "";
    const count = state.opponents[name]?.length || 0;
    for (let index = 0; index < count; index += 1) {
      const back = document.createElement("span");
      back.className = "tile-back";
      el.appendChild(back);
    }
  });
  document.querySelectorAll(".ai-seat-label").forEach((label) => {
    const name = label.previousElementSibling?.textContent;
    label.textContent = `${state.ting[name] ? "聽 | " : ""}AI ${currentAi().label}`;
  });
}

function renderRiver() {
  riverTilesEl.innerHTML = "";
  state.river.slice(-24).forEach(({ tile, from }) => {
    const item = document.createElement("span");
    item.className = `river-tile from-${from === "你" ? "self" : "ai"}`;
    item.title = `${from}打出 ${tile.label}`;
    item.appendChild(createTileFace(tile));
    riverTilesEl.appendChild(item);
  });
}

function createTileFace(tile) {
  const face = document.createElement("span");
  face.className = "tile-face";
  face.appendChild(createMahjongTileArt(tile));
  return face;
}

function createMahjongTileArt(tile) {
  const svg = svgEl("svg", {
    class: "tile-art",
    viewBox: "0 0 80 112",
    role: "img",
    "aria-label": tile.label,
  });
  if (tile.suit === "筒") drawDotTile(svg, tile.rank);
  if (tile.suit === "條") drawBambooTile(svg, tile.rank);
  if (tile.suit === "萬") drawWanTile(svg, tile.rank);
  if (tile.suit === "字") drawHonorTile(svg, tile.label);
  if (tile.suit === "花") drawFlowerTile(svg, tile.label);
  return svg;
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

function svgText(parent, text, attrs = {}) {
  const el = svgEl("text", attrs);
  el.textContent = text;
  parent.appendChild(el);
  return el;
}

function tileMarkPositions(rank) {
  const positions = {
    1: [[40, 56]],
    2: [[24, 28], [56, 84]],
    3: [[24, 28], [40, 56], [56, 84]],
    4: [[23, 28], [57, 28], [23, 84], [57, 84]],
    5: [[23, 28], [57, 28], [40, 56], [23, 84], [57, 84]],
    6: [[23, 24], [57, 24], [23, 56], [57, 56], [23, 88], [57, 88]],
    7: [[23, 22], [57, 22], [23, 50], [40, 56], [57, 50], [23, 88], [57, 88]],
    8: [[20, 22], [40, 22], [60, 22], [24, 50], [56, 50], [20, 88], [40, 88], [60, 88]],
    9: [[20, 22], [40, 22], [60, 22], [20, 56], [40, 56], [60, 56], [20, 90], [40, 90], [60, 90]],
  };
  return positions[rank] || [];
}

function drawDotTile(svg, rank) {
  const colors = ["#091aa8", "#008445", "#d8002b"];
  if (rank === 1) {
    svg.appendChild(svgEl("circle", { cx: 40, cy: 56, r: 23, fill: "#fffdf2", stroke: "#071052", "stroke-width": 3 }));
    svg.appendChild(svgEl("circle", { cx: 40, cy: 56, r: 17, fill: "none", stroke: "#091aa8", "stroke-width": 5 }));
    svg.appendChild(svgEl("circle", { cx: 40, cy: 56, r: 10, fill: "none", stroke: "#008445", "stroke-width": 5 }));
    svg.appendChild(svgEl("circle", { cx: 40, cy: 56, r: 4, fill: "#d8002b" }));
    return;
  }
  tileMarkPositions(rank).forEach(([x, y], index) => {
    drawDotMark(svg, x, y, colors[index % colors.length]);
  });
}

function drawDotMark(svg, x, y, color) {
  svg.appendChild(svgEl("circle", { cx: x, cy: y, r: 9, fill: "#fffdf2", stroke: "#111111", "stroke-width": 1.4 }));
  svg.appendChild(svgEl("circle", { cx: x, cy: y, r: 6.2, fill: "none", stroke: color, "stroke-width": 3 }));
  svg.appendChild(svgEl("circle", { cx: x, cy: y, r: 2.1, fill: color }));
}

function drawBambooTile(svg, rank) {
  if (rank === 1) {
    drawBird(svg);
    return;
  }
  tileMarkPositions(rank).forEach(([x, y], index) => {
    drawBambooMark(svg, x, y, index % 3 === 1 ? "#d8002b" : "#007a3b");
  });
}

function drawBambooMark(svg, x, y, color) {
  const g = svgEl("g", { transform: `translate(${x} ${y})` });
  g.appendChild(svgEl("rect", { x: -4.5, y: -17, width: 9, height: 34, rx: 4, fill: color, stroke: "#082f18", "stroke-width": 1.2 }));
  [-8, 0, 8].forEach((offset) => {
    g.appendChild(svgEl("path", { d: `M-6 ${offset} Q0 ${offset - 4} 6 ${offset}`, fill: "none", stroke: "#fff7df", "stroke-width": 1.2, "stroke-linecap": "round" }));
  });
  svg.appendChild(g);
}

function drawBird(svg) {
  const g = svgEl("g", { transform: "translate(40 58) rotate(-8)" });
  g.appendChild(svgEl("path", { d: "M-18 12 C-14 -12 7 -25 20 -7 C10 -9 4 -2 0 11 C-5 4 -12 5 -18 12Z", fill: "#008445", stroke: "#06351d", "stroke-width": 2 }));
  g.appendChild(svgEl("path", { d: "M-5 2 C-1 -10 12 -11 19 -2 C9 -1 5 6 2 15Z", fill: "#d8002b", opacity: 0.95 }));
  g.appendChild(svgEl("path", { d: "M-15 12 C-20 22 -22 28 -26 32", fill: "none", stroke: "#008445", "stroke-width": 3, "stroke-linecap": "round" }));
  g.appendChild(svgEl("path", { d: "M-3 15 C-1 26 1 31 4 36", fill: "none", stroke: "#d8002b", "stroke-width": 3, "stroke-linecap": "round" }));
  g.appendChild(svgEl("circle", { cx: 11, cy: -8, r: 2.2, fill: "#071052" }));
  g.appendChild(svgEl("path", { d: "M18 -8 L29 -12 L20 -3Z", fill: "#071052" }));
  svg.appendChild(g);
}

function drawWanTile(svg, rank) {
  svgText(svg, chineseRanks[rank - 1], {
    x: 40,
    y: 46,
    "text-anchor": "middle",
    "font-family": "'Noto Sans TC', serif",
    "font-size": 30,
    "font-weight": 900,
    fill: "#111111",
  });
  svgText(svg, "萬", {
    x: 40,
    y: 83,
    "text-anchor": "middle",
    "font-family": "'Noto Sans TC', serif",
    "font-size": 32,
    "font-weight": 900,
    fill: "#d8002b",
  });
}

function drawHonorTile(svg, label) {
  if (label === "白") {
    svg.appendChild(svgEl("rect", { x: 22, y: 27, width: 36, height: 56, rx: 2, fill: "none", stroke: "#111111", "stroke-width": 4 }));
    svg.appendChild(svgEl("rect", { x: 29, y: 35, width: 22, height: 40, rx: 1, fill: "none", stroke: "#111111", "stroke-width": 2 }));
    return;
  }
  const color = label === "中" ? "#d8002b" : label === "發" ? "#008445" : "#111111";
  svgText(svg, label, {
    x: 40,
    y: 72,
    "text-anchor": "middle",
    "font-family": "'Noto Sans TC', serif",
    "font-size": 42,
    "font-weight": 900,
    fill: color,
  });
}

function drawFlowerTile(svg, label) {
  const flowerNumber = flowers.indexOf(label) + 1;
  svgText(svg, String(flowerNumber), {
    x: 14,
    y: 22,
    "text-anchor": "middle",
    "font-family": "'Noto Sans TC', serif",
    "font-size": 16,
    "font-weight": 900,
    fill: "#d8002b",
  });
  svgText(svg, label, {
    x: 40,
    y: 30,
    "text-anchor": "middle",
    "font-family": "'Noto Sans TC', serif",
    "font-size": 21,
    "font-weight": 900,
    fill: "#111111",
  });
  svg.appendChild(svgEl("path", { d: "M39 88 C36 68 43 55 37 39", fill: "none", stroke: "#008445", "stroke-width": 3.2, "stroke-linecap": "round" }));
  svg.appendChild(svgEl("path", { d: "M38 63 C27 56 22 51 18 42", fill: "none", stroke: "#008445", "stroke-width": 2.4, "stroke-linecap": "round" }));
  svg.appendChild(svgEl("path", { d: "M40 68 C51 62 57 54 61 45", fill: "none", stroke: "#008445", "stroke-width": 2.4, "stroke-linecap": "round" }));
  [[18, 41], [61, 44], [37, 38]].forEach(([x, y]) => {
    svg.appendChild(svgEl("circle", { cx: x, cy: y, r: 5, fill: "#d8002b" }));
    svg.appendChild(svgEl("circle", { cx: x + 5, cy: y + 2, r: 4, fill: "#e83a55" }));
    svg.appendChild(svgEl("circle", { cx: x - 4, cy: y + 4, r: 4, fill: "#e83a55" }));
  });
}

function createLegacyTileFace(tile) {
  const face = document.createElement("span");
  face.className = "tile-face";
  if (tile.suit === "筒") renderDots(face, tile.rank);
  if (tile.suit === "條") renderBamboo(face, tile.rank);
  if (tile.suit === "萬") renderWan(face, tile.rank);
  if (tile.suit === "字") renderHonor(face, tile.label);
  if (tile.suit === "花") renderFlower(face, tile.label);
  return face;
}

function renderDots(face, rank) {
  face.classList.add("dot-face", `rank-${rank}`);
  const layouts = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9],
    7: [1, 3, 4, 5, 6, 7, 9],
    8: [1, 2, 3, 4, 6, 7, 8, 9],
    9: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  };
  layouts[rank].forEach((position, index) => {
    const dot = document.createElement("span");
    dot.className = `tile-mark mark-pos-${position} dot dot-${(index % 3) + 1}`;
    face.appendChild(dot);
  });
}

function renderBamboo(face, rank) {
  face.classList.add("bamboo-face", `rank-${rank}`);
  if (rank === 1) {
    const bird = document.createElement("span");
    bird.className = "bird";
    bird.textContent = "鳥";
    face.appendChild(bird);
    return;
  }
  const layouts = {
    2: [2, 8],
    3: [2, 5, 8],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9],
    7: [1, 3, 4, 5, 6, 7, 9],
    8: [1, 2, 3, 4, 6, 7, 8, 9],
    9: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  };
  layouts[rank].forEach((position, index) => {
    const bamboo = document.createElement("span");
    bamboo.className = `tile-mark mark-pos-${position} bamboo bamboo-${index % 2}`;
    face.appendChild(bamboo);
  });
}

function renderWan(face, rank) {
  face.classList.add("wan-face");
  const top = document.createElement("span");
  top.className = "wan-rank";
  top.textContent = chineseRanks[rank - 1];
  const bottom = document.createElement("span");
  bottom.className = "wan-word";
  bottom.textContent = "萬";
  face.append(top, bottom);
}

function renderHonor(face, label) {
  face.classList.add("honor-face");
  if (label === "中") face.classList.add("red-honor");
  if (label === "發") face.classList.add("green-honor");
  face.textContent = label;
}

function renderFlower(face, label) {
  face.classList.add("flower-face");
  const stem = document.createElement("span");
  stem.className = "flower-stem";
  const blossom = document.createElement("span");
  blossom.className = "flower-blossom";
  const word = document.createElement("span");
  word.className = "flower-word";
  word.textContent = label;
  face.append(stem, blossom, word);
}

function getTurnText() {
  if (state.turn === "finished") return "本局已結束，請重新開局";
  if (!state.dealer) return "請先抽位起莊";
  if (state.currentPlayer !== "你") return `${state.currentPlayer} 思考中`;
  if (state.lastDrawSelf) return "請選一張牌打出，或使用跳出的胡 / 自摸提示";
  if (state.lastDiscard) return "若條件成立，動作提示會在手牌上方跳出";
  return "輪到你摸牌";
}

function renderPromptActions() {
  const prompts = getAvailablePrompts();
  let visible = false;
  const labels = { hu: "胡", chi: "吃", pon: "碰", kan: "槓", ting: "聽", zimo: "自摸", pass: "" };
  promptActionsEl.querySelectorAll("button").forEach((button) => {
    const available = Boolean(prompts[button.dataset.promptAction]);
    button.classList.toggle("available", available);
    button.disabled = !available;
    button.textContent = labels[button.dataset.promptAction];
    visible = visible || available;
  });
  promptActionsEl.classList.toggle("visible", visible);
}

function log(message) {
  const item = document.createElement("li");
  item.textContent = message;
  logEl.prepend(item);
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

document.getElementById("seatDrawBtn").addEventListener("click", drawSeatAndDealer);
document.getElementById("diceBox").addEventListener("click", drawSeatAndDealer);
document.getElementById("drawBtn").addEventListener("click", drawTile);
document.getElementById("discardBtn").addEventListener("click", discardTile);
document.getElementById("newRoundBtn").addEventListener("click", startRound);
aiSelect.addEventListener("change", (event) => setAiDifficulty(event.target.value));
promptActionsEl.querySelectorAll("button").forEach((button) => {
  button.addEventListener("click", () => handlePromptAction(button.dataset.promptAction));
});
document.getElementById("slotSpinBtn").addEventListener("click", spinSlot);
document.getElementById("slotLeverBtn").addEventListener("click", pullSlotLever);
document.getElementById("slotBetDownBtn").addEventListener("click", () => changeSlotBet(-5));
document.getElementById("slotBetUpBtn").addEventListener("click", () => changeSlotBet(5));
document.getElementById("slotLinesDownBtn").addEventListener("click", () => changeSlotLines(-1));
document.getElementById("slotLinesUpBtn").addEventListener("click", () => changeSlotLines(1));
document.getElementById("slotCollectBtn").addEventListener("click", collectSlotWin);
document.querySelectorAll("[data-stop-reel]").forEach((button) => {
  button.addEventListener("click", () => stopSlotReel(Number(button.dataset.stopReel)));
});
document.querySelectorAll("[data-gamble]").forEach((button) => {
  button.addEventListener("click", () => gambleSlot(button.dataset.gamble));
});
document.getElementById("moleSingleBtn").addEventListener("click", () => setMoleMode("single"));
document.getElementById("moleDuelBtn").addEventListener("click", () => setMoleMode("duel"));
document.getElementById("moleStartBtn").addEventListener("click", startMole);
document.getElementById("moleResetBtn").addEventListener("click", resetMole);

document.querySelectorAll(".payment-grid button").forEach((button, index) => {
  button.addEventListener("click", () => {
    const bonus = 100 + index * 20;
    state.balance += bonus;
    updateBalanceLabels();
  });
});

setAiDifficulty(state.aiDifficulty);
startRound();
initSlot();
initMole();
updateBalanceLabels();
