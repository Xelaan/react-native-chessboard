import React from 'react';
import { View } from 'react-native';
import { Chess } from 'chess.js';

import { GameOverBadges } from '../components/game-over-badges';
import type { BoardConfig } from '../state/types';
import type { GameOverLabels, GameResult } from '../types';
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
  playerSide: 'both',
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
  },
  animations: {
    move: MOVE_SPRING,
    scale: SCALE_SPRING,
    snapBack: SNAP_BACK_SPRING,
  },
  fontSource: null,
  backgroundImage: null,
};

const LABELS: GameOverLabels = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  draw: 'Draw',
  resign: 'Resigned',
  timeout: 'Time out',
  abandon: 'Abandoned',
  winner: 'Winner',
};

const labelsOf = (
  result?: GameResult | null,
  labels: GameOverLabels = LABELS
): string[] => {
  // Wrapped so an unfinished game (which renders nothing) still has a root.
  const tree = renderToTree(
    <View>
      <GameOverBadges
        chess={new Chess()}
        config={config}
        result={result}
        labels={labels}
      />
    </View>
  );
  return findAllByType(tree, 'Text').flatMap((node) =>
    (node.children ?? []).filter(
      (child): child is string => typeof child === 'string'
    )
  );
};

describe('GameOverBadges', () => {
  it('draws nothing while the game is unfinished', () => {
    expect(labelsOf(null)).toEqual([]);
    expect(labelsOf(undefined)).toEqual([]);
  });

  it('badges the loser with the reason and the winner with the winner label', () => {
    const labels = labelsOf({ reason: 'checkmate', winner: 'w' });

    expect(labels).toContain('Checkmate');
    expect(labels).toContain('Winner');
  });

  it('badges both kings with the reason on a draw', () => {
    const labels = labelsOf({ reason: 'stalemate' });

    expect(labels).toEqual(['Stalemate', 'Stalemate']);
    expect(labels).not.toContain('Winner');
  });

  it('falls back to the raw reason when the app supplies no copy', () => {
    const labels = labelsOf({ reason: 'timeout', winner: 'b' }, {});

    expect(labels).toContain('timeout');
  });

  it('says the same thing whichever side won', () => {
    const white = labelsOf({ reason: 'resign', winner: 'w' });
    const black = labelsOf({ reason: 'resign', winner: 'b' });

    expect(white.sort()).toEqual(black.sort());
  });
});
