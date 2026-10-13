// Single-elimination tournament bracket.
export function createBracket(participants) {
  // participants: array of {id, name, isBot}. Pad to power of 2 with byes if needed.
  let size = 1;
  while (size < participants.length) size *= 2;
  const seeded = participants.slice();
  while (seeded.length < size) seeded.push(null); // bye

  const rounds = [];
  // Round 0 matches
  let current = [];
  for (let i = 0; i < seeded.length; i += 2) {
    current.push({ a: seeded[i], b: seeded[i + 1], winner: null });
  }
  rounds.push(current);
  // Subsequent empty rounds
  let n = current.length;
  while (n > 1) {
    n = Math.floor(n / 2);
    rounds.push(Array.from({ length: n }, () => ({ a: null, b: null, winner: null })));
  }
  return { rounds, size, champion: null };
}

export function reportResult(bracket, roundIdx, matchIdx, winner) {
  const match = bracket.rounds[roundIdx][matchIdx];
  match.winner = winner;
  if (roundIdx + 1 < bracket.rounds.length) {
    const next = bracket.rounds[roundIdx + 1][Math.floor(matchIdx / 2)];
    if (matchIdx % 2 === 0) next.a = winner;
    else next.b = winner;
  } else {
    bracket.champion = winner;
  }
  return bracket;
}

// Auto-advance byes (null opponents).
export function resolveByes(bracket, autoWinner) {
  bracket.rounds[0].forEach((m, i) => {
    if (m.winner) return;
    if (m.a && !m.b) autoWinner(0, i, m.a);
    else if (!m.a && m.b) autoWinner(0, i, m.b);
  });
  return bracket;
}
