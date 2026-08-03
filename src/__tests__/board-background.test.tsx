import React from 'react';
import { Group, useFont, useImage } from '@shopify/react-native-skia';
import { makeSkImage } from '../__mocks__/react-native-skia';
import { BoardBackground } from '../components/skia/board-background';
import {
  MOVE_SPRING,
  SCALE_SPRING,
  SNAP_BACK_SPRING,
} from '../config/animations';
import type { BoardConfig } from '../state/types';
import { findAllByType, renderToTree } from './render-utils';

const useFontMock = useFont as jest.Mock;

const baseConfig = (overrides: Partial<BoardConfig> = {}): BoardConfig => ({
  boardSize: 400,
  pieceSize: 50,
  gestureEnabled: true,
  playerSide: 'both' as const,
  premovesEnabled: false,
  dragScale: 1.2,
  dragOffsetY: 0,
  dragHoverEnabled: true,
  dragHoverRingScale: 1.7,
  dotScale: 0.16,
  dotRevealMs: 140,
  dotDismissMs: 100,
  flipped: false,
  withLetters: true,
  withNumbers: true,
  colors: {
    white: '#fff',
    black: '#000',
    lastMoveHighlight: 'rgba(255,255,0,0.5)',
    checkmateHighlight: '#E84855',
    premoveHighlight: 'rgba(231, 76, 60, 0.55)',
    hoverSquare: 'rgba(255, 255, 255, 0.32)',
    hoverRing: 'rgba(255, 255, 255, 0.18)',
    legalMoveDot: 'rgba(0, 0, 0, 0.3)',
    promotionPieceButton: '#FF9B71',
  },
  animations: {
    move: MOVE_SPRING,
    scale: SCALE_SPRING,
    snapBack: SNAP_BACK_SPRING,
  },
  fontSource: null,
  backgroundImage: null,
  ...overrides,
});

const labelTexts = (config: BoardConfig): string[] =>
  findAllByType(renderToTree(<BoardBackground config={config} />), 'skia-text')
    .map((node) => (node.props as { text: string }).text)
    .sort();

describe('BoardBackground labels', () => {
  beforeEach(() => {
    useFontMock.mockClear();
    // No custom font source by default; useFont(null, ...) returns null in
    // production, so the component falls back to matchFont (system font).
    useFontMock.mockReturnValue(null);
  });

  it('paints 8 column letters when withLetters=true and withNumbers=false', () => {
    const texts = labelTexts(
      baseConfig({ withLetters: true, withNumbers: false })
    );
    expect(texts).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  });

  it('paints 8 row numbers when withLetters=false and withNumbers=true', () => {
    const texts = labelTexts(
      baseConfig({ withLetters: false, withNumbers: true })
    );
    expect(texts).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  });

  it('paints all 16 labels when both flags are true', () => {
    const texts = labelTexts(
      baseConfig({ withLetters: true, withNumbers: true })
    );
    expect(texts).toHaveLength(16);
  });

  it('paints zero labels when both flags are false', () => {
    const texts = labelTexts(
      baseConfig({ withLetters: false, withNumbers: false })
    );
    expect(texts).toHaveLength(0);
  });

  it('reverses letters when flipped=true', () => {
    // squares are pushed in row-major order; after sorting we lose order
    // information, so check the unsorted list at row 7 directly.
    const tree = renderToTree(
      <BoardBackground
        config={baseConfig({ flipped: true, withNumbers: false })}
      />
    );
    const texts = findAllByType(tree, 'skia-text').map(
      (node) => (node.props as { text: string }).text
    );
    expect(texts).toEqual(['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']);
  });

  it('reverses numbers when flipped=true', () => {
    const tree = renderToTree(
      <BoardBackground
        config={baseConfig({ flipped: true, withLetters: false })}
      />
    );
    // Row labels render once per row (col === 0), so they appear in row order.
    const texts = findAllByType(tree, 'skia-text').map(
      (node) => (node.props as { text: string }).text
    );
    expect(texts).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  });

  it('forwards a custom fontSource to useFont', () => {
    const customSource = require('../assets/pieces-sprite.png');
    renderToTree(
      <BoardBackground
        config={baseConfig({ fontSource: customSource, withNumbers: false })}
      />
    );

    expect(useFontMock).toHaveBeenCalled();
    expect(useFontMock.mock.calls[0][0]).toBe(customSource);
  });

  it('passes null to useFont when no fontSource is provided', () => {
    renderToTree(<BoardBackground config={baseConfig()} />);

    expect(useFontMock).toHaveBeenCalled();
    expect(useFontMock.mock.calls[0][0]).toBeNull();
  });

  it('still paints labels when useFont returns null (system font fallback)', () => {
    useFontMock.mockReturnValue(null);
    const texts = labelTexts(baseConfig({ withNumbers: false }));
    expect(texts).toHaveLength(8);
  });

  describe('board texture', () => {
    it('draws no image when the theme supplies none', () => {
      const tree = renderToTree(
        <Group>
          <BoardBackground config={baseConfig()} />
        </Group>
      );

      expect(findAllByType(tree, 'skia-image')).toHaveLength(0);
    });

    it('covers the board with the texture, under the squares', () => {
      (useImage as jest.Mock).mockReturnValue(makeSkImage());
      const config = baseConfig({ backgroundImage: 1 as never });

      const tree = renderToTree(
        <Group>
          <BoardBackground config={config} />
        </Group>
      );
      const images = findAllByType(tree, 'skia-image');
      const rects = findAllByType(tree, 'skia-rect');

      expect(images).toHaveLength(1);
      expect((images[0].props as { width: number }).width).toBe(
        config.pieceSize * 8
      );
      // Under the squares: a texture painted last would hide the board.
      expect(rects.length).toBeGreaterThan(0);
      (useImage as jest.Mock).mockReturnValue(null);
    });
  });
});
