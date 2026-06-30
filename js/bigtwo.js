// ===== 大老二遊戲邏輯（臺灣規則） =====
// 牌序：3<4<...<K<A<2；花色：梅♣ < 方♦ < 紅♥ < 黑♠
// 首輪必含梅花3；可出單/對/三條/五張組合；無同花限制

const RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const SUITS = ['♣','♦','♥','♠'];   // 低 → 高（台灣：梅<方<紅<黑）
const AI_NAMES = ['香吉士','索隆','娜美'];

const AI_CONFIG = {
  beginner:     { name:'初學者', icon:'😊' },
  intermediate: { name:'中級',   icon:'🧐' },
  advanced:     { name:'高級',   icon:'😈' },
  boss:         { name:'魔王級', icon:'👹' }
};

// 玩家位置：[0]=你(下), [1]=香吉士(右), [2]=索隆(上), [3]=娜美(左)
const AREA_IDS  = ['bt-bottom','bt-right','bt-top','bt-left'];
const POSITIONS = ['bottom','right','top','left'];

// ── 遊戲狀態 ──
let difficulty   = null;
let playerCount  = 2;
let players      = [];
let currentTurn  = 0;
let currentRound = null;   // { type, tier, value, cards, playerId }
let gameOver     = false;
let scores       = {};
let passCount    = 0;
let isFirstTurn  = true;
let busyLock     = false;
let selectedIdxs = [];
let finishOrder  = [];

// ── 牌組工具 ──
const rankIdx = r => RANKS.indexOf(r);
const suitIdx = s => SUITS.indexOf(s);
const cardVal = c => rankIdx(c.rank) * 4 + suitIdx(c.suit);
const cardCmp = (a,b) => cardVal(a) - cardVal(b);
const isRed   = s => s === '♥' || s === '♦';
const sleep   = ms => new Promise(r => setTimeout(r, ms));

