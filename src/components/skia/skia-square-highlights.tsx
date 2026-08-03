import React from 'react';
import {
  Group,
  Rect,
  RoundedRect,
  rrect,
  rect,
} from '@shopify/react-native-skia';
import type { Square } from 'chess.js';

import type { BoardConfig } from '../../state/types';
import { squareToPosition } from '../../state/use-board-state';
import type { SquareHighlight } from '../../types';

/** Ring thickness and corner radius, as fractions of one square. */
const RING_WIDTH = 0.06;
const CORNER_RADIUS = 0.12;
const DEFAULT_COLOR = 'rgba(255, 213, 79, 0.9)';

export interface SkiaSquareHighlightsProps {
  config: BoardConfig;
  highlights?: SquareHighlight[];
}

/**
 * Caller-declared square highlights.
 *
 * Distinct from `SkiaHighlights`, which renders what the *board* knows —
 * last move, check, and whatever `ref.highlight()` set. These come from
 * props: the origin square of a coach hint, a puzzle's target, an
 * annotation an app draws for its own reasons.
 *
 * `fill` tints the whole square; `ring` outlines it, which is what you want
 * when the square already has a piece on it and tinting would fight with the
 * artwork.
 */
export const SkiaSquareHighlights: React.FC<SkiaSquareHighlightsProps> =
  React.memo(({ config, highlights }) => {
    if (!highlights?.length) {
      return null;
    }

    const { pieceSize, flipped } = config;
    const ringWidth = pieceSize * RING_WIDTH;
    const radius = pieceSize * CORNER_RADIUS;

    return (
      <Group>
        {highlights.map((highlight) => {
          const { x, y } = squareToPosition(
            highlight.square as Square,
            pieceSize,
            flipped
          );
          const color = highlight.color ?? DEFAULT_COLOR;

          if (highlight.type === 'ring') {
            // Inset by half the stroke so the ring sits inside the square
            // rather than bleeding over its neighbours.
            const inset = ringWidth / 2;
            return (
              <RoundedRect
                key={`${highlight.square}-ring`}
                rect={rrect(
                  rect(
                    x + inset,
                    y + inset,
                    pieceSize - ringWidth,
                    pieceSize - ringWidth
                  ),
                  radius,
                  radius
                )}
                style="stroke"
                strokeWidth={ringWidth}
                color={color}
              />
            );
          }

          return (
            <Rect
              key={`${highlight.square}-fill`}
              x={x}
              y={y}
              width={pieceSize}
              height={pieceSize}
              color={color}
            />
          );
        })}
      </Group>
    );
  });

SkiaSquareHighlights.displayName = 'SkiaSquareHighlights';
