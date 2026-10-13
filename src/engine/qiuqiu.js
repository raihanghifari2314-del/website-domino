// QiuQiu (Kiu-Kiu / Domino 99) engine — simplified for MVP.
// Each player gets 4 tiles, split into 2 pairs; hand value = compare special combos then (sum % 10).
import { Emitter } from '../core/events.js';
import { mulberry32 } from '../core/rng.js';
import { deal, pipSum, isDouble } from '../core/domino.js';

// Pair value = total pips mod 10 (a "kiu" = 9 is best for normal values).
function pairValue(a, b) {
  return (pipSum(a) + pipSum(b)) % 10;
}

// Evaluate a 4-tile hand. Choose the pairing (of the 3 possible) that maximizes value.
// Returns { rank, label, v1, v2, score } where higher is better.
export function evaluateHand(hand) {
  if (hand.length !== 4) throw new Error('QiuQiu hand must be 4 tiles');
  const totalPips = hand.reduce((s, t) => s + pipSum(t), 0);
  const doubles = hand.filter(isDouble).length;

  // Special combinations (checked first, higher rank beats normal).
  // Balak (4 Dewa): all four are doubles.
  if (doubles === 4) {
    return { rank: 4, label: 'Balak (4 Dewa)', v1: 0, v2: 0, score: 400 };
  }
  // Enam Dewa (Six Gods): total pips >= 40.
  if (totalPips >= 40) {
    return { rank: 3, label: 'Enam Dewa', v1: 0, v2: 0, score: 300 };
  }
  // Murni Kecil (Small Pure): total pips <= 9.
  if (totalPips <= 9) {
    return { rank: 2, label: 'Murni Kecil', v1: 0, v2: 0, score: 200 };
  }

  // Normal: best pairing. 3 ways to split 4 tiles into 2 pairs.
  const [t0, t1, t2, t3] = hand;
  const splits = [
    [[t0, t1], [t2, t3]],
    [[t0, t2], [t1, t3]],
    [[t0, t3], [t1, t2]],
  ];
  let best = { v1: -1, v2: -1, metric: -1 };
  for (const [[a, b], [c, d]] of splits) {
    const v1 = pairValue(a, b);
    const v2 = pairValue(c, d);
    const metric = Math.max(v1, v2) * 10 + Math.min(v1, v2);
    if (metric > best.metric) best = { v1, v2, metric };
  }
  const hi = Math.max(best.v1, best.v2);
  const lo = Math.min(best.v1, best.v2);
  const label = hi === 9 && lo === 9 ? 'QiuQiu (9-9)' : `${hi}-${lo}`;
  return { rank: 1, label, v1: hi, v2: lo, score: 100 + hi * 10 + lo };
}

export class QiuQiuGame extends Emitter {
  constructor(players, seed, opts = {}) {
    super();
    if (players.length !== 4) throw new Error('QiuQiu requires exactly 4 players');
    this.seed = seed >>> 0;
    this.rng = mulberry32(this.seed);
    this.ante = opts.ante ?? 10;
    this.players = players.map((p) => ({ ...p, hand: [], chips: p.chips ?? 500 }));
    this.state = { mode: 'qiuqiu', seed: this.seed, phase: 'idle', pot: 0, results: [], log: [] };
  }

  log(msg) {
    this.state.log.push(msg);
    this.emit('log', msg);
  }

  startRound() {
    const { hands } = deal(this.rng, 4, 4); // 4 tiles each
    this.players.forEach((p, i) => {
      p.hand = hands[i];
      p.chips -= this.ante;
    });
    this.state.pot = this.ante * 4;
    this.state.phase = 'reveal';
    this.state.results = [];
    this.log(`Ronde QiuQiu dimulai. Pot: ${this.state.pot}`);
    this.emit('round_started', this.snapshot());
  }

  resolve() {
    const evals = this.players.map((p, i) => ({
      idx: i,
      name: p.name,
      eval: evaluateHand(p.hand),
    }));
    evals.sort((a, b) => b.eval.score - a.eval.score);
    const winner = evals[0];
    this.players[winner.idx].chips += this.state.pot;
    this.state.phase = 'round_over';
    this.state.results = evals;
    this.state.winner = winner.idx;
    this.log(`${winner.name} menang dengan ${winner.eval.label} (+${this.state.pot})`);
    this.emit('round_over', { winner: winner.idx, results: evals, snapshot: this.snapshot() });
    return { winner: winner.idx, results: evals };
  }

  snapshot() {
    return {
      ...this.state,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        chips: p.chips,
        hand: p.hand.map((t) => ({ ...t })),
      })),
    };
  }
}