function createDeck() {
  const d = [];
  for (const suit of SUITS)
    for (const rank of RANKS)
      d.push({ rank, suit });
  return d;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function groupByRank(hand) {
  const g = {};
  for (const c of hand) { if (!g[c.rank]) g[c.rank] = []; g[c.rank].push(c); }
  return g;
}
function groupBySuit(hand) {
  const g = {};
  for (const c of hand) { if (!g[c.suit]) g[c.suit] = []; g[c.suit].push(c); }
  return g;
}

// ── 順子判斷 ──
// 有效視窗（排序後的 rank 索引組）
const STRAIGHT_WINDOWS = [
  [0,1,2,3,4],[1,2,3,4,5],[2,3,4,5,6],[3,4,5,6,7],
  [4,5,6,7,8],[5,6,7,8,9],[6,7,8,9,10],[7,8,9,10,11],
  [0,1,2,11,12]  // A-2-3-4-5（含2，最大順）
];

function isValidStraight(sortedRanks) {
  const key = sortedRanks.join(',');
  return STRAIGHT_WINDOWS.some(w => w.join(',') === key);
}

function straightTopValue(sorted) {
  const ri = sorted.map(c => rankIdx(c.rank)).sort((a,b) => a-b);
  // A-2-3-4-5：最高牌是 2
  if (ri.join(',') === '0,1,2,11,12') {
    const two = sorted.find(c => c.rank === '2');
    return cardVal(two);
  }
  return cardVal(sorted.reduce((a,b) => cardVal(a) >= cardVal(b) ? a : b));
}

// ── 牌型辨識 ──
const TYPE_NAME = {
  single:'單張', pair:'對子', triple:'三條',
  straight:'順子', fullHouse:'葫蘆', fourOfAKind:'鐵支',
  straightFlush:'同花順', dragon:'一條龍'
};

function identifyPlay(cards) {
  if (!cards || cards.length === 0) return null;
  const n      = cards.length;
  const sorted = [...cards].sort(cardCmp);

  // ── 1張 ──
  if (n === 1) return { type:'single', tier:0, value:cardVal(sorted[0]), cards:sorted };

  // ── 2張 ──
  if (n === 2) {
    if (sorted[0].rank === sorted[1].rank)
      return { type:'pair', tier:0, value:cardVal(sorted[1]), cards:sorted };
    return null;
  }

  // ── 3張 ──
  if (n === 3) {
    if (new Set(sorted.map(c=>c.rank)).size === 1)
      return { type:'triple', tier:0, value:cardVal(sorted[2]), cards:sorted };
    return null;
  }

  // ── 5張 ──
  if (n === 5) {
    const ri    = sorted.map(c => rankIdx(c.rank));
    const suits = sorted.map(c => c.suit);
    const rcnt  = {};
    ri.forEach(r => rcnt[r] = (rcnt[r]||0) + 1);
    const counts   = Object.values(rcnt).sort((a,b) => b-a);
    const sameSuit = suits.every(s => s === suits[0]);
    const sortedRi = [...ri].sort((a,b) => a-b);
    const isStraight = isValidStraight(sortedRi);

    if (isStraight && sameSuit)
      return { type:'straightFlush', tier:4, value:straightTopValue(sorted), cards:sorted };

    if (counts[0] === 4) {
      const fourRI = parseInt(Object.entries(rcnt).find(([,c])=>c===4)[0]);
      return { type:'fourOfAKind', tier:3, value:fourRI*4+3, cards:sorted };
    }

    if (counts[0] === 3 && counts[1] === 2) {
      const triRI = parseInt(Object.entries(rcnt).find(([,c])=>c===3)[0]);
      return { type:'fullHouse', tier:2, value:triRI*4+3, cards:sorted };
    }

    if (isStraight)   // 台灣版：不允許同花作為獨立牌型
      return { type:'straight', tier:1, value:straightTopValue(sorted), cards:sorted };

    return null;
  }

  // ── 13張（一條龍）──
  if (n === 13) {
    if (new Set(cards.map(c=>c.rank)).size === 13)
      return { type:'dragon', tier:5, value:Infinity, cards:sorted };
    return null;
  }

  return null;
}

function canBeat(newPlay, current) {
  if (!current) return true;
  if (newPlay.cards.length !== current.cards.length) return false;
  if (newPlay.cards.length >= 5) {
    if (newPlay.tier > current.tier) return true;
    if (newPlay.tier < current.tier) return false;
    return newPlay.value > current.value;
  }
  return newPlay.value > current.value;
}

// ── AI 找牌函式 ──
function findBeatSingle(hand, tgt) {
  const c = hand.filter(c => cardVal(c) > tgt).sort(cardCmp);
  return c.length ? [c[0]] : null;
}

function findBeatPair(hand, tgt) {
  const gr = groupByRank(hand);
  let best = null;
  for (const r of RANKS) {
    const g = (gr[r]||[]).sort(cardCmp);
    if (g.length < 2) continue;
    const v = cardVal(g[1]);
    if (v > tgt && (!best || v < cardVal(best[1]))) best = g.slice(0,2);
  }
  return best;
}

function findBeatTriple(hand, tgt) {
  const gr = groupByRank(hand);
  let best = null;
  for (const r of RANKS) {
    const g = (gr[r]||[]).sort(cardCmp);
    if (g.length < 3) continue;
    const v = cardVal(g[2]);
    if (v > tgt && (!best || v < cardVal(best[2]))) best = g.slice(0,3);
  }
  return best;
}

function findBeatStraight(hand, tgt) {
  const gr = groupByRank(hand);
  let best = null;
  for (const w of STRAIGHT_WINDOWS) {
    const grps = w.map(i => (gr[RANKS[i]]||[]).sort(cardCmp));
    if (grps.some(g => g.length === 0)) continue;
    const combo = grps.map(g => g[0]);
    const play  = identifyPlay(combo);
    if (play && play.value > tgt && (!best || play.value < best.value)) best = play;
  }
  return best ? best.cards : null;
}

function findBeatFullHouse(hand, tgt) {
  const gr = groupByRank(hand);
  let best = null;
  for (const tr of RANKS) {
    const tg = (gr[tr]||[]).sort(cardCmp);
    if (tg.length < 3) continue;
    const tv = rankIdx(tr)*4+3;
    if (tv <= tgt) continue;
    for (const pr of RANKS) {
      if (pr === tr) continue;
      const pg = (gr[pr]||[]).sort(cardCmp);
      if (pg.length < 2) continue;
      const play = identifyPlay([...tg.slice(0,3), ...pg.slice(0,2)]);
      if (play && play.value > tgt && (!best || play.value < best.value)) { best = play; break; }
    }
  }
  return best ? best.cards : null;
}

function findBeatFour(hand, tgt) {
  const gr = groupByRank(hand);
  let best = null;
  for (const fr of RANKS) {
    const fg = (gr[fr]||[]).sort(cardCmp);
    if (fg.length < 4) continue;
    if (rankIdx(fr)*4+3 <= tgt) continue;
    for (const kr of RANKS) {
      if (kr === fr) continue;
      const kg = (gr[kr]||[]);
      if (!kg.length) continue;
      const play = identifyPlay([...fg.slice(0,4), kg.sort(cardCmp)[0]]);
      if (play && play.value > tgt && (!best || play.value < best.value)) { best = play; break; }
    }
  }
  return best ? best.cards : null;
}

function findBeatSF(hand, tgt) {
  const gs = groupBySuit(hand);
  let best = null;
  for (const [, sc] of Object.entries(gs)) {
    if (sc.length < 5) continue;
    const srk = {};
    sc.forEach(c => srk[c.rank] = c);
    for (const w of STRAIGHT_WINDOWS) {
      const combo = w.map(i => srk[RANKS[i]]).filter(Boolean);
      if (combo.length !== 5) continue;
      const play = identifyPlay(combo);
      if (play && play.value > tgt && (!best || play.value < best.value)) best = play;
    }
  }
  return best ? best.cards : null;
}

function findDragon(hand) {
  const gr = groupByRank(hand);
  if (!RANKS.every(r => (gr[r]||[]).length > 0)) return null;
  return RANKS.map(r => gr[r].sort(cardCmp)[0]);
}

// ── AI 策略 ──
function aiChooseFollow(player, round, diff) {
  const { type, tier, value } = round;
  const hand = player.hand;
  let cands = null;

  switch (type) {
    case 'single':      cands = findBeatSingle(hand, value); break;
    case 'pair':        cands = findBeatPair(hand, value);   break;
    case 'triple':      cands = findBeatTriple(hand, value); break;
    case 'straight':
      cands = findBeatStraight(hand, value);
      if (!cands && diff !== 'beginner')
        cands = findBeatFour(hand,-1) || findBeatSF(hand,-1) || findDragon(hand);
      break;
    case 'fullHouse':
      cands = findBeatFullHouse(hand, value);
      if (!cands && diff !== 'beginner')
        cands = findBeatFour(hand,-1) || findBeatSF(hand,-1);
      break;
    case 'fourOfAKind':
      cands = findBeatFour(hand, value);
      if (!cands && diff !== 'beginner') cands = findBeatSF(hand,-1);
      break;
    case 'straightFlush':
      cands = findBeatSF(hand, value); break;
  }

  if (!cands) return null;

  // 出完即獲勝，無論如何都出
  if (player.hand.length - cands.length <= 0) return cands;

  // 策略性跳過機率
  const has2 = cands.some(c => c.rank === '2');
  const passRate = { beginner:0.40, intermediate:0.15, advanced:0.06, boss:0.02 };
  const save2    = { beginner:0.85, intermediate:0.55, advanced:0.30, boss:0.12 };
  if (has2 && player.hand.length > 3 && Math.random() < (save2[diff]||0)) return null;
  if (Math.random() < (passRate[diff]||0)) return null;
  return cands;
}

function aiChooseLead(player, diff) {
  const hand = player.hand;
  const gr   = groupByRank(hand);

  // 一條龍（魔王且13張時）
  if (diff === 'boss') {
    const d = findDragon(hand);
    if (d && hand.length === 13) return d;
  }

  // 快出完時：整手出掉
  if (hand.length <= 3) {
    const p = identifyPlay(hand);
    if (p) return hand;
    for (let cnt = hand.length; cnt >= 1; cnt--) {
      if (identifyPlay(hand.slice(0,cnt))) return hand.slice(0,cnt);
    }
  }

  if (diff === 'beginner') return [[...hand].sort(cardCmp)[0]];

  // 嘗試三條（高級+魔王）
  if (diff === 'advanced' || diff === 'boss') {
    for (const r of RANKS) {
      const g = (gr[r]||[]).sort(cardCmp);
      if (g.length >= 3 && r !== '2') return g.slice(0,3);
    }
  }

  // 對子（中級+）
  for (const r of RANKS) {
    if (r === '2') continue;
    const g = (gr[r]||[]).sort(cardCmp);
    if (g.length >= 2) return g.slice(0,2);
  }

  // 最小單張（保留2）
  const sorted = [...hand].sort(cardCmp);
  const non2   = sorted.filter(c => c.rank !== '2');
  return [non2.length ? non2[0] : sorted[0]];
}

function findPlayContaining(hand, mustCard, round) {
  if (!round) return [mustCard];
  const val = cardVal(mustCard);
  if (round.type === 'single') return val > round.value ? [mustCard] : null;
  if (round.type === 'pair') {
    const gr = groupByRank(hand);
    const g  = (gr[mustCard.rank]||[]).sort(cardCmp);
    if (g.length >= 2 && cardVal(g[1]) > round.value) return g.slice(0,2);
    return null;
  }
  if (round.type === 'triple') {
    const gr = groupByRank(hand);
    const g  = (gr[mustCard.rank]||[]).sort(cardCmp);
    if (g.length >= 3 && cardVal(g[2]) > round.value) return g.slice(0,3);
    return null;
  }
  return null;
}

function aiChoosePlay(player, round, mustClub3, diff) {
  if (mustClub3) {
    const c3 = player.hand.find(c => c.rank==='3' && c.suit==='♣');
    if (!c3) return null;
    return findPlayContaining(player.hand, c3, round) || [c3];
  }
  return round ? aiChooseFollow(player, round, diff) : aiChooseLead(player, diff);
}

// ── 渲染工具 ──
function cardHTML(card, extraCls='') {
  const col = isRed(card.suit) ? 'red' : 'black';
  return `<div class="card ${col} deal-anim ${extraCls}">
    <span class="card-value">${card.rank}</span>
    <span class="card-suit">${card.suit}</span>
  </div>`;
}

function rankBadgeHTML(playerIdx) {
  const pos = finishOrder.indexOf(playerIdx);
  if (pos < 0) return '';
  if (pos === 0) return `<span class="bt-rank-badge bt-rank-1">🥇</span>`;
  if (pos === 1) return `<span class="bt-rank-badge bt-rank-2">🥈</span>`;
  if (pos === 2) return `<span class="bt-rank-badge bt-rank-3">🥉</span>`;
  return `<span class="bt-rank-badge bt-rank-last">💀</span>`;
}

function renderAll() {
  AREA_IDS.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML=''; });
  for (let i = 0; i < players.length; i++) renderPlayer(i);
  renderCenter();
  updateScoreboard();
}

