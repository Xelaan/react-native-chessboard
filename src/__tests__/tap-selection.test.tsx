import React from 'react';
import { act, create } from 'react-test-renderer';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { makeMutable } from 'react-native-reanimated';
import type { MockTapGesture } from '../__mocks__/react-native-gesture-handler';

import { useBoardGesture } from '../hooks/use-board-gesture';
import { squareToPosition } from '../state/use-board-state';
import { collectLegalTargets } from '../helpers/collect-legal-targets';
import { SQUARES } from '../state/types';
import type {
  BoardConfig,
  BoardState,
  HighlightState,
  PieceCode,
  SquareState,
} from '../state/types';
import type { MoveExecutor } from '../state/move-executor';
import {
  MOVE_SPRING,
  SCALE_SPRING,
  SNAP_BACK_SPRING,
} from '../config/animations';

const PIECE_SIZE = 40;

const config: BoardConfig = {
  boardSize: PIECE_SIZE * 8,
  pieceSize: PIECE_SIZE,
  gestureEnabled: true,
  playerSide: 'both',
  premovesEnabled: false,
  dragScale: 1.8,
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
  },
  animations: {
    move: MOVE_SPRING,
    scale: SCALE_SPRING,
    snapBack: SNAP_BACK_SPRING,
  },
  fontSource: null,
  backgroundImage: null,
};

const makeBoardState = (chess: Chess): BoardState => {
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

const centre = (square: Square) => {
  const origin = squareToPosition(square, PIECE_SIZE, false);
  return {
    x: origin.x + PIECE_SIZE / 2,
    y: origin.y + PIECE_SIZE / 2,
    translationX: 0,
    translationY: 0,
  };
};

const mount = (boardState: BoardState) => {
  const moveExecutor = {
    tryMove: jest.fn(),
    selectPiece: jest.fn(),
  } as unknown as MoveExecutor;
  let tap: MockTapGesture | undefined;
  const Probe = () => {
    const gesture = useBoardGesture({
      boardState,
      config,
      moveExecutor,
      gestureEnabled: true,
    }) as unknown as { gestures: [MockTapGesture, unknown] };
    tap = gesture.gestures[0];
    return null;
  };
  act(() => {
    create(<Probe />);
  });
  if (!tap) throw new Error('tap gesture was not captured');
  return { tap, moveExecutor };
};

describe('tap selection', () => {
  const E2 = 'e2' as Square;
  const D2 = 'd2' as Square;
  const E4 = 'e4' as Square;

  it('grows the tapped piece so it reads as picked up', () => {
    const boardState = makeBoardState(new Chess());
    const { tap } = mount(boardState);

    tap.simulateTap(centre(E2));

    expect(boardState.squares[E2].scale.get()).toBe(config.tapScale);
    // Raised above resting pieces so growing doesn't clip it.
    expect(boardState.squares[E2].zIndex.get()).toBe(50);
  });

  it('settles the piece again when it is deselected', () => {
    const boardState = makeBoardState(new Chess());
    const { tap } = mount(boardState);

    tap.simulateTap(centre(E2));
    boardState.selectedSquare.set(E2);
    tap.simulateTap(centre(E2));

    expect(boardState.squares[E2].scale.get()).toBe(1);
    expect(boardState.squares[E2].zIndex.get()).toBe(0);
  });

  it('settles the previous piece when the selection moves', () => {
    const boardState = makeBoardState(new Chess());
    const { tap } = mount(boardState);

    tap.simulateTap(centre(E2));
    boardState.selectedSquare.set(E2);
    tap.simulateTap(centre(D2));

    expect(boardState.squares[E2].scale.get()).toBe(1);
    expect(boardState.squares[D2].scale.get()).toBe(config.tapScale);
  });

  it('settles the piece before it travels to its target', () => {
    // The move animation starts from wherever the sprite is; a grown piece
    // would shrink mid-flight.
    const boardState = makeBoardState(new Chess());
    const { tap, moveExecutor } = mount(boardState);

    tap.simulateTap(centre(E2));
    boardState.selectedSquare.set(E2);
    boardState.validMoves.set([E4]);
    tap.simulateTap(centre(E4));

    expect(boardState.squares[E2].scale.get()).toBe(1);
    expect(moveExecutor.tryMove).toHaveBeenCalledWith(E2, E4);
  });

  it("does not grow a piece that is not this player's to move", () => {
    const boardState = makeBoardState(new Chess());
    const { tap } = mount(boardState);
    const e7 = 'e7' as Square;

    tap.simulateTap(centre(e7));

    expect(boardState.squares[e7].scale.get()).toBe(1);
  });
});
