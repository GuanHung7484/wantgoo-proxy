const views = {
  lobby: document.getElementById("lobbyView"),
  mahjong: document.getElementById("mahjongView"),
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
  isTing: false,
  turn: "setup",
  balance: 1750,
  aiDifficulty: "easy",
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

function showView(name) {
  Object.entries(views).forEach(([key, el]) => el.classList.toggle("active", key === name));
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === name && button.classList.contains("rail-btn"));
  });
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
  state.wall = buildWall();
  state.hand = state.wall.splice(0, 16).sort(sortTile);
  Object.keys(state.opponents).forEach((name) => {
    state.opponents[name] = state.wall.splice(0, 16).sort(sortTile);
  });
  state.selectedIndex = 0;
  state.dealer = null;
  state.lastDiscard = null;
  state.river = [];
  state.lastDrawSelf = false;
  state.isTing = false;
  state.turn = "setup";
  logEl.innerHTML = "";
  log(`新局建立：AI 強度為 ${currentAi().label}，失誤率 ${currentAi().mistakeRate}%。請先抽位與起莊。`);
  render();
}

function currentAi() {
  return aiProfiles[state.aiDifficulty];
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
  if (state.dealer) {
    log(`本局已起莊，莊家為 ${state.dealer}。要重新抽位請按「重新開局」。`);
    return;
  }
  const dealerWind = winds[Math.floor(Math.random() * winds.length)];
  const diceA = Math.ceil(Math.random() * 6);
  const diceB = Math.ceil(Math.random() * 6);
  state.dealer = dealerWind;
  state.turn = "dealer";
  document.getElementById("diceBox").textContent = diceA + diceB;
  log(`抽位完成：你坐東位，莊家為 ${dealerWind}，擲骰 ${diceA}+${diceB} 決定開門。`);
  log(dealerWind === "東" ? "你是莊家，先出一張牌。" : "由莊家先打，接著逆時針摸牌出牌。");
  render();
}

function drawTile() {
  if (!state.dealer) {
    log("尚未抽位起莊，請先按「抽位 / 起莊」。");
    return;
  }
  if (state.turn === "finished") {
    log("本局已結束，請重新開局。");
    return;
  }
  if (!state.wall.length) {
    log("牌牆已摸完，本局流局。");
    return;
  }
  if (state.hand.length >= 17) {
    log("手牌已有 17 張，請先出牌。");
    return;
  }
  const tile = state.wall.shift();
  state.hand.push(tile);
  state.selectedIndex = state.hand.length - 1;
  state.lastDrawSelf = true;
  state.turn = "player";
  log(`摸牌：${tile.label}。`);
  render();
}

function discardTile() {
  if (state.turn === "finished") {
    log("本局已結束，請重新開局。");
    return;
  }
  if (!state.hand.length) return;
  const [tile] = state.hand.splice(state.selectedIndex, 1);
  state.lastDiscard = tile;
  state.river.push({ tile, from: "你" });
  state.lastDrawSelf = false;
  state.selectedIndex = Math.max(0, state.selectedIndex - 1);
  state.turn = "wait";
  log(`你打出 ${tile.label}。電腦依目前 AI 強度思考。`);
  simulateOpponentTurn();
  render();
}

function simulateOpponentTurn() {
  const names = Object.keys(state.opponents);
  names.forEach((name) => {
    if (!state.wall.length) return;
    const hand = state.opponents[name];
    hand.push(state.wall.shift());
    const mistake = Math.random() * 100 < currentAi().mistakeRate;
    const discardIndex = chooseOpponentDiscard(hand, mistake);
    const [discarded] = hand.splice(discardIndex, 1);
    state.lastDiscard = discarded;
    state.river.push({ tile: discarded, from: name });
    const thinking = mistake ? "失誤亂打" : "保留好牌後出牌";
    log(`${name}（AI ${currentAi().label}）摸打一張，${thinking}：${discarded.label}。`);
  });
  state.turn = "player";
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
  state.lastDiscard = null;
  state.lastDrawSelf = false;
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
    state.isTing = true;
    log("聽牌提示成立：你已進入聽牌狀態，接下來可等胡或自摸。");
    render();
  }
  if (action === "pass") {
    log("你選擇過，不吃碰槓胡。");
    state.lastDiscard = null;
    render();
  }
}

function removeSequenceForChi(discarded) {
  const candidates = [
    [discarded.rank - 2, discarded.rank - 1],
    [discarded.rank - 1, discarded.rank + 1],
    [discarded.rank + 1, discarded.rank + 2],
  ];
  const match = candidates.find((ranks) =>
    ranks.every((rank) => state.hand.some((tile) => tile.suit === discarded.suit && tile.rank === rank)),
  );
  if (!match) return;
  match.forEach((rank) => {
    const index = state.hand.findIndex((tile) => tile.suit === discarded.suit && tile.rank === rank);
    if (index >= 0) state.hand.splice(index, 1);
  });
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
  log(selfDraw ? "自摸成立：你以 17 張完成胡牌。" : `胡牌成立：你胡 ${state.lastDiscard.label}。`);
  state.turn = "finished";
  state.lastDiscard = null;
  render();
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
    pass: Boolean(state.lastDiscard) && state.turn !== "finished",
  };
}

