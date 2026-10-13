// Domino tile domain model: double-six set (0..6), 28 tiles.
import { shuffle } from './rng.js';

export function makeTile(a, b) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return { a: lo, b: hi, id: `${lo}-${hi}` };
}

export function isDouble(t) {
  return t.a === t.b;
}

export function pipSum(t) {
  return t.a + t.b;
}

// Full double-six set.
export function fullDeck() {
  const deck = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      deck.push(makeTile(a, b));
    }
  }
  return deck; // 28 tiles
}

export function deal(rng, hands = 4, perHand = 7) {
  const deck = shuffle(fullDeck(), rng);
  const result = [];
  let idx = 0;
  for (let h = 0; h < hands; h++) {
    result.push(deck.slice(idx, idx + perHand));
    idx += perHand;
  }
  const boneyard = deck.slice(idx);
  return { hands: result, boneyard };
}

// Can a tile attach to an open end value?
export function tileMatchesEnd(tile, end) {
  return tile.a === end || tile.b === end;
}

// Total pip value of a hand (used for scoring).
export function handPips(hand) {
  return hand.reduce((s, t) => s + pipSum(t), 0);
}