function renderPlayer(idx) {
  const p    = players[idx];
  const pos  = POSITIONS[idx];
  const area = document.getElementById(AREA_IDS[idx]);
  if (!area) return;

  const cfg      = AI_CONFIG[difficulty];
  const isActive = !gameOver && idx === currentTurn;
  const isBtm    = pos === 'bottom';
  const diffLbl  = p.isHuman ? '' : ` [${cfg.name}${cfg.icon}]`;
  const icon     = p.isHuman ? '🧑' : '🤖';

  let cardsHTML = '';

  if (isBtm) {
    const isMyTurn = isActive && !gameOver && !busyLock;
    cardsHTML = `<div class="bt-player-cards" id="bt-human-cards">`;
    p.hand.forEach((c, ci) => {
      const sel = selectedIdxs.includes(ci) ? 'bt-selected' : '';
      cardsHTML += `<div class="card ${isRed(c.suit)?'red':'black'} deal-anim ${sel}"
        data-cidx="${ci}">
        <span class="card-value">${c.rank}</span>
        <span class="card-suit">${c.suit}</span>
      </div>`;
    });
    cardsHTML += '</div>';

  } else if (pos === 'top') {
    cardsHTML = `<div class="bt-ai-top-cards">`;
    p.hand.forEach(() => cardsHTML += `<div class="card facedown bt-ai-top-card"></div>`);
    cardsHTML += '</div>';

  } else {
    cardsHTML = `<div class="bt-ai-side-cards">`;
    p.hand.forEach(() => cardsHTML += `<div class="card facedown bt-ai-side-card"></div>`);
    cardsHTML += '</div>';
  }

  const finished = finishOrder.includes(idx);
  area.innerHTML = `
    <div class="bt-player-box ${isActive?'bt-active':''} ${finished && finishOrder.indexOf(idx)===players.length-1?'bt-out':''}">
      <div class="bt-player-label">
        ${icon} ${p.name}${diffLbl}
        <span class="bt-cnt">(${p.hand.length}張)</span>
        ${rankBadgeHTML(idx)}
      </div>
      ${cardsHTML}
    </div>`;

  // 綁定手牌點選（只針對底部人類）
  if (isBtm && isActive && !gameOver && !busyLock) {
    area.querySelectorAll('.bt-player-cards .card').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => toggleSelect(parseInt(el.dataset.cidx)));
    });
  }
}

