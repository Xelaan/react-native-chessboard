import React from 'react';
import { Group } from '@shopify/react-native-skia';
import type { Square } from 'chess.js';

import { SkiaMarks, markBadgeCenter } from '../components/skia/skia-marks';
import { squareToPosition } from '../state/use-board-state';
import type { BoardConfig } from '../state/types';
import type { SquareMark } from '../types';
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
    hoverSquare: 'rgba(255, 255, 255, 0.32)',
    hoverRing: 'rgba(255, 255, 255, 0.18)',
    legalMoveDot: 'rgba(0, 0, 0, 0.3)',
    coordinateLight: '#62B1A8',
    coordinateDark: '#D9FDF8',
    promotionPieceButton: 'rgba(255, 255, 255, 0.8)',
  },
  animations: {
    move: MOVE_SPRING,
    scale: SCALE_SPRING,
    snapBack: SNAP_BACK_SPRING,
  },
  fontSource: null,
  backgroundImage: null,
};

const render = (marks?: SquareMark[], boardConfig: BoardConfig = config) =>
  renderToTree(
    <Group>
      <SkiaMarks config={boardConfig} marks={marks} />
    </Group>
  );

const circles = (marks?: SquareMark[], boardConfig?: BoardConfig) =>
  findAllByType(render(marks, boardConfig), 'skia-circle');

const glyphs = (marks?: SquareMark[]) =>
  findAllByType(render(marks), 'skia-path').map(
    (node) => (node.props as { path: { svg?: string } | null }).path?.svg ?? ''
  );

describe('SkiaMarks', () => {
  it('draws nothing without marks', () => {
    expect(circles()).toHaveLength(0);
    expect(circles([])).toHaveLength(0);
  });

  it('draws one badge per mark', () => {
    expect(
      circles([{ square: 'e4' as Square }, { square: 'd5' as Square }])
    ).toHaveLength(2);
  });

  it('starts over the square it marks', () => {
    // Before the settle animation runs, the badge is centred on the cell —
    // the pop reads as landing on the piece, not beside it.
    const [circle] = circles([{ square: 'e4' as Square }]);
    const origin = squareToPosition('e4' as Square, PIECE_SIZE, false);

    const cx = (circle.props as { cx: { value: number } }).cx.value;
    const cy = (circle.props as { cy: { value: number } }).cy.value;

    expect(cx).toBeCloseTo(origin.x + PIECE_SIZE / 2, 5);
    expect(cy).toBeCloseTo(origin.y + PIECE_SIZE / 2, 5);
  });

  it('follows the board when it is flipped', () => {
    const flipped = { ...config, flipped: true };
    const [circle] = circles([{ square: 'e4' as Square }], flipped);
    const origin = squareToPosition('e4' as Square, PIECE_SIZE, true);

    const cx = (circle.props as { cx: { value: number } }).cx.value;

    expect(cx).toBeCloseTo(origin.x + PIECE_SIZE / 2, 5);
  });

  it('uses the glyph the mark asks for, defaulting to a cross', () => {
    const [check] = glyphs([{ square: 'e4' as Square, icon: 'check' }]);
    const [cross] = glyphs([{ square: 'e4' as Square, icon: 'cross' }]);
    const [fallback] = glyphs([{ square: 'e4' as Square }]);

    expect(check).not.toBe(cross);
    expect(fallback).toBe(cross);
  });

  it('colours by icon unless the mark overrides it', () => {
    const [defaulted] = circles([{ square: 'e4' as Square, icon: 'check' }]);
    const [overridden] = circles([
      { square: 'e4' as Square, icon: 'check', color: '#123456' },
    ]);

    expect((defaulted.props as { color: string }).color).not.toBe('#123456');
    expect((overridden.props as { color: string }).color).toBe('#123456');
  });

  describe('markBadgeCenter', () => {
    // The settled position is what the animation ends on, and the mocked
    // timing here never advances — so assert the geometry directly.
    const inside = (square: Square, boardConfig: BoardConfig = config) => {
      const { x, y, radius } = markBadgeCenter(square, boardConfig);
      return (
        x - radius >= 0 &&
        y - radius >= 0 &&
        x + radius <= boardConfig.boardSize &&
        y + radius <= boardConfig.boardSize
      );
    };

    it("settles on the square's top-right corner", () => {
      const origin = squareToPosition('e4' as Square, PIECE_SIZE, false);
      const { x, y } = markBadgeCenter('e4' as Square, config);

      expect(x).toBeCloseTo(origin.x + PIECE_SIZE, 5);
      expect(y).toBeCloseTo(origin.y, 5);
    });

    it("keeps every square's badge on the board", () => {
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      for (const file of files) {
        for (let rank = 1; rank <= 8; rank += 1) {
          const square = `${file}${rank}` as Square;
          expect(inside(square)).toBe(true);
          expect(inside(square, { ...config, flipped: true })).toBe(true);
        }
      }
    });

    it('pulls the corner squares back inside', () => {
      // h8 is the one that would hang off both edges without the clamp.
      const origin = squareToPosition('h8' as Square, PIECE_SIZE, false);
      const { x, y } = markBadgeCenter('h8' as Square, config);

      expect(x).toBeLessThan(origin.x + PIECE_SIZE);
      expect(y).toBeGreaterThan(origin.y);
    });
  });
});
