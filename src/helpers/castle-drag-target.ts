import type { Square } from 'chess.js';
import type { PieceCode } from '../state/types';

/**
 * Resolve a king dropped on its own rook into the castling move it means.
 *
 * Castling is expressed as the king moving two squares (`e1` → `g1`), but
 * players reach for the rook — it is how the move is made over the board, and
 * what chess.com and lichess accept. This translates that drop into the move
 * chess.js actually understands, so the rest of the pipeline never learns
 * about the alternative spelling.
 *
 * Derived from the position's own legal targets rather than from a separate
 * map: a king move of two files is castling and nothing else, which gives us
 * both the destination and which rook it pairs with. That keeps this a pure
 * function of state the gesture handler already holds, so nothing new has to
 * be recomputed when the position changes.
 *
 * Drag only, deliberately. The dots draw from `validMoves`, which is untouched
 * here, so no dot ever appears on the rook and a tap on it is not a move.
 *
 * Standard chess only. Chess960's king and rook can start anywhere, so "two
 * files" stops identifying castling and the pairing has to come from the
 * position's castling rights instead.
 *
 * @param from    The square the drag started on.
 * @param to      The square it was dropped on.
 * @param piece   The dragged piece, as the board codes it (`'wk'`, `'bq'`, …).
 * @param targets Legal destinations from `from`, i.e. `legalTargets[from]`.
 * @returns The king's real destination, or `null` if this isn't a castling drop.
 */
export const castleDragTarget = (
  from: Square,
  to: Square,
  piece: PieceCode,
  targets: readonly Square[] | undefined
): Square | null => {
  'worklet';
  if (!piece || piece[1] !== 'k' || !targets) return null;

  const rank = from[1];
  // The rook we castle with always shares the king's rank.
  if (to[1] !== rank || to === from) return null;

  const fromFile = from.charCodeAt(0);

  for (const target of targets) {
    if (target[1] !== rank) continue;

    const step = target.charCodeAt(0) - fromFile;
    // Two files, and only two, means castling: a king moves one square
    // otherwise, and chess.js spells both castles this way.
    if (step !== 2 && step !== -2) continue;

    // Kingside castling pairs with the h-file rook, queenside with the a-file.
    const rookSquare = (step > 0 ? 'h' : 'a') + rank;
    if (to === rookSquare) return target;
  }

  return null;
};
