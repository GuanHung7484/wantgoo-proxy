// ===== 抽鬼牌遊戲邏輯（多人版 + 手動配對 + 四方位佈局） =====

const SUITS = ['♠','♥','♦','♣'];
const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

// AI 名稱對應位置：右(AI1)=香吉士、上(AI2)=索隆、左(AI3)=娜美
const AI_NAMES = ['香吉士', '索隆', '娜美'];

const AI_CONFIG = {
  beginner:     { name: '初學者', icon: '😊', jokerDetect: 0,    bluff: 0    },
  intermediate: { name: '中級',   icon: '🧐', jokerDetect: 0.3,  bluff: 0.1  },
  advanced:     { name: '高級',   icon: '😈', jokerDetect: 0.55, bluff: 0.25 },
  boss:         { name: '魔王級', icon: '👹', jokerDetect: 0.80, bluff: 0.4  }
};

function playerAvatar(name) {
  const key = name === '你' ? 'you' : name === '香吉士' ? 'sanji' : name === '索隆' ? 'zoro' : 'nami';
  return `<span class="player-avatar avatar-${key}" aria-hidden="true"><span class="avatar-face"><span class="avatar-eyes"></span><span class="avatar-mouth"></span></span></span>`;
}

// 玩家位置對應（索引 → 方位）
// players[0]=你(下), players[1]=香吉士(右), players[2]=索隆(上), players[3]=娜美(左)
const AREA_IDS    = ['area-bottom', 'area-right', 'area-top', 'area-left'];
const POSITIONS   = ['bottom', 'right', 'top', 'left'];

// === 狀態 ===
let difficulty   = null;
let playerCount  = 2;
let players      = [];
let currentTurn  = 0;
let gameOver     = false;
let phase        = 'idle'; // idle | draw | discard | ai-turn | done
let selectedCardIdx = -1;
let scores       = {};
let busyLock     = false;

// === 牌組工具 ===
function createDeck() {
  const d = [];
  for (const s of SUITS)
    for (const v of VALUES)
      d.push({ suit: s, value: v, id: v + s });
  d.push({ suit: '🃏', value: 'JOKER', id: 'JOKER' });
  return d;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isRed(suit) { return suit === '♥' || suit === '♦'; }
function sleep(ms)   { return new Promise(r => setTimeout(r, ms)); }

function hasAnyPairs(hand) {
  const count = {};
  for (const c of hand) {
    if (c.value === 'JOKER') continue;
    count[c.value] = (count[c.value] || 0) + 1;
  }
  return Object.values(count).some(n => n >= 2);
}

function autoRemovePairs(player) {
  let changed = true;
  while (changed) {
    changed = false;
    const map = {};
    for (let i = 0; i < player.hand.length; i++) {
      const c = player.hand[i];
      if (c.value === 'JOKER') continue;
      if (map[c.value] !== undefined) {
        player.pairs.push(c.value);
        player.hand.splice(i, 1);
        player.hand.splice(map[c.value], 1);
        changed = true;
        break;
      }
      map[c.value] = i;
    }
  }
}

// === 渲染工具 ===
function colorClass(card) {
  if (card.value === 'JOKER') return 'joker-card';
  return isRed(card.suit) ? 'red' : 'black';
}

function cardInner(card) {
  if (card.value === 'JOKER')
    return `<span class="card-value">🃏</span><span class="card-suit">鬼牌</span>`;
  return `<span class="card-value">${card.value}</span><span class="card-suit">${card.suit}</span>`;
}

// === 主渲染：四個方位各自繪製 ===
function renderAll() {
  // 清空所有區域
  AREA_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });

  for (let i = 0; i < players.length; i++) {
    renderPlayerToArea(i);
  }

  bindCardClicks();
  updateScoreboard();
}

