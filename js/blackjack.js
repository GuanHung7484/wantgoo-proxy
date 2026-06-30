// ===== 21點遊戲邏輯（四方位 + 骰子決定莊家） =====

const SUITS = ['♠','♥','♦','♣'];
const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

// 參與者名單（依人數截取）
const PARTICIPANT_NAMES = ['你', '香吉士', '索隆', '娜美'];

const AI_CONFIG = {
  beginner:     { standOn: 14, bustChance: 0.15, name: '初學者', icon: '😊' },
  intermediate: { standOn: 16, bustChance: 0.05, name: '中級',   icon: '🧐' },
  advanced:     { standOn: 17, bustChance: 0,    name: '高級',   icon: '😈' },
  boss:         { standOn: 17, bustChance: 0,    name: '魔王級', icon: '👹', peeks: true }
};

function playerAvatar(name) {
  const key = name === '你' ? 'you' : name === '香吉士' ? 'sanji' : name === '索隆' ? 'zoro' : 'nami';
  return `<span class="player-avatar avatar-${key}" aria-hidden="true"><span class="avatar-face"><span class="avatar-eyes"></span><span class="avatar-mouth"></span></span></span>`;
}

// 位置定義：上(莊家)→右→下→左
const POS_LABELS = ['上方', '右方', '下方', '左方'];
const POS_KEYS   = ['top', 'right', 'bottom', 'left'];
const AREA_IDS   = ['bj-top', 'bj-right', 'bj-bottom', 'bj-left'];

// === 狀態 ===
let deck = [];
let difficulty = null;
let playerCount = null;
let allPlayers = [];   // [0]=上(莊家), [1]=右, [2]=下, [3]=左
let playOrder = [];    // 出牌順序索引 (非莊家先，莊家最後)
let currentOrderIdx = 0;
let gamePhase = 'setup'; // setup | dice | playing | dealer | done
let scores = { win: 0, lose: 0, draw: 0 };

