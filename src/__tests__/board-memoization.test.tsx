import React from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { Chess, Square } from 'chess.js';
import { useFont } from '@shopify/react-native-skia';
import { makeSkImage } from '../__mocks__/react-native-skia';
import { makeMutable } from 'react-native-reanimated';
import { BoardBackground } from '../components/skia/board-background';
import { SkiaBoard } from '../components/skia/skia-board';
import { squareToPosition } from '../state/use-board-state';
import type {
  BoardConfig,
  BoardState,
  PieceCode,
  SquareState,
  HighlightState,
} from '../state/types';
import { SQUARES } from '../state/types';
import { collectLegalTargets } from '../helpers/collect-legal-targets';
import {
  MOVE_SPRING,
  SCALE_SPRING,
  SNAP_BACK_SPRING,
} from '../config/animations';
import { findAllByType, renderToTree } from './render-utils';
import type { RenderedJSON } from './render-utils';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// `BoardBackground` calls `useFont` on every render (it is not memoized
// internally), so the mock's call count is a render counter for it — and, by
// extension, for any parent that would re-render it.
const useFontMock = useFont as jest.Mock;

const PIECE_SIZE = 50;

/** A fresh object each call, mirroring an inline `colors` prop upstream. */
const makeConfig = (overrides: Partial<BoardConfig> = {}): BoardConfig => ({
  boardSize: PIECE_SIZE * 8,
  pieceSize: PIECE_SIZE,
  gestureEnabled: true,
  playerSide: 'both' as const,
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
    coordinateLight: '#62B1A8',
    coordinateDark: '#D9FDF8',
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

const makeBoardState = (): BoardState => {
  const chess = new Chess();
  const squares: Partial<Record<Square, SquareState>> = {};
  const highlights: Partial<Record<Square, HighlightState>> = {};

  for (const square of SQUARES) {
    const { x, y } = squareToPosition(square, PIECE_SIZE, false);
    const piece = chess.get(square);
    squares[square] = {
      piece: makeMutable<PieceCode>(
        piece ? (`${piece.color}${piece.type}` as PieceCode) : null
      ),
      translateX: makeMutable(x),
      translateY: makeMutable(y),
      scale: makeMutable(1),
      zIndex: makeMutable(0),
      lastMove: makeMutable(false),
      inCheck: makeMutable(false),
    };
    highlights[square] = { color: makeMutable<string | null>(null) };
  }

  return {
    squares: squares as Record<Square, SquareState>,
    highlights: highlights as Record<Square, HighlightState>,
    turn: makeMutable(chess.turn()),
    selectedSquare: makeMutable<Square | null>(null),
    validMoves: makeMutable<Square[]>([]),
    lastMove: makeMutable<{ from: Square; to: Square } | null>(null),
    isCheck: makeMutable(false),
    kingInCheckSquare: makeMutable<Square | null>(null),
    legalTargets: makeMutable(collectLegalTargets(chess)),
    premoveTargets: makeMutable({}),
    premove: makeMutable<{ from: Square; to: Square } | null>(null),
    hoverSquare: makeMutable<Square | null>(null),
  };
};

/** Renders `element`, then re-renders with `next` and reports render counts. */
const renderThenUpdate = (
  element: React.ReactElement,
  next: React.ReactElement
) => {
  let renderer: ReactTestRenderer | null = null;
  useFontMock.mockClear();

  act(() => {
    renderer = create(element);
  });
  const afterMount = useFontMock.mock.calls.length;

  act(() => {
    renderer!.update(next);
  });

  return { afterMount, afterUpdate: useFontMock.mock.calls.length };
};

describe('BoardBackground memoization', () => {
  it('does not re-render for a new config object with the same values', () => {
    const { afterMount, afterUpdate } = renderThenUpdate(
      <BoardBackground config={makeConfig()} />,
      <BoardBackground config={makeConfig()} />
    );

    expect(afterMount).toBeGreaterThan(0);
    expect(afterUpdate).toBe(afterMount);
  });

  it('re-renders when a drawn colour changes', () => {
    const { afterMount, afterUpdate } = renderThenUpdate(
      <BoardBackground config={makeConfig()} />,
      <BoardBackground
        config={makeConfig({
          colors: { ...makeConfig().colors, white: '#123456' },
        })}
      />
    );

    expect(afterUpdate).toBeGreaterThan(afterMount);
  });

  it('re-renders when pieceSize changes', () => {
    const { afterMount, afterUpdate } = renderThenUpdate(
      <BoardBackground config={makeConfig()} />,
      <BoardBackground config={makeConfig({ pieceSize: 64 })} />
    );

    expect(afterUpdate).toBeGreaterThan(afterMount);
  });

  it('re-renders on flip while coordinates are shown', () => {
    const { afterMount, afterUpdate } = renderThenUpdate(
      <BoardBackground config={makeConfig()} />,
      <BoardBackground config={makeConfig({ flipped: true })} />
    );

    expect(afterUpdate).toBeGreaterThan(afterMount);
  });

  it('ignores a flip when no coordinates are drawn', () => {
    const bare = { withLetters: false, withNumbers: false };
    const { afterMount, afterUpdate } = renderThenUpdate(
      <BoardBackground config={makeConfig(bare)} />,
      <BoardBackground config={makeConfig({ ...bare, flipped: true })} />
    );

    // The checkerboard is symmetric, so flipping it changes nothing to draw.
    expect(afterUpdate).toBe(afterMount);
  });
});

describe('SkiaBoard memoization', () => {
  it('does not re-render its subtree for an equal config object', () => {
    const boardState = makeBoardState();
    const { afterMount, afterUpdate } = renderThenUpdate(
      <SkiaBoard
        config={makeConfig()}
        boardState={boardState}
        spriteImage={null}
      />,
      <SkiaBoard
        config={makeConfig()}
        boardState={boardState}
        spriteImage={null}
      />
    );

    expect(afterMount).toBeGreaterThan(0);
    expect(afterUpdate).toBe(afterMount);
  });

  it('re-renders when a drawn colour changes', () => {
    const boardState = makeBoardState();
    const { afterMount, afterUpdate } = renderThenUpdate(
      <SkiaBoard
        config={makeConfig()}
        boardState={boardState}
        spriteImage={null}
      />,
      <SkiaBoard
        config={makeConfig({
          colors: { ...makeConfig().colors, black: '#654321' },
        })}
        boardState={boardState}
        spriteImage={null}
      />
    );

    expect(afterUpdate).toBeGreaterThan(afterMount);
  });

  it('ignores config fields it never draws', () => {
    const boardState = makeBoardState();
    const { afterMount, afterUpdate } = renderThenUpdate(
      <SkiaBoard
        config={makeConfig()}
        boardState={boardState}
        spriteImage={null}
      />,
      <SkiaBoard
        config={makeConfig({ gestureEnabled: false })}
        boardState={boardState}
        spriteImage={null}
      />
    );

    // `gestureEnabled` reaches the gesture layer, never a Skia node.
    expect(afterUpdate).toBe(afterMount);
  });

  it('re-renders when the sprite sheet arrives', () => {
    const boardState = makeBoardState();
    const config = makeConfig();
    const sprite = makeSkImage() as never;

    // The config is untouched here, so the background legitimately stays
    // bailed out — assert on the atlas the sprite is actually handed to.
    let renderer: ReactTestRenderer | null = null;
    act(() => {
      renderer = create(
        <SkiaBoard config={config} boardState={boardState} spriteImage={null} />
      );
    });

    const atlasImage = () => {
      const tree = (renderer as unknown as ReactTestRenderer).toJSON();
      const atlas = findAllByType(tree as RenderedJSON, 'skia-atlas')[0];
      return (atlas?.props as { image?: unknown } | undefined)?.image;
    };

    // No sheet yet: the atlas renders nothing at all.
    expect(atlasImage()).toBeUndefined();

    act(() => {
      renderer!.update(
        <SkiaBoard
          config={config}
          boardState={boardState}
          spriteImage={sprite}
        />
      );
    });

    expect(atlasImage()).toBe(sprite);
  });

  it('scales pieces to the sheet it was given, not a fixed cell size', () => {
    // A 1440x480 sheet is 240px cells; a 768x256 one is 128. Both must draw
    // pieces at the same on-board size — the sheet's resolution is the
    // consumer's choice, not a contract.
    const transformsFor = (sheetWidth: number) => {
      const tree = renderToTree(
        <SkiaBoard
          config={makeConfig()}
          boardState={makeBoardState()}
          spriteImage={
            makeSkImage(undefined, sheetWidth, sheetWidth / 3) as never
          }
        />
      );
      const atlas = findAllByType(tree, 'skia-atlas')[0];
      return (atlas.props as { transforms: { value: { scos: number }[] } })
        .transforms.value;
    };

    const small = transformsFor(768);
    const large = transformsFor(1440);

    // Same on-board size means the larger sheet is drawn at a smaller scale,
    // in exactly the ratio of their cell sizes.
    expect(small[0].scos / large[0].scos).toBeCloseTo(1440 / 768, 5);
  });
});
