// Reusable render helpers: domino tiles, pip layouts, player badges.

const PIP_POS = {
  0: [],
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [25, 75], [75, 25], [75, 75]],
  5: [[25, 25], [25, 75], [50, 50], [75, 25], [75, 75]],
  6: [[25, 25], [25, 50], [25, 75], [75, 25], [75, 50], [75, 75]],
};

function half(value) {
  const pips = (PIP_POS[value] || [])
    .map(([x, y]) => `<span class="pip" style="left:${x}%;top:${y}%"></span>`)
    .join('');
  return `<div class="tile-half" data-v="${value}">${pips}</div>`;
}

// orientation: 'h' horizontal (board), 'v' vertical (hand)
export function tileHTML(tile, { orientation = 'v', playable = false, selected = false, faceDown = false } = {}) {
  const cls = [
    'tile',
    orientation === 'h' ? 'tile-h' : 'tile-v',
    playable ? 'playable' : '',
    selected ? 'selected' : '',
    faceDown ? 'face-down' : '',
  ]
    .filter(Boolean)
    .join(' ');
  if (faceDown) {
    return `<div class="${cls}" data-id="${tile.id}"><div class="tile-back"></div></div>`;
  }
  return `<div class="${cls}" data-id="${tile.id}">${half(tile.a)}<div class="tile-divider"></div>${half(tile.b)}</div>`;
}

export function playerBadge(p, { active = false, position = '' } = {}) {
  const avatarChar = (p.name || '?').charAt(0).toUpperCase();
  const sub = p.isBot ? 'BOT' : 'YOU';
  const score = p.score != null ? `${p.score} pts` : p.chips != null ? `${p.chips} chips` : '';
  return `
    <div class="player-badge ${active ? 'active' : ''} pos-${position}">
      <div class="avatar">${avatarChar}</div>
      <div class="player-meta">
        <div class="player-name">${p.name} <span class="tag">${sub}</span></div>
        <div class="player-score">${score}</div>
      </div>
    </div>`;
}

export function toast(msg, type = 'info') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.className = 'toast'), 2200);
}