// === 牌組工具 ===
function createDeck(n = 2) {
  const d = [];
  for (let i = 0; i < n; i++)
    for (const s of SUITS)
      for (const v of VALUES)
        d.push({ suit: s, value: v });
  return d;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function dealCard() {
  if (deck.length < 20) deck = shuffle(createDeck());
  return deck.pop();
}

function cardScore(hand) {
  let total = 0, aces = 0;
  for (const c of hand) {
    if (c.value === 'A') { total += 11; aces++; }
    else if (['K','Q','J'].includes(c.value)) total += 10;
    else total += parseInt(c.value);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isBlackjack(hand) { return hand.length === 2 && cardScore(hand) === 21; }
function isRed(suit) { return suit === '♥' || suit === '♦'; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// === 渲染牌 ===
function renderCard(card, facedown = false, small = false) {
  const cls = small ? 'bj-small-card' : '';
  if (facedown) return `<div class="card facedown deal-anim ${cls}"></div>`;
  const color = isRed(card.suit) ? 'red' : 'black';
  return `<div class="card ${color} deal-anim ${cls}">
    <span class="card-value">${card.value}</span>
    <span class="card-suit">${card.suit}</span>
  </div>`;
}

// === 渲染四方位牌桌 ===
function renderAll() {
  const cfg = AI_CONFIG[difficulty];
  const revealDealer = gamePhase === 'dealer' || gamePhase === 'done';

  for (let i = 0; i < allPlayers.length; i++) {
    const p = allPlayers[i];
    const pos = POS_KEYS[i];
    const areaEl = document.getElementById(AREA_IDS[i]);
    if (!areaEl) continue;

    const isDealer = i === 0;
    const isSmall = pos === 'left' || pos === 'right';
    const isCurrentTurn = gamePhase === 'playing' && playOrder[currentOrderIdx] === i;
    const isDealerTurn = gamePhase === 'dealer' && isDealer;
    const isActive = isCurrentTurn || isDealerTurn;

    // 分數顯示
    const showScore = isDealer ? (revealDealer || isDealerTurn) : true;
    const scoreText = showScore ? `${cardScore(p.hand)} 點` : '? 點';

    // 牌面：莊家第二張蓋牌（直到翻牌）
    const cards = p.hand.map((c, ci) => {
      const hide = isDealer && ci === 1 && !revealDealer && !isDealerTurn;
      return renderCard(c, hide, isSmall);
    }).join('');

    // 狀態
    let statusHTML = '';
    if (p.status === 'bust') statusHTML = '<span class="status-text bust">💥 爆牌</span>';
    else if (p.status === 'blackjack') statusHTML = '<span class="status-text bj">BJ!</span>';
    else if (p.status === 'stand') statusHTML = '<span class="status-text stand">停牌</span>';

    // 結果
    let resultHTML = '';
    if (gamePhase === 'done' && p.result) {
      const cls = p.result === 'win' ? 'win' : p.result === 'lose' ? 'lose' : 'push';
      const txt = p.result === 'win' ? '勝' : p.result === 'lose' ? '負' : '平';
      resultHTML = `<span class="result-badge ${cls}">${txt}</span>`;
    }

    const roleLabel = isDealer ? '👑莊家' : '閒家';
    const diffLabel = p.isHuman ? '' : ` [${cfg.name}${cfg.icon}]`;

    areaEl.innerHTML = `
      <div class="bj-player-box ${isActive ? 'bj-active' : ''} ${isDealer ? 'bj-dealer-box' : ''} ${p.status === 'bust' ? 'bj-bust' : ''}">
        <div class="bj-player-label">
          ${playerAvatar(p.name)}<span class="player-name">${p.name}</span>${diffLabel}
          <span class="bj-role">${roleLabel}</span>
          <span class="bj-score">${scoreText}</span>
          ${statusHTML} ${resultHTML}
        </div>
        <div class="bj-hand">${cards}</div>
      </div>`;
  }

  // 分數
  document.getElementById('score-win').textContent = scores.win;
  document.getElementById('score-lose').textContent = scores.lose;
  document.getElementById('score-draw').textContent = scores.draw;
}

function setMessage(text, type = '') {
  const el = document.getElementById('message');
  if (el) { el.textContent = text; el.className = 'message ' + type; }
}

function setButtons(hit, stand, dbl) {
  document.getElementById('btn-hit').disabled = !hit;
  document.getElementById('btn-stand').disabled = !stand;
  document.getElementById('btn-double').disabled = !dbl;
}

function hideButtons() { setButtons(false, false, false); }

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
      checkReady();
    });
  });

  countBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      countBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      playerCount = parseInt(btn.dataset.count);
      checkReady();
    });
  });

  startBtn.addEventListener('click', () => {
    if (!difficulty || !playerCount) return;
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('game-table').classList.add('active');
    deck = shuffle(createDeck());
    startDicePhase();
  });

  function checkReady() {
    startBtn.disabled = !(difficulty && playerCount);
  }
}

