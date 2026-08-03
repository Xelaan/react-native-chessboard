import React from 'react';
import { Group } from '@shopify/react-native-skia';
import type { Square } from 'chess.js';

import { SkiaSquareHighlights } from '../components/skia/skia-square-highlights';
import { squareToPosition } from '../state/use-board-state';
import type { BoardConfig } from '../state/types';
import type { SquareHighlight } from '../types';
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

const render = (
  highlights?: SquareHighlight[],
  boardConfig: BoardConfig = config
) =>
  renderToTree(
    <Group>
      <SkiaSquareHighlights config={boardConfig} highlights={highlights} />
    </Group>
  );

describe('SkiaSquareHighlights', () => {
  it('draws nothing without highlights', () => {
    expect(findAllByType(render(), 'skia-rect')).toHaveLength(0);
    expect(findAllByType(render([]), 'skia-rrect')).toHaveLength(0);
  });

  it('fills the square it is given', () => {
    const tree = render([{ square: 'e4' as Square, type: 'fill' }]);
    const [fill] = findAllByType(tree, 'skia-rect');
    const origin = squareToPosition('e4' as Square, PIECE_SIZE, false);

    expect((fill.props as { x: number }).x).toBe(origin.x);
    expect((fill.props as { width: number }).width).toBe(PIECE_SIZE);
  });

  it('defaults to a fill when the caller does not say', () => {
    const tree = render([{ square: 'e4' as Square }]);

    expect(findAllByType(tree, 'skia-rect')).toHaveLength(1);
  });

  it('strokes a ring inside the square rather than over its neighbours', () => {
    const tree = render([{ square: 'e4' as Square, type: 'ring' }]);
    const [ring] = findAllByType(tree, 'skia-rrect');
    const props = ring.props as {
      style: string;
      strokeWidth: number;
      rect: { rect: { x: number; y: number; width: number } };
    };
    const origin = squareToPosition('e4' as Square, PIECE_SIZE, false);

    expect(props.style).toBe('stroke');
    // Inset by half the stroke, so the outer edge lands on the square's edge.
    expect(props.rect.rect.x).toBeCloseTo(origin.x + props.strokeWidth / 2, 5);
    expect(props.rect.rect.width).toBeCloseTo(
      PIECE_SIZE - props.strokeWidth,
      5
    );
  });

  it('honours the colour when given one', () => {
    const tree = render([
      { square: 'e4' as Square, type: 'fill', color: '#abcdef' },
    ]);

    expect(
      (findAllByType(tree, 'skia-rect')[0].props as { color: string }).color
    ).toBe('#abcdef');
  });

  it('follows a flipped board', () => {
    const tree = render([{ square: 'e4' as Square, type: 'fill' }], {
      ...config,
      flipped: true,
    });
    const origin = squareToPosition('e4' as Square, PIECE_SIZE, true);

    expect((findAllByType(tree, 'skia-rect')[0].props as { x: number }).x).toBe(
      origin.x
    );
  });

  it('draws one node per highlight', () => {
    const tree = render([
      { square: 'e4' as Square, type: 'fill' },
      { square: 'd5' as Square, type: 'ring' },
    ]);

    expect(findAllByType(tree, 'skia-rect')).toHaveLength(1);
    expect(findAllByType(tree, 'skia-rrect')).toHaveLength(1);
  });
});