function canChi() {
  if (!state.lastDiscard || state.turn === "finished") return false;
  if (state.lastDiscard.suit === "字" || state.lastDiscard.suit === "花") return false;
  const ranks = state.hand.filter((tile) => tile.suit === state.lastDiscard.suit).map((tile) => tile.rank);
  const rank = state.lastDiscard.rank;
  return (
    (ranks.includes(rank - 2) && ranks.includes(rank - 1)) ||
    (ranks.includes(rank - 1) && ranks.includes(rank + 1)) ||
    (ranks.includes(rank + 1) && ranks.includes(rank + 2))
  );
}

function canPon() {
  if (state.turn === "finished") return false;
  return Boolean(state.lastDiscard) && state.hand.filter((tile) => tile.label === state.lastDiscard.label).length >= 2;
}

function canKan() {
  if (state.turn === "finished") return false;
  if (state.lastDiscard && state.hand.filter((tile) => tile.label === state.lastDiscard.label).length >= 3) return true;
  return Object.values(countTiles(state.hand)).some((count) => count >= 4);
}

function canHuDiscard() {
  if (!state.lastDiscard || state.turn === "finished") return false;
  return isPotentialWinningHand([...state.hand, state.lastDiscard]);
}

function canSelfDraw() {
  if (state.turn === "finished") return false;
  return state.lastDrawSelf && state.hand.length === 17 && isPotentialWinningHand(state.hand);
}

function canTing() {
  if (state.turn === "finished") return false;
  if (state.isTing || state.hand.length !== 16) return false;
  return uniqueTilesFromWallAndHand().some((tile) => isPotentialWinningHand([...state.hand, tile]));
}

function uniqueTilesFromWallAndHand() {
  const map = new Map();
  [...state.wall, ...state.hand].forEach((tile) => {
    if (!map.has(tile.label)) map.set(tile.label, tile);
  });
  return [...map.values()];
}

function isPotentialWinningHand(hand) {
  if (hand.length !== 17) return false;
  const counts = countTiles(hand);
  const pairCount = Object.values(counts).filter((count) => count >= 2).length;
  const tripletCount = Object.values(counts).filter((count) => count >= 3).length;
  const sequenceCount = countSequences(hand);
  return pairCount >= 1 && tripletCount + sequenceCount >= 4;
}

function countSequences(hand) {
  let total = 0;
  suits.forEach((suit) => {
    const ranks = hand.filter((tile) => tile.suit === suit.name).map((tile) => tile.rank);
    for (let rank = 1; rank <= 7; rank += 1) {
      if (ranks.includes(rank) && ranks.includes(rank + 1) && ranks.includes(rank + 2)) total += 1;
    }
  });
  return total;
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
  state.hand.sort(sortTile);
  handEl.innerHTML = "";
  state.hand.forEach((tile, index) => {
    const button = document.createElement("button");
    button.className = `tile tile-${tile.suit}${index === state.selectedIndex ? " selected" : ""}${index === state.hand.length - 1 && state.lastDrawSelf ? " drawn" : ""}`;
    button.setAttribute("aria-label", tile.label);
    button.type = "button";
    button.appendChild(createTileFace(tile));
    button.addEventListener("click", () => {
      if (state.selectedIndex === index && state.hand.length >= 17) {
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
  document.getElementById("dealerLabel").textContent = `莊家：${state.dealer || "抽位中"}`;
  document.getElementById("lastDiscard").textContent = `海底：${state.lastDiscard ? state.lastDiscard.label : "無"}`;
  document.getElementById("turnLabel").textContent = getTurnText();
  document.getElementById("playerSeatStatus").textContent = state.isTing ? `聽牌 ${state.hand.length}` : `手牌 ${state.hand.length}`;
  document.querySelectorAll(".seat-marker").forEach((seat) => {
    seat.classList.toggle("dealer-seat", seat.dataset.wind === state.dealer);
  });
  renderOpponents();
  renderRiver();
  renderPromptActions();
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
  if (tile.suit === "筒") renderDots(face, tile.rank);
  if (tile.suit === "條") renderBamboo(face, tile.rank);
  if (tile.suit === "萬") renderWan(face, tile.rank);
  if (tile.suit === "字") renderHonor(face, tile.label);
  if (tile.suit === "花") renderFlower(face, tile.label);
  return face;
}

function renderDots(face, rank) {
  face.classList.add("dot-face", `rank-${rank}`);
  const count = rank === 1 ? 1 : rank;
  for (let index = 0; index < count; index += 1) {
    const dot = document.createElement("span");
    dot.className = `dot dot-${(index % 3) + 1}`;
    face.appendChild(dot);
  }
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
  for (let index = 0; index < rank; index += 1) {
    const bamboo = document.createElement("span");
    bamboo.className = `bamboo bamboo-${index % 2}`;
    face.appendChild(bamboo);
  }
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
  face.classList.add("honor-face", label === "中" ? "red-honor" : label === "發" ? "green-honor" : "");
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
  if (state.hand.length === 17) return "請選一張牌打出，或使用跳出的胡 / 自摸提示";
  if (state.lastDiscard) return "若條件成立，動作提示會在手牌上方跳出";
  return "輪到你摸牌";
}

function renderPromptActions() {
  const prompts = getAvailablePrompts();
  let visible = false;
  promptActionsEl.querySelectorAll("button").forEach((button) => {
    const available = Boolean(prompts[button.dataset.promptAction]);
    button.classList.toggle("available", available);
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

document.querySelectorAll(".payment-grid button").forEach((button, index) => {
  button.addEventListener("click", () => {
    const bonus = 100 + index * 20;
    state.balance += bonus;
    const value = state.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById("coinBalance").textContent = value;
    document.getElementById("storeBalance").textContent = value;
  });
});

setAiDifficulty(state.aiDifficulty);
startRound();