// =============================================
//  骰子階段
// =============================================
async function startDicePhase() {
  gamePhase = 'dice';
  const diceScreen = document.getElementById('dice-screen');
  const diceResults = document.getElementById('dice-results');
  const diceSeats = document.getElementById('dice-seats');
  diceScreen.style.display = '';
  document.getElementById('bj-table').style.display = 'none';
  document.getElementById('action-bar').style.display = 'none';
  diceResults.innerHTML = '';
  diceSeats.innerHTML = '';

  // 參與者
  const participants = PARTICIPANT_NAMES.slice(0, playerCount).map(name => ({
    name,
    isHuman: name === '你',
    dice: 0,
    sortKey: 0
  }));

  // 逐一擲骰子動畫
  for (const p of participants) {
    const row = document.createElement('div');
    row.className = 'dice-row';
    row.innerHTML = `<span class="dice-name">${playerAvatar(p.name)}<span class="player-name">${p.name}</span></span>
                     <span class="dice-value dice-rolling">🎲</span>`;
    diceResults.appendChild(row);

    // 滾動動畫
    const valSpan = row.querySelector('.dice-value');
    const faces = ['⚀','⚁','⚂','⚃','⚄','⚅'];
    for (let t = 0; t < 8; t++) {
      valSpan.textContent = faces[Math.floor(Math.random() * 6)];
      await sleep(80);
    }

    // 最終結果
    p.dice = Math.ceil(Math.random() * 6);
    p.sortKey = Math.random(); // 平手用
    valSpan.textContent = faces[p.dice - 1] + ' ' + p.dice;
    valSpan.classList.remove('dice-rolling');
    await sleep(300);
  }

  // 排序：骰子大→小
  participants.sort((a, b) => b.dice - a.dice || b.sortKey - a.sortKey);

  // 標記莊家
  await sleep(400);
  const rows = diceResults.querySelectorAll('.dice-row');
  // 找到 participants[0] 在 DOM 中的位置
  const nameEls = diceResults.querySelectorAll('.dice-name');
  nameEls.forEach(el => {
    if (el.textContent.includes(participants[0].name)) {
      el.closest('.dice-row').classList.add('dice-dealer-highlight');
      el.closest('.dice-row').querySelector('.dice-value').textContent += ' 👑 莊家！';
    }
  });

  await sleep(600);

  // 顯示座位安排
  const posLabels = ['上方 (莊家)', '右方', '下方', '左方'];
  let seatsHTML = '<div class="dice-seats-title">座位安排</div>';
  for (let i = 0; i < participants.length; i++) {
    const emoji = i === 0 ? '👑' : '💺';
    seatsHTML += `<div class="dice-seat-row">${emoji} ${posLabels[i]}：${participants[i].name}</div>`;
  }
  diceSeats.innerHTML = seatsHTML;

  await sleep(1800);

  // 建立 allPlayers 並開始遊戲
  allPlayers = participants.map((p, i) => ({
    name: p.name,
    isHuman: p.isHuman,
    hand: [],
    status: 'playing',
    result: null,
    dice: p.dice
  }));

  // 建立出牌順序：非莊家 (1,2,3) 先，莊家 (0) 最後
  playOrder = [];
  for (let i = 1; i < allPlayers.length; i++) playOrder.push(i);
  playOrder.push(0);

  // 切到牌桌
  diceScreen.style.display = 'none';
  document.getElementById('bj-table').style.display = '';
  document.getElementById('action-bar').style.display = '';

  startRound();
}

// =============================================
//  發牌 & 遊戲流程
// =============================================
function startRound() {
  gamePhase = 'playing';

  // 發牌
  for (const p of allPlayers) {
    p.hand = [dealCard(), dealCard()];
    p.status = 'playing';
    p.result = null;
    if (isBlackjack(p.hand)) p.status = 'blackjack';
  }

  currentOrderIdx = 0;
  document.getElementById('btn-new').style.display = 'none';
  setMessage('');
  renderAll();

  advanceToNextPlayer();
}

function advanceToNextPlayer() {
  // 跳過已完成（blackjack 等）的玩家
  while (currentOrderIdx < playOrder.length) {
    const idx = playOrder[currentOrderIdx];
    const p = allPlayers[idx];

    if (p.status === 'playing') {
      // 莊家最後打（dealerPlay 階段）
      if (idx === 0) {
        startDealerTurn();
        return;
      }
      // 非莊家玩家
      if (p.isHuman) {
        renderAll();
        enableHumanButtons(p);
        return;
      } else {
        renderAll();
        aiPlayerPlay(idx);
        return;
      }
    }
    currentOrderIdx++;
  }

  // 所有非莊家完成 → 莊家
  startDealerTurn();
}

function enableHumanButtons(p) {
  const canDouble = p.hand.length === 2;
  setButtons(true, true, canDouble);
  setMessage('輪到你了！', '');
}

