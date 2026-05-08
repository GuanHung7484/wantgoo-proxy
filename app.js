const views = {
  lobby: document.getElementById("lobbyView"),
  mahjong: document.getElementById("mahjongView"),
  store: document.getElementById("storeView"),
  rules: document.getElementById("rulesView"),
};

const state = {
  wall: [],
  hand: [],
  selectedIndex: 0,
  dealer: null,
  lastDiscard: null,
  turn: "setup",
  balance: 1750,
};

const suits = [
  { name: "萬", values: ["一", "二", "三", "四", "五", "六", "七", "八", "九"] },
  { name: "筒", values: ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"] },
  { name: "條", values: ["1", "2", "3", "4", "5", "6", "7", "8", "9"] },
];
const honors = ["東", "南", "西", "北", "中", "發", "白"];
const flowers = ["春", "夏", "秋", "冬", "梅", "蘭", "竹", "菊"];
const winds = ["東", "南", "西", "北"];
const handEl = document.getElementById("playerHand");
const logEl = document.getElementById("gameLog");

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
  state.selectedIndex = 0;
  state.dealer = null;
  state.lastDiscard = null;
  state.turn = "setup";
  logEl.innerHTML = "";
  log("新局建立：請先抽位與起莊。");
  render();
}

function drawSeatAndDealer() {
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
  state.turn = "player";
  log(`摸牌：${tile.label}。`);
  render();
}

function discardTile() {
  if (!state.hand.length) return;
  const [tile] = state.hand.splice(state.selectedIndex, 1);
  state.lastDiscard = tile;
  state.selectedIndex = Math.max(0, state.selectedIndex - 1);
  state.turn = "wait";
  document.getElementById("topDiscard").textContent = `打出 ${tile.label}`;
  log(`你打出 ${tile.label}。下家摸打後輪回你。`);
  render();
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
  if (action === "吃" && !canChi(state.lastDiscard)) {
    log(`不能吃 ${state.lastDiscard.label}：只能吃上家且需組成順子。`);
    return;
  }
  log(`${action}牌成立：以 ${state.lastDiscard.label} 組成面子。`);
  if (action === "槓" && state.wall.length) {
    const supplement = state.wall.pop();
    state.hand.push(supplement);
    log(`槓後從牌牆末端補 ${supplement.label}。`);
  }
  state.lastDiscard = null;
  render();
}

function canChi(tile) {
  if (!tile || tile.suit === "字" || tile.suit === "花") return false;
  const ranks = state.hand.filter((item) => item.suit === tile.suit).map((item) => item.rank);
  return (
    (ranks.includes(tile.rank - 2) && ranks.includes(tile.rank - 1)) ||
    (ranks.includes(tile.rank - 1) && ranks.includes(tile.rank + 1)) ||
    (ranks.includes(tile.rank + 1) && ranks.includes(tile.rank + 2))
  );
}

function checkHu() {
  if (state.hand.length !== 17) {
    log("尚未達 17 張，16 張台麻胡牌需 5 組面子加 1 對將牌。");
    return;
  }
  const counts = countTiles(state.hand);
  const pairCount = Object.values(counts).filter((count) => count >= 2).length;
  const tripletCount = Object.values(counts).filter((count) => count >= 3).length;
  const possible = pairCount >= 1 && tripletCount >= 1;
  log(possible ? "胡牌提示：牌型可能成立，請依正式番台檢核。" : "未形成基本胡牌輪廓，宣告胡牌可能為詐胡。");
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
    button.className = `tile${index === state.selectedIndex ? " selected" : ""}${index === state.hand.length - 1 && state.hand.length === 17 ? " drawn" : ""}`;
    button.textContent = tile.label;
    button.type = "button";
    button.addEventListener("click", () => {
      state.selectedIndex = index;
      render();
    });
    handEl.appendChild(button);
  });
  document.getElementById("wallLabel").textContent = `牌牆：${state.wall.length}`;
  document.getElementById("dealerLabel").textContent = `莊家：${state.dealer || "抽位中"}`;
  document.getElementById("lastDiscard").textContent = `海底：${state.lastDiscard ? state.lastDiscard.label : "無"}`;
  document.getElementById("turnLabel").textContent = getTurnText();
  document.querySelectorAll(".seat").forEach((seat) => {
    seat.classList.toggle("dealer-seat", seat.dataset.wind === state.dealer);
  });
}

function getTurnText() {
  if (!state.dealer) return "請先抽位起莊";
  if (state.hand.length === 17) return "請選一張牌打出或檢查胡牌";
  if (state.turn === "wait") return "對手回合，可宣告吃碰槓";
  return "輪到你摸牌";
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
document.getElementById("drawBtn").addEventListener("click", drawTile);
document.getElementById("discardBtn").addEventListener("click", discardTile);
document.getElementById("chiBtn").addEventListener("click", () => claim("吃"));
document.getElementById("ponBtn").addEventListener("click", () => claim("碰"));
document.getElementById("kanBtn").addEventListener("click", () => claim("槓"));
document.getElementById("huBtn").addEventListener("click", checkHu);
document.getElementById("newRoundBtn").addEventListener("click", startRound);

document.querySelectorAll(".payment-grid button").forEach((button, index) => {
  button.addEventListener("click", () => {
    const bonus = 100 + index * 20;
    state.balance += bonus;
    const value = state.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById("coinBalance").textContent = value;
    document.getElementById("storeBalance").textContent = value;
  });
});

startRound();
