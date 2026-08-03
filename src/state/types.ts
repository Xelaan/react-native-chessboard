import type { ImageSourcePropType } from 'react-native';
import type { SharedValue, WithSpringConfig } from 'react-native-reanimated';
import type { Square, Color } from 'chess.js';

export type PieceCode =
  | 'wp'
  | 'wn'
  | 'wb'
  | 'wr'
  | 'wq'
  | 'wk'
  | 'bp'
  | 'bn'
  | 'bb'
  | 'br'
  | 'bq'
  | 'bk'
  | null;

export interface SquareState {
  piece: SharedValue<PieceCode>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  scale: SharedValue<number>;
  zIndex: SharedValue<number>;
  // Per-square highlight flags. Writers (move-executor / reset paths) flip
  // only the affected squares, so each square's highlight worklet subscribes
  // to its own flag instead of all 64 pulling from a shared global.
  lastMove: SharedValue<boolean>;
  inCheck: SharedValue<boolean>;
}

export interface HighlightState {
  color: SharedValue<string | null>;
}

/** Legal destinations for the side to move, keyed by origin square. */
export type LegalTargets = Partial<Record<Square, Square[]>>;

export interface BoardState {
  squares: Record<Square, SquareState>;
  highlights: Record<Square, HighlightState>;
  turn: SharedValue<Color>;
  selectedSquare: SharedValue<Square | null>;
  /**
   * Targets of the CURRENTLY SELECTED piece — what the dots draw. Written from
   * the JS thread by `selectPiece`, so it lags a gesture by a round trip and
   * must never be used to judge a drop. See `legalTargets`.
   */
  validMoves: SharedValue<Square[]>;
  /**
   * Every legal move in the position, by origin square. Refreshed whenever the
   * position changes, so the gesture handler can validate a drop entirely on
   * the UI thread — without waiting for `selectPiece` to round-trip through
   * JS, which is what let fast drags be judged against a stale selection.
   */
  legalTargets: SharedValue<LegalTargets>;
  /**
   * Moves the waiting player could make if it were their turn. Empty unless
   * premoves are enabled and it is the opponent's move.
   */
  premoveTargets: SharedValue<LegalTargets>;
  /** The queued premove, drawn as a highlight until it fires or is cleared. */
  premove: SharedValue<{ from: Square; to: Square } | null>;
  /** Cell under the finger mid-drag; null when nothing is being dragged. */
  hoverSquare: SharedValue<Square | null>;
  lastMove: SharedValue<{ from: Square; to: Square } | null>;
  isCheck: SharedValue<boolean>;
  kingInCheckSquare: SharedValue<Square | null>;
}

export interface BoardConfig {
  boardSize: number;
  pieceSize: number;
  gestureEnabled: boolean;
  /**
   * Let the player queue a move during the opponent's turn. Needs
   * `playerSide` — without a side there is no "opponent's turn" to queue in.
   */
  premovesEnabled: boolean;
  /** Scale a piece grows to while it is picked up. */
  dragScale: number;
  /**
   * Lift the *rendered* dragged piece above the finger, as a fraction of one
   * square, so it isn't hidden under it. Purely visual: the targeted cell —
   * hover ring and drop — always tracks the finger, or the player would be
   * aiming with something they can't see.
   */
  dragOffsetY: number;
  /** Highlight the cell under the finger while dragging. */
  dragHoverEnabled: boolean;
  /** Diameter of the hover disc, as a multiple of one square. */
  dragHoverRingScale: number;
  /** Legal-move dot radius, as a fraction of one square. */
  dotScale: number;
  /** How long the dots take to appear / disappear, in ms. */
  dotRevealMs: number;
  dotDismissMs: number;
  /**
   * Which colour this device may pick up. `'both'` (the default) is
   * hot-seat / review; `'w'` or `'b'` is a real game, where touching the
   * opponent's pieces should do nothing at all.
   */
  playerSide: Color | 'both';
  flipped: boolean;
  withLetters: boolean;
  withNumbers: boolean;
  colors: {
    white: string;
    black: string;
    lastMoveHighlight: string;
    checkmateHighlight: string;
    /** Tint on the two squares of a queued premove. */
    premoveHighlight: string;
    /** Fill on the cell under the finger while dragging. */
    hoverSquare: string;
    /** The disc drawn around that cell. */
    hoverRing: string;
    /** Legal-move dots and the capture wedges. */
    legalMoveDot: string;
    promotionPieceButton: string;
  };
  animations: {
    move: WithSpringConfig;
    scale: WithSpringConfig;
    snapBack: WithSpringConfig;
  };
  fontSource: ImageSourcePropType | null;
  /**
   * Texture drawn under the squares. Only visible where the square colours
   * are translucent — a theme supplies the image and the alpha together.
   */
  backgroundImage: ImageSourcePropType | null;
}

// All 64 squares on a chessboard
export const SQUARES: Square[] = [
  'a8',
  'b8',
  'c8',
  'd8',
  'e8',
  'f8',
  'g8',
  'h8',
  'a7',
  'b7',
  'c7',
  'd7',
  'e7',
  'f7',
  'g7',
  'h7',
  'a6',
  'b6',
  'c6',
  'd6',
  'e6',
  'f6',
  'g6',
  'h6',
  'a5',
  'b5',
  'c5',
  'd5',
  'e5',
  'f5',
  'g5',
  'h5',
  'a4',
  'b4',
  'c4',
  'd4',
  'e4',
  'f4',
  'g4',
  'h4',
  'a3',
  'b3',
  'c3',
  'd3',
  'e3',
  'f3',
  'g3',
  'h3',
  'a2',
  'b2',
  'c2',
  'd2',
  'e2',
  'f2',
  'g2',
  'h2',
  'a1',
  'b1',
  'c1',
  'd1',
  'e1',
  'f1',
  'g1',
  'h1',
];
