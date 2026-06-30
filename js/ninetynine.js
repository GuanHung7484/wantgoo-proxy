// ===== 九九遊戲邏輯 =====

const SUITS  = ['♠','♥','♦','♣'];
const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const AI_NAMES = ['香吉士','索隆','娜美'];

const AI_CFG = {
  beginner:     { name:'初學者', icon:'😊', rnd:30, saveFn:0  },
  intermediate: { name:'中級',   icon:'🧐', rnd:15, saveFn:12 },
  advanced:     { name:'高級',   icon:'😈', rnd:5,  saveFn:22 },
  boss:         { name:'魔王級', icon:'👹', rnd:2,  saveFn:28 }
};

function playerAvatar(name) {
  const key = name === '你' ? 'you' : name === '香吉士' ? 'sanji' : name === '索隆' ? 'zoro' : 'nami';
  return `<span class="player-avatar avatar-${key}" aria-hidden="true"><span class="avatar-face"><span class="avatar-eyes"></span><span class="avatar-mouth"></span></span></span>`;
}

// 位置對應（依人數變化）
function posMap(count) {
  if (count === 2) return ['bottom','top'];
  if (count === 3) return ['bottom','right','top'];
  return ['bottom','right','top','left'];
}
function areaMap(count) {
  if (count === 2) return ['nn-bottom','nn-top'];
  if (count === 3) return ['nn-bottom','nn-right','nn-top'];
  return ['nn-bottom','nn-right','nn-top','nn-left'];
}

// === 狀態 ===
let difficulty   = null;
let playerCount  = null;
let players      = [];   // { name, isHuman, hand[], eliminated }
let drawPile     = [];
let discardPile  = [];
let currentTotal = 0;
let clockwise    = true;
let curIdx       = 0;    // 目前出牌玩家
let phase        = 'setup'; // setup|idle|choose-effect|choose-target|ai|done
let lastCard     = null;
let pendingCard  = null;
let nextOverride = -1;
let skipNext     = false;
let scores       = {};
let busyLock     = false;
let selectedCI   = -1;   // 確認出牌用：選中的手牌索引

// === 牌組 ===
function createDeck() {
  const d = [];
  for (const s of SUITS) for (const v of VALUES) d.push({ suit:s, value:v });
  return d;
}
function shuffle(a) {
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
function isRed(s) { return s==='♥'||s==='♦'; }
function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }

function drawFromPile() {
  if (drawPile.length === 0 && discardPile.length > 0) {
    drawPile = shuffle([...discardPile]);
    discardPile = [];
  }
  return drawPile.length > 0 ? drawPile.pop() : null;
}

// === 牌的效果 ===
function isSpadeA(c) { return c.value==='A' && c.suit==='♠'; }

function getEffect(c) {
  if (isSpadeA(c)) return { type:'reset' };
  switch(c.value) {
    case 'A':  return { type:'add', d:1 };
    case '2':  return { type:'add', d:2 };
    case '3':  return { type:'add', d:3 };
    case '4':  return { type:'reverse' };
    case '5':  return { type:'designate' };
    case '6':  return { type:'add', d:6 };
    case '7':  return { type:'add', d:7 };
    case '8':  return { type:'add', d:8 };
    case '9':  return { type:'add', d:9 };
    case '10': return { type:'add', d:10, neg:true };
    case 'J':  return { type:'skip' };
    case 'Q':  return { type:'add', d:20, neg:true };
    case 'K':  return { type:'set99' };
  }
}

function canPlay(c, total) {
  const e = getEffect(c);
  if (['reset','reverse','designate','skip','set99'].includes(e.type)) return true;
  if (e.neg) return true; // 可減
  return total + e.d <= 99;
}

function effectLabel(c) {
  if (isSpadeA(c)) return '歸零';
  switch(c.value) {
    case 'A': return '+1';  case '2': return '+2';  case '3': return '+3';
    case '4': return '迴轉'; case '5': return '指定'; case '6': return '+6';
    case '7': return '+7';  case '8': return '+8';  case '9': return '+9';
    case '10':return '±10'; case 'J': return 'PASS'; case 'Q': return '±20';
    case 'K': return '=99';
  }
}

function effectMsg(c, choice) {
  if (isSpadeA(c)) return '♠A 歸零！→ 0';
  const e = getEffect(c);
  switch(e.type) {
    case 'add':
      if (e.neg) {
        const sign = choice < 0 ? '-' : '+';
        return `${c.value}${c.suit} ${sign}${e.d} → ${currentTotal}`;
      }
      return `${c.value}${c.suit} +${e.d} → ${currentTotal}`;
    case 'reverse': return `4${c.suit} 迴轉！`;
    case 'designate': return `5${c.suit} 指定出牌！`;
    case 'skip': return `J${c.suit} 跳過下一位！`;
    case 'set99': return `K${c.suit} → 99！`;
  }
  return '';
}