function renderCenter() {
  const lpEl    = document.getElementById('bt-last-play');
  const lbEl    = document.getElementById('bt-play-label');
  if (!lpEl || !lbEl) return;

  if (currentRound) {
    const name = players[currentRound.playerId]?.name || '?';
    lbEl.textContent = `${name} 出了 ${TYPE_NAME[currentRound.type]||''}`;
    lpEl.innerHTML   = currentRound.cards.map(c => cardHTML(c)).join('');
  } else {
    lbEl.textContent = '— 新的一輪 —';
    lpEl.innerHTML   = '';
  }
}

function setMessage(text, type='') {
  const el = document.getElementById('message');
  if (el) { el.textContent = text; el.className = 'message ' + type; }
}

function setTurnMsg(text) {
  const el = document.getElementById('bt-turn-indicator');
  if (el) el.textContent = text;
}

function updateScoreboard() {
  const el = document.getElementById('scoreboard-content');
  if (!el) return;
  el.innerHTML = players.map(p =>
    `<div class="score-item">${p.name} <span>${scores[p.name]||0}</span></div>`
  ).join('');
}

function showActions(show) {
  const bar = document.getElementById('bt-actions');
  const shortcuts = document.getElementById('bt-shortcuts');
  if (bar) bar.style.display = show ? 'flex' : 'none';
  if (shortcuts) shortcuts.style.display = show ? 'flex' : 'none';
}