function renderPlayerToArea(playerIdx) {
  const p        = players[playerIdx];
  const pos      = POSITIONS[playerIdx];
  const areaEl   = document.getElementById(AREA_IDS[playerIdx]);
  if (!areaEl) return;

  const cfg      = AI_CONFIG[difficulty];
  const isActive = !gameOver && playerIdx === currentTurn;
  const drawTarget = getDrawTarget(currentTurn);
  const isDrawTarget = !gameOver && phase === 'draw'
                       && players[currentTurn].isHuman
                       && drawTarget === playerIdx;

  // --- 牌的 HTML ---
  let cardsHTML = '';

  if (p.isHuman) {
    // 你自己的牌：正面朝上，配對模式可點選
    const inDiscard = phase === 'discard';
    cardsHTML = `<div class="om-cards om-bottom-cards">`;
    p.hand.forEach((c, ci) => {
      const isSel = inDiscard && ci === selectedCardIdx;
      const selCls = isSel ? 'selected' : '';
      const clickAttr = inDiscard ? `data-cidx="${ci}"` : '';
      cardsHTML += `<div class="card ${colorClass(c)} om-player-card ${inDiscard ? 'selectable' : ''} ${selCls}" ${clickAttr}
                      style="${c.value === 'JOKER' ? 'color:#9c27b0' : ''}">
                      ${cardInner(c)}
                    </div>`;
    });
    cardsHTML += '</div>';

  } else if (pos === 'top') {
    // 上方 AI：橫向蓋牌
    const spreadCls = isDrawTarget ? 'spread' : '';
    cardsHTML = `<div class="om-cards om-top-cards ${spreadCls}">`;
    p.hand.forEach((c, ci) => {
      const clickAttr = isDrawTarget ? `data-clickable="true" data-cidx="${ci}"` : '';
      cardsHTML += `<div class="card facedown om-top-card" ${clickAttr}></div>`;
    });
    cardsHTML += '</div>';

  } else if (pos === 'right') {
    // 右方 AI：縱向蓋牌
    const spreadCls = isDrawTarget ? 'spread-side' : '';
    cardsHTML = `<div class="om-cards om-side-cards ${spreadCls}">`;
    p.hand.forEach((c, ci) => {
      const clickAttr = isDrawTarget ? `data-clickable="true" data-cidx="${ci}"` : '';
      cardsHTML += `<div class="card facedown om-side-card" ${clickAttr}></div>`;
    });
    cardsHTML += '</div>';

  } else if (pos === 'left') {
    // 左方 AI：縱向蓋牌（反向堆疊）
    const spreadCls = isDrawTarget ? 'spread-side' : '';
    cardsHTML = `<div class="om-cards om-side-cards ${spreadCls}">`;
    p.hand.forEach((c, ci) => {
      const clickAttr = isDrawTarget ? `data-clickable="true" data-cidx="${ci}"` : '';
      cardsHTML += `<div class="card facedown om-side-card" ${clickAttr}></div>`;
    });
    cardsHTML += '</div>';
  }

  const pairsHTML = p.pairs.map(v => `<span class="mini-pair">${v}</span>`).join('');
  const diffLabel = p.isHuman ? '' : ` [${cfg.name}${cfg.icon}]`;
  const outLabel  = p.isOut ? ' ✅' : '';
  const countLabel = `(${p.hand.length}張)${outLabel}`;

  areaEl.innerHTML = `
    <div class="om-player-box ${isActive ? 'om-active' : ''} ${p.isOut ? 'om-out' : ''}">
      <div class="om-player-label">${playerAvatar(p.name)}<span class="player-name">${p.name}</span>${diffLabel}
        <span class="om-count">${countLabel}</span>
      </div>
      ${cardsHTML}
      <div class="om-pairs">${pairsHTML}</div>
    </div>`;
}

function bindCardClicks() {
  // 從 AI 抽牌
  if (phase === 'draw' && players[currentTurn]?.isHuman) {
    document.querySelectorAll('.card[data-clickable="true"]').forEach(el => {
      el.addEventListener('click', () => {
        if (busyLock) return;
        playerDrawCard(parseInt(el.dataset.cidx));
      });
    });
  }

  // 手動配對
  if (phase === 'discard') {
    document.querySelectorAll('.om-bottom-cards .card.selectable').forEach(el => {
      el.addEventListener('click', () => {
        if (busyLock) return;
        playerSelectPair(parseInt(el.dataset.cidx));
      });
    });
  }
}

function updateScoreboard() {
  const el = document.getElementById('scoreboard-content');
  if (!el) return;
  el.innerHTML = players.map(p =>
    `<div class="score-item">${p.name} <span>${scores[p.name] || 0}</span></div>`
  ).join('');
}

function setMessage(text, type = '') {
  const el = document.getElementById('message');
  el.textContent = text;
  el.className = 'message ' + type;
}

function setTurnIndicator(text) {
  document.getElementById('turn-indicator').textContent = text;
}

// === 設定畫面 ===
function initSetup() {
  const diffBtns  = document.querySelectorAll('#diff-grid .setup-btn');
  const countBtns = document.querySelectorAll('#count-grid .setup-btn');
  const startBtn  = document.getElementById('btn-start-game');

  diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      diffBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      difficulty = btn.dataset.level;
      startBtn.disabled = !(difficulty && playerCount);
    });
  });

  countBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      countBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      playerCount = parseInt(btn.dataset.count);
      startBtn.disabled = !(difficulty && playerCount);
    });
  });

  startBtn.addEventListener('click', () => {
    if (!difficulty || !playerCount) return;
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('game-table').classList.add('active');
    startGame();
  });
}