// === 渲染 ===
function renderAll() {
  const areas = areaMap(playerCount);
  const allAreaIds = ['nn-bottom','nn-right','nn-top','nn-left'];
  allAreaIds.forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML=''; });

  for (let i = 0; i < players.length; i++) {
    renderPlayer(i, areas[i]);
  }
  updateCenter();
  bindClicks();
  updateScoreboard();
}

function renderPlayer(idx, areaId) {
  const p = players[idx];
  const el = document.getElementById(areaId);
  if (!el) return;
  const pos = posMap(playerCount)[idx];
  const cfg = AI_CFG[difficulty];
  const isActive = phase === 'idle' && idx === curIdx && !p.eliminated;
  const diff = p.isHuman ? '' : ` [${cfg.name}${cfg.icon}]`;
  const elimLabel = p.eliminated ? ' ❌ 淘汰' : '';
  const isSmall = pos === 'left' || pos === 'right';

  let cardsHTML = '';
  if (p.eliminated) {
    cardsHTML = '<div class="nn-hand" style="min-height:50px;opacity:.3;text-align:center;color:#888">已淘汰</div>';
  } else if (p.isHuman) {
    cardsHTML = '<div class="nn-hand nn-human-hand">';
    p.hand.forEach((c, ci) => {
      const ok = canPlay(c, currentTotal);
      const clickable = isActive && ok && !busyLock && phase === 'idle';
      const isSelected = (phase === 'confirm') && ci === selectedCI;
      const cls = [
        'card', isRed(c.suit)?'red':'black', 'nn-hcard',
        clickable ? 'nn-playable' : '',
        isActive && !ok ? 'nn-unplayable' : '',
        isSelected ? 'nn-selected' : ''
      ].join(' ');
      const lbl = effectLabel(c);
      cardsHTML += `<div class="${cls}" ${clickable?`data-cidx="${ci}"`:''} title="${lbl}">
        <span class="card-value">${c.value}</span>
        <span class="card-suit">${c.suit}</span>
        <span class="nn-elbl">${lbl}</span>
      </div>`;
    });
    cardsHTML += '</div>';
  } else {
    // AI: 蓋牌
    const cardCls = isSmall ? 'bj-small-card' : '';
    cardsHTML = `<div class="nn-hand ${isSmall?'nn-side-ai':''}">`;
    for (let j = 0; j < p.hand.length; j++) {
      cardsHTML += `<div class="card facedown ${cardCls}"></div>`;
    }
    cardsHTML += '</div>';
  }

  el.innerHTML = `
    <div class="nn-pbox ${isActive?'nn-active':''} ${p.eliminated?'nn-elim':''}">
      <div class="nn-plabel">${playerAvatar(p.name)}<span class="player-name">${p.name}</span>${diff}
        <span class="nn-cnt">(${p.hand.length}張)${elimLabel}</span>
      </div>
      ${cardsHTML}
    </div>`;
}

function updateCenter() {
  const t = document.getElementById('nn-total');
  t.textContent = currentTotal;
  const clr = currentTotal>=91?'#f44336':currentTotal>=81?'#ff9800':currentTotal>=51?'#ffd200':'#4caf50';
  t.style.borderColor = clr; t.style.color = clr;

  document.getElementById('nn-direction').textContent = clockwise ? '⟳ 順時針' : '⟲ 逆時針';
  document.getElementById('nn-pile-info').textContent = `山: ${drawPile.length} 張`;

  const wrap = document.getElementById('nn-last-card-wrap');
  if (lastCard) {
    const c = isRed(lastCard.suit)?'red':'black';
    wrap.innerHTML = `<div class="card ${c}" style="width:50px;height:70px;margin:5px auto;font-size:.9rem">
      <span class="card-value">${lastCard.value}</span>
      <span class="card-suit">${lastCard.suit}</span></div>`;
  } else { wrap.innerHTML = ''; }
}

function updateScoreboard() {
  const el = document.getElementById('scoreboard-content');
  if (!el) return;
  el.innerHTML = players.map(p =>
    `<div class="score-item">${p.name} <span>${scores[p.name]||0}</span></div>`
  ).join('');
}

function setMsg(text, type) {
  const el = document.getElementById('message');
  el.textContent = text; el.className = 'message '+(type||'');
}