// === 玩家操作 ===
function hit() {
  if (gamePhase !== 'playing' && gamePhase !== 'dealer') return;
  const idx = (gamePhase === 'dealer') ? 0 : playOrder[currentOrderIdx];
  const p = allPlayers[idx];
  if (!p.isHuman || p.status !== 'playing') return;

  p.hand.push(dealCard());
  const score = cardScore(p.hand);
  renderAll();

  if (score > 21) {
    p.status = 'bust';
    renderAll();
    afterCurrentPlayer();
  } else if (score === 21) {
    p.status = 'stand';
    renderAll();
    afterCurrentPlayer();
  } else {
    // 莊家不能加倍
    setButtons(true, true, false);
  }
}

function stand() {
  if (gamePhase !== 'playing' && gamePhase !== 'dealer') return;
  const idx = (gamePhase === 'dealer') ? 0 : playOrder[currentOrderIdx];
  const p = allPlayers[idx];
  if (!p.isHuman || p.status !== 'playing') return;

  p.status = 'stand';
  renderAll();
  afterCurrentPlayer();
}

function doubleDown() {
  if (gamePhase !== 'playing') return;
  const idx = playOrder[currentOrderIdx];
  const p = allPlayers[idx];
  if (!p.isHuman || p.status !== 'playing') return;

  p.hand.push(dealCard());
  if (cardScore(p.hand) > 21) p.status = 'bust';
  else p.status = 'stand';
  renderAll();
  afterCurrentPlayer();
}

function afterCurrentPlayer() {
  hideButtons();
  if (gamePhase === 'dealer') {
    // 莊家結束（人類莊家打完）
    resolveRound();
    return;
  }
  currentOrderIdx++;
  advanceToNextPlayer();
}

// === AI 閒家出牌 ===
async function aiPlayerPlay(idx) {
  const p = allPlayers[idx];
  const cfg = AI_CONFIG[difficulty];
  setMessage(`🤖 ${p.name} 正在思考...`, '');
  hideButtons();

  await sleep(500);

  while (p.status === 'playing') {
    const score = cardScore(p.hand);
    if (score >= 21) {
      p.status = score > 21 ? 'bust' : 'stand';
      break;
    }

    let shouldHit = score < cfg.standOn;

    if (cfg.bustChance > 0 && !shouldHit && score >= 14 && score <= 17) {
      if (Math.random() < cfg.bustChance) shouldHit = true;
    }

    // 魔王看莊家明牌
    if (cfg.peeks && !shouldHit && score < 19) {
      const dealerUp = cardScore([allPlayers[0].hand[0]]);
      if (dealerUp >= 7 && score <= 16) shouldHit = true;
    }

    if (!shouldHit) { p.status = 'stand'; break; }

    p.hand.push(dealCard());
    if (cardScore(p.hand) > 21) p.status = 'bust';
    renderAll();
    await sleep(350);
  }

  renderAll();
  setMessage('');
  await sleep(250);
  currentOrderIdx++;
  advanceToNextPlayer();
}

// === 莊家出牌 ===
async function startDealerTurn() {
  gamePhase = 'dealer';
  const dealer = allPlayers[0];

  // 如果所有閒家都爆了，莊家直接贏
  const nonDealers = allPlayers.slice(1);
  if (nonDealers.every(p => p.status === 'bust')) {
    dealer.status = 'stand';
    renderAll();
    resolveRound();
    return;
  }

  // 莊家 blackjack
  if (dealer.status === 'blackjack') {
    renderAll();
    resolveRound();
    return;
  }

  renderAll();
  setMessage('👑 莊家回合', '');
  await sleep(500);

  if (dealer.isHuman) {
    // 人類莊家：手動操作
    setMessage('你是莊家，輪到你了！', '');
    setButtons(true, true, false); // 莊家不能加倍
  } else {
    // AI 莊家
    await aiDealerPlay();
  }
}