// === 輔助：找抽牌對象（下一位有牌的人） ===
function getDrawTarget(fromIdx) {
  const n = players.length;
  for (let offset = 1; offset < n; offset++) {
    const t = (fromIdx + offset) % n;
    if (!players[t].isOut && players[t].hand.length > 0) return t;
  }
  return -1;
}

function getNextTurn(fromIdx) {
  const n = players.length;
  for (let offset = 1; offset <= n; offset++) {
    const next = (fromIdx + offset) % n;
    if (!players[next].isOut && players[next].hand.length > 0) return next;
  }
  return -1;
}

// === 遊戲開始 ===
function startGame() {
  gameOver = false;
  selectedCardIdx = -1;
  busyLock = false;

  // 建立玩家：[0]=你(下), [1]=香吉士(右), [2]=索隆(上), [3]=娜美(左)
  players = [];
  players.push({ name: '你', isHuman: true, hand: [], pairs: [], isOut: false });
  for (let i = 0; i < playerCount - 1; i++) {
    players.push({ name: AI_NAMES[i], isHuman: false, hand: [], pairs: [], isOut: false });
  }

  // 初始化計分（僅首次）
  if (Object.keys(scores).length === 0)
    players.forEach(p => { scores[p.name] = 0; });

  // 發牌
  const deck = shuffle(createDeck());
  deck.forEach((c, i) => players[i % players.length].hand.push(c));

  // AI 自動初始消對
  for (const p of players) {
    if (!p.isHuman) {
      autoRemovePairs(p);
      p.hand = shuffle(p.hand);
    }
  }

  document.getElementById('btn-new').style.display = 'none';
  setMessage('');

  currentTurn = 0;

  // 玩家需手動消初始對
  if (hasAnyPairs(players[0].hand)) {
    phase = 'discard';
    setTurnIndicator('👆 請點選兩張相同數字的牌來配對消除');
    setMessage('初始配對 — 點選兩張相同數字的牌', '');
  } else {
    phase = 'draw';
    setTurnIndicator('');
  }

  renderAll();
  if (phase === 'draw') startTurn();
}

// === 回合開始 ===
function startTurn() {
  if (gameOver) return;

  const active = players.filter(p => !p.isOut && p.hand.length > 0);
  if (active.length <= 1) { endGame(); return; }

  const cp = players[currentTurn];
  if (cp.isOut || cp.hand.length === 0) {
    cp.isOut = true;
    advanceTurn();
    return;
  }

  const target = getDrawTarget(currentTurn);
  if (target === -1) { endGame(); return; }

  if (cp.isHuman) {
    phase = 'draw';
    setTurnIndicator(`👆 你的回合 — 點選 ${players[target].name} 的牌來抽！`);
    setMessage('');
    renderAll();
  } else {
    phase = 'ai-turn';
    setTurnIndicator(`🤖 ${cp.name} 正在思考...`);
    renderAll();
    setTimeout(() => aiTurn(), 700 + Math.random() * 600);
  }
}

// === 玩家抽牌 ===
function playerDrawCard(cardIdx) {
  if (phase !== 'draw' || gameOver || busyLock) return;
  const cp     = players[currentTurn];
  if (!cp.isHuman) return;
  const target = getDrawTarget(currentTurn);
  if (target === -1 || cardIdx >= players[target].hand.length) return;

  busyLock = true;
  const card = players[target].hand.splice(cardIdx, 1)[0];
  cp.hand.push(card);
  if (players[target].hand.length === 0) players[target].isOut = true;
  selectedCardIdx = -1;

  const cardName = card.value === 'JOKER' ? '🃏鬼牌' : `${card.value}${card.suit}`;

  if (hasAnyPairs(cp.hand)) {
    phase = 'discard';
    setTurnIndicator('👆 抽到牌了！請點選兩張相同數字的牌來配對消除');
    setMessage(`抽到 ${cardName}，有配對！`, '');
    renderAll();
    busyLock = false;
  } else {
    setMessage(`抽到 ${cardName}，沒有配對`, '');
    renderAll();
    setTimeout(() => { busyLock = false; afterPlayerTurn(); }, 500);
  }
}

