import React, { createContext, useContext, useMemo } from 'react';
import { Chess } from 'chess.js';
import type { Color } from 'chess.js';
import type { BoardState, BoardConfig } from './types';
import { useBoardState } from './use-board-state';
import { Dimensions } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import {
  MOVE_SPRING,
  SCALE_SPRING,
  SNAP_BACK_SPRING,
} from '../config/animations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DEFAULT_BOARD_SIZE = Math.floor(SCREEN_WIDTH / 8) * 8;

type BoardContextValue = {
  boardState: BoardState;
  chess: Chess;
  config: BoardConfig;
};

const BoardStateContext = createContext<BoardContextValue | null>(null);

export type BoardStateProviderProps = {
  children: React.ReactNode;
  fen?: string;
  boardSize?: number;
  gestureEnabled?: boolean;
  /**
   * Restricts dragging to one colour. Omit (or pass `'both'`) for hot-seat
   * and review boards, where either side may be moved.
   */
  playerSide?: Color | 'both';
  /** Allow queueing a move during the opponent's turn (needs `playerSide`). */
  premovesEnabled?: boolean;
  /** Scale a piece grows to while it is picked up. Default `1.2`. */
  dragScale?: number;
  /**
   * Lift the rendered dragged piece above the finger, as a fraction of one
   * square. Visual only — the drop target tracks the finger. Default `0`.
   */
  dragOffsetY?: number;
  /** Highlight the hovered cell while dragging. Default `true`. */
  dragHoverEnabled?: boolean;
  /** Diameter of the hover disc, in squares. Default `1.7`. */
  dragHoverRingScale?: number;
  /** Rank / file label size as a fraction of a square. Default `0.18`. */
  coordinateScale?: number;
  /** Legal-move dot radius as a fraction of a square. Default `0.16`. */
  dotScale?: number;
  /** Dot reveal / dismiss durations in ms. Default `140` / `100`. */
  dotRevealMs?: number;
  dotDismissMs?: number;
  flipped?: boolean;
  withLetters?: boolean;
  withNumbers?: boolean;
  colors?: Partial<BoardConfig['colors']>;
  fontSource?: ImageSourcePropType;
  /** Texture under the squares; needs translucent square colours to show. */
  backgroundImage?: ImageSourcePropType;
  /**
   * Override any of the board's spring animations. Merged over the defaults,
   * so `{ move: … }` retunes moves and leaves lift and snap-back alone.
   */
  animations?: Partial<BoardConfig['animations']>;
};

const defaultColors: BoardConfig['colors'] = {
  white: '#D9FDF8',
  black: '#62B1A8',
  lastMoveHighlight: 'rgba(255,255,0, 0.5)',
  checkmateHighlight: '#E84855',
  premoveHighlight: 'rgba(231, 76, 60, 0.55)',
  hoverSquare: 'rgba(255, 255, 255, 0.32)',
  hoverRing: 'rgba(255, 255, 255, 0.18)',
  legalMoveDot: 'rgba(0, 0, 0, 0.3)',
  // Each label reads against the square it sits on: a light square gets the
  // dark board colour and vice versa.
  coordinateLight: '#62B1A8',
  coordinateDark: '#D9FDF8',
  promotionPieceButton: '#FF9B71',
};

const defaultAnimations: BoardConfig['animations'] = {
  move: MOVE_SPRING,
  scale: SCALE_SPRING,
  snapBack: SNAP_BACK_SPRING,
};

export const BoardStateProvider: React.FC<BoardStateProviderProps> = ({
  children,
  fen,
  boardSize = DEFAULT_BOARD_SIZE,
  gestureEnabled = true,
  playerSide = 'both',
  premovesEnabled = false,
  dragScale = 1.2,
  dragOffsetY = 0,
  dragHoverEnabled = true,
  dragHoverRingScale = 1.7,
  coordinateScale = 0.18,
  dotScale = 0.16,
  dotRevealMs = 140,
  dotDismissMs = 100,
  flipped = false,
  withLetters = true,
  withNumbers = true,
  colors,
  fontSource,
  backgroundImage,
  animations,
}) => {
  const pieceSize = boardSize / 8;

  const config = useMemo(
    (): BoardConfig => ({
      boardSize,
      pieceSize,
      gestureEnabled,
      playerSide,
      premovesEnabled,
      dragScale,
      dragOffsetY,
      dragHoverEnabled,
      dragHoverRingScale,
      coordinateScale,
      dotScale,
      dotRevealMs,
      dotDismissMs,
      flipped,
      withLetters,
      withNumbers,
      colors: { ...defaultColors, ...colors },
      animations: { ...defaultAnimations, ...animations },
      fontSource: fontSource ?? null,
      backgroundImage: backgroundImage ?? null,
    }),
    [
      boardSize,
      pieceSize,
      gestureEnabled,
      playerSide,
      premovesEnabled,
      dragScale,
      dragOffsetY,
      dragHoverEnabled,
      dragHoverRingScale,
      coordinateScale,
      dotScale,
      dotRevealMs,
      dotDismissMs,
      flipped,
      withLetters,
      withNumbers,
      colors,
      fontSource,
      backgroundImage,
      animations,
    ]
  );

  const { boardState, chess } = useBoardState(fen, pieceSize, flipped);

  const value = useMemo(
    () => ({
      boardState,
      chess,
      config,
    }),
    [boardState, chess, config]
  );

  return (
    <BoardStateContext.Provider value={value}>
      {children}
    </BoardStateContext.Provider>
  );
};

export const useBoardContext = (): BoardContextValue => {
  const context = useContext(BoardStateContext);
  if (!context) {
    throw new Error('useBoardContext must be used within a BoardStateProvider');
  }
  return context;
};

export const useBoardConfig = (): BoardConfig => {
  return useBoardContext().config;
};

export const useChess = (): Chess => {
  return useBoardContext().chess;
};

export const useBoardStateValues = (): BoardState => {
  return useBoardContext().boardState;
};
