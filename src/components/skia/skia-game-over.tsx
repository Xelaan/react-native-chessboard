import React, { useEffect } from 'react';
import {
  Circle,
  Group,
  Path,
  RoundedRect,
  Skia,
  rect,
  rrect,
} from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { Square } from 'chess.js';

import type { BoardConfig } from '../../state/types';
import { squareToPosition } from '../../state/use-board-state';
import type { GameOverReason, GameResult } from '../../types';

// Choreography, in ms and relative to `startDelay`. Grow pops a rounded square
// over the king's cell, the hold lets the label pill breathe, and settle
// shrinks the overlay into the persistent corner badge.
const GROW_MS = 300;
const HOLD_MS = 800;
const SETTLE_MS = 350;

// Sizes as fractions of one square.
const BADGE_FRACTION = 0.45;
const ICON_FRACTION = 0.58;
const GLYPH_BOX = 24;
const EDGE_PAD = 2;

// The full-cell overlay is translucent so the king stays visible under it, and
// firms up to solid as it becomes the corner badge, which reads better opaque.
const CELL_FILL_OPACITY = 0.8;

export type BadgeVariant = 'winner' | 'draw' | GameOverReason;

/**
 * Glyph per variant, in a 24×24 box — the same drawings the view-tree board
 * uses, as path data rather than SVG elements.
 */
const GLYPHS: Partial<Record<BadgeVariant, string[]>> = {
  winner: [
    'M4.2 15.8 L3 6.8 l4.9 3.6 L12 3.8 l4.1 6.6 L21 6.8 l-1.2 9 Z',
    'M4.6 17.4 h14.8 v2.4 H4.6 Z',
  ],
  checkmate: [
    'M19,22H5V20H19V22M17,10C15.58,10 14.26,10.77 13.55,12H13V7H16V5H13V2H11V5H8V7H11V12H10.45C9.74,10.77 8.42,10 7,10A4,4 0 0,0 3,14C3,15.86 4.28,17.43 6,17.87V19H18V17.87C19.72,17.43 21,15.86 21,14A4,4 0 0,0 17,10Z',
  ],
  resign: ['M6 2.4 h2.2 v19.2 H6 Z', 'M8.2 3.6 H19.6 l-3 3.6 3 3.6 H8.2 Z'],
  abandon: [
    'M4.6 6.2 6.2 4.6 12 10.4 17.8 4.6 19.4 6.2 13.6 12 19.4 17.8 17.8 19.4 12 13.6 6.2 19.4 4.6 17.8 10.4 12 Z',
  ],
  // A draw's ½ is drawn rather than typeset: a glyph would need a font asset,
  // and this has to look identical whatever the consumer ships.
  draw: [
    'M5.2 6.4 L7.4 5.2 h1.4 v7.6 H7 V7.2 l-1.4 0.8 Z',
    'M15.6 4.6 h1.6 L8.4 19.4 H6.8 Z',
    'M14.4 12.4 h4.4 v1.4 h-2.6 v1.2 h1.2 a1.9 1.9 0 0 1 0 3.8 h-3 v-1.4 h3 a0.5 0.5 0 0 0 0-1 h-3 Z',
  ],
};
GLYPHS.stalemate = GLYPHS.draw;
// Timeout is a clock: an outline and two hands, so it is stroked below rather
// than filled like the others.
const TIMEOUT_HANDS = 'M12 7.2 V12 L15.4 14.2';

const clamp = (value: number, lo: number, hi: number): number =>
  Math.min(Math.max(value, lo), hi);

const lerp = (from: number, to: number, t: number): number => {
  'worklet';
  return from + (to - from) * t;
};

/**
 * Where a settled badge sits: the king's top-right corner, clamped inside the
 * board so a king on the h-file or back rank doesn't push it off the edge.
 */
export const gameOverBadgeCenter = (
  square: Square,
  {
    boardSize,
    pieceSize,
    flipped,
  }: Pick<BoardConfig, 'boardSize' | 'pieceSize' | 'flipped'>
): { x: number; y: number } => {
  const { x, y } = squareToPosition(square, pieceSize, flipped);
  const half = (pieceSize * BADGE_FRACTION) / 2;
  return {
    x: clamp(x + pieceSize, half + EDGE_PAD, boardSize - half - EDGE_PAD),
    y: clamp(y, half + EDGE_PAD, boardSize - half - EDGE_PAD),
  };
};

interface KingBadgeProps {
  variant: BadgeVariant;
  square: Square;
  config: BoardConfig;
  startDelayMs: number;
}

