/* Domino Island — standalone bundle (no ES modules, no server needed).
   This is a concatenated, dependency-free build of the modular src/ codebase
   so index.html / play.html can be opened directly from the filesystem.
   The authoritative, modular source lives in src/ (see ARCHITECTURE.md). */
(function () {
  'use strict';

  /* ================= settings (localStorage-backed) ================= */
  const SETTINGS_KEY = 'domino-island:settings';
  function loadSettings() {
    try {
      return Object.assign(
        { sound: true, difficulty: 'normal' },
        JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}
      );
    } catch (e) {
      return { sound: true, difficulty: 'normal' };
    }
  }
  function saveSettings(s) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch (e) {}
  }
  const settings = loadSettings();

  /* ================= sound (WebAudio, zero asset files) ================= */
  const Sound = (function () {
    let ctx = null;
    function ac() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctx = new AC();
      }
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function blip(freq, dur, type, gain) {
      if (!settings.sound) return;
      const c = ac();
      if (!c) return;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.value = gain == null ? 0.08 : gain;
      o.connect(g);
      g.connect(c.destination);
      const now = c.currentTime;
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.start(now);
      o.stop(now + dur);
    }
    return {
      unlock: ac,
      click: () => blip(520, 0.06, 'triangle', 0.05),
      place: () => {
        blip(300, 0.08, 'square', 0.06);
        setTimeout(() => blip(180, 0.12, 'sine', 0.07), 40);
      },
      pass: () => blip(220, 0.14, 'sawtooth', 0.04),
      deal: () => blip(440, 0.05, 'triangle', 0.04),
      win: () => {
        [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.07), i * 110));
      },
      lose: () => {
        [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.2, 'sine', 0.07), i * 130));
      },
    };
  })();

  function buzz(pattern) {
    if (settings.sound && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }
  }

  /* ================= confetti (canvas overlay) ================= */
  function confettiBurst(durationMs) {
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    document.body.appendChild(canvas);
    const dpr = window.devicePixelRatio || 1;
    function resize() {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    }
    resize();
    const g = canvas.getContext('2d');
    const colors = ['#ff8a3d', '#ff5e7e', '#28e0c0', '#ffd23f', '#4d9bff', '#a76bff', '#2fd27a'];
    const parts = [];
    const N = 160;
    for (let i = 0; i < N; i++) {
      parts.push({
        x: Math.random() * canvas.width,
        y: -Math.random() * canvas.height * 0.4,
        vx: (Math.random() - 0.5) * 6 * dpr,
        vy: (2 + Math.random() * 4) * dpr,
        size: (4 + Math.random() * 6) * dpr,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: colors[(Math.random() * colors.length) | 0],
      });
    }
    const end = performance.now() + (durationMs || 2200);
    function frame(now) {
      g.clearRect(0, 0, canvas.width, canvas.height);
      parts.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05 * dpr;
        p.rot += p.vr;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.fillStyle = p.color;
        g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        g.restore();
      });
      if (now < end) requestAnimationFrame(frame);
      else canvas.remove();
    }
    requestAnimationFrame(frame);
  }

  /* ================= win/result overlay ================= */
  function showResultOverlay(opts) {
    // opts: { title, subtitle, rows:[{name,detail,win}], youWon, onAgain, againLabel }
    const prev = document.querySelector('.result-overlay');
    if (prev) prev.remove();
    const ov = document.createElement('div');
    ov.className = 'result-overlay';
    const rows = (opts.rows || [])
      .map(
        (r) =>
          '<div class="ro-row ' + (r.win ? 'win' : '') + '"><span>' + r.name + '</span><b>' + r.detail + '</b></div>'
      )
      .join('');
    ov.innerHTML =
      '<div class="result-card ' + (opts.youWon ? 'you-won' : 'you-lost') + '">' +
      '<div class="ro-emoji">' + (opts.youWon ? '\uD83C\uDFC6' : '\uD83C\uDFC1') + '</div>' +
      '<h2>' + opts.title + '</h2>' +
      (opts.subtitle ? '<p class="ro-sub">' + opts.subtitle + '</p>' : '') +
      (rows ? '<div class="ro-rows">' + rows + '</div>' : '') +
      '<button class="btn big" id="roAgain">' + (opts.againLabel || 'Main Lagi') + '</button>' +
      '</div>';
    document.body.appendChild(ov);
    if (opts.youWon) {
      confettiBurst(2400);
      Sound.win();
      buzz([30, 40, 30, 40, 60]);
    } else {
      Sound.lose();
      buzz(120);
    }
    ov.querySelector('#roAgain').addEventListener('click', () => {
      ov.remove();
      if (opts.onAgain) opts.onAgain();
    });
    ov.addEventListener('click', (e) => {
      if (e.target === ov) ov.remove();
    });
  }

  /* ================= core/rng ================= */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randomSeed() {
    return (Math.random() * 2 ** 32) >>> 0;
  }
  function shuffle(array, rng) {
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ================= core/domino ================= */
  function makeTile(a, b) {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return { a: lo, b: hi, id: lo + '-' + hi };
  }
  function isDouble(t) {
    return t.a === t.b;
  }
  function pipSum(t) {
    return t.a + t.b;
  }
  function fullDeck() {
    const deck = [];
    for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) deck.push(makeTile(a, b));
    return deck;
  }
  function deal(rng, hands, perHand) {
    hands = hands || 4;
    perHand = perHand || 7;
    const deck = shuffle(fullDeck(), rng);
    const result = [];
    let idx = 0;
    for (let h = 0; h < hands; h++) {
      result.push(deck.slice(idx, idx + perHand));
      idx += perHand;
    }
    return { hands: result, boneyard: deck.slice(idx) };
  }
  function tileMatchesEnd(tile, end) {
    return tile.a === end || tile.b === end;
  }
  function handPips(hand) {
    return hand.reduce((s, t) => s + pipSum(t), 0);
  }

  /* ================= core/events ================= */
  class Emitter {
    constructor() {
      this._h = new Map();
    }
    on(type, fn) {
      if (!this._h.has(type)) this._h.set(type, new Set());
      this._h.get(type).add(fn);
      return () => this.off(type, fn);
    }
    off(type, fn) {
      const s = this._h.get(type);
      if (s) s.delete(fn);
    }
    emit(type, payload) {
      const s = this._h.get(type);
      if (s) s.forEach((fn) => fn(payload));
      const star = this._h.get('*');
      if (star) star.forEach((fn) => fn({ type, payload }));
    }
  }

  /* ================= store/storage ================= */
  const SKEY = 'domino-island:v1';
  function readAll() {
    try {
      return JSON.parse(localStorage.getItem(SKEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function writeAll(obj) {
    try {
      localStorage.setItem(SKEY, JSON.stringify(obj));
    } catch (e) {}
  }
  const store = {
    get(key, fb) {
      const all = readAll();
      return key in all ? all[key] : fb === undefined ? null : fb;
    },
    set(key, value) {
      const all = readAll();
      all[key] = value;
      writeAll(all);
    },
    remove(key) {
      const all = readAll();
      delete all[key];
      writeAll(all);
    },
  };
  function getProfile() {
    let p = store.get('profile');
    if (!p) {
      p = { name: 'Pemain', chips: 1000, wins: 0, created: Date.now() };
      store.set('profile', p);
    }
    return p;
  }
  function saveProfile(p) {
    store.set('profile', p);
  }

  /* ================= engine/gaple ================= */
  class GapleGame extends Emitter {
    constructor(players, seed, opts) {
      super();
      opts = opts || {};
      if (players.length !== 4) throw new Error('Gaple requires exactly 4 players');
      this.seed = seed >>> 0;
      this.rng = mulberry32(this.seed);
      this.drawMode = !!opts.drawMode;
      this.targetScore = opts.targetScore || 100;
      this.players = players.map((p) => Object.assign({}, p, { hand: [], score: 0 }));
      this.state = {
        mode: 'gaple',
        seed: this.seed,
        phase: 'idle',
        turn: 0,
        line: [],
        leftEnd: null,
        rightEnd: null,
        boneyard: [],
        passes: 0,
        roundWinner: null,
        matchWinner: null,
        log: [],
      };
    }
    log(m) {
      this.state.log.push(m);
      this.emit('log', m);
    }
    startRound() {
      const d = deal(this.rng, 4, 7);
      this.players.forEach((p, i) => (p.hand = d.hands[i]));
      this.state.line = [];
      this.state.leftEnd = null;
      this.state.rightEnd = null;
      this.state.boneyard = d.boneyard;
      this.state.passes = 0;
      this.state.roundWinner = null;
      this.state.phase = 'playing';
      this.state.turn = this._openingPlayer();
      this.log('Ronde dimulai. Pembuka: ' + this.players[this.state.turn].name);
      this.emit('round_started', this.snapshot());
    }
    _openingPlayer() {
      let best = { player: 0, value: -1, isDbl: false };
      this.players.forEach((p, i) => {
        p.hand.forEach((t) => {
          const dbl = isDouble(t);
          const val = pipSum(t);
          const better = (dbl && !best.isDbl) || (dbl === best.isDbl && val > best.value);
          if (better) best = { player: i, value: val, isDbl: dbl };
        });
      });
      return best.player;
    }
    legalMoves(playerIdx) {
      const p = this.players[playerIdx];
      if (this.state.line.length === 0) return p.hand.map((t) => ({ tile: t, end: 'start' }));
      const moves = [];
      p.hand.forEach((t) => {
        if (tileMatchesEnd(t, this.state.leftEnd)) moves.push({ tile: t, end: 'left' });
        if (tileMatchesEnd(t, this.state.rightEnd)) moves.push({ tile: t, end: 'right' });
      });
      return moves;
    }
    canPlay(i) {
      return this.legalMoves(i).length > 0;
    }
    applyAction(action) {
      if (this.state.phase !== 'playing') return { ok: false, reason: 'not_playing' };
      const idx = this.state.turn;
      const player = this.players[idx];
      if (action.type === 'play') {
        const legal = this.legalMoves(idx);
        const match = legal.find(
          (m) => m.tile.id === action.tile.id && (action.end ? m.end === action.end : true)
        );
        if (!match) return { ok: false, reason: 'illegal_move' };
        this._placeTile(player, match.tile, match.end);
        this.state.passes = 0;
        this.log(player.name + ' memainkan [' + match.tile.a + '|' + match.tile.b + ']');
        this.emit('tile_played', { player: idx, tile: match.tile, end: match.end });
        if (player.hand.length === 0) return this._endRound(idx, 'domino');
        this._advanceTurn();
        return { ok: true };
      }
      if (action.type === 'draw') {
        if (!this.drawMode || this.state.boneyard.length === 0)
          return { ok: false, reason: 'cannot_draw' };
        player.hand.push(this.state.boneyard.pop());
        this.emit('tile_drawn', { player: idx });
        return { ok: true, drew: true };
      }
      if (action.type === 'pass') {
        if (this.canPlay(idx)) return { ok: false, reason: 'must_play' };
        this.state.passes += 1;
        this.log(player.name + ' pass');
        this.emit('passed', { player: idx });
        if (this.state.passes >= this.players.length) return this._endRoundBlocked();
        this._advanceTurn();
        return { ok: true };
      }
      return { ok: false, reason: 'unknown_action' };
    }
    _placeTile(player, tile, end) {
      player.hand = player.hand.filter((t) => t.id !== tile.id);
      if (this.state.line.length === 0) {
        this.state.line.push(Object.assign({}, tile));
        this.state.leftEnd = tile.a;
        this.state.rightEnd = tile.b;
        return;
      }
      if (end === 'left') {
        const open = this.state.leftEnd;
        const outer = tile.a === open ? tile.b : tile.a;
        this.state.line.unshift({ a: outer, b: open });
        this.state.leftEnd = outer;
      } else {
        const open = this.state.rightEnd;
        const outer = tile.a === open ? tile.b : tile.a;
        this.state.line.push({ a: open, b: outer });
        this.state.rightEnd = outer;
      }
    }
    _advanceTurn() {
      this.state.turn = (this.state.turn + 1) % this.players.length;
      this.emit('turn_changed', { turn: this.state.turn });
    }
    _endRound(winnerIdx, reason) {
      this.state.phase = 'round_over';
      this.state.roundWinner = winnerIdx;
      let gained = 0;
      this.players.forEach((p, i) => {
        if (i !== winnerIdx) gained += handPips(p.hand);
      });
      this.players[winnerIdx].score += gained;
      this.log(this.players[winnerIdx].name + ' menang ronde (' + reason + ') +' + gained);
      this.emit('round_over', {
        winner: winnerIdx,
        gained: gained,
        reason: reason,
        snapshot: this.snapshot(),
      });
      this._maybeEndMatch();
      return { ok: true, roundOver: true, winner: winnerIdx };
    }
    _endRoundBlocked() {
      let winnerIdx = 0;
      let lowest = Infinity;
      this.players.forEach((p, i) => {
        const v = handPips(p.hand);
        if (v < lowest) {
          lowest = v;
          winnerIdx = i;
        }
      });
      this.log('Permainan buntu. Pip terendah: ' + this.players[winnerIdx].name);
      return this._endRound(winnerIdx, 'blocked');
    }
    _maybeEndMatch() {
      const champ = this.players.findIndex((p) => p.score >= this.targetScore);
      if (champ >= 0) {
        this.state.phase = 'match_over';
        this.state.matchWinner = champ;
        this.log(this.players[champ].name + ' memenangkan match!');
        this.emit('match_over', { winner: champ, snapshot: this.snapshot() });
      }
    }
    snapshot() {
      return Object.assign({}, this.state, {
        line: this.state.line.map((t) => Object.assign({}, t)),
        players: this.players.map((p) => ({
          id: p.id,
          name: p.name,
          isBot: p.isBot,
          score: p.score,
          handCount: p.hand.length,
          hand: p.hand.map((t) => Object.assign({}, t)),
        })),
      });
    }
  }

  /* ================= engine/qiuqiu ================= */
  function pairValue(a, b) {
    return (pipSum(a) + pipSum(b)) % 10;
  }
  function evaluateHand(hand) {
    if (hand.length !== 4) throw new Error('QiuQiu hand must be 4 tiles');
    const totalPips = hand.reduce((s, t) => s + pipSum(t), 0);
    const doubles = hand.filter(isDouble).length;
    if (doubles === 4) return { rank: 4, label: 'Balak (4 Dewa)', v1: 0, v2: 0, score: 400 };
    if (totalPips >= 40) return { rank: 3, label: 'Enam Dewa', v1: 0, v2: 0, score: 300 };
    if (totalPips <= 9) return { rank: 2, label: 'Murni Kecil', v1: 0, v2: 0, score: 200 };
    const t = hand;
    const splits = [
      [[t[0], t[1]], [t[2], t[3]]],
      [[t[0], t[2]], [t[1], t[3]]],
      [[t[0], t[3]], [t[1], t[2]]],
    ];
    let best = { v1: -1, v2: -1, metric: -1 };
    for (const s of splits) {
      const v1 = pairValue(s[0][0], s[0][1]);
      const v2 = pairValue(s[1][0], s[1][1]);
      const metric = Math.max(v1, v2) * 10 + Math.min(v1, v2);
      if (metric > best.metric) best = { v1: v1, v2: v2, metric: metric };
    }
    const hi = Math.max(best.v1, best.v2);
    const lo = Math.min(best.v1, best.v2);
    const label = hi === 9 && lo === 9 ? 'QiuQiu (9-9)' : hi + '-' + lo;
    return { rank: 1, label: label, v1: hi, v2: lo, score: 100 + hi * 10 + lo };
  }
  class QiuQiuGame extends Emitter {
    constructor(players, seed, opts) {
      super();
      opts = opts || {};
      if (players.length !== 4) throw new Error('QiuQiu requires exactly 4 players');
      this.seed = seed >>> 0;
      this.rng = mulberry32(this.seed);
      this.ante = opts.ante || 10;
      this.players = players.map((p) =>
        Object.assign({}, p, { hand: [], chips: p.chips != null ? p.chips : 500 })
      );
      this.state = { mode: 'qiuqiu', seed: this.seed, phase: 'idle', pot: 0, results: [], log: [] };
    }
    log(m) {
      this.state.log.push(m);
      this.emit('log', m);
    }
    startRound() {
      const d = deal(this.rng, 4, 4);
      this.players.forEach((p, i) => {
        p.hand = d.hands[i];
        p.chips -= this.ante;
      });
      this.state.pot = this.ante * 4;
      this.state.phase = 'reveal';
      this.state.results = [];
      this.log('Ronde QiuQiu dimulai. Pot: ' + this.state.pot);
      this.emit('round_started', this.snapshot());
    }
    resolve() {
      const evals = this.players.map((p, i) => ({ idx: i, name: p.name, eval: evaluateHand(p.hand) }));
      evals.sort((a, b) => b.eval.score - a.eval.score);
      const winner = evals[0];
      this.players[winner.idx].chips += this.state.pot;
      this.state.phase = 'round_over';
      this.state.results = evals;
      this.state.winner = winner.idx;
      this.log(winner.name + ' menang dengan ' + winner.eval.label + ' (+' + this.state.pot + ')');
      this.emit('round_over', { winner: winner.idx, results: evals, snapshot: this.snapshot() });
      return { winner: winner.idx, results: evals };
    }
    snapshot() {
      return Object.assign({}, this.state, {
        players: this.players.map((p) => ({
          id: p.id,
          name: p.name,
          isBot: p.isBot,
          chips: p.chips,
          hand: p.hand.map((t) => Object.assign({}, t)),
        })),
      });
    }
  }

  /* ================= ai/bots ================= */
  function gapleBotMove(game, playerIdx, difficulty) {
    difficulty = difficulty || 'normal';
    const moves = game.legalMoves(playerIdx);
    if (moves.length === 0) {
      if (game.drawMode && game.state.boneyard.length > 0) return { type: 'draw' };
      return { type: 'pass' };
    }
    // Easy: random legal move.
    if (difficulty === 'easy') {
      const pick = moves[(Math.random() * moves.length) | 0];
      return { type: 'play', tile: pick.tile, end: pick.end };
    }
    // Count how many of each pip value remain in this bot's own hand (for Hard planning).
    const myHand = game.players[playerIdx].hand;
    function pipCountInHand(v) {
      let c = 0;
      myHand.forEach((t) => {
        if (t.a === v) c++;
        if (t.b === v) c++;
      });
      return c;
    }
    const ranked = moves
      .map((m) => {
        let score = pipSum(m.tile) + (isDouble(m.tile) ? 2 : 0);
        if (difficulty === 'hard') {
          // Prefer plays that leave an open end matching values we still hold many of,
          // so we keep future options; also dump heavy tiles early.
          const open = m.end === 'left' ? game.state.leftEnd : game.state.rightEnd;
          const outer = m.tile.a === open ? m.tile.b : m.tile.a;
          score += pipCountInHand(outer) * 1.5;
          score += pipSum(m.tile) * 0.5; // emphasise shedding points
        }
        return { m: m, score: score };
      })
      .sort((a, b) => b.score - a.score);
    return { type: 'play', tile: ranked[0].m.tile, end: ranked[0].m.end };
  }

  /* ================= tournament/bracket ================= */
  function createBracket(participants) {
    let size = 1;
    while (size < participants.length) size *= 2;
    const seeded = participants.slice();
    while (seeded.length < size) seeded.push(null);
    const rounds = [];
    let current = [];
    for (let i = 0; i < seeded.length; i += 2)
      current.push({ a: seeded[i], b: seeded[i + 1], winner: null });
    rounds.push(current);
    let n = current.length;
    while (n > 1) {
      n = Math.floor(n / 2);
      const arr = [];
      for (let k = 0; k < n; k++) arr.push({ a: null, b: null, winner: null });
      rounds.push(arr);
    }
    return { rounds: rounds, size: size, champion: null };
  }
  function reportResult(bracket, roundIdx, matchIdx, winner) {
    const match = bracket.rounds[roundIdx][matchIdx];
    match.winner = winner;
    if (roundIdx + 1 < bracket.rounds.length) {
      const next = bracket.rounds[roundIdx + 1][Math.floor(matchIdx / 2)];
      if (matchIdx % 2 === 0) next.a = winner;
      else next.b = winner;
    } else bracket.champion = winner;
    return bracket;
  }
  function resolveByes(bracket, autoWinner) {
    bracket.rounds[0].forEach((m, i) => {
      if (m.winner) return;
      if (m.a && !m.b) autoWinner(0, i, m.a);
      else if (!m.a && m.b) autoWinner(0, i, m.b);
    });
    return bracket;
  }

  /* ================= ui/components ================= */
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
      .map((xy) => '<span class="pip" style="left:' + xy[0] + '%;top:' + xy[1] + '%"></span>')
      .join('');
    return '<div class="tile-half" data-v="' + value + '">' + pips + '</div>';
  }
  function tileHTML(tile, opts) {
    opts = opts || {};
    const orientation = opts.orientation || 'v';
    const cls = ['tile', orientation === 'h' ? 'tile-h' : 'tile-v'];
    if (opts.playable) cls.push('playable');
    if (opts.selected) cls.push('selected');
    if (opts.faceDown) cls.push('face-down');
    const c = cls.join(' ');
    if (opts.faceDown)
      return '<div class="' + c + '" data-id="' + tile.id + '"><div class="tile-back"></div></div>';
    return (
      '<div class="' + c + '" data-id="' + tile.id + '">' +
      half(tile.a) + '<div class="tile-divider"></div>' + half(tile.b) + '</div>'
    );
  }
  function playerBadge(p, opts) {
    opts = opts || {};
    const avatarChar = (p.name || '?').charAt(0).toUpperCase();
    const sub = p.isBot ? 'BOT' : 'YOU';
    const score = p.score != null ? p.score + ' pts' : p.chips != null ? p.chips + ' chips' : '';
    return (
      '<div class="player-badge ' + (opts.active ? 'active' : '') + ' pos-' + (opts.position || '') + '">' +
      '<div class="avatar">' + avatarChar + '</div>' +
      '<div class="player-meta"><div class="player-name">' + p.name +
      ' <span class="tag">' + sub + '</span></div>' +
      '<div class="player-score">' + score + '</div></div></div>'
    );
  }
  function toast(msg, type) {
    type = type || 'info';
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.className = 'toast'), 2200);
  }

  /* ================= ui/lobby ================= */
  function mountLobby(root, cfg) {
    cfg = cfg || {};
    const profile = getProfile();
    root.innerHTML =
      '<div class="lobby">' +
      '<header class="lobby-header"><div class="brand"><div class="logo">\uD83C\uDC63</div>' +
      '<div><h1>Domino <span>Island</span></h1><p class="tagline">Casual board game \u00B7 Gaple & QiuQiu</p></div></div>' +
      '<div class="profile-chip"><input id="nameInput" class="name-input" value="' + profile.name + '" maxlength="14" />' +
      '<div class="chips">\uD83D\uDCB0 ' + profile.chips + '</div></div></header>' +
      '<section class="settings-bar">' +
      '<div class="setting"><span class="setting-label">Suara</span>' +
      '<button class="toggle ' + (settings.sound ? 'on' : '') + '" id="soundToggle" aria-label="Toggle suara"><span class="knob"></span></button></div>' +
      '<div class="setting"><span class="setting-label">Kesulitan Bot</span>' +
      '<div class="seg" id="diffSeg">' +
      '<button data-diff="easy" class="' + (settings.difficulty === 'easy' ? 'active' : '') + '">Mudah</button>' +
      '<button data-diff="normal" class="' + (settings.difficulty === 'normal' ? 'active' : '') + '">Normal</button>' +
      '<button data-diff="hard" class="' + (settings.difficulty === 'hard' ? 'active' : '') + '">Sulit</button>' +
      '</div></div></section>' +
      '<section class="mode-grid">' +
      '<button class="mode-card gaple" data-mode="gaple"><div class="mode-emoji">\uD83C\uDC31</div><h2>Gaple</h2><p>Domino klasik 4 pemain. Habiskan kartu, kunci lawan.</p><span class="play-cta">Main \u2192</span></button>' +
      '<button class="mode-card qiuqiu" data-mode="qiuqiu"><div class="mode-emoji">\uD83C\uDFB4</div><h2>QiuQiu</h2><p>Kiu-Kiu / Domino 99. Nilai tertinggi menang pot.</p><span class="play-cta">Main \u2192</span></button>' +
      '<button class="mode-card tourney" data-mode="tournament"><div class="mode-emoji">\uD83C\uDFC6</div><h2>Turnamen</h2><p>Single-elimination 8 peserta. Jadilah juara pulau.</p><span class="play-cta">Masuk \u2192</span></button>' +
      '</section>' +
      '<footer class="lobby-footer"><span>MVP lokal \u00B7 tanpa AI \u00B7 bot heuristik \u00B7 chip virtual</span></footer>' +
      '</div>';
    const nameInput = root.querySelector('#nameInput');
    nameInput.addEventListener('change', () => {
      profile.name = nameInput.value.trim() || 'Pemain';
      saveProfile(profile);
    });
    const soundToggle = root.querySelector('#soundToggle');
    soundToggle.addEventListener('click', () => {
      settings.sound = !settings.sound;
      saveSettings(settings);
      soundToggle.classList.toggle('on', settings.sound);
      if (settings.sound) {
        Sound.unlock();
        Sound.click();
      }
    });
    root.querySelector('#diffSeg').querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        settings.difficulty = b.dataset.diff;
        saveSettings(settings);
        root.querySelector('#diffSeg').querySelectorAll('button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        Sound.unlock();
        Sound.click();
      });
    });
    root.querySelectorAll('.mode-card').forEach((card) => {
      card.addEventListener('click', () => {
        Sound.unlock();
        Sound.click();
        profile.name = nameInput.value.trim() || 'Pemain';
        saveProfile(profile);
        if (cfg.onSelectMode) cfg.onSelectMode(card.dataset.mode, profile);
      });
    });
    return { destroy: () => (root.innerHTML = '') };
  }

  /* ================= ui/table (gaple) ================= */
  const BOT_DELAY = 650;
  function mountGapleTable(root, cfg) {
    cfg = cfg || {};
    const seed = cfg.seed != null ? cfg.seed : randomSeed();
    const game = new GapleGame(cfg.players, seed, { drawMode: false, targetScore: 100 });
    const difficulty = cfg.difficulty || settings.difficulty || 'normal';
    let selectedTileId = null;
    let turnTimer = null;

    root.innerHTML =
      '<div class="table-view"><div class="table-top-bar">' +
      '<button class="btn ghost" id="exitBtn">\u2190 Keluar</button>' +
      '<div class="mode-pill">GAPLE \u00B7 4 Pemain</div>' +
      '<button class="btn ghost" id="newRoundBtn">Ronde Baru</button></div>' +
      '<div class="felt" id="felt">' +
      '<div class="seat seat-top" id="seat-2"></div><div class="seat seat-left" id="seat-1"></div>' +
      '<div class="seat seat-right" id="seat-3"></div><div class="seat seat-bottom" id="seat-0"></div>' +
      '<div class="board-wrap"><div class="board" id="board"></div></div>' +
      '<div class="turn-indicator" id="turnIndicator"></div></div>' +
      '<div class="hand-dock"><div class="hand-actions">' +
      '<button class="btn" id="playBtn" disabled>Mainkan</button>' +
      '<button class="btn warn" id="passBtn">Pass</button></div>' +
      '<div class="hand" id="hand"></div></div></div>';

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
        const seat = root.querySelector('#seat-' + i);
        const active = snap.turn === i && snap.phase === 'playing';
        let backs = '';
        if (i !== 0) {
          let b = '';
          for (let k = 0; k < p.handCount; k++)
            b += tileHTML({ id: 'x' }, { orientation: 'v', faceDown: true });
          backs = '<div class="opp-hand">' + b + '</div>';
        }
        seat.innerHTML = playerBadge(p, { active: active, position: positions[i] }) + backs;
      });
    }
    function renderBoard(snap) {
      if (snap.line.length === 0) {
        el.board.innerHTML = '<div class="board-empty">Papan kosong \u2014 pembuka memulai</div>';
        return;
      }
      const tiles = snap.line.map((t) => tileHTML(t, { orientation: 'h' })).join('');
      el.board.innerHTML =
        '<span class="end-badge left">' + snap.leftEnd + '</span>' +
        tiles +
        '<span class="end-badge right">' + snap.rightEnd + '</span>';
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
          Sound.unlock();
          if (!node.classList.contains('playable')) {
            toast('Tile itu tidak bisa dimainkan sekarang', 'warn');
            return;
          }
          Sound.click();
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
        el.turnIndicator.textContent = '\uD83C\uDFC6 ' + game.players[snap.matchWinner].name + ' juara match!';
        return;
      }
      if (snap.phase === 'round_over') {
        el.turnIndicator.textContent = 'Ronde selesai \u2014 ' + game.players[snap.roundWinner].name + ' menang';
        return;
      }
      const p = game.players[snap.turn];
      el.turnIndicator.textContent = p.isBot ? p.name + ' berpikir\u2026' : 'Giliran kamu';
    }
    // Visual countdown ring on the active player's avatar.
    function restartTurnTimer(snap) {
      if (turnTimer) {
        clearTimeout(turnTimer.fallback);
        turnTimer = null;
      }
      if (snap.phase !== 'playing') return;
      const seat = root.querySelector('#seat-' + snap.turn + ' .player-badge');
      if (!seat) return;
      const ring = document.createElement('div');
      ring.className = 'turn-ring';
      seat.appendChild(ring);
      // Auto-pass/auto-play safety for the human if idle too long (keeps game flowing).
      const isHuman = snap.turn === 0;
      const limit = isHuman ? 20000 : 0;
      turnTimer = { fallback: null };
      if (isHuman && limit) {
        turnTimer.fallback = setTimeout(() => {
          if (game.state.turn !== 0 || game.state.phase !== 'playing') return;
          if (game.canPlay(0)) {
            const mv = gapleBotMove(game, 0, 'easy');
            game.applyAction(mv);
          } else {
            game.applyAction({ type: 'pass' });
          }
          afterMove();
        }, limit);
      }
    }
    function renderAll() {
      const snap = game.snapshot();
      renderSeats(snap);
      renderBoard(snap);
      renderHand(snap);
      renderTurn(snap);
      restartTurnTimer(snap);
    }
    // Called after any move resolves to refresh + continue bot loop + check end.
    function afterMove() {
      renderAll();
      const snap = game.snapshot();
      if (snap.phase === 'round_over' || snap.phase === 'match_over') {
        showGapleResult(snap);
        return;
      }
      maybeBotLoop();
    }
    function playSelected(end) {
      if (!selectedTileId) return;
      const me = game.players[0];
      const tile = me.hand.find((t) => t.id === selectedTileId);
      if (!tile) return;
      const legal = game.legalMoves(0).filter((m) => m.tile.id === tile.id);
      let chosenEnd = end || (legal.length === 1 ? legal[0].end : null);
      if (!chosenEnd && legal.length > 1) {
        showEndPicker(tile, legal);
        return;
      }
      const res = game.applyAction({ type: 'play', tile: tile, end: chosenEnd || legal[0].end });
      if (!res.ok) {
        toast('Gerakan tidak valid', 'warn');
        return;
      }
      Sound.place();
      buzz(15);
      selectedTileId = null;
      flashBoard();
      afterMove();
    }
    // Little pop animation on the most recently placed board tile.
    function flashBoard() {
      requestAnimationFrame(() => {
        const tiles = el.board.querySelectorAll('.tile');
        if (!tiles.length) return;
        const last = tiles[tiles.length - 1];
        last.classList.add('just-placed');
        setTimeout(() => last.classList.remove('just-placed'), 350);
      });
    }
    function showGapleResult(snap) {
      const rows = game.players.map((p, i) => ({
        name: p.name,
        detail: p.score + ' pts',
        win: snap.phase === 'match_over' ? i === snap.matchWinner : i === snap.roundWinner,
      }));
      if (snap.phase === 'match_over') {
        const youWon = snap.matchWinner === 0;
        const inTournament = !!cfg.onMatchOver;
        showResultOverlay({
          title: youWon ? 'Kamu Juara Match!' : game.players[snap.matchWinner].name + ' Juara Match',
          subtitle: 'Skor akhir sampai ' + game.targetScore,
          rows: rows,
          youWon: youWon,
          againLabel: inTournament ? 'Lanjut Turnamen' : 'Match Baru',
          onAgain: () => {
            if (inTournament) {
              cfg.onMatchOver(snap.matchWinner);
              return;
            }
            game.players.forEach((p) => (p.score = 0));
            game.state.matchWinner = null;
            game.startRound();
            selectedTileId = null;
            afterMove();
          },
        });
      } else {
        const youWon = snap.roundWinner === 0;
        showResultOverlay({
          title: youWon ? 'Kamu Menang Ronde!' : game.players[snap.roundWinner].name + ' Menang Ronde',
          subtitle: 'Lanjut ke ronde berikutnya',
          rows: rows,
          youWon: youWon,
          againLabel: 'Ronde Berikutnya',
          onAgain: () => {
            game.startRound();
            selectedTileId = null;
            afterMove();
          },
        });
      }
    }
    function showEndPicker(tile, legal) {
      const picker = document.createElement('div');
      picker.className = 'end-picker';
      picker.innerHTML =
        '<div class="end-picker-inner"><p>Taruh [' + tile.a + '|' + tile.b + '] di ujung mana?</p>' +
        '<div class="end-btns"><button class="btn" data-end="left">\u27F5 Kiri (' + game.state.leftEnd + ')</button>' +
        '<button class="btn" data-end="right">Kanan (' + game.state.rightEnd + ') \u27F6</button></div></div>';
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
      if (snap.phase !== 'playing') return;
      if (snap.turn === 0) return;
      setTimeout(() => {
        if (game.state.phase !== 'playing') return;
        const action = gapleBotMove(game, game.state.turn, difficulty);
        const res = game.applyAction(action);
        if (!res.ok && action.type === 'play') game.applyAction({ type: 'pass' });
        if (action.type === 'pass') {
          Sound.pass();
        } else {
          Sound.place();
          flashBoard();
        }
        afterMove();
      }, BOT_DELAY);
    }

    root.querySelector('#exitBtn').addEventListener('click', () => {
      if (turnTimer) clearTimeout(turnTimer.fallback);
      cfg.onExit && cfg.onExit();
    });
    root.querySelector('#newRoundBtn').addEventListener('click', () => {
      Sound.unlock();
      Sound.deal();
      game.startRound();
      selectedTileId = null;
      afterMove();
    });
    el.playBtn.addEventListener('click', () => {
      Sound.unlock();
      playSelected();
    });
    el.passBtn.addEventListener('click', () => {
      Sound.unlock();
      const res = game.applyAction({ type: 'pass' });
      if (!res.ok) {
        toast('Kamu masih punya langkah legal', 'warn');
        return;
      }
      Sound.pass();
      buzz(10);
      afterMove();
    });

    Sound.deal();
    game.startRound();
    renderAll();
    maybeBotLoop();
    return {
      game: game,
      destroy: () => {
        if (turnTimer) clearTimeout(turnTimer.fallback);
        root.innerHTML = '';
      },
    };
  }

  /* ================= ui/qiuqiu ================= */
  function mountQiuQiuTable(root, cfg) {
    cfg = cfg || {};
    const seed = cfg.seed != null ? cfg.seed : randomSeed();
    const game = new QiuQiuGame(cfg.players, seed, { ante: 10 });
    let revealed = false;

    root.innerHTML =
      '<div class="table-view"><div class="table-top-bar">' +
      '<button class="btn ghost" id="exitBtn">\u2190 Keluar</button>' +
      '<div class="mode-pill qq">QIUQIU \u00B7 4 Pemain</div>' +
      '<button class="btn ghost" id="dealBtn">Bagi Ulang</button></div>' +
      '<div class="felt qq-felt"><div class="pot" id="pot"></div><div class="qq-seats" id="qqSeats"></div></div>' +
      '<div class="hand-dock"><div class="hand-actions"><button class="btn" id="revealBtn">Buka Kartu</button></div>' +
      '<div class="result-line" id="resultLine"></div></div></div>';

    const el = {
      seats: root.querySelector('#qqSeats'),
      pot: root.querySelector('#pot'),
      revealBtn: root.querySelector('#revealBtn'),
      resultLine: root.querySelector('#resultLine'),
    };
    function render() {
      const snap = game.snapshot();
      el.pot.innerHTML = '<span class="pot-label">POT</span><span class="pot-val">' + snap.pot + '</span>';
      el.seats.innerHTML = snap.players
        .map((p, i) => {
          const showFace = revealed || i === 0;
          const tiles = p.hand.map((t) => tileHTML(t, { orientation: 'v', faceDown: !showFace })).join('');
          const resultTag =
            revealed && snap.results.length
              ? '<div class="qq-eval">' + snap.results.find((r) => r.idx === i).eval.label + '</div>'
              : '';
          const winnerCls = revealed && snap.winner === i ? 'qq-winner' : '';
          return (
            '<div class="qq-seat ' + winnerCls + '">' + playerBadge(p, {}) +
            '<div class="qq-tiles">' + tiles + '</div>' + resultTag + '</div>'
          );
        })
        .join('');
    }
    function reveal() {
      if (revealed) return;
      Sound.unlock();
      revealed = true;
      const r = game.resolve();
      render();
      el.revealBtn.disabled = true;
      // Staggered flip of each seat, then show result.
      const seats = el.seats.querySelectorAll('.qq-seat');
      seats.forEach((s, i) => {
        setTimeout(() => {
          s.classList.add('revealed');
          Sound.click();
        }, i * 220);
      });
      setTimeout(() => {
        const youWon = r.winner === 0;
        el.resultLine.textContent = game.players[r.winner].name + ' menang.';
        showResultOverlay({
          title: youWon ? 'Kamu Menang Pot!' : game.players[r.winner].name + ' Menang Pot',
          subtitle: 'Pot: ' + game.state.pot + ' chips',
          rows: r.results.map((e) => ({
            name: e.name,
            detail: e.eval.label,
            win: e.idx === r.winner,
          })),
          youWon: youWon,
          againLabel: 'Bagi Ulang',
          onAgain: () => startFreshRound(),
        });
      }, seats.length * 220 + 200);
    }
    function startFreshRound() {
      revealed = false;
      el.revealBtn.disabled = false;
      el.resultLine.textContent = '';
      Sound.deal();
      game.startRound();
      render();
    }
    root.querySelector('#exitBtn').addEventListener('click', () => cfg.onExit && cfg.onExit());
    root.querySelector('#dealBtn').addEventListener('click', startFreshRound);
    el.revealBtn.addEventListener('click', reveal);
    Sound.deal();
    game.startRound();
    render();
    return { game: game, destroy: () => (root.innerHTML = '') };
  }

  /* ================= ui/tournament ================= */
  function mountTournamentView(root, cfg) {
    cfg = cfg || {};
    const profile = cfg.profile || {};
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
      for (let r = 0; r < bracket.rounds.length; r++)
        for (let m = 0; m < bracket.rounds[r].length; m++) {
          const match = bracket.rounds[r][m];
          if (match.winner || !match.a || !match.b) continue;
          const human = (match.a && !match.a.isBot) || (match.b && !match.b.isBot);
          if (human) return { r: r, m: m, match: match };
        }
      return null;
    }
    function autoSimBotMatches() {
      let changed = true;
      while (changed) {
        changed = false;
        for (let r = 0; r < bracket.rounds.length; r++)
          for (let m = 0; m < bracket.rounds[r].length; m++) {
            const match = bracket.rounds[r][m];
            if (match.winner || !match.a || !match.b) continue;
            const human = !match.a.isBot || !match.b.isBot;
            if (human) continue;
            const w = (match.a.id.length + match.b.id.length) % 2 === 0 ? match.a : match.b;
            reportResult(bracket, r, m, w);
            changed = true;
          }
      }
      store.set('tournament', bracket);
    }
    function buildTablePlayers(you, opp) {
      return [
        { id: you.id, name: you.name, isBot: false },
        { id: 'f1', name: 'Pendamping 1', isBot: true },
        { id: opp.id, name: opp.name, isBot: true },
        { id: 'f2', name: 'Pendamping 2', isBot: true },
      ];
    }
    function render() {
      if (!bracket) {
        root.innerHTML =
          '<div class="tourney-view"><div class="table-top-bar">' +
          '<button class="btn ghost" id="exitBtn">\u2190 Lobby</button>' +
          '<div class="mode-pill tr">TURNAMEN</div><span></span></div>' +
          '<div class="tourney-empty"><h2>Mode Turnamen</h2>' +
          '<p>Single-elimination, 8 peserta. Menangkan setiap match untuk jadi juara.</p>' +
          '<button class="btn big" id="startBtn">Mulai Turnamen Baru</button></div></div>';
        root.querySelector('#startBtn').addEventListener('click', startNew);
        root.querySelector('#exitBtn').addEventListener('click', () => cfg.onExit && cfg.onExit());
        return;
      }
      autoSimBotMatches();
      const roundNames = ['Perempat Final', 'Semifinal', 'Final', 'Juara'];
      const columns = bracket.rounds
        .map((round, r) => {
          const matches = round
            .map((match) => {
              const a = match.a ? match.a.name : '\u2014';
              const b = match.b ? match.b.name : '\u2014';
              const aW = match.winner && match.a && match.winner.id === match.a.id;
              const bW = match.winner && match.b && match.winner.id === match.b.id;
              return (
                '<div class="bracket-match"><div class="bm-row ' + (aW ? 'win' : '') + '">' + a + '</div>' +
                '<div class="bm-row ' + (bW ? 'win' : '') + '">' + b + '</div></div>'
              );
            })
            .join('');
          return '<div class="bracket-col"><div class="bracket-title">' + (roundNames[r] || 'Ronde ' + (r + 1)) + '</div>' + matches + '</div>';
        })
        .join('');
      const champ = bracket.champion;
      const next = findNextHumanMatch();
      let footer;
      if (champ) footer = '<div class="champ-banner">\uD83C\uDFC6 Juara: <b>' + champ.name + '</b></div>';
      else if (next) footer = '<button class="btn big" id="playBtn">Main Match Kamu \u2192</button>';
      else footer = '<div class="info">Menunggu match berikutnya\u2026</div>';

      root.innerHTML =
        '<div class="tourney-view"><div class="table-top-bar">' +
        '<button class="btn ghost" id="exitBtn">\u2190 Lobby</button>' +
        '<div class="mode-pill tr">TURNAMEN</div>' +
        '<button class="btn ghost" id="resetBtn">Reset</button></div>' +
        '<div class="bracket">' + columns + '</div>' +
        '<div class="tourney-footer">' + footer + '</div></div>';

      root.querySelector('#exitBtn').addEventListener('click', () => cfg.onExit && cfg.onExit());
      const resetBtn = root.querySelector('#resetBtn');
      if (resetBtn)
        resetBtn.addEventListener('click', () => {
          store.remove('tournament');
          bracket = null;
          render();
        });
      const playBtn = root.querySelector('#playBtn');
      if (playBtn && next) {
        playBtn.addEventListener('click', () => {
          const opp = next.match.a && !next.match.a.isBot ? next.match.b : next.match.a;
          const you = next.match.a && !next.match.a.isBot ? next.match.a : next.match.b;
          if (cfg.onPlayMatch)
            cfg.onPlayMatch({
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
    render();
    return { destroy: () => (root.innerHTML = '') };
  }

  /* ================= main / router ================= */
  function boot() {
    const app = document.getElementById('app');
    let current = null;
    function clear() {
      if (current && current.destroy) current.destroy();
      app.innerHTML = '';
      current = null;
    }
    function goLobby() {
      clear();
      current = mountLobby(app, {
        onSelectMode: (mode, profile) => {
          if (mode === 'gaple') goGaple(profile);
          else if (mode === 'qiuqiu') goQiuQiu(profile);
          else if (mode === 'tournament') goTournament(profile);
        },
      });
    }
    function goGaple(profile) {
      clear();
      current = mountGapleTable(app, {
        players: [
          { id: 'you', name: profile.name || 'Kamu', isBot: false },
          { id: 'b1', name: 'Budi', isBot: true },
          { id: 'b2', name: 'Sari', isBot: true },
          { id: 'b3', name: 'Andi', isBot: true },
        ],
        onExit: goLobby,
      });
    }
    function goQiuQiu(profile) {
      clear();
      current = mountQiuQiuTable(app, {
        players: [
          { id: 'you', name: profile.name || 'Kamu', isBot: false, chips: profile.chips },
          { id: 'b1', name: 'Budi', isBot: true },
          { id: 'b2', name: 'Sari', isBot: true },
          { id: 'b3', name: 'Andi', isBot: true },
        ],
        onExit: goLobby,
      });
    }
    function goTournament(profile) {
      clear();
      current = mountTournamentView(app, {
        profile: profile,
        onExit: goLobby,
        onPlayMatch: (args) => {
          clear();
          current = mountGapleTable(app, {
            players: args.tablePlayers,
            onExit: () => goTournament(profile),
            onMatchOver: (winnerIdx) => {
              args.onResult(winnerIdx === 0);
              goTournament(profile);
            },
          });
        },
      });
    }
    goLobby();
  }

  // Expose a tiny API for optional headless testing (used by test.html).
  window.DominoIsland = {
    GapleGame: GapleGame,
    QiuQiuGame: QiuQiuGame,
    evaluateHand: evaluateHand,
    gapleBotMove: gapleBotMove,
    createBracket: createBracket,
    reportResult: reportResult,
    resolveByes: resolveByes,
    fullDeck: fullDeck,
    mulberry32: mulberry32,
    boot: boot,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