function bindClicks() {
  if (phase !== 'idle') return;
  const cp = players[curIdx];
  if (!cp || !cp.isHuman || cp.eliminated || busyLock) return;
  document.querySelectorAll('.nn-hcard.nn-playable[data-cidx]').forEach(el => {
    el.addEventListener('click', () => {
      if (busyLock) return;
      humanPlay(parseInt(el.dataset.cidx));
    });
  });
}

// === 設定 ===
function initSetup() {
  const dBtns = document.querySelectorAll('#diff-grid .setup-btn');
  const cBtns = document.querySelectorAll('#count-grid .setup-btn');
  const startBtn = document.getElementById('btn-start-game');
  dBtns.forEach(b => b.addEventListener('click', () => {
    dBtns.forEach(x=>x.classList.remove('selected'));
    b.classList.add('selected'); difficulty = b.dataset.level;
    startBtn.disabled = !(difficulty && playerCount);
  }));
  cBtns.forEach(b => b.addEventListener('click', () => {
    cBtns.forEach(x=>x.classList.remove('selected'));
    b.classList.add('selected'); playerCount = parseInt(b.dataset.count);
    startBtn.disabled = !(difficulty && playerCount);
  }));
  startBtn.addEventListener('click', () => {
    if (!difficulty || !playerCount) return;
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('game-table').classList.add('active');
    startGame();
  });
}

// === 遊戲流程 ===
function startGame() {
  // 建立玩家
  players = [{ name:'你', isHuman:true, hand:[], eliminated:false }];
  for (let i = 0; i < playerCount-1; i++) {
    players.push({ name:AI_NAMES[i], isHuman:false, hand:[], eliminated:false });
  }
  if (Object.keys(scores).length === 0) players.forEach(p => scores[p.name]=0);

  // 洗牌 & 發牌（5張）
  const deck = shuffle(createDeck());
  for (let r = 0; r < 5; r++) {
    for (let i = 0; i < players.length; i++) {
      players[i].hand.push(deck.pop());
    }
  }
  drawPile = deck;
  discardPile = [];
  currentTotal = 0;
  clockwise = true;
  curIdx = 0;
  lastCard = null;
  pendingCard = null;
  nextOverride = -1;
  skipNext = false;
  busyLock = false;

  document.getElementById('btn-new').style.display = 'none';
  document.getElementById('nn-choice').style.display = 'none';
  setMsg('');
  renderAll();
  startTurn();
}

async function startTurn() {
  if (phase === 'done') return;

  // 跳過已淘汰
  if (players[curIdx].eliminated) { advance(); startTurn(); return; }

  // 勝利檢查
  const alive = players.filter(p => !p.eliminated);
  if (alive.length <= 1) { endGame(alive[0]); return; }

  // 淘汰檢查
  if (checkElim(curIdx)) {
    renderAll();
    setMsg(`❌ ${players[curIdx].name} 無牌可出，淘汰！`, 'lose');
    await sleep(1200);
    const remaining = players.filter(p => !p.eliminated);
    if (remaining.length <= 1) { endGame(remaining[0]); return; }
    advance();
    startTurn();
    return;
  }

  phase = 'idle';
  renderAll();

  const cp = players[curIdx];
  if (cp.isHuman) {
    setMsg('輪到你了！點選一張牌出牌', '');
  } else {
    setMsg(`🤖 ${cp.name} 正在思考...`, '');
    await sleep(500 + Math.random()*500);
    aiPlay();
  }
}

function checkElim(idx) {
  const p = players[idx];
  if (p.eliminated) return true;
  if (p.hand.every(c => !canPlay(c, currentTotal))) {
    p.eliminated = true;
    discardPile.push(...p.hand);
    p.hand = [];
    return true;
  }
  return false;
}

// === 人類出牌（先確認再出）===
function humanPlay(ci) {
  if (phase !== 'idle' || busyLock) return;
  const cp = players[curIdx];
  if (!cp.isHuman) return;
  const card = cp.hand[ci];
  if (!canPlay(card, currentTotal)) return;

  // 進入確認階段
  selectedCI = ci;
  phase = 'confirm';
  showConfirmPanel(card);
  renderAll();
}

function showConfirmPanel(card) {
  const lbl = effectLabel(card);
  const ch = document.getElementById('nn-choice');
  ch.innerHTML = `
    <div class="nn-ch-title">出牌確認：${card.value}${card.suit}（${lbl}）</div>
    <div class="nn-ch-btns">
      <button class="btn btn-hit nn-cbtn" onclick="confirmPlay()">確認出牌</button>
      <button class="btn btn-secondary nn-cbtn" onclick="cancelPlay()">取消</button>
    </div>`;
  ch.style.display = '';
}