async function aiDealerPlay() {
  const dealer = allPlayers[0];
  const cfg = AI_CONFIG[difficulty];
  setMessage(`🤖 ${dealer.name}(莊家) 翻牌...`, '');
  await sleep(600);

  while (dealer.status === 'playing') {
    const score = cardScore(dealer.hand);
    if (score >= 21) {
      dealer.status = score > 21 ? 'bust' : 'stand';
      break;
    }

    let shouldHit = score < cfg.standOn;

    if (cfg.peeks) {
      const best = Math.max(...allPlayers.slice(1)
        .filter(p => p.status !== 'bust')
        .map(p => cardScore(p.hand)));
      if (score >= cfg.standOn && score < best && score <= 18) shouldHit = true;
    }

    if (cfg.bustChance > 0 && !shouldHit && score >= 15 && score <= 17) {
      if (Math.random() < cfg.bustChance) shouldHit = true;
    }

    if (!shouldHit) { dealer.status = 'stand'; break; }

    dealer.hand.push(dealCard());
    if (cardScore(dealer.hand) > 21) dealer.status = 'bust';
    renderAll();
    await sleep(400);
  }

  renderAll();
  await sleep(300);
  resolveRound();
}

// === 結算 ===
function resolveRound() {
  gamePhase = 'done';
  const dealer = allPlayers[0];
  const ds = cardScore(dealer.hand);
  const dealerBJ = isBlackjack(dealer.hand);
  const dealerBust = ds > 21;

  // 閒家與莊家比較
  for (let i = 1; i < allPlayers.length; i++) {
    const p = allPlayers[i];
    const ps = cardScore(p.hand);
    const pBJ = isBlackjack(p.hand);

    if (p.status === 'bust') { p.result = 'lose'; }
    else if (dealerBust) { p.result = 'win'; }
    else if (pBJ && dealerBJ) { p.result = 'push'; }
    else if (pBJ) { p.result = 'win'; }
    else if (dealerBJ) { p.result = 'lose'; }
    else if (ps > ds) { p.result = 'win'; }
    else if (ps < ds) { p.result = 'lose'; }
    else { p.result = 'push'; }
  }

  // 莊家的結果：反轉（閒家贏 = 莊家輸）
  const nonDealerResults = allPlayers.slice(1).map(p => p.result);
  if (nonDealerResults.every(r => r === 'lose')) dealer.result = 'win';
  else if (nonDealerResults.every(r => r === 'win')) dealer.result = 'lose';
  else dealer.result = 'push';

  // 找到人類玩家記分
  const human = allPlayers.find(p => p.isHuman);
  if (human) {
    // 人類是莊家
    if (human === dealer) {
      if (dealer.result === 'win') scores.win++;
      else if (dealer.result === 'lose') scores.lose++;
      else scores.draw++;
    } else {
      if (human.result === 'win') scores.win++;
      else if (human.result === 'lose') scores.lose++;
      else scores.draw++;
    }
  }

  renderAll();

  // 顯示人類結果
  const humanResult = human === dealer ? dealer.result : human.result;
  if (humanResult === 'win') setMessage('🎉 你贏了！', 'win');
  else if (humanResult === 'lose') setMessage('😢 你輸了…', 'lose');
  else setMessage('🤝 平手！', 'draw');

  hideButtons();
  document.getElementById('btn-new').style.display = 'inline-block';
}

// === 再來一局（重新擲骰子）===
async function newGame() {
  document.getElementById('btn-new').style.display = 'none';
  startDicePhase();
}

function backToSetup() {
  gamePhase = 'setup';
  document.getElementById('setup-screen').style.display = '';
  document.getElementById('game-table').classList.remove('active');
  scores = { win: 0, lose: 0, draw: 0 };
  difficulty = null;
  playerCount = null;
  document.querySelectorAll('.setup-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('btn-start-game').disabled = true;
}

// === 事件綁定 ===
document.addEventListener('DOMContentLoaded', () => {
  initSetup();
  document.getElementById('btn-hit').addEventListener('click', hit);
  document.getElementById('btn-stand').addEventListener('click', stand);
  document.getElementById('btn-double').addEventListener('click', doubleDown);
  document.getElementById('btn-new').addEventListener('click', newGame);
  document.getElementById('btn-back').addEventListener('click', backToSetup);
});
