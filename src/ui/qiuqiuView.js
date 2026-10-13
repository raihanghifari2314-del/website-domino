// QiuQiu table view: deal, reveal, resolve. Simplified MVP flow.
import { tileHTML, playerBadge, toast } from './components.js';
import { QiuQiuGame } from '../engine/qiuqiu.js';
import { randomSeed } from '../core/rng.js';

export function mountQiuQiuTable(root, { players, seed, onExit } = {}) {
  seed = seed ?? randomSeed();
  const game = new QiuQiuGame(players, seed, { ante: 10 });
  let revealed = false;

  root.innerHTML = `
    <div class="table-view">
      <div class="table-top-bar">
        <button class="btn ghost" id="exitBtn">← Keluar</button>
        <div class="mode-pill qq">QIUQIU · 4 Pemain</div>
        <button class="btn ghost" id="dealBtn">Bagi Ulang</button>
      </div>
      <div class="felt qq-felt">
        <div class="pot" id="pot"></div>
        <div class="qq-seats" id="qqSeats"></div>
      </div>
      <div class="hand-dock">
        <div class="hand-actions">
          <button class="btn" id="revealBtn">Buka Kartu</button>
        </div>
        <div class="result-line" id="resultLine"></div>
      </div>
    </div>`;

  const el = {
    seats: root.querySelector('#qqSeats'),
    pot: root.querySelector('#pot'),
    revealBtn: root.querySelector('#revealBtn'),
    resultLine: root.querySelector('#resultLine'),
  };

  function render() {
    const snap = game.snapshot();
    el.pot.innerHTML = `<span class="pot-label">POT</span><span class="pot-val">${snap.pot}</span>`;
    el.seats.innerHTML = snap.players
      .map((p, i) => {
        const showFace = revealed || i === 0;
        const tiles = p.hand
          .map((t) => tileHTML(t, { orientation: 'v', faceDown: !showFace }))
          .join('');
        const resultTag =
          revealed && snap.results.length
            ? `<div class="qq-eval">${snap.results.find((r) => r.idx === i).eval.label}</div>`
            : '';
        const winnerCls = revealed && snap.winner === i ? 'qq-winner' : '';
        return `<div class="qq-seat ${winnerCls}">
          ${playerBadge(p, { active: false })}
          <div class="qq-tiles">${tiles}</div>
          ${resultTag}
        </div>`;
      })
      .join('');
  }

  function reveal() {
    if (revealed) return;
    revealed = true;
    const { winner } = game.resolve();
    render();
    toast(`${game.players[winner].name} memenangkan pot!`, 'success');
    el.resultLine.textContent = `${game.players[winner].name} menang.`;
    el.revealBtn.disabled = true;
  }

  root.querySelector('#exitBtn').addEventListener('click', () => onExit && onExit());
  root.querySelector('#dealBtn').addEventListener('click', () => {
    revealed = false;
    el.revealBtn.disabled = false;
    el.resultLine.textContent = '';
    game.startRound();
    render();
  });
  el.revealBtn.addEventListener('click', reveal);

  game.startRound();
  render();
  return { game, destroy: () => (root.innerHTML = '') };
}
