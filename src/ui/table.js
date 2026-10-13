// Gaple table view: renders board, 4 players, local player's hand, and drives turns vs bots.
import { tileHTML, playerBadge, toast } from './components.js';
import { GapleGame } from '../engine/gaple.js';
import { gapleBotMove } from '../ai/bots.js';
import { randomSeed } from '../core/rng.js';

const BOT_DELAY = 650;

export function mountGapleTable(root, { players, seed, onExit, onMatchOver } = {}) {
  seed = seed ?? randomSeed();
  const game = new GapleGame(players, seed, { drawMode: false, targetScore: 100 });
  let selectedTileId = null;

  root.innerHTML = `
    <div class="table-view">
      <div class="table-top-bar">
        <button class="btn ghost" id="exitBtn">← Keluar</button>
        <div class="mode-pill">GAPLE · 4 Pemain</div>
        <button class="btn ghost" id="newRoundBtn">Ronde Baru</button>
      </div>
      <div class="felt" id="felt">
        <div class="seat seat-top" id="seat-2"></div>
        <div class="seat seat-left" id="seat-1"></div>
        <div class="seat seat-right" id="seat-3"></div>
        <div class="seat seat-bottom" id="seat-0"></div>
        <div class="board-wrap"><div class="board" id="board"></div></div>
        <div class="turn-indicator" id="turnIndicator"></div>
      </div>
      <div class="hand-dock">
        <div class="hand-actions">
          <button class="btn" id="playBtn" disabled>Mainkan</button>
          <button class="btn warn" id="passBtn">Pass</button>
        </div>
        <div class="hand" id="hand"></div>
      </div>
    </div>`;

  const el = {
    board: root.querySelector('#board'),
    hand: root.querySelector('#hand'),
    turnIndicator: root.querySelector('#turnIndicator'),
    playBtn: root.querySelector('#playBtn'),
    passBtn: root.querySelector('#passBtn'),
  };

  function renderSeats(snap) {
    const positions = { 0: 'bottom', 1: 'left', 2: 'top', 3: 'right' };
    snap.players.forEach((p, i) => {
      const seat = root.querySelector(`#seat-${i}`);
      const active = snap.turn === i && snap.phase === 'playing';
      const backs =
        i === 0
          ? ''
          : `<div class="opp-hand">${Array.from({ length: p.handCount })
              .map(() => tileHTML({ id: 'x' }, { orientation: 'v', faceDown: true }))
              .join('')}</div>`;
      seat.innerHTML = playerBadge(p, { active, position: positions[i] }) + backs;
    });
  }

  function renderBoard(snap) {
    if (snap.line.length === 0) {
      el.board.innerHTML = `<div class="board-empty">Papan kosong — pembuka memulai</div>`;
      return;
    }
    el.board.innerHTML = snap.line
      .map((t) => tileHTML(t, { orientation: 'h' }))
      .join('');
    el.board.scrollLeft = el.board.scrollWidth / 2 - el.board.clientWidth / 2;
  }

  function renderHand(snap) {
    const me = game.players[0];
    const legal = snap.turn === 0 && snap.phase === 'playing' ? game.legalMoves(0) : [];
    const legalIds = new Set(legal.map((m) => m.tile.id));
    el.hand.innerHTML = me.hand
      .map((t) =>
        tileHTML(t, {
          orientation: 'v',
          playable: legalIds.has(t.id),
          selected: t.id === selectedTileId,
        })
      )
      .join('');
    el.hand.querySelectorAll('.tile').forEach((node) => {
      node.addEventListener('click', () => {
        if (!node.classList.contains('playable')) {
          toast('Tile itu tidak bisa dimainkan sekarang', 'warn');
          return;
        }
        selectedTileId = node.dataset.id;
        renderHand(game.snapshot());
        el.playBtn.disabled = false;
      });
    });
    const myTurn = snap.turn === 0 && snap.phase === 'playing';
    el.passBtn.disabled = !myTurn || game.canPlay(0);
    el.playBtn.disabled = !myTurn || !selectedTileId;
  }

  function renderTurn(snap) {
    if (snap.phase === 'match_over') {
      el.turnIndicator.textContent = `🏆 ${game.players[snap.matchWinner].name} juara match!`;
      return;
    }
    if (snap.phase === 'round_over') {
      el.turnIndicator.textContent = `Ronde selesai — ${game.players[snap.roundWinner].name} menang`;
      return;
    }
    const p = game.players[snap.turn];
    el.turnIndicator.textContent = p.isBot ? `${p.name} berpikir…` : 'Giliran kamu';
  }

  function renderAll() {
    const snap = game.snapshot();
    renderSeats(snap);
    renderBoard(snap);
    renderHand(snap);
    renderTurn(snap);
  }

  function playSelected(end) {
    if (!selectedTileId) return;
    const me = game.players[0];
    const tile = me.hand.find((t) => t.id === selectedTileId);
    if (!tile) return;
    const legal = game.legalMoves(0).filter((m) => m.tile.id === tile.id);
    const chosenEnd = end || (legal.length === 1 ? legal[0].end : null);
    if (!chosenEnd && legal.length > 1) {
      // Ask which end via quick prompt (left/right)
      showEndPicker(tile, legal);
      return;
    }
    const res = game.applyAction({ type: 'play', tile, end: chosenEnd || legal[0].end });
    if (!res.ok) {
      toast('Gerakan tidak valid', 'warn');
      return;
    }
    selectedTileId = null;
    renderAll();
    maybeBotLoop();
  }

  function showEndPicker(tile, legal) {
    const picker = document.createElement('div');
    picker.className = 'end-picker';
    picker.innerHTML = `
      <div class="end-picker-inner">
        <p>Taruh [${tile.a}|${tile.b}] di ujung mana?</p>
        <div class="end-btns">
          <button class="btn" data-end="left">⟵ Kiri (${game.state.leftEnd})</button>
          <button class="btn" data-end="right">Kanan (${game.state.rightEnd}) ⟶</button>
        </div>
      </div>`;
    picker.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        picker.remove();
        playSelected(b.dataset.end);
      })
    );
    root.querySelector('.table-view').appendChild(picker);
  }

  function maybeBotLoop() {
    const snap = game.snapshot();
    if (snap.phase !== 'playing') {
      if (snap.phase === 'match_over' && onMatchOver) onMatchOver(snap.matchWinner);
      return;
    }
    if (snap.turn === 0) return; // wait for human
    setTimeout(() => {
      const action = gapleBotMove(game, game.state.turn);
      const res = game.applyAction(action);
      if (!res.ok && action.type === 'play') {
        // fallback: pass
        game.applyAction({ type: 'pass' });
      }
      renderAll();
      maybeBotLoop();
    }, BOT_DELAY);
  }

  // Wire controls
  root.querySelector('#exitBtn').addEventListener('click', () => onExit && onExit());
  root.querySelector('#newRoundBtn').addEventListener('click', () => {
    game.startRound();
    selectedTileId = null;
    renderAll();
    maybeBotLoop();
  });
  el.playBtn.addEventListener('click', () => playSelected());
  el.passBtn.addEventListener('click', () => {
    const res = game.applyAction({ type: 'pass' });
    if (!res.ok) {
      toast('Kamu masih punya langkah legal', 'warn');
      return;
    }
    renderAll();
    maybeBotLoop();
  });

  // Engine events for round transitions
  game.on('round_over', ({ winner, gained, reason }) => {
    toast(`${game.players[winner].name} menang ronde (+${gained}, ${reason})`, 'success');
  });
  game.on('match_over', ({ winner }) => {
    toast(`🏆 ${game.players[winner].name} juara match!`, 'success');
  });

  game.startRound();
  renderAll();
  maybeBotLoop();

  return { game, destroy: () => (root.innerHTML = '') };
}
