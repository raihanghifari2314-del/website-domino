// Gaple (Domino Block/Draw) engine — pure state machine, no DOM.
import { Emitter } from '../core/events.js';
import { mulberry32 } from '../core/rng.js';
import { deal, isDouble, pipSum, tileMatchesEnd, handPips } from '../core/domino.js';

export class GapleGame extends Emitter {
  /**
   * @param {Array<{id,name,isBot}>} players exactly 4
   * @param {number} seed
   * @param {{drawMode?:boolean, targetScore?:number}} opts
   */
  constructor(players, seed, opts = {}) {
    super();
    if (players.length !== 4) throw new Error('Gaple requires exactly 4 players');
    this.seed = seed >>> 0;
    this.rng = mulberry32(this.seed);
    this.drawMode = !!opts.drawMode; // true: draw from boneyard; false: pure block
    this.targetScore = opts.targetScore ?? 100; // match ends when someone reaches this
    this.players = players.map((p) => ({ ...p, hand: [], score: 0 }));
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

  log(msg) {
    this.state.log.push(msg);
    this.emit('log', msg);
  }

  startRound() {
    const { hands, boneyard } = deal(this.rng, 4, 7);
    this.players.forEach((p, i) => (p.hand = hands[i]));
    this.state.line = [];
    this.state.leftEnd = null;
    this.state.rightEnd = null;
    this.state.boneyard = boneyard; // empty for 4-player (28/4=7, remainder 0)
    this.state.passes = 0;
    this.state.roundWinner = null;
    this.state.phase = 'playing';
    this.state.turn = this._openingPlayer();
    this.log(`Ronde dimulai. Pembuka: ${this.players[this.state.turn].name}`);
    this.emit('round_started', this.snapshot());
    // If opening player is a bot, they still make their move via UI loop.
  }

  _openingPlayer() {
    // Highest double opens; else highest pip tile.
    let best = { player: 0, value: -1, isDbl: false };
    this.players.forEach((p, i) => {
      p.hand.forEach((t) => {
        const dbl = isDouble(t);
        const val = pipSum(t);
        const better =
          (dbl && !best.isDbl) ||
          (dbl === best.isDbl && val > best.value);
        if (better) best = { player: i, value: val, isDbl: dbl };
      });
    });
    return best.player;
  }

  legalMoves(playerIdx) {
    const p = this.players[playerIdx];
    if (this.state.line.length === 0) {
      // Opening move: on the very first play of the round, must play a tile.
      // Convention: opener may play any tile (we recommend the chosen opener tile but allow any).
      return p.hand.map((t) => ({ tile: t, end: 'start' }));
    }
    const moves = [];
    p.hand.forEach((t) => {
      if (tileMatchesEnd(t, this.state.leftEnd)) moves.push({ tile: t, end: 'left' });
      if (tileMatchesEnd(t, this.state.rightEnd)) moves.push({ tile: t, end: 'right' });
    });
    return moves;
  }

  canPlay(playerIdx) {
    return this.legalMoves(playerIdx).length > 0;
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
      this.log(`${player.name} memainkan [${match.tile.a}|${match.tile.b}]`);
      this.emit('tile_played', { player: idx, tile: match.tile, end: match.end });

      if (player.hand.length === 0) {
        return this._endRound(idx, 'domino');
      }
      this._advanceTurn();
      return { ok: true };
    }

    if (action.type === 'draw') {
      if (!this.drawMode || this.state.boneyard.length === 0) {
        return { ok: false, reason: 'cannot_draw' };
      }
      const t = this.state.boneyard.pop();
      player.hand.push(t);
      this.log(`${player.name} menarik dari boneyard`);
      this.emit('tile_drawn', { player: idx });
      return { ok: true, drew: true };
    }

    if (action.type === 'pass') {
      if (this.canPlay(idx)) return { ok: false, reason: 'must_play' };
      this.state.passes += 1;
      this.log(`${player.name} pass`);
      this.emit('passed', { player: idx });
      if (this.state.passes >= this.players.length) {
        return this._endRoundBlocked();
      }
      this._advanceTurn();
      return { ok: true };
    }

    return { ok: false, reason: 'unknown_action' };
  }

  _placeTile(player, tile, end) {
    player.hand = player.hand.filter((t) => t.id !== tile.id);
    if (this.state.line.length === 0) {
      this.state.line.push({ ...tile });
      this.state.leftEnd = tile.a;
      this.state.rightEnd = tile.b;
      return;
    }
    if (end === 'left') {
      // orient so the matching pip faces the line
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
    // Losers add their remaining pips to winner's score.
    let gained = 0;
    this.players.forEach((p, i) => {
      if (i !== winnerIdx) gained += handPips(p.hand);
    });
    this.players[winnerIdx].score += gained;
    this.log(`${this.players[winnerIdx].name} menang ronde (${reason}) +${gained}`);
    this.emit('round_over', { winner: winnerIdx, gained, reason, snapshot: this.snapshot() });
    this._maybeEndMatch();
    return { ok: true, roundOver: true, winner: winnerIdx };
  }

  _endRoundBlocked() {
    // Blocked: lowest pip hand wins the remaining pips of others.
    let winnerIdx = 0;
    let lowest = Infinity;
    this.players.forEach((p, i) => {
      const v = handPips(p.hand);
      if (v < lowest) {
        lowest = v;
        winnerIdx = i;
      }
    });
    this.log(`Permainan buntu. Pip terendah: ${this.players[winnerIdx].name}`);
    return this._endRound(winnerIdx, 'blocked');
  }

  _maybeEndMatch() {
    const champ = this.players.findIndex((p) => p.score >= this.targetScore);
    if (champ >= 0) {
      this.state.phase = 'match_over';
      this.state.matchWinner = champ;
      this.log(`${this.players[champ].name} memenangkan match!`);
      this.emit('match_over', { winner: champ, snapshot: this.snapshot() });
    }
  }

  snapshot() {
    return {
      ...this.state,
      line: this.state.line.map((t) => ({ ...t })),
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        score: p.score,
        handCount: p.hand.length,
        hand: p.hand.map((t) => ({ ...t })),
      })),
    };
  }
}
