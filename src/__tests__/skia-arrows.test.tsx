import React from 'react';
import { Group } from '@shopify/react-native-skia';
import type { Square } from 'chess.js';

import { SkiaArrows, arrowGeometry } from '../components/skia/skia-arrows';
import { squareToPosition } from '../state/use-board-state';
import type { BoardConfig } from '../state/types';
import type { Arrow } from '../types';
import {
  MOVE_SPRING,
  SCALE_SPRING,
  SNAP_BACK_SPRING,
} from '../config/animations';
import { findAllByType, renderToTree } from './render-utils';

const PIECE_SIZE = 40;

const config: BoardConfig = {
  boardSize: PIECE_SIZE * 8,
  pieceSize: PIECE_SIZE,
  gestureEnabled: true,
  playerSide: 'both',
  premovesEnabled: false,
  dragScale: 1.2,
  tapScale: 1.08,
  dragOffsetY: 0,
  dragHoverEnabled: true,
  dragHoverRingScale: 1.7,
  coordinateScale: 0.18,
  dotScale: 0.16,
  dotRevealMs: 140,
  dotDismissMs: 100,
  flipped: false,
  withLetters: false,
  withNumbers: false,
  colors: {
    white: '#f0d9b5',
    black: '#b58863',
    lastMoveHighlight: 'rgba(255, 255, 0, 0.4)',
    checkmateHighlight: 'rgba(255, 0, 0, 0.4)',
    premoveHighlight: 'rgba(231, 76, 60, 0.55)',
    selectedSquare: 'rgba(255, 255, 0, 0.5)',
    hoverSquare: 'rgba(255, 255, 255, 0.32)',
    hoverRing: 'rgba(255, 255, 255, 0.18)',
    legalMoveDot: 'rgba(0, 0, 0, 0.3)',
    coordinateLight: '#62B1A8',
    coordinateDark: '#D9FDF8',
    promotionPieceButton: 'rgba(255, 255, 255, 0.8)',
    promotionDialogBackground: '#fff',
    promotionOverlay: 'rgba(0, 0, 0, 0.4)',
    gameOverWinner: '#81b64c',
    gameOverLoser: '#fa412d',
    gameOverDraw: '#8b8987',
    gameOverAccent: '#ffffff',
  },
  animations: {
    move: MOVE_SPRING,
    scale: SCALE_SPRING,
    snapBack: SNAP_BACK_SPRING,
  },
  fontSource: null,
  backgroundImage: null,
};

const paths = (arrows?: Arrow[]) =>
  findAllByType(
    renderToTree(
      <Group>
        <SkiaArrows config={config} arrows={arrows} />
      </Group>
    ),
    'skia-path'
  );

const centre = (square: Square, flipped = false) => {
  const origin = squareToPosition(square, PIECE_SIZE, flipped);
  return { x: origin.x + PIECE_SIZE / 2, y: origin.y + PIECE_SIZE / 2 };
};

const distance = (
  a: { x: number; y: number },
  b: { x: number; y: number }
): number => Math.hypot(a.x - b.x, a.y - b.y);

describe('SkiaArrows', () => {
  it('draws nothing without arrows', () => {
    expect(paths()).toHaveLength(0);
    expect(paths([])).toHaveLength(0);
  });

  it('draws a stroked shaft and a filled head per arrow', () => {
    const rendered = paths([{ from: 'e2' as Square, to: 'e4' as Square }]);

    expect(rendered).toHaveLength(2);
    expect((rendered[0].props as { style: string }).style).toBe('stroke');
    expect((rendered[1].props as { style: string }).style).toBe('fill');
  });

  it('closes the head so it fills as a triangle', () => {
    const [, head] = paths([{ from: 'e2' as Square, to: 'e4' as Square }]);
    const path = (
      head.props as { path: { closed: boolean; points: unknown[] } }
    ).path;

    expect(path.closed).toBe(true);
    expect(path.points).toHaveLength(3);
  });

  it('takes the colour from the arrow when it gives one', () => {
    const [shaft] = paths([
      { from: 'e2' as Square, to: 'e4' as Square, color: '#abcdef' },
    ]);

    expect((shaft.props as { color: string }).color).toBe('#abcdef');
  });
});

describe('arrowGeometry', () => {
  const geometryFor = (from: string, to: string, flipped = false) =>
    arrowGeometry(
      { from: from as Square, to: to as Square },
      { pieceSize: PIECE_SIZE, flipped }
    );

  it('has no direction for a zero-length arrow', () => {
    expect(geometryFor('e4', 'e4')).toBeNull();
  });

  it('points from the source toward the destination', () => {
    const geometry = geometryFor('e2', 'e4');
    if (!geometry) throw new Error('expected geometry');

    // e2 → e4 travels up the board, so the tip is above the tail.
    expect(geometry.tip.y).toBeLessThan(geometry.tail.y);
    expect(geometry.tip.x).toBeCloseTo(geometry.tail.x, 5);
  });

  it('stops short of both square centres', () => {
    const geometry = geometryFor('e2', 'e4');
    if (!geometry) throw new Error('expected geometry');

    // The tip lands inside the destination rather than on its far edge, and
    // the tail starts off the source's centre.
    expect(distance(geometry.tip, centre('e4' as Square))).toBeGreaterThan(0);
    expect(distance(geometry.tip, centre('e4' as Square))).toBeLessThan(
      PIECE_SIZE / 2
    );
    expect(distance(geometry.tail, centre('e2' as Square))).toBeGreaterThan(0);
  });

  it('puts the head corners either side of the shaft', () => {
    const geometry = geometryFor('e2', 'e4');
    if (!geometry) throw new Error('expected geometry');

    // Symmetric about the base, and the head is behind the tip.
    expect(distance(geometry.left, geometry.base)).toBeCloseTo(
      distance(geometry.right, geometry.base),
      5
    );
    expect(geometry.base.y).toBeGreaterThan(geometry.tip.y);
  });

  it('handles a diagonal without distorting the head', () => {
    const geometry = geometryFor('a1', 'h8');
    if (!geometry) throw new Error('expected geometry');

    expect(distance(geometry.left, geometry.base)).toBeCloseTo(
      distance(geometry.right, geometry.base),
      5
    );
  });

  it('follows a flipped board', () => {
    const normal = geometryFor('e2', 'e4');
    const flipped = geometryFor('e2', 'e4', true);
    if (!normal || !flipped) throw new Error('expected geometry');

    // Same move, mirrored board: the arrow now points the other way.
    expect(flipped.tip.y).toBeGreaterThan(flipped.tail.y);
    expect(normal.tip.y).toBeLessThan(normal.tail.y);
  });

  it('scales the shaft with the requested width', () => {
    const thin = arrowGeometry(
      { from: 'e2' as Square, to: 'e4' as Square, width: 0.1 },
      { pieceSize: PIECE_SIZE, flipped: false }
    );
    const thick = arrowGeometry(
      { from: 'e2' as Square, to: 'e4' as Square, width: 0.3 },
      { pieceSize: PIECE_SIZE, flipped: false }
    );

    expect(thin?.strokeWidth).toBeLessThan(thick?.strokeWidth ?? 0);
  });
});