const KingBadge: React.FC<KingBadgeProps> = ({
  variant,
  square,
  config,
  startDelayMs,
}) => {
  const { pieceSize, flipped, colors } = config;
  const { x, y } = squareToPosition(square, pieceSize, flipped);
  const badge = gameOverBadgeCenter(square, config);
  const badgeSize = pieceSize * BADGE_FRACTION;

  const fill =
    variant === 'winner'
      ? colors.gameOverWinner
      : variant === 'draw' || variant === 'stalemate'
      ? colors.gameOverDraw
      : colors.gameOverLoser;

  const grow = useSharedValue(0);
  const settle = useSharedValue(0);

  useEffect(() => {
    grow.value = 0;
    settle.value = 0;
    // No overshoot easing: the overlay must never scale past its own cell.
    grow.value = withDelay(
      startDelayMs,
      withTiming(1, { duration: GROW_MS, easing: Easing.out(Easing.cubic) })
    );
    settle.value = withDelay(
      startDelayMs + GROW_MS + HOLD_MS,
      withTiming(1, { duration: SETTLE_MS, easing: Easing.inOut(Easing.cubic) })
    );
  }, [grow, settle, square, variant, startDelayMs]);

  // The overlay is a full cell scaled and translated into the corner rather
  // than resized, so the glyph shrinks with it for free.
  const cellCX = x + pieceSize / 2;
  const cellCY = y + pieceSize / 2;
  const endScale = badgeSize / pieceSize;

  const scale = useDerivedValue(() => lerp(grow.value, endScale, settle.value));
  const centreX = useDerivedValue(() => lerp(cellCX, badge.x, settle.value));
  const centreY = useDerivedValue(() => lerp(cellCY, badge.y, settle.value));

  const fillOpacity = useDerivedValue(() =>
    grow.value <= 0.01 ? 0 : lerp(CELL_FILL_OPACITY, 1, settle.value)
  );
  const glyphOpacity = useDerivedValue(() => (grow.value <= 0.01 ? 0 : 1));

  // Square while it covers the cell, circular once it is a badge. Radius is
  // pre-scale, so `pieceSize / 2` at the settled scale reads as a circle of
  // the badge's size.
  const fillRect = useDerivedValue(() => {
    const radius = lerp(0, pieceSize / 2, settle.value);
    return rrect(rect(0, 0, pieceSize, pieceSize), radius, radius);
  });

  const fillTransform = useDerivedValue(() => [
    { translateX: centreX.value - (pieceSize / 2) * scale.value },
    { translateY: centreY.value - (pieceSize / 2) * scale.value },
    { scale: scale.value },
  ]);

  const iconSize = pieceSize * ICON_FRACTION;
  const glyphTransform = useDerivedValue(() => {
    const drawn = iconSize * scale.value;
    return [
      { translateX: centreX.value - drawn / 2 },
      { translateY: centreY.value - drawn / 2 },
      { scale: drawn / GLYPH_BOX },
    ];
  });

  const paths = (GLYPHS[variant] ?? [])
    .map((d) => Skia.Path.MakeFromSVGString(d))
    .filter((path): path is NonNullable<typeof path> => !!path);
  const hands =
    variant === 'timeout' ? Skia.Path.MakeFromSVGString(TIMEOUT_HANDS) : null;

  return (
    <Group>
      <Group opacity={fillOpacity} transform={fillTransform}>
        <RoundedRect rect={fillRect} color={fill} />
      </Group>
      <Group opacity={glyphOpacity} transform={glyphTransform}>
        <Group>
          {paths.map((path, index) => (
            <Path key={index} path={path} color={colors.gameOverAccent} />
          ))}
          {variant === 'timeout' ? (
            <>
              <Circle
                cx={12}
                cy={12}
                r={8.4}
                style="stroke"
                strokeWidth={2.4}
                color={colors.gameOverAccent}
              />
              {hands ? (
                <Path
                  path={hands}
                  style="stroke"
                  strokeWidth={2.2}
                  strokeCap="round"
                  color={colors.gameOverAccent}
                />
              ) : null}
            </>
          ) : null}
        </Group>
      </Group>
    </Group>
  );
};

export interface SkiaGameOverProps {
  config: BoardConfig;
  result?: GameResult | null;
  whiteKingSquare: Square | null;
  blackKingSquare: Square | null;
  /** Lets the final move finish sliding before the badges pop. */
  startDelayMs?: number;
}

/**
 * The game-over animation.
 *
 * Decisive results pop a reason badge over the losing king and a winner badge
 * over the other; draws put the same ½ badge on both. Each overlay holds, then
 * settles into a small circular corner badge that persists until the result
 * clears.
 */
export const SkiaGameOver: React.FC<SkiaGameOverProps> = React.memo(
  ({ config, result, whiteKingSquare, blackKingSquare, startDelayMs = 0 }) => {
    if (!result) {
      return null;
    }

    const shared = { config, startDelayMs };

    if (result.reason === 'draw' || result.reason === 'stalemate') {
      return (
        <Group>
          {whiteKingSquare ? (
            <KingBadge variant="draw" square={whiteKingSquare} {...shared} />
          ) : null}
          {blackKingSquare ? (
            <KingBadge variant="draw" square={blackKingSquare} {...shared} />
          ) : null}
        </Group>
      );
    }

    if (!result.winner) {
      // Decisive without a winner says nothing about who won; drawing the
      // reason on an arbitrary king would be worse than drawing nothing.
      return null;
    }

    const loser = result.winner === 'w' ? blackKingSquare : whiteKingSquare;
    const winner = result.winner === 'w' ? whiteKingSquare : blackKingSquare;

    return (
      <Group>
        {loser ? (
          <KingBadge variant={result.reason} square={loser} {...shared} />
        ) : null}
        {winner ? (
          <KingBadge variant="winner" square={winner} {...shared} />
        ) : null}
      </Group>
    );
  }
);

SkiaGameOver.displayName = 'SkiaGameOver';
