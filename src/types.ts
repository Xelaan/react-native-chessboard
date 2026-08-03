import type { Chess, Square, Color, PieceSymbol } from 'chess.js';
import type { SharedValue } from 'react-native-reanimated';

type Player = Color;
type Type = PieceSymbol;
type PieceType = `${Player}${Type}`;

type PiecesType = Record<PieceType, ReturnType<typeof require>>;
type Vector<T = number> = {
  x: T;
  y: T;
};

type ChessMove = {
  from: Square;
  to: Square;
};

type EffectTrigger = 'checkmate' | 'check' | 'stalemate' | '';

/**
 * An arrow drawn between two squares — coach lines, puzzle hints. Static: it
 * is an annotation, not an animation.
 */
interface Arrow {
  from: Square;
  to: Square;
  /** Defaults to an amber the board picks. */
  color?: string;
  /** Shaft thickness as a fraction of one square. Defaults to `0.18`. */
  width?: number;
}

/** How a finished game ended. */
type GameOverReason =
  | 'checkmate'
  | 'stalemate'
  | 'draw'
  | 'resign'
  | 'timeout'
  | 'abandon';

/**
 * A finished game. Decisive reasons badge the losing king with the reason and
 * the other with a winner badge, so they need `winner`; draws badge both and
 * ignore it.
 */
interface GameResult {
  reason: GameOverReason;
  winner?: Color | null;
}

/**
 * Localized badge text. The library ships no copy of its own — an app that
 * says nothing here gets the raw reason.
 */
type GameOverLabels = Partial<Record<GameOverReason | 'winner', string>>;

/** Glyph shown inside a {@link SquareMark} badge. */
type SquareMarkIcon = 'cross' | 'check';

/**
 * An animated badge pinned to a square — a coloured disc with a glyph. Pops
 * over the square, holds, then settles into its corner. Persists while the
 * mark is in `marks` and disappears when removed.
 */
interface SquareMark {
  square: Square;
  /** Which glyph to render. Default: `'cross'`. */
  icon?: SquareMarkIcon;
  /** Disc fill. Defaults to green for `'check'`, red for `'cross'`. */
  color?: string;
  /** Glyph colour. Defaults to white. */
  accentColor?: string;
}

interface EffectParams {
  // Center position of the effect (e.g., king position on checkmate)
  centerX: SharedValue<number>;
  centerY: SharedValue<number>;
  // Progress from 0 to 1, animated when effect triggers
  progress: SharedValue<number>;
  // Board dimensions
  boardSize: number;
  // What triggered the effect (SharedValue for reactivity)
  trigger: SharedValue<EffectTrigger>;
}

export type {
  Chess,
  Player,
  Type,
  PieceType,
  PiecesType,
  Vector,
  ChessMove,
  Square,
  Color,
  PieceSymbol,
  EffectParams,
  EffectTrigger,
  SquareMark,
  SquareMarkIcon,
  Arrow,
  GameResult,
  GameOverReason,
  GameOverLabels,
};
