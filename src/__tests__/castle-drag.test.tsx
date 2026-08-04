import React from 'react';
import { act, create } from 'react-test-renderer';
import { Chess, Square } from 'chess.js';
import { makeMutable } from 'react-native-reanimated';
import type {
  MockPanGesture,
  MockTapGesture,
} from '../__mocks__/react-native-gesture-handler';
import { useBoardGesture } from '../hooks/use-board-gesture';
import { squareToPosition } from '../state/use-board-state';
import { castleDragTarget } from '../helpers/castle-drag-target';
import { createMoveExecutor, type MoveExecutor } from '../state/move-executor';
import type {
  BoardState,
  BoardConfig,
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

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const PIECE_SIZE = 50;

/** Both sides may castle either way; nothing in between the pieces. */
const CASTLING_FEN = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';

const createMockBoardState = (chess: Chess): BoardState => {
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

const config: BoardConfig = {
  boardSize: PIECE_SIZE * 8,
  pieceSize: PIECE_SIZE,
  gestureEnabled: true,
  playerSide: 'both' as const,
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

const event = (x: number, y: number) => ({
  x,
  y,
  translationX: 0,
  translationY: 0,
});

const centerOf = (square: Square) => {
  const { x, y } = squareToPosition(square, PIECE_SIZE, false);
  return { x: x + PIECE_SIZE / 2, y: y + PIECE_SIZE / 2 };
};

const mountGesture = (
  boardState: BoardState,
  overrides: Partial<BoardConfig> = {}
) => {
  const boardConfig: BoardConfig = { ...config, ...overrides };
  const moveExecutor = {
    tryMove: jest.fn(),
    selectPiece: jest.fn(),
    queuePremove: jest.fn(),
  } as unknown as MoveExecutor;

  let pan: MockPanGesture | undefined;
  let tap: MockTapGesture | undefined;

  const Probe = () => {
    const gesture = useBoardGesture({
      boardState,
      config: boardConfig,
      moveExecutor,
      gestureEnabled: true,
    }) as unknown as { gestures: [MockTapGesture, MockPanGesture] };
    tap = gesture.gestures[0];
    pan = gesture.gestures[1];
    return null;
  };

  act(() => {
    create(<Probe />);
  });

  if (!pan || !tap) throw new Error('gestures were not captured');
  return { pan, tap, moveExecutor };
};

/** Drag the piece on `from` and drop it on `to`. */
const drag = (pan: MockPanGesture, from: Square, to: Square) => {
  const start = centerOf(from);
  const end = centerOf(to);
  pan.simulateBegin(event(start.x, start.y));
  pan.simulateStart(event(start.x, start.y));
  pan.simulateUpdate(event(end.x, end.y));
  pan.simulateEnd(event(end.x, end.y));
};

describe('castleDragTarget', () => {
  const targetsFor = (fen: string, square: Square) =>
    collectLegalTargets(new Chess(fen))[square];

  it('Should read a king dropped on the h-file rook as kingside castling', () => {
    const targets = targetsFor(CASTLING_FEN, 'e1' as Square);
    expect(
      castleDragTarget('e1' as Square, 'h1' as Square, 'wk', targets)
    ).toBe('g1');
  });

  it('Should read a king dropped on the a-file rook as queenside castling', () => {
    const targets = targetsFor(CASTLING_FEN, 'e1' as Square);
    expect(
      castleDragTarget('e1' as Square, 'a1' as Square, 'wk', targets)
    ).toBe('c1');
  });

  it('Should work for black, on the eighth rank', () => {
    const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R b KQkq - 0 1';
    const targets = targetsFor(fen, 'e8' as Square);
    expect(
      castleDragTarget('e8' as Square, 'h8' as Square, 'bk', targets)
    ).toBe('g8');
    expect(
      castleDragTarget('e8' as Square, 'a8' as Square, 'bk', targets)
    ).toBe('c8');
  });

  it('Should refuse when the side has no castling rights', () => {
    const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w kq - 0 1';
    const targets = targetsFor(fen, 'e1' as Square);
    expect(
      castleDragTarget('e1' as Square, 'h1' as Square, 'wk', targets)
    ).toBeNull();
  });

  it('Should refuse when a piece stands between king and rook', () => {
    const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K1NR w KQkq - 0 1';
    const targets = targetsFor(fen, 'e1' as Square);
    // Kingside is blocked by the knight on g1; queenside is still open.
    expect(
      castleDragTarget('e1' as Square, 'h1' as Square, 'wk', targets)
    ).toBeNull();
    expect(
      castleDragTarget('e1' as Square, 'a1' as Square, 'wk', targets)
    ).toBe('c1');
  });

  it('Should refuse for a piece that is not a king', () => {
    const targets = targetsFor(CASTLING_FEN, 'a1' as Square);
    // The rook itself dragged onto the other rook is not castling.
    expect(
      castleDragTarget('a1' as Square, 'h1' as Square, 'wr', targets)
    ).toBeNull();
  });

  it('Should refuse a drop on a square that is not the paired rook', () => {
    const targets = targetsFor(CASTLING_FEN, 'e1' as Square);
    for (const square of ['b1', 'd1', 'e2', 'h2']) {
      expect(
        castleDragTarget('e1' as Square, square as Square, 'wk', targets)
      ).toBeNull();
    }
  });

  it('Should refuse a drop back on the origin square', () => {
    const targets = targetsFor(CASTLING_FEN, 'e1' as Square);
    expect(
      castleDragTarget('e1' as Square, 'e1' as Square, 'wk', targets)
    ).toBeNull();
  });

  it('Should refuse when there are no legal targets at all', () => {
    expect(
      castleDragTarget('e1' as Square, 'h1' as Square, 'wk', undefined)
    ).toBeNull();
  });
});

describe('castling by dragging the king onto the rook', () => {
  it('Should play the castle when the king is dropped on the h-file rook', () => {
    const chess = new Chess(CASTLING_FEN);
    const boardState = createMockBoardState(chess);
    const { pan, moveExecutor } = mountGesture(boardState);

    drag(pan, 'e1' as Square, 'h1' as Square);

    // The move handed to chess.js is the king's two-square move, not the
    // spelling the player used.
    expect(moveExecutor.tryMove).toHaveBeenCalledWith('e1', 'g1');
  });

  it('Should play the queenside castle when dropped on the a-file rook', () => {
    const chess = new Chess(CASTLING_FEN);
    const boardState = createMockBoardState(chess);
    const { pan, moveExecutor } = mountGesture(boardState);

    drag(pan, 'e1' as Square, 'a1' as Square);

    expect(moveExecutor.tryMove).toHaveBeenCalledWith('e1', 'c1');
  });

  it('Should animate the king to its real destination, not onto the rook', () => {
    const chess = new Chess(CASTLING_FEN);
    const boardState = createMockBoardState(chess);
    const { pan } = mountGesture(boardState);

    drag(pan, 'e1' as Square, 'h1' as Square);

    // Sliding the king onto h1 and correcting it afterwards would read as a
    // glitch, so the translation happens before anything animates.
    const g1 = squareToPosition('g1' as Square, PIECE_SIZE, false);
    const king = boardState.squares['e1' as Square];
    expect(king.translateX.get()).toBe(g1.x);
    expect(king.translateY.get()).toBe(g1.y);
  });

  it('Should leave the ordinary two-square castling drag working', () => {
    const chess = new Chess(CASTLING_FEN);
    const boardState = createMockBoardState(chess);
    const { pan, moveExecutor } = mountGesture(boardState);

    drag(pan, 'e1' as Square, 'g1' as Square);

    expect(moveExecutor.tryMove).toHaveBeenCalledWith('e1', 'g1');
  });

  it('Should snap back instead when the prop is off', () => {
    const chess = new Chess(CASTLING_FEN);
    const boardState = createMockBoardState(chess);
    const { pan, moveExecutor } = mountGesture(boardState, {
      castleByDraggingToRook: false,
    });

    drag(pan, 'e1' as Square, 'h1' as Square);

    expect(moveExecutor.tryMove).not.toHaveBeenCalled();
  });

  it('Should not castle when the rook is TAPPED rather than dragged', () => {
    const chess = new Chess(CASTLING_FEN);
    const boardState = createMockBoardState(chess);
    const { tap, moveExecutor } = mountGesture(boardState);

    // Select the king, then tap the rook. Dragging to the rook is the only
    // way to spell it this way — a tap there must stay inert, or the rook
    // becomes a target that no dot ever advertised.
    const king = centerOf('e1' as Square);
    tap.simulateTap(event(king.x, king.y));
    boardState.validMoves.set(
      chess.moves({ square: 'e1' as Square, verbose: true }).map((m) => m.to)
    );

    const rook = centerOf('h1' as Square);
    tap.simulateTap(event(rook.x, rook.y));

    expect(moveExecutor.tryMove).not.toHaveBeenCalled();
  });

  it('Should not put a dot on the rook square', () => {
    const chess = new Chess(CASTLING_FEN);
    const boardState = createMockBoardState(chess);
    // The real executor, so this reads the dots the board would actually
    // draw rather than re-deriving them from chess.js.
    const executor = createMoveExecutor(chess, boardState, config, {});

    executor.selectPiece('e1' as Square);
    const dots = boardState.validMoves.get();

    // The castle is offered once, at the square the king lands on. The rook
    // stays undecorated — it is a drag affordance only, so nothing on screen
    // invites the tap that would not work.
    expect(dots).toContain('g1');
    expect(dots).toContain('c1');
    expect(dots).not.toContain('h1');
    expect(dots).not.toContain('a1');
  });
});