// ── 快捷按鈕：自動找牌並出牌 ──
function playComboByType(typeTarget) {
  if (busyLock || gameOver || currentTurn !== 0) return;
  if (!players[0] || !players[0].hand) return;

  const hand = players[0].hand;
  let cards = null;

  // 根據類型尋找牌
  switch (typeTarget) {
    case 'pair': {
      // 找一對（同花不計）
      const gr = groupByRank(hand);
      for (const rank of RANKS) {
        const g = (gr[rank]||[]).sort(cardCmp);
        if (g.length >= 2) {
          const pair = g.slice(0,2);
          const play = identifyPlay(pair);
          if (play && (!currentRound || (play.cards.length === currentRound.cards.length && play.value > currentRound.value))) {
            cards = pair;
            break;
          }
        }
      }
      break;
    }
    case 'triple': {
      // 找三條
      const gr = groupByRank(hand);
      for (const rank of RANKS) {
        const g = (gr[rank]||[]).sort(cardCmp);
        if (g.length >= 3) {
          const triple = g.slice(0,3);
          const play = identifyPlay(triple);
          if (play && (!currentRound || (play.cards.length === currentRound.cards.length && play.value > currentRound.value))) {
            cards = triple;
            break;
          }
        }
      }
      break;
    }
    case 'straight': {
      // 找順子
      const gr = groupByRank(hand);
      for (const w of STRAIGHT_WINDOWS) {
        const grps = w.map(i => (gr[RANKS[i]]||[]).sort(cardCmp));
        if (grps.every(g => g.length > 0)) {
          const combo = grps.map(g => g[0]);
          const play = identifyPlay(combo);
          if (play && (!currentRound || (play.cards.length === currentRound.cards.length && play.value > currentRound.value))) {
            cards = combo;
            break;
          }
        }
      }
      break;
    }
    case 'fullHouse': {
      // 找葫蘆（三條+對子）
      const gr = groupByRank(hand);
      for (const tr of RANKS) {
        const tg = (gr[tr]||[]).sort(cardCmp);
        if (tg.length < 3) continue;
        for (const pr of RANKS) {
          if (pr === tr) continue;
          const pg = (gr[pr]||[]).sort(cardCmp);
          if (pg.length < 2) continue;
          const combo = [...tg.slice(0,3), ...pg.slice(0,2)];
          const play = identifyPlay(combo);
          if (play && (!currentRound || (play.cards.length === currentRound.cards.length && play.value > currentRound.value))) {
            cards = combo;
            break;
          }
        }
        if (cards) break;
      }
      break;
    }
    case 'four': {
      // 找鐵支（四條+1）
      const gr = groupByRank(hand);
      for (const fr of RANKS) {
        const fg = (gr[fr]||[]).sort(cardCmp);
        if (fg.length < 4) continue;
        for (const kr of RANKS) {
          if (kr === fr) continue;
          const kg = (gr[kr]||[]);
          if (!kg.length) continue;
          const combo = [...fg.slice(0,4), kg.sort(cardCmp)[0]];
          const play = identifyPlay(combo);
          if (play && (!currentRound || (play.cards.length === currentRound.cards.length && play.value > currentRound.value))) {
            cards = combo;
            break;
          }
        }
        if (cards) break;
      }
      break;
    }
    case 'sf': {
      // 找同花順
      const gs = groupBySuit(hand);
      for (const [, sc] of Object.entries(gs)) {
        if (sc.length < 5) continue;
        const srk = {};
        sc.forEach(c => srk[c.rank] = c);
        for (const w of STRAIGHT_WINDOWS) {
          const combo = w.map(i => srk[RANKS[i]]).filter(Boolean);
          if (combo.length !== 5) continue;
          const play = identifyPlay(combo);
          if (play && (!currentRound || (play.cards.length === currentRound.cards.length && play.value > currentRound.value))) {
            cards = combo;
            break;
          }
        }
        if (cards) break;
      }
      break;
    }
  }

  if (!cards) {
    setMessage('❌ 沒有符合條件的牌型', 'lose');
    return;
  }

  const play = identifyPlay(cards);
  busyLock = true;
  showActions(false);
  setMessage('');
  makePlay(0, cards, play);
}

