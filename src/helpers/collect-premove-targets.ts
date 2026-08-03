import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import type { LegalTargets } from '../state/types';
import { collectLegalTargets } from './collect-legal-targets';

/**
 * Moves the waiting player could plausibly make, for premove validation.
 *
 * A premove is queued while it is the *opponent's* turn, so the real position
 * offers no moves for the waiting side at all. This asks the same question of
 * a copy of the position with the turn flipped: "if it were my move right now,
 * could this piece go there?"
 *
 * Deliberately permissive. It cannot know what the opponent is about to do, so
 * a premove it accepts may turn out to be illegal (the target gets blocked, the
 * king ends up in check) — the executor re-validates when the move actually
 * fires and drops it if the position no longer allows it. That is the same
 * bargain every chess site makes: the premove that loses a queen to a capture
 * you didn't see has to be *allowed*, or premoving would be a cheat.
 *
 * Returns an empty map only when chess.js refuses the flipped FEN outright.
 * Note it is lenient about positions that are unreachable in a real game (the
 * side not to move standing in check, say) and will happily generate moves for
 * them — harmless here, because firing re-validates against the real position.
 */
export const collectPremoveTargets = (chess: Chess): LegalTargets => {
  const fields = chess.fen().split(' ');
  if (fields.length < 6) {
    return {};
  }
  fields[1] = fields[1] === 'w' ? 'b' : 'w';
  // A flipped turn makes any en-passant square meaningless, and chess.js
  // rejects the FEN when it can't be reached; clear it.
  fields[3] = '-';

  try {
    return collectLegalTargets(new Chess(fields.join(' ')));
  } catch {
    return {};
  }
};

/** Whether a queued premove is still plausible in the swapped position. */
export const isPremoveTarget = (
  targets: LegalTargets,
  from: Square,
  to: Square
): boolean => (targets[from] ?? []).includes(to);
