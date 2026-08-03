import type { WithSpringConfig } from 'react-native-reanimated';

/**
 * Spring animation configurations for the chessboard.
 *
 * These are critically damped springs (dampingRatio = 1) which means:
 * - No oscillation/bouncing
 * - Fastest approach to target without overshoot
 * - Formula: damping = 2 * sqrt(stiffness * mass)
 *
 * Settling time for a critically damped spring is roughly `6.64 / sqrt(k/m)`
 * — the point where ~1% of the travel remains. That is the number to reason
 * about when these feel wrong: stiffness 400 settles in ~330ms, which reads
 * as sluggish next to a board that slides a piece in under 150ms. The
 * defaults below target ~165ms, and a consumer who wants a different feel
 * passes its own configs through the `animations` prop rather than living
 * with these.
 */

// Move animation: Used when pieces move to their destination.
// Reanimated 4 ends a spring when its relative energy drops below
// `energyThreshold` (default 6e-9 ≈ a 0.008% amplitude — hundreds of ms of
// invisible tail). 1e-4 ≈ 1% of the travel distance (~0.5px on a one-square
// move), so the completion callback fires as soon as the piece is visually
// settled and awaited moves (`ref.move()`) resolve without dead time.
export const MOVE_SPRING: WithSpringConfig = {
  stiffness: 1600,
  damping: 80,
  mass: 1,
  energyThreshold: 1e-4,
};

// Scale animation: Used when lifting/dropping pieces
// Lift/drop tracks the finger, so it wants to be quicker than a move.
export const SCALE_SPRING: WithSpringConfig = {
  stiffness: 2200,
  damping: 94,
  mass: 1,
};

// Snap-back animation: Used when invalid moves snap back to origin
// A rejected move should get out of the way promptly — the player already
// knows it failed.
export const SNAP_BACK_SPRING: WithSpringConfig = {
  stiffness: 1800,
  damping: 85,
  mass: 1,
};