// ── 人類操作 ──
function toggleSelect(cidx) {
  if (busyLock || gameOver || currentTurn !== 0) return;
  const pos = selectedIdxs.indexOf(cidx);
  if (pos >= 0) selectedIdxs.splice(pos, 1);
  else           selectedIdxs.push(cidx);
  renderPlayer(0);
}

function humanPlay() {
  if (busyLock || gameOver || currentTurn !== 0) return;
  if (selectedIdxs.length === 0) { setMessage('請先選擇要出的牌', ''); return; }

  const selected = [...selectedIdxs].sort((a,b)=>a-b).map(i => players[0].hand[i]);
  const play     = identifyPlay(selected);

  if (!play) { setMessage('❌ 無效的牌型組合', 'lose'); return; }

  // 第一輪必含梅花3
  if (isFirstTurn && !selected.find(c => c.rank==='3' && c.suit==='♣')) {
    setMessage('❌ 開局必須含 ♣3（梅花三）', 'lose'); return;
  }

  // 跟牌時張數必須相同
  if (currentRound && play.cards.length !== currentRound.cards.length) {
    setMessage(`❌ 需出 ${currentRound.cards.length} 張`, 'lose'); return;
  }

  // 牌值必須更大
  if (currentRound && !canBeat(play, currentRound)) {
    setMessage('❌ 牌值不夠，出不過', 'lose'); return;
  }

  busyLock = true;
  showActions(false);
  setMessage('');
  makePlay(0, selected, play);
}

function humanPass() {
  if (busyLock || gameOver || currentTurn !== 0) return;
  if (!currentRound) { setMessage('❌ 新一輪必須出牌', 'lose'); return; }
  if (isFirstTurn)   { setMessage('❌ 持有 ♣3 必須出牌', 'lose'); return; }
  busyLock = true;
  showActions(false);
  setMessage('');
  doPass(0);
}

