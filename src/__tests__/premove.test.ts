import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { makeMutable } from 'react-native-reanimated';

import { createMoveExecutor } from '../state/move-executor';
import {
  collectPremoveTargets,
  isPremoveTarget,
} from '../helpers/collect-premove-targets';
import { collectLegalTargets } from '../helpers/collect-legal-targets';
import { SQUARES } from '../state/types';
import type {
  BoardConfig,
  BoardState,
  HighlightState,
  PieceCode,
  SquareState,
} from '../state/types';
import {
  MOVE_SPRING,
  SCALE_SPRING,
  SNAP_BACK_SPRING,
} from '../config/animations';

const PIECE_SIZE = 40;

const makeConfig = (overrides: Partial<BoardConfig> = {}): BoardConfig => ({
  boardSize: PIECE_SIZE * 8,
  pieceSize: PIECE_SIZE,
  gestureEnabled: true,
  premovesEnabled: true,
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
  playerSide: 'w',
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
  ...overrides,
});

const makeBoardState = (chess: Chess): BoardState => {
  const squares: Partial<Record<Square, SquareState>> = {};
  const highlights: Partial<Record<Square, HighlightState>> = {};

  for (const square of SQUARES) {
    const col = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = 8 - parseInt(square[1], 10);
    const piece = chess.get(square);
    squares[square] = {
      piece: makeMutable<PieceCode>(
        piece ? (`${piece.color}${piece.type}` as PieceCode) : null
      ),
      translateX: makeMutable(col * PIECE_SIZE),
      translateY: makeMutable(row * PIECE_SIZE),
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

const setup = (fen: string, config: BoardConfig = makeConfig()) => {
  const chess = new Chess(fen);
  const boardState = makeBoardState(chess);
  const onMove = jest.fn();
  const executor = createMoveExecutor(chess, boardState, config, { onMove });
  // Mount-time seeding, as `gesture-board` does.
  executor.syncPremoveState();
  return { chess, boardState, executor, onMove };
};

// White to move is Black's chance to premove and vice versa; these fixtures are
// always "not White's turn", with White premoving.
const BLACK_TO_MOVE =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1';

describe('collectPremoveTargets', () => {
  it('offers the waiting side moves the real position does not', () => {
    const chess = new Chess(BLACK_TO_MOVE);

    // It is Black's move, so chess.js offers White nothing.
    expect(collectLegalTargets(chess).e2).toBeUndefined();
    expect(collectPremoveTargets(chess).e2).toContain('e4');
  });

  it('still answers for a position that is unreachable when flipped', () => {
    // Black is in check here, so flipping the turn describes a position no
    // real game reaches. chess.js is lenient about that, and it does not
    // matter: firing re-validates against the real position, so an
    // over-generous map costs nothing.
    const chess = new Chess('4k3/8/8/8/8/8/4R3/4K3 b - - 0 1');

    expect(() => collectPremoveTargets(chess)).not.toThrow();
  });

  it('drops the en-passant square, which a flipped turn makes meaningless', () => {
    const chess = new Chess(
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2'
    );

    // Would be rejected as an unreachable FEN if the ep square were kept.
    expect(Object.keys(collectPremoveTargets(chess)).length).toBeGreaterThan(0);
  });
});

describe('premove queue', () => {
  it("queues a move made on the opponent's turn", () => {
    const { executor, boardState } = setup(BLACK_TO_MOVE);

    expect(executor.queuePremove('e2' as Square, 'e4' as Square)).toBe(true);
    expect(boardState.premove.get()).toEqual({ from: 'e2', to: 'e4' });
  });

  it('highlights both squares while it waits', () => {
    const { executor, boardState } = setup(BLACK_TO_MOVE);

    executor.queuePremove('e2' as Square, 'e4' as Square);

    expect(boardState.highlights.e2.color.get()).not.toBeNull();
    expect(boardState.highlights.e4.color.get()).not.toBeNull();
  });

  it('replaces the previous premove rather than stacking', () => {
    const { executor, boardState } = setup(BLACK_TO_MOVE);

    executor.queuePremove('e2' as Square, 'e4' as Square);
    executor.queuePremove('d2' as Square, 'd4' as Square);

    expect(boardState.premove.get()).toEqual({ from: 'd2', to: 'd4' });
    // The abandoned one must not leave its highlight behind.
    expect(boardState.highlights.e2.color.get()).toBeNull();
  });

  it('refuses a move the flipped position does not allow', () => {
    const { executor, boardState } = setup(BLACK_TO_MOVE);

    expect(executor.queuePremove('e2' as Square, 'e5' as Square)).toBe(false);
    expect(boardState.premove.get()).toBeNull();
  });

  it('refuses to queue on our own turn — that is just a move', () => {
    const { executor } = setup(new Chess().fen());

    expect(executor.queuePremove('e2' as Square, 'e4' as Square)).toBe(false);
  });

  it('does nothing when premoves are switched off', () => {
    const { executor } = setup(
      BLACK_TO_MOVE,
      makeConfig({ premovesEnabled: false })
    );

    expect(executor.queuePremove('e2' as Square, 'e4' as Square)).toBe(false);
  });

  it('needs a side — "both" has no opponent turn to queue in', () => {
    const { executor } = setup(
      BLACK_TO_MOVE,
      makeConfig({ playerSide: 'both' })
    );

    expect(executor.queuePremove('e2' as Square, 'e4' as Square)).toBe(false);
  });

  it('clears on request', () => {
    const { executor, boardState } = setup(BLACK_TO_MOVE);
    executor.queuePremove('e2' as Square, 'e4' as Square);

    executor.clearPremove();

    expect(boardState.premove.get()).toBeNull();
    expect(boardState.highlights.e2.color.get()).toBeNull();
  });
});

describe('premove firing', () => {
  it('plays the queued move as soon as the turn comes back', () => {
    const { chess, executor, boardState, onMove } = setup(BLACK_TO_MOVE);
    executor.queuePremove('e2' as Square, 'e4' as Square);

    // Black replies; the premove should fire off the back of it.
    executor.executeMove('e7' as Square, 'e5' as Square);

    expect(chess.history()).toEqual(['e5', 'e4']);
    expect(boardState.premove.get()).toBeNull();
    // A fired premove is a real move, so it reports like one.
    expect(onMove).toHaveBeenCalledTimes(2);
  });

  it('drops a premove the opponent made illegal', () => {
    // White queues Ra1-a5. Black's bishop on b2 takes the rook instead, so
    // there is nothing left to move — the premove has to be abandoned, not
    // retried with some other piece.
    const { chess, executor, boardState } = setup(
      '4k3/8/8/8/8/8/1b6/R3K3 b - - 0 1'
    );
    executor.queuePremove('a1' as Square, 'a5' as Square);

    executor.executeMove('b2' as Square, 'a1' as Square);

    expect(chess.history()).toEqual(['Bxa1']);
    expect(boardState.premove.get()).toBeNull();
    expect(boardState.highlights.a1.color.get()).toBeNull();
  });

  it('auto-queens a premoved pawn reaching the last rank', () => {
    // White pawn on b7, Black to move; premove bxa8 promoting.
    const { chess, executor } = setup('n3k3/1P6/8/8/8/8/8/4K3 b - - 0 1');
    executor.queuePremove('b7' as Square, 'a8' as Square);

    executor.executeMove('e8' as Square, 'e7' as Square);

    const last = chess.history({ verbose: true }).pop();
    expect(last?.promotion).toBe('q');
  });

  it('leaves nothing queued against a replaced position', () => {
    const { executor, boardState } = setup(BLACK_TO_MOVE);
    executor.queuePremove('e2' as Square, 'e4' as Square);

    executor.resetBoard();

    expect(boardState.premove.get()).toBeNull();
  });
});

describe('isPremoveTarget', () => {
  it('reads the map it is given', () => {
    const targets = { e2: ['e3', 'e4'] } as Record<string, Square[]>;

    expect(isPremoveTarget(targets, 'e2' as Square, 'e4' as Square)).toBe(true);
    expect(isPremoveTarget(targets, 'e2' as Square, 'e5' as Square)).toBe(
      false
    );
    expect(isPremoveTarget(targets, 'd2' as Square, 'd4' as Square)).toBe(
      false
    );
  });
});
