import React from 'react';
import { Path, Skia } from '@shopify/react-native-skia';
import type { Square } from 'chess.js';

import type { BoardConfig } from '../../state/types';
import { squareToPosition } from '../../state/use-board-state';
import type { Arrow } from '../../types';

/** Shaft thickness as a fraction of one square, when the arrow doesn't say. */
const DEFAULT_WIDTH = 0.18;
const HEAD_LENGTH = 2.2;
const HEAD_HALF_WIDTH = 1.4;
// The tip stops short of the destination's edge, and the tail starts off the
// source's centre — an arrow drawn corner to corner reads as covering the
// squares rather than pointing between them.
const TIP_BACKOFF = 0.25;
const TAIL_FORWARD = 0.18;
const DEFAULT_COLOR = 'rgba(255, 170, 0, 0.85)';

export interface ArrowGeometry {
  /** Shaft, from the tail to where the head begins. */
  tail: { x: number; y: number };
  base: { x: number; y: number };
  /** Filled head: tip plus the two base corners. */
  tip: { x: number; y: number };
  left: { x: number; y: number };
  right: { x: number; y: number };
  strokeWidth: number;
}

/**
 * Arrow geometry in board coordinates. Pure and exported so the shape can be
 * asserted without rendering — the maths is the part that goes subtly wrong
 * (backwards heads, arrows that overshoot the board on a knight move).
 *
 * Returns `null` for a zero-length arrow, which has no direction to point in.
 */
export const arrowGeometry = (
  arrow: Arrow,
  { pieceSize, flipped }: Pick<BoardConfig, 'pieceSize' | 'flipped'>
): ArrowGeometry | null => {
  const from = squareToPosition(arrow.from as Square, pieceSize, flipped);
  const to = squareToPosition(arrow.to as Square, pieceSize, flipped);

  const startX = from.x + pieceSize / 2;
  const startY = from.y + pieceSize / 2;
  const endX = to.x + pieceSize / 2;
  const endY = to.y + pieceSize / 2;

  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) {
    return null;
  }

  // Unit vector along the arrow, and its perpendicular.
  const ux = dx / length;
  const uy = dy / length;
  const px = -uy;
  const py = ux;

  const strokeWidth = pieceSize * (arrow.width ?? DEFAULT_WIDTH);
  const headLength = strokeWidth * HEAD_LENGTH;
  const headHalfWidth = strokeWidth * HEAD_HALF_WIDTH;

  const tipX = endX - ux * pieceSize * TIP_BACKOFF;
  const tipY = endY - uy * pieceSize * TIP_BACKOFF;
  const baseX = tipX - ux * headLength;
  const baseY = tipY - uy * headLength;

  return {
    tail: {
      x: startX + ux * pieceSize * TAIL_FORWARD,
      y: startY + uy * pieceSize * TAIL_FORWARD,
    },
    base: { x: baseX, y: baseY },
    tip: { x: tipX, y: tipY },
    left: { x: baseX + px * headHalfWidth, y: baseY + py * headHalfWidth },
    right: { x: baseX - px * headHalfWidth, y: baseY - py * headHalfWidth },
    strokeWidth,
  };
};

const ArrowShape: React.FC<{ arrow: Arrow; config: BoardConfig }> = ({
  arrow,
  config,
}) => {
  const geometry = arrowGeometry(arrow, config);
  if (!geometry) {
    return null;
  }

  const { tail, base, tip, left, right, strokeWidth } = geometry;
  const color = arrow.color ?? DEFAULT_COLOR;

  const shaft = Skia.Path.Make();
  shaft.moveTo(tail.x, tail.y);
  shaft.lineTo(base.x, base.y);

  const head = Skia.Path.Make();
  head.moveTo(tip.x, tip.y);
  head.lineTo(left.x, left.y);
  head.lineTo(right.x, right.y);
  head.close();

  return (
    <>
      <Path
        path={shaft}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="round"
        color={color}
      />
      <Path path={head} style="fill" color={color} />
    </>
  );
};

export interface SkiaArrowsProps {
  config: BoardConfig;
  arrows?: Arrow[];
}

/**
 * Coach / hint arrows drawn between two squares.
 *
 * Two draws each (a stroked shaft, a filled head) and no per-frame work —
 * arrows are static annotations, so nothing here animates.
 */
export const SkiaArrows: React.FC<SkiaArrowsProps> = React.memo(
  ({ config, arrows }) => {
    if (!arrows?.length) {
      return null;
    }
    return (
      <>
        {arrows.map((arrow) => (
          <ArrowShape
            key={`${arrow.from}-${arrow.to}`}
            arrow={arrow}
            config={config}
          />
        ))}
      </>
    );
  }
);

SkiaArrows.displayName = 'SkiaArrows';