// ── 遊戲流程 ──
function makePlay(pIdx, cards, play) {
  const p = players[pIdx];

  // 從手牌移除已出的牌
  const usedSet = new Set(cards.map(c => c.rank+c.suit));
  p.hand = p.hand.filter(c => !usedSet.has(c.rank+c.suit));

  currentRound = { ...play, playerId: pIdx };
  passCount    = 0;
  if (isFirstTurn) isFirstTurn = false;
  selectedIdxs = [];

  // 出完牌：記錄完成順序，並開啟新一輪供下家自由出牌
  if (p.hand.length === 0 && !finishOrder.includes(pIdx)) {
    finishOrder.push(pIdx);
    // 清除當前出牌記錄，讓下一家可自由出牌
    currentRound = null;
    // 若只剩最後一人，直接記為輸家
    if (finishOrder.length === players.length - 1) {
      const loser = players.findIndex((_,i) => !finishOrder.includes(i));
      if (loser >= 0) finishOrder.push(loser);
    }
  }

  renderAll();
  setMessage(`${p.name} 出了 ${TYPE_NAME[play.type]||''}`, '');

  if (finishOrder.length >= players.length) { setTimeout(endGame, 600); return; }

  setTimeout(() => { busyLock = false; advanceTurn(pIdx); }, p.isHuman ? 300 : 500);
}

function doPass(pIdx) {
  passCount++;
  renderAll();
  setTurnMsg(`${players[pIdx].name} 跳過`);

  const active = players.filter(p => p.hand.length > 0 && !finishOrder.includes(players.indexOf(p))).length;
  // 所有人都跳過（只剩最後出牌者）
  if (passCount >= active - 1) {
    const lastId = currentRound?.playerId ?? 0;
    currentRound = null;
    passCount    = 0;
    setTimeout(() => {
      busyLock = false;
      setMessage('');
      // 找下一位有牌的玩家（從上一輪出牌者開始）
      if (players[lastId] && players[lastId].hand.length > 0 && !finishOrder.includes(lastId)) {
        currentTurn = lastId;
      } else {
        const next = getNextWithCards(lastId);
        if (next < 0) { endGame(); return; }
        currentTurn = next;
      }
      startTurn();
    }, 600);
  } else {
    setTimeout(() => { busyLock = false; advanceTurn(pIdx); }, 400);
  }
}

function getNextWithCards(fromIdx) {
  const n = players.length;
  for (let offset = 1; offset <= n; offset++) {
    const next = (fromIdx + offset) % n;
    if (players[next].hand.length > 0 && !finishOrder.includes(next)) return next;
  }
  return -1;
}

function advanceTurn(fromIdx) {
  const next = getNextWithCards(fromIdx);
  if (next < 0) { endGame(); return; }
  currentTurn = next;
  startTurn();
}

function startTurn() {
  if (gameOver) return;

  const active = players.filter((p,i) => p.hand.length > 0 && !finishOrder.includes(i));
  if (active.length <= 1) { endGame(); return; }

  const cp        = players[currentTurn];
  const hasClub3  = isFirstTurn && cp.hand.some(c => c.rank==='3' && c.suit==='♣');

  renderAll();

  if (cp.isHuman) {
    if (hasClub3) {
      setTurnMsg('👆 你的回合 — 必須出梅花三 ♣3！');
    } else if (currentRound) {
      const n = currentRound.cards.length;
      const typeHint = n===1?'單張':n===2?'對子':n===3?'三條':'五張組合';
      setTurnMsg(`👆 你的回合 — 出更大的${typeHint}，或跳過`);
    } else {
      setTurnMsg('👆 你的回合 — 新一輪，自由出牌');
    }
    selectedIdxs = [];
    showActions(true);
    busyLock = false;
  } else {
    setTurnMsg(`🤖 ${cp.name} 思考中...`);
    showActions(false);
    setTimeout(aiTurn, 650 + Math.random()*550);
  }
}

async function aiTurn() {
  if (gameOver) return;
  const cp       = players[currentTurn];
  busyLock       = true;
  const mustC3   = isFirstTurn && cp.hand.some(c => c.rank==='3' && c.suit==='♣');
  const cards    = aiChoosePlay(cp, currentRound, mustC3, difficulty);

  if (cards && cards.length > 0) {
    const play = identifyPlay(cards);
    if (play && (!currentRound || canBeat(play, currentRound))) {
      await sleep(350);
      makePlay(currentTurn, cards, play);
      return;
    }
  }

  await sleep(350);
  doPass(currentTurn);
}

