// Heuristic bots (NOT AI/LLM). Deterministic, always produce a legal action.
import { pipSum, isDouble } from '../core/domino.js';

// Gaple bot: pick a legal move that offloads the heaviest tile; prefer dumping doubles early.
export function gapleBotMove(game, playerIdx) {
  const moves = game.legalMoves(playerIdx);
  if (moves.length === 0) {
    // Try to draw if draw mode, else pass.
    if (game.drawMode && game.state.boneyard.length > 0) {
      return { type: 'draw' };
    }
    return { type: 'pass' };
  }
  // Score each move: heavier tile = higher priority to discard; doubles slightly favored.
  const ranked = moves
    .map((m) => ({ m, score: pipSum(m.tile) + (isDouble(m.tile) ? 2 : 0) }))
    .sort((a, b) => b.score - a.score);
  return { type: 'play', tile: ranked[0].m.tile, end: ranked[0].m.end };
}

// QiuQiu bot in MVP just reveals (no betting rounds yet). Kept for symmetry/extensibility.
export function qiuqiuBotDecision() {
  return { type: 'reveal' };
}