// eslint-disable-next-line no-unused-vars
function confirmPlay() {
  if (phase !== 'confirm' || selectedCI < 0) return;
  const cp = players[curIdx];
  const card = cp.hand[selectedCI];
  cp.hand.splice(selectedCI, 1);
  selectedCI = -1;
  busyLock = true;

  const e = getEffect(card);

  if (e.neg) {
    pendingCard = card;
    phase = 'choose-effect';
    showEffectChoice(card);
    return;
  }
  if (e.type === 'designate') {
    pendingCard = card;
    phase = 'choose-target';
    showTargetChoice();
    return;
  }

  document.getElementById('nn-choice').style.display = 'none';
  applyEffect(card);
  setMsg(effectMsg(card), '');
  renderAll();
  setTimeout(() => finishTurn(), 400);
}

// eslint-disable-next-line no-unused-vars
function cancelPlay() {
  // 如果牌已從手牌移出（choose-effect / choose-target），放回去
  if (pendingCard) {
    players[curIdx].hand.push(pendingCard);
    pendingCard = null;
  }
  selectedCI = -1;
  phase = 'idle';
  busyLock = false;
  document.getElementById('nn-choice').style.display = 'none';
  setMsg('輪到你了！點選一張牌出牌', '');
  renderAll();
}

function showEffectChoice(card) {
  const e = getEffect(card);
  const addT = currentTotal + e.d;
  const subT = currentTotal - e.d;
  const canAdd = addT <= 99;
  const ch = document.getElementById('nn-choice');
  let html = `<div class="nn-ch-title">選擇效果</div><div class="nn-ch-btns">`;
  if (canAdd) html += `<button class="btn btn-hit nn-cbtn" onclick="resolveEffect(1)">+${e.d} (→${addT})</button>`;
  html += `<button class="btn btn-stand nn-cbtn" onclick="resolveEffect(-1)">-${e.d} (→${subT})</button>`;
  html += `<button class="btn btn-secondary nn-cbtn" onclick="cancelPlay()">取消</button>`;
  html += '</div>';
  ch.innerHTML = html; ch.style.display = '';
  renderAll();
}

// eslint-disable-next-line no-unused-vars -- called from inline onclick
function resolveEffect(sign) {
  if (phase !== 'choose-effect' || !pendingCard) return;
  document.getElementById('nn-choice').style.display = 'none';
  applyEffect(pendingCard, sign);
  setMsg(effectMsg(pendingCard, sign), '');
  pendingCard = null;
  renderAll();
  setTimeout(() => finishTurn(), 400);
}

function showTargetChoice() {
  const ch = document.getElementById('nn-choice');
  let html = `<div class="nn-ch-title">指定下一位出牌者</div><div class="nn-ch-btns">`;
  players.forEach((p, i) => {
    if (i !== curIdx && !p.eliminated) {
      html += `<button class="btn btn-draw nn-cbtn" onclick="resolveTarget(${i})">${p.name}</button>`;
    }
  });
  html += `<button class="btn btn-secondary nn-cbtn" onclick="cancelPlay()">取消</button>`;
  html += '</div>';
  ch.innerHTML = html; ch.style.display = '';
  renderAll();
}

// eslint-disable-next-line no-unused-vars -- called from inline onclick
function resolveTarget(tIdx) {
  if (phase !== 'choose-target' || !pendingCard) return;
  document.getElementById('nn-choice').style.display = 'none';
  applyEffect(pendingCard, tIdx);
  setMsg(`5${pendingCard.suit} 指定 ${players[tIdx].name} 出牌！`, '');
  pendingCard = null;
  renderAll();
  setTimeout(() => finishTurn(), 400);
}