// === 玩家手動配對 ===
function playerSelectPair(cardIdx) {
  if (phase !== 'discard' || gameOver || busyLock) return;
  const hp = players[0]; // 人類永遠是 index 0
  if (cardIdx >= hp.hand.length) return;
  const card = hp.hand[cardIdx];

  if (card.value === 'JOKER') {
    setMessage('🃏 鬼牌不能配對！', '');
    selectedCardIdx = -1;
    renderAll();
    return;
  }

  if (selectedCardIdx === -1) {
    selectedCardIdx = cardIdx;
    renderAll();
    return;
  }

  if (selectedCardIdx === cardIdx) {
    selectedCardIdx = -1;
    renderAll();
    return;
  }

  const first  = hp.hand[selectedCardIdx];
  const second = hp.hand[cardIdx];

  if (first.value === second.value) {
    // 配對成功
    busyLock = true;
    hp.pairs.push(first.value);
    const idxs = [selectedCardIdx, cardIdx].sort((a, b) => b - a);
    hp.hand.splice(idxs[0], 1);
    hp.hand.splice(idxs[1], 1);
    selectedCardIdx = -1;

    setMessage(`✅ 配對成功！消除了 ${first.value}`, 'win');

    if (hasAnyPairs(hp.hand)) {
      setTurnIndicator('👆 還有配對！繼續點選相同數字的牌');
      renderAll();
      busyLock = false;
    } else {
      if (hp.hand.length === 0) hp.isOut = true;
      renderAll();
      setTimeout(() => { busyLock = false; afterPlayerTurn(); }, 400);
    }
  } else {
    setMessage('❌ 數字不同，無法配對！', 'lose');
    selectedCardIdx = cardIdx;
    renderAll();
  }
}

function afterPlayerTurn() {
  const hp = players[0];
  if (hp.hand.length === 0) hp.isOut = true;

  const active = players.filter(p => !p.isOut && p.hand.length > 0);
  if (active.length <= 1) { endGame(); return; }
  advanceTurn();
}

// === AI 回合 ===
async function aiTurn() {
  if (gameOver) return;
  const cp  = players[currentTurn];
  const cfg = AI_CONFIG[difficulty];
  const target = getDrawTarget(currentTurn);
  if (target === -1) { endGame(); return; }

  const targetPlayer = players[target];
  const jokerIdx     = targetPlayer.hand.findIndex(c => c.value === 'JOKER');
  let chosenIndex;

  if (jokerIdx !== -1 && Math.random() < cfg.jokerDetect) {
    const nonJoker = targetPlayer.hand.map((_, i) => i).filter(i => i !== jokerIdx);
    chosenIndex = nonJoker.length > 0
      ? nonJoker[Math.floor(Math.random() * nonJoker.length)]
      : jokerIdx;
  } else if (cfg.bluff > 0 && jokerIdx !== -1 && Math.random() < cfg.bluff) {
    chosenIndex = jokerIdx;
  } else {
    chosenIndex = Math.floor(Math.random() * targetPlayer.hand.length);
  }

  const card = targetPlayer.hand.splice(chosenIndex, 1)[0];
  cp.hand.push(card);
  if (targetPlayer.hand.length === 0) targetPlayer.isOut = true;

  autoRemovePairs(cp);
  cp.hand = shuffle(cp.hand);
  if (cp.hand.length === 0) cp.isOut = true;

  setTurnIndicator(`🤖 ${cp.name} 從 ${players[target].name} 抽了一張牌`);
  renderAll();
  await sleep(600);

  const active = players.filter(p => !p.isOut && p.hand.length > 0);
  if (active.length <= 1) { endGame(); return; }
  advanceTurn();
}

// === 推進回合 ===
function advanceTurn() {
  const next = getNextTurn(currentTurn);
  if (next === -1) { endGame(); return; }
  currentTurn = next;
  startTurn();
}

// === 遊戲結束 ===
function endGame() {
  gameOver = true;
  phase = 'done';

  const loser = players.find(p => p.hand.length > 0 && p.hand.some(c => c.value === 'JOKER'));

  if (loser) {
    players.forEach(p => {
      if (p !== loser) scores[p.name] = (scores[p.name] || 0) + 1;
    });
    if (loser.isHuman) {
      setMessage('😱 你拿到鬼牌了！你輸了…', 'lose');
    } else {
      setMessage(`🎉 ${loser.name} 拿到鬼牌！你贏了！`, 'win');
    }
  } else {
    setMessage('遊戲結束！', '');
  }

  setTurnIndicator('');
  renderAll();
  document.getElementById('btn-new').style.display = 'inline-block';
}

function newGame() {
  document.getElementById('btn-new').style.display = 'none';
  startGame();
}

function backToSetup() {
  document.getElementById('setup-screen').style.display = '';
  document.getElementById('game-table').classList.remove('active');
  scores = {};
  difficulty = null;
  playerCount = null;
  document.querySelectorAll('.setup-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('btn-start-game').disabled = true;
}

// === 事件綁定 ===
document.addEventListener('DOMContentLoaded', () => {
  initSetup();
  document.getElementById('btn-new').addEventListener('click', newGame);
  document.getElementById('btn-back').addEventListener('click', backToSetup);
});