// ── 結算 ──
function endGame() {
  gameOver = true;
  busyLock = false;
  showActions(false);

  // 補齊排名
  players.forEach((_,i) => { if (!finishOrder.includes(i)) finishOrder.push(i); });

  const winner = finishOrder[0];
  const loser  = finishOrder[finishOrder.length-1];

  if (winner !== undefined) scores[players[winner].name] = (scores[players[winner].name]||0)+1;

  renderAll();
  setTurnMsg('');

  if (players[winner]?.isHuman) {
    setMessage('🎉 恭喜！你第一個出完牌，贏了！', 'win');
  } else if (players[loser]?.isHuman) {
    setMessage(`😱 你是最後一個出完的，輸了！${players[winner]?.name} 獲勝`, 'lose');
  } else {
    setMessage(`🏆 ${players[winner]?.name} 贏了！`, 'draw');
  }

  document.getElementById('btn-new').style.display = 'inline-block';
}

// ── 設定畫面 ──
function initSetup() {
  const diffBtns = document.querySelectorAll('#diff-grid .setup-btn');
  const cntBtns  = document.querySelectorAll('#count-grid .setup-btn');
  const startBtn = document.getElementById('btn-start-game');

  diffBtns.forEach(btn => btn.addEventListener('click', () => {
    diffBtns.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    difficulty = btn.dataset.level;
    startBtn.disabled = !(difficulty && playerCount);
  }));

  cntBtns.forEach(btn => btn.addEventListener('click', () => {
    cntBtns.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    playerCount = parseInt(btn.dataset.count);
    startBtn.disabled = !(difficulty && playerCount);
  }));

  startBtn.addEventListener('click', () => {
    if (!difficulty || !playerCount) return;
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('game-table').classList.add('active');
    startGame();
  });
}

function startGame() {
  gameOver     = false;
  busyLock     = false;
  passCount    = 0;
  isFirstTurn  = true;
  currentRound = null;
  selectedIdxs = [];
  finishOrder  = [];

  // 建立玩家
  players = [{ name:'你', isHuman:true, hand:[] }];
  for (let i = 0; i < playerCount-1; i++)
    players.push({ name:AI_NAMES[i], isHuman:false, hand:[] });

  if (Object.keys(scores).length === 0)
    players.forEach(p => { scores[p.name] = 0; });

  // 發牌
  const deck = shuffle(createDeck());
  deck.forEach((c, i) => players[i % players.length].hand.push(c));
  players.forEach(p => p.hand.sort(cardCmp));

  document.getElementById('btn-new').style.display = 'none';
  setMessage('');
  setTurnMsg('');
  showActions(false);
  updateScoreboard();

  // 持有梅花3的玩家先出牌
  currentTurn = players.findIndex(p => p.hand.some(c => c.rank==='3' && c.suit==='♣'));
  if (currentTurn < 0) currentTurn = 0;

  renderAll();
  startTurn();
}

function newGame() {
  document.getElementById('btn-new').style.display = 'none';
  startGame();
}

function backToSetup() {
  document.getElementById('setup-screen').style.display = '';
  document.getElementById('game-table').classList.remove('active');
  scores = {}; difficulty = null; playerCount = null;
  document.querySelectorAll('.setup-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('btn-start-game').disabled = true;
}

// ── 事件綁定 ──
document.addEventListener('DOMContentLoaded', () => {
  initSetup();
  document.getElementById('btn-play').addEventListener('click', humanPlay);
  document.getElementById('btn-pass').addEventListener('click', humanPass);
  document.getElementById('btn-new').addEventListener('click', newGame);
  document.getElementById('btn-back').addEventListener('click', backToSetup);

  // 快捷按鈕
  document.getElementById('btn-pair').addEventListener('click', () => playComboByType('pair'));
  document.getElementById('btn-triple').addEventListener('click', () => playComboByType('triple'));
  document.getElementById('btn-straight').addEventListener('click', () => playComboByType('straight'));
  document.getElementById('btn-full').addEventListener('click', () => playComboByType('fullHouse'));
  document.getElementById('btn-four').addEventListener('click', () => playComboByType('four'));
  document.getElementById('btn-sf').addEventListener('click', () => playComboByType('sf'));
});
