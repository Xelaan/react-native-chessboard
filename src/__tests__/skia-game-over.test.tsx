import React from 'react';
import { Group } from '@shopify/react-native-skia';
import type { Square } from 'chess.js';

import {
  SkiaGameOver,
  gameOverBadgeCenter,
} from '../components/skia/skia-game-over';
import { squareToPosition } from '../state/use-board-state';
import type { BoardConfig } from '../state/types';
import type { GameResult } from '../types';
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
  castleByDraggingToRook: true,
  dragHoverRingScale: 1.7,
  coordinateScale: 0.18,
  dotScale: 0.16,
  dotRevealMs: 140,
  dotDismissMs: 100,
  flipped: false,
  withLetters: false,
  withNumbers: false,
  colors: {
    white: '#fff',
    black: '#000',
    lastMoveHighlight: 'a',
    checkmateHighlight: 'b',
    premoveHighlight: 'c',
    selectedSquare: 'd',
    hoverSquare: 'e',
    hoverRing: 'f',
    legalMoveDot: 'g',
    coordinateLight: 'h',
    coordinateDark: 'i',
    promotionPieceButton: 'j',
    promotionDialogBackground: 'k',
    promotionOverlay: 'l',
    gameOverWinner: '#winner',
    gameOverLoser: '#loser',
    gameOverDraw: '#draw',
    gameOverAccent: '#accent',
  },
  animations: {
    move: MOVE_SPRING,
    scale: SCALE_SPRING,
    snapBack: SNAP_BACK_SPRING,
  },
  fontSource: null,
  backgroundImage: null,
};

const WHITE_KING = 'e1' as Square;
const BLACK_KING = 'e8' as Square;

const render = (result?: GameResult | null) =>
  renderToTree(
    <Group>
      <SkiaGameOver
        config={config}
        result={result}
        whiteKingSquare={WHITE_KING}
        blackKingSquare={BLACK_KING}
      />
    </Group>
  );

const fills = (result?: GameResult | null) =>
  findAllByType(render(result), 'skia-rrect').map(
    (node) => (node.props as { color: string }).color
  );

describe('SkiaGameOver', () => {
  it('draws nothing while the game is unfinished', () => {
    expect(fills(null)).toHaveLength(0);
    expect(fills(undefined)).toHaveLength(0);
  });

  it('badges the loser and the winner in their own colours', () => {
    const painted = fills({ reason: 'checkmate', winner: 'w' });

    expect(painted).toContain('#loser');
    expect(painted).toContain('#winner');
  });

  it('badges both kings the same on a draw', () => {
    const painted = fills({ reason: 'stalemate' });

    expect(painted).toEqual(['#draw', '#draw']);
  });

  it('draws nothing decisive without a winner', () => {
    // Which king lost is unknowable, and guessing is worse than silence.
    expect(fills({ reason: 'checkmate' })).toHaveLength(0);
  });

  it('gives each reason its own glyph', () => {
    const glyphOf = (result: GameResult) =>
      findAllByType(render(result), 'skia-path')
        .map((node) => (node.props as { path: { svg?: string } }).path?.svg)
        .join('|');

    const checkmate = glyphOf({ reason: 'checkmate', winner: 'w' });
    const resign = glyphOf({ reason: 'resign', winner: 'w' });
    const abandon = glyphOf({ reason: 'abandon', winner: 'w' });

    expect(new Set([checkmate, resign, abandon]).size).toBe(3);
  });

  it('draws the clock outline for a timeout', () => {
    const circles = findAllByType(
      render({ reason: 'timeout', winner: 'w' }),
      'skia-circle'
    );

    expect(circles).toHaveLength(1);
    expect((circles[0].props as { style: string }).style).toBe('stroke');
  });
});

describe('gameOverBadgeCenter', () => {
  it("settles on the king square's top-right corner", () => {
    const origin = squareToPosition('e4' as Square, PIECE_SIZE, false);
    const { x, y } = gameOverBadgeCenter('e4' as Square, config);

    expect(x).toBeCloseTo(origin.x + PIECE_SIZE, 5);
    expect(y).toBeCloseTo(origin.y, 5);
  });

  it('keeps a badge on the board from any square', () => {
    // Kings on the h-file or the back rank would push it off the edge.
    const half = (PIECE_SIZE * 0.45) / 2;
    for (const file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      for (let rank = 1; rank <= 8; rank += 1) {
        const { x, y } = gameOverBadgeCenter(
          `${file}${rank}` as Square,
          config
        );
        expect(x - half).toBeGreaterThanOrEqual(0);
        expect(y - half).toBeGreaterThanOrEqual(0);
        expect(x + half).toBeLessThanOrEqual(config.boardSize);
        expect(y + half).toBeLessThanOrEqual(config.boardSize);
      }
    }
  });
});