// === AI 出牌 ===
async function aiPlay() {
  const cp = players[curIdx];
  const cfg = AI_CFG[difficulty];
  const hand = cp.hand;
  const playable = hand.filter(c => canPlay(c, currentTotal));
  if (playable.length === 0) return; // shouldn't reach here

  // 評分選牌
  const scored = playable.map(card => {
    const e = getEffect(card);
    let s = Math.random() * cfg.rnd;

    if (e.type === 'add' && !e.neg) {
      const nt = currentTotal + e.d;
      if (nt <= 99) { s += e.d * 2; if (nt > 85) s -= 20; }
    }
    if (['reset','reverse','skip','designate'].includes(e.type)) {
      s -= cfg.saveFn;
      if (currentTotal >= 85) s += 30;
    }
    if (e.type === 'set99') {
      s += currentTotal < 80 ? 15 : -20;
    }
    if (e.neg) {
      s += 5;
      if (currentTotal >= 80) s += 10;
    }
    return { card, s };
  });
  scored.sort((a,b) => b.s - a.s);
  const card = scored[0].card;
  const ci = hand.indexOf(card);
  hand.splice(ci, 1);

  const e = getEffect(card);

  // AI 選擇 +/-
  let choice = 1;
  if (e.neg) {
    const addT = currentTotal + e.d;
    if (addT > 99) { choice = -1; }
    else if (difficulty === 'boss') {
      choice = (addT <= 99 && addT >= 85) ? 1 : -1;
    } else {
      choice = currentTotal >= 70 ? -1 : 1;
    }
  }

  // AI 選指定目標
  if (e.type === 'designate') {
    const targets = players.map((p,i)=>({p,i})).filter(x => x.i!==curIdx && !x.p.eliminated);
    let tIdx;
    if (difficulty === 'boss') {
      const human = targets.find(x => x.p.isHuman);
      tIdx = (human && Math.random() > 0.3) ? human.i : targets[Math.floor(Math.random()*targets.length)].i;
    } else {
      tIdx = targets[Math.floor(Math.random()*targets.length)].i;
    }
    choice = tIdx;
  }

  applyEffect(card, choice);
  let msg = effectMsg(card, choice);
  if (e.type === 'designate') msg = `${cp.name} 指定 ${players[choice].name} 出牌！`;
  setMsg(`🤖 ${cp.name}: ${msg}`, '');
  renderAll();
  await sleep(500);
  finishTurn();
}

// === 效果套用 ===
function applyEffect(card, choice) {
  const e = getEffect(card);
  switch(e.type) {
    case 'reset':     currentTotal = 0; break;
    case 'set99':     currentTotal = 99; break;
    case 'reverse':   clockwise = !clockwise; break;
    case 'skip':      skipNext = true; break;
    case 'designate': nextOverride = choice; break;
    case 'add':
      if (e.neg && choice < 0) currentTotal -= e.d;
      else currentTotal += e.d;
      break;
  }
  discardPile.push(card);
  lastCard = card;
}

// === 結束回合 ===
async function finishTurn() {
  // 抽牌
  const nc = drawFromPile();
  if (nc) players[curIdx].hand.push(nc);

  busyLock = false;
  updateCenter();
  renderAll();
  await sleep(300);
  advance();
  startTurn();
}

// === 推進回合 ===
function advance() {
  const n = players.length;
  const step = clockwise ? 1 : -1;

  if (nextOverride >= 0) {
    curIdx = nextOverride;
    nextOverride = -1;
    return;
  }

  if (skipNext) {
    skipNext = false;
    // 找到下一位，跳過
    let skipped = curIdx;
    for (let i = 0; i < n; i++) {
      skipped = ((skipped + step) % n + n) % n;
      if (!players[skipped].eliminated) break;
    }
    // 再找下一位
    let next = skipped;
    for (let i = 0; i < n; i++) {
      next = ((next + step) % n + n) % n;
      if (!players[next].eliminated) break;
    }
    curIdx = next;
    return;
  }

  for (let i = 0; i < n; i++) {
    curIdx = ((curIdx + step) % n + n) % n;
    if (!players[curIdx].eliminated) return;
  }
}

// === 遊戲結束 ===
function endGame(winner) {
  phase = 'done';
  busyLock = false;
  if (winner) {
    scores[winner.name] = (scores[winner.name]||0) + 1;
    if (winner.isHuman) setMsg('🎉 你是最後的贏家！', 'win');
    else setMsg(`😢 ${winner.name} 獲勝了…`, 'lose');
  } else {
    setMsg('遊戲結束！', '');
  }
  renderAll();
  document.getElementById('btn-new').style.display = 'inline-block';
}

function newGame() {
  document.getElementById('btn-new').style.display = 'none';
  startGame();
}

function backToSetup() {
  phase = 'setup';
  document.getElementById('setup-screen').style.display = '';
  document.getElementById('game-table').classList.remove('active');
  scores = {}; difficulty = null; playerCount = null;
  document.querySelectorAll('.setup-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('btn-start-game').disabled = true;
}

// === 事件綁定 ===
document.addEventListener('DOMContentLoaded', () => {
  initSetup();
  document.getElementById('btn-new').addEventListener('click', newGame);
  document.getElementById('btn-back').addEventListener('click', backToSetup);
});
