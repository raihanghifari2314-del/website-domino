// Tournament bracket view (single-elimination) using Gaple matches.
import { createBracket, reportResult, resolveByes } from '../tournament/bracket.js';
import { store } from '../store/storage.js';
import { toast } from './components.js';

export function mountTournamentView(root, { profile, onPlayMatch, onExit } = {}) {
  let bracket = store.get('tournament');

  function startNew() {
    const participants = [
      { id: 'you', name: profile.name || 'Kamu', isBot: false },
      { id: 'b1', name: 'Budi', isBot: true },
      { id: 'b2', name: 'Sari', isBot: true },
      { id: 'b3', name: 'Andi', isBot: true },
      { id: 'b4', name: 'Dewi', isBot: true },
      { id: 'b5', name: 'Rudi', isBot: true },
      { id: 'b6', name: 'Nina', isBot: true },
      { id: 'b7', name: 'Tono', isBot: true },
    ];
    bracket = createBracket(participants);
    resolveByes(bracket, (r, m, w) => reportResult(bracket, r, m, w));
    store.set('tournament', bracket);
    render();
  }

  function findNextHumanMatch() {
    for (let r = 0; r < bracket.rounds.length; r++) {
      for (let m = 0; m < bracket.rounds[r].length; m++) {
        const match = bracket.rounds[r][m];
        if (match.winner) continue;
        if (!match.a || !match.b) continue;
        const human = (match.a && !match.a.isBot) || (match.b && !match.b.isBot);
        if (human) return { r, m, match };
      }
    }
    return null;
  }

  function autoSimBotMatches() {
    // Resolve any bot-vs-bot matches that are ready, round by round.
    let changed = true;
    while (changed) {
      changed = false;
      for (let r = 0; r < bracket.rounds.length; r++) {
        for (let m = 0; m < bracket.rounds[r].length; m++) {
          const match = bracket.rounds[r][m];
          if (match.winner || !match.a || !match.b) continue;
          const human = (!match.a.isBot) || (!match.b.isBot);
          if (human) continue;
          // random-ish deterministic winner
          const w = (match.a.id.length + match.b.id.length) % 2 === 0 ? match.a : match.b;
          reportResult(bracket, r, m, w);
          changed = true;
        }
      }
    }
    store.set('tournament', bracket);
  }

  function render() {
    if (!bracket) {
      root.innerHTML = `
        <div class="tourney-view">
          <div class="table-top-bar">
            <button class="btn ghost" id="exitBtn">← Lobby</button>
            <div class="mode-pill tr">TURNAMEN</div>
            <span></span>
          </div>
          <div class="tourney-empty">
            <h2>Mode Turnamen</h2>
            <p>Single-elimination, 8 peserta. Menangkan setiap match untuk jadi juara.</p>
            <button class="btn big" id="startBtn">Mulai Turnamen Baru</button>
          </div>
        </div>`;
      root.querySelector('#startBtn').addEventListener('click', startNew);
      root.querySelector('#exitBtn').addEventListener('click', () => onExit && onExit());
      return;
    }

    autoSimBotMatches();

    const roundNames = ['Perempat Final', 'Semifinal', 'Final', 'Juara'];
    const columns = bracket.rounds
      .map((round, r) => {
        const matches = round
          .map((match, m) => {
            const a = match.a ? match.a.name : '—';
            const b = match.b ? match.b.name : '—';
            const aW = match.winner && match.a && match.winner.id === match.a.id;
            const bW = match.winner && match.b && match.winner.id === match.b.id;
            return `<div class="bracket-match">
              <div class="bm-row ${aW ? 'win' : ''}">${a}</div>
              <div class="bm-row ${bW ? 'win' : ''}">${b}</div>
            </div>`;
          })
          .join('');
        return `<div class="bracket-col"><div class="bracket-title">${
          roundNames[r] || `Ronde ${r + 1}`
        }</div>${matches}</div>`;
      })
      .join('');

    const champ = bracket.champion;
    const next = findNextHumanMatch();

    root.innerHTML = `
      <div class="tourney-view">
        <div class="table-top-bar">
          <button class="btn ghost" id="exitBtn">← Lobby</button>
          <div class="mode-pill tr">TURNAMEN</div>
          <button class="btn ghost" id="resetBtn">Reset</button>
        </div>
        <div class="bracket">${columns}</div>
        <div class="tourney-footer">
          ${
            champ
              ? `<div class="champ-banner">🏆 Juara: <b>${champ.name}</b></div>`
              : next
              ? `<button class="btn big" id="playBtn">Main Match Kamu →</button>`
              : `<div class="info">Menunggu match berikutnya…</div>`
          }
        </div>
      </div>`;

    root.querySelector('#exitBtn').addEventListener('click', () => onExit && onExit());
    root.querySelector('#resetBtn')?.addEventListener('click', () => {
      store.remove('tournament');
      bracket = null;
      render();
    });
    const playBtn = root.querySelector('#playBtn');
    if (playBtn && next) {
      playBtn.addEventListener('click', () => {
        const opp = next.match.a && !next.match.a.isBot ? next.match.b : next.match.a;
        const you = next.match.a && !next.match.a.isBot ? next.match.a : next.match.b;
        onPlayMatch &&
          onPlayMatch({
            tablePlayers: buildTablePlayers(you, opp),
            onResult: (humanWon) => {
              const winner = humanWon ? you : opp;
              reportResult(bracket, next.r, next.m, winner);
              store.set('tournament', bracket);
              if (humanWon) toast('Kamu menang! Maju ke ronde berikutnya.', 'success');
              else toast('Kamu kalah. Turnamen berakhir untukmu.', 'warn');
              render();
            },
          });
      });
    }
  }

  // A tournament "match" is a Gaple table. Fill 4 seats: you, your opponent, +2 fillers.
  function buildTablePlayers(you, opp) {
    return [
      { id: you.id, name: you.name, isBot: false },
      { id: 'f1', name: 'Pendamping 1', isBot: true },
      { id: opp.id, name: opp.name, isBot: true },
      { id: 'f2', name: 'Pendamping 2', isBot: true },
    ];
  }

  render();
  return { destroy: () => (root.innerHTML = '') };
}
