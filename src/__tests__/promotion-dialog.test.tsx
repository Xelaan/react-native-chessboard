import React from 'react';
import { View } from 'react-native';

import { PromotionDialog } from '../components/promotion-dialog';
import type { BoardConfig } from '../state/types';
import {
  MOVE_SPRING,
  SCALE_SPRING,
  SNAP_BACK_SPRING,
} from '../config/animations';
import { findAllByType, renderToTree } from './render-utils';

const PIECE_SIZE = 40;

const config = {
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
    promotionPieceButton: '#button',
    promotionDialogBackground: '#panel',
    promotionOverlay: '#scrim',
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
} as BoardConfig;

const render = (overrides: { color?: 'w' | 'b'; spriteSource?: number } = {}) =>
  renderToTree(
    <View>
      <PromotionDialog
        color={overrides.color ?? 'w'}
        onSelect={jest.fn()}
        onCancel={jest.fn()}
        config={config}
        {...(overrides.spriteSource !== undefined
          ? { spriteSource: overrides.spriteSource }
          : {})}
      />
    </View>
  );

const flatten = (style: unknown): Record<string, unknown> => {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, entry) => ({ ...acc, ...flatten(entry) }),
      {}
    );
  }
  return (style ?? {}) as Record<string, unknown>;
};

describe('PromotionDialog', () => {
  it('overlays the board rather than the screen', () => {
    // A Modal centres on the screen, so on any layout where the board is not
    // dead centre the picker appears somewhere unrelated to the game.
    expect(findAllByType(render(), 'Modal')).toHaveLength(0);
  });

  it('takes its panel and scrim from the theme', () => {
    const tree = render();
    const colours = [
      // The panel is an Animated.View (it fades in); the scrim is the
      // Pressable that dismisses the picker.
      ...findAllByType(tree, 'Animated.View'),
      ...findAllByType(tree, 'Pressable'),
    ]
      .map((node) => flatten(node.props.style).backgroundColor)
      .filter(Boolean);

    expect(colours).toContain('#panel');
    expect(colours).toContain('#scrim');
  });

  it('offers a button per promotion piece', () => {
    const buttons = findAllByType(render(), 'TouchableOpacity').filter(
      (node) => flatten(node.props.style).backgroundColor === '#button'
    );

    expect(buttons).toHaveLength(4);
  });

  it('draws the pieces from the sheet the board was given', () => {
    const custom = 4242 as unknown as number;

    const sources = findAllByType(
      render({ spriteSource: custom }),
      'Image'
    ).map((node) => (node.props as { source: unknown }).source);

    expect(sources).toContain(custom);
  });

  it('windows one cell of the sheet per piece', () => {
    const images = findAllByType(render(), 'Image');
    const style = flatten(images[0]?.props.style);

    // The whole 6x2 sheet, shifted so a single cell shows through.
    expect(style.width).toBe(PIECE_SIZE * 6);
    expect(style.height).toBe(PIECE_SIZE * 2);
  });

  it('offers black its own pieces', () => {
    const offsetFor = (color: 'w' | 'b') =>
      flatten(findAllByType(render({ color }), 'Image')[0]?.props.style)
        .marginTop;

    expect(offsetFor('w')).toBe(-0);
    // Row 1 of the sheet.
    expect(offsetFor('b')).toBe(-PIECE_SIZE);
  });
});
