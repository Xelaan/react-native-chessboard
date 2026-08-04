import React from 'react';
import { act, create } from 'react-test-renderer';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { makeMutable } from 'react-native-reanimated';
import type {
  MockPanGesture,
  MockTapGesture,
} from '../__mocks__/react-native-gesture-handler';

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

const mountAll = (boardState: BoardState) => {
  const moveExecutor = {
    tryMove: jest.fn(),
    selectPiece: jest.fn(),
  } as unknown as MoveExecutor;
  let tap: MockTapGesture | undefined;
  let pan: MockPanGesture | undefined;
  const Probe = () => {
    const gesture = useBoardGesture({
      boardState,
      config,
      moveExecutor,
      gestureEnabled: true,
    }) as unknown as { gestures: [MockTapGesture, MockPanGesture] };
    tap = gesture.gestures[0] as MockTapGesture;
    pan = gesture.gestures[1] as unknown as MockPanGesture;
    return null;
  };
  act(() => {
    create(<Probe />);
  });
  if (!tap || !pan) throw new Error('gestures were not captured');
  return { tap, pan, moveExecutor };
};

describe('tap selection', () => {
  const E2 = 'e2' as Square;
  const D2 = 'd2' as Square;
  const E4 = 'e4' as Square;

  it('grows the tapped piece so it reads as picked up', () => {
    const boardState = makeBoardState(new Chess());
    const { tap } = mountAll(boardState);

    tap.simulateTap(centre(E2));

    expect(boardState.squares[E2].scale.get()).toBe(config.tapScale);
    // zIndex is deliberately untouched: a touch can land while a move
    // animation still owns this square, and writing it would clobber that
    // animation's rollback.
    expect(boardState.squares[E2].zIndex.get()).toBe(0);
  });

  it('settles the piece again when it is deselected', () => {
    const boardState = makeBoardState(new Chess());
    const { tap } = mountAll(boardState);

    tap.simulateTap(centre(E2));
    boardState.selectedSquare.set(E2);
    tap.simulateTap(centre(E2));

    expect(boardState.squares[E2].scale.get()).toBe(1);
  });

  it('settles the previous piece when the selection moves', () => {
    const boardState = makeBoardState(new Chess());
    const { tap } = mountAll(boardState);

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
    const { tap, moveExecutor } = mountAll(boardState);

    tap.simulateTap(centre(E2));
    boardState.selectedSquare.set(E2);
    boardState.validMoves.set([E4]);
    tap.simulateTap(centre(E4));

    expect(boardState.squares[E2].scale.get()).toBe(1);
    expect(moveExecutor.tryMove).toHaveBeenCalledWith(E2, E4);
  });

  it("does not grow a piece that is not this player's to move", () => {
    const boardState = makeBoardState(new Chess());
    const { tap } = mountAll(boardState);
    const e7 = 'e7' as Square;

    tap.simulateTap(centre(e7));

    expect(boardState.squares[e7].scale.get()).toBe(1);
  });

  it('shows the selection the moment the finger lands', () => {
    // Dots on touch-down, not on release: waiting for the finger to lift
    // means the player has already decided before the board answers.
    const boardState = makeBoardState(new Chess());
    const { pan, moveExecutor } = mountAll(boardState);

    pan.simulateBegin(centre(E2));

    expect(moveExecutor.selectPiece).toHaveBeenCalledWith(E2);
    expect(boardState.squares[E2].scale.get()).toBe(config.tapScale);
  });

  it('keeps the selection when that same touch lifts', () => {
    // The touch that selects also releases on the same square; treating that
    // release as "tapped an already-selected piece" would deselect instantly.
    const boardState = makeBoardState(new Chess());
    const { pan, tap } = mountAll(boardState);

    pan.simulateBegin(centre(E2));
    boardState.selectedSquare.set(E2);
    tap.simulateTap(centre(E2));

    expect(boardState.selectedSquare.get()).toBe(E2);
  });

  it('deselects when the piece is tapped again by a later touch', () => {
    const boardState = makeBoardState(new Chess());
    const { pan, tap } = mountAll(boardState);

    pan.simulateBegin(centre(E2));
    boardState.selectedSquare.set(E2);
    tap.simulateTap(centre(E2));
    // A fresh touch: finalize clears the "this touch selected it" flag.
    pan.simulateFinalize(centre(E2));
    tap.simulateTap(centre(E2));

    expect(boardState.selectedSquare.get()).toBeNull();
  });
});
