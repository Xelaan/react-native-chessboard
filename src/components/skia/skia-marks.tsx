import React, { useEffect } from 'react';
import { Circle, Group, Path, Skia } from '@shopify/react-native-skia';
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
import type { SquareMark, SquareMarkIcon } from '../../types';

// Choreography: the badge pops as a translucent full-cell fill over the piece,
// holds, then settles into a small opaque circle on the square's corner. Same
// timings as the game-over badge so the two read as one language.
const GROW_MS = 300;
const HOLD_MS = 800;
const SETTLE_MS = 350;
const BADGE_FRACTION = 0.45;
const ICON_FRACTION = 0.58;
const CELL_FILL_OPACITY = 0.8;
const EDGE_PAD = 2;

// Material's check / close glyphs, in a 24×24 box.
const GLYPHS: Record<SquareMarkIcon, string> = {
  check: 'M9 16.17 L4.83 12 L3.41 13.41 L9 19 L21 7 L19.59 5.59 Z',
  cross:
    'M19 6.41 L17.59 5 L12 10.59 L6.41 5 L5 6.41 L10.59 12 L5 17.59 L6.41 19 L12 13.41 L17.59 19 L19 17.59 L13.41 12 Z',
};

const GLYPH_BOX = 24;
const DEFAULT_COLORS: Record<SquareMarkIcon, string> = {
  check: '#81b64c',
  cross: '#fa412d',
};
const DEFAULT_ACCENT = '#ffffff';

const clamp = (value: number, lo: number, hi: number): number =>
  Math.min(Math.max(value, lo), hi);

/**
 * Where a settled badge sits: the square's top-right corner, pulled back so an
 * edge or corner square never hangs it off the board. Exported for tests —
 * the clamp is invisible until it's wrong, and only on eight squares.
 */
export const markBadgeCenter = (
  square: Square,
  {
    boardSize,
    pieceSize,
    flipped,
  }: Pick<BoardConfig, 'boardSize' | 'pieceSize' | 'flipped'>
): { x: number; y: number; radius: number } => {
  const { x, y } = squareToPosition(square, pieceSize, flipped);
  const radius = (pieceSize * BADGE_FRACTION) / 2;
  return {
    x: clamp(x + pieceSize, radius + EDGE_PAD, boardSize - radius - EDGE_PAD),
    y: clamp(y, radius + EDGE_PAD, boardSize - radius - EDGE_PAD),
    radius,
  };
};

const lerp = (from: number, to: number, t: number): number => {
  'worklet';
  return from + (to - from) * t;
};

interface MarkProps {
  mark: SquareMark;
  config: BoardConfig;
}

/**
 * One square badge.
 *
 * Marks arrive as props (puzzle feedback changes once per move, not per
 * frame), so the animation is started from an effect — but everything it
 * drives is a derived value, so the pop itself runs on the UI thread without
 * a re-render.
 */
const SkiaMark: React.FC<MarkProps> = ({ mark, config }) => {
  const { pieceSize, flipped } = config;
  const icon: SquareMarkIcon = mark.icon ?? 'cross';
  const { x, y } = squareToPosition(mark.square as Square, pieceSize, flipped);

  const cellCX = x + pieceSize / 2;
  const cellCY = y + pieceSize / 2;
  const {
    x: badgeCX,
    y: badgeCY,
    radius: badgeRadius,
  } = markBadgeCenter(mark.square as Square, config);

  const grow = useSharedValue(0);
  const settle = useSharedValue(0);

  useEffect(() => {
    grow.value = 0;
    settle.value = 0;
    grow.value = withTiming(1, {
      duration: GROW_MS,
      easing: Easing.out(Easing.cubic),
    });
    settle.value = withDelay(
      GROW_MS + HOLD_MS,
      withTiming(1, { duration: SETTLE_MS, easing: Easing.inOut(Easing.cubic) })
    );
    // Re-running on square/icon change restarts the pop, which is what a new
    // verdict on a new square should look like.
  }, [grow, settle, mark.square, icon]);

  const cx = useDerivedValue(() => lerp(cellCX, badgeCX, settle.value));
  const cy = useDerivedValue(() => lerp(cellCY, badgeCY, settle.value));
  const radius = useDerivedValue(() =>
    lerp((pieceSize / 2) * grow.value, badgeRadius, settle.value)
  );
  const opacity = useDerivedValue(() =>
    lerp(CELL_FILL_OPACITY * grow.value, 1, settle.value)
  );

  const glyph = Skia.Path.MakeFromSVGString(GLYPHS[icon]);
  const glyphTransform = useDerivedValue(() => {
    // The glyph tracks the circle: full icon size over the cell, shrinking
    // into the settled badge.
    const size = lerp(
      pieceSize * ICON_FRACTION * grow.value,
      pieceSize * BADGE_FRACTION * ICON_FRACTION * 2,
      settle.value
    );
    const scale = size / GLYPH_BOX;
    return [
      { translateX: cx.value - size / 2 },
      { translateY: cy.value - size / 2 },
      { scale },
    ];
  });

  if (!glyph) {
    return null;
  }

  return (
    <Group opacity={opacity}>
      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        color={mark.color ?? DEFAULT_COLORS[icon]}
      />
      <Group transform={glyphTransform}>
        <Path path={glyph} color={mark.accentColor ?? DEFAULT_ACCENT} />
      </Group>
    </Group>
  );
};

export interface SkiaMarksProps {
  config: BoardConfig;
  marks?: SquareMark[];
}

/**
 * Animated square badges — a coloured disc with a glyph, for puzzle feedback
 * (a red ✕ where a wrong move landed, a green ✓ on the solving move).
 *
 * Drawn as Skia paths rather than sprites on purpose: the piece atlas would
 * need a second sheet for two glyphs, and paths cost one draw each without a
 * texture upload.
 */
export const SkiaMarks: React.FC<SkiaMarksProps> = React.memo(
  ({ config, marks }) => {
    if (!marks?.length) {
      return null;
    }
    return (
      <>
        {marks.map((mark) => (
          <SkiaMark
            // Keyed by square + icon so a changed verdict remounts and replays
            // the pop rather than silently swapping the glyph.
            key={`${mark.square}-${mark.icon ?? 'cross'}`}
            mark={mark}
            config={config}
          />
        ))}
      </>
    );
  }
);

SkiaMarks.displayName = 'SkiaMarks';
