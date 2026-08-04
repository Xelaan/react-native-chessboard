import React, { forwardRef } from 'react';
import type { ImageSourcePropType } from 'react-native';
import type { Move, Square } from 'chess.js';
import { BoardStateProvider } from './state';
import type { BoardStateProviderProps } from './state';
import { GestureBoard } from './components/skia';
import type { MoveResult } from './state/move-executor';
import type { ChessboardRef } from './hooks';
import type { ChessboardState } from './helpers/get-chessboard-state';
import type {
  Arrow,
  SquareHighlight,
  EffectParams,
  GameOverLabels,
  GameResult,
  SquareMark,
} from './types';

export interface ChessboardProps
  extends Omit<BoardStateProviderProps, 'children'> {
  onMove?: (result: MoveResult) => void;
  onIllegalMove?: (from: Square, to: Square) => void;
  renderEffect?: (params: EffectParams) => React.ReactNode;
  /**
   * Animated square badges — puzzle feedback and the like. Keep the array
   * referentially stable between renders; the board compares it by identity.
   */
  marks?: SquareMark[];
  /** Static annotation arrows (coach lines, hints). */
  arrows?: Arrow[];
  /** Squares to ring or tint — hints, targets, app annotations. */
  highlightedSquares?: SquareHighlight[];
  /** Terminal state; badges both kings with how the game ended. */
  gameResult?: GameResult | null;
  /** Localized badge text for `gameResult`. */
  gameOverLabels?: GameOverLabels;
  /**
   * Optional custom piece sprite sheet. Must match the standard
   * 6×2 / 128px-cell layout (row 0 = white p,n,b,r,q,k; row 1 =
   * black). Falls back to the bundled sheet when omitted.
   */
  spriteSource?: ImageSourcePropType;
  /**
   * Optional font asset for the board's letter and number labels
   * (e.g. `require('./Inter.ttf')`). Falls back to the platform
   * system font when omitted.
   */
  fontSource?: ImageSourcePropType;
}

const Chessboard = forwardRef<ChessboardRef, ChessboardProps>(
  (
    {
      fen,
      boardSize,
      gestureEnabled,
      playerSide,
      premovesEnabled,
      dragScale,
      tapScale,
      dragOffsetY,
      dragHoverEnabled,
      castleByDraggingToRook,
      dragHoverRingScale,
      coordinateScale,
      dotScale,
      dotRevealMs,
      dotDismissMs,
      flipped,
      withLetters,
      withNumbers,
      colors,
      onMove,
      onIllegalMove,
      renderEffect,
      marks,
      arrows,
      highlightedSquares,
      gameResult,
      gameOverLabels,
      spriteSource,
      fontSource,
      backgroundImage,
      animations,
    },
    ref
  ) => {
    return (
      <BoardStateProvider
        fen={fen}
        boardSize={boardSize}
        gestureEnabled={gestureEnabled}
        playerSide={playerSide}
        premovesEnabled={premovesEnabled}
        dragScale={dragScale}
        tapScale={tapScale}
        dragOffsetY={dragOffsetY}
        dragHoverEnabled={dragHoverEnabled}
        castleByDraggingToRook={castleByDraggingToRook}
        dragHoverRingScale={dragHoverRingScale}
        coordinateScale={coordinateScale}
        dotScale={dotScale}
        dotRevealMs={dotRevealMs}
        dotDismissMs={dotDismissMs}
        flipped={flipped}
        withLetters={withLetters}
        withNumbers={withNumbers}
        colors={colors}
        fontSource={fontSource}
        backgroundImage={backgroundImage}
        animations={animations}
      >
        <GestureBoard
          ref={ref}
          onMove={onMove}
          onIllegalMove={onIllegalMove}
          renderEffect={renderEffect}
          marks={marks}
          arrows={arrows}
          highlightedSquares={highlightedSquares}
          gameResult={gameResult}
          gameOverLabels={gameOverLabels}
          spriteSource={spriteSource}
        />
      </BoardStateProvider>
    );
  }
);

Chessboard.displayName = 'Chessboard';

export default Chessboard;
export { Chessboard };
export { preloadPieceSpriteSheet } from './assets/piece-images';
export type { ChessboardRef, ChessboardState, MoveResult, Move };
export type {
  Arrow,
  SquareHighlight,
  EffectParams,
  GameResult,
  GameOverReason,
  GameOverLabels,
  SquareMark,
  SquareMarkIcon,
} from './types';
