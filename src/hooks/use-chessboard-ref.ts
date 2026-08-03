import { useImperativeHandle, useCallback, useMemo } from 'react';
import type { Ref } from 'react';
import type { Move, Square, PieceSymbol } from 'chess.js';
import type { Chess } from 'chess.js';
import type { BoardState } from '../state/types';
import type { MoveExecutor } from '../state/move-executor';
import {
  getChessboardState,
  ChessboardState,
} from '../helpers/get-chessboard-state';
import { SQUARES } from '../state/types';

export interface ChessboardRef {
  move: (params: {
    from: Square;
    to: Square;
    promotion?: PieceSymbol;
  }) => Promise<Move | undefined>;
  undo: () => Move | null;
  /**
   * Replays the most recently undone move. Navigation, not play — it does not
   * fire `onMove`, and playing any new move discards what was undone.
   */
  redo: () => Move | null;
  /** Whether `undo` / `redo` would do anything right now. */
  canUndo: () => boolean;
  canRedo: () => boolean;
  highlight: (params: { square: Square; color?: string }) => void;
  resetAllHighlightedSquares: () => void;
  /**
   * Resets the board to `fen` (or the starting position).
   *
   * Resolves once a `slide` animation has settled, so callers can sequence
   * work against it. With no `slide` there is nothing to animate and the
   * promise is already resolved — awaiting is optional in every case.
   */
  resetBoard: (
    fen?: string,
    opts?: {
      slide?: { from: Square; to: Square };
      lastMove?: { from: Square; to: Square } | null;
    }
  ) => Promise<void>;
  getState: () => ChessboardState;
}

interface UseChessboardRefProps {
  ref: Ref<ChessboardRef>;
  chess: Chess;
  boardState: BoardState;
  moveExecutor: MoveExecutor;
  defaultHighlightColor?: string;
}

export const useChessboardRef = ({
  ref,
  chess,
  boardState,
  moveExecutor,
  defaultHighlightColor = 'rgba(255, 255, 0, 0.5)',
}: UseChessboardRefProps) => {
  const move = useCallback(
    async (params: {
      from: Square;
      to: Square;
      promotion?: PieceSymbol;
    }): Promise<Move | undefined> => {
      return moveExecutor.tryMove(params.from, params.to, params.promotion);
    },
    [moveExecutor]
  );

  const undo = useCallback((): Move | null => {
    return moveExecutor.undo();
  }, [moveExecutor]);

  const redo = useCallback((): Move | null => {
    return moveExecutor.redo();
  }, [moveExecutor]);

  const canUndo = useCallback(
    (): boolean => moveExecutor.canUndo(),
    [moveExecutor]
  );

  const canRedo = useCallback(
    (): boolean => moveExecutor.canRedo(),
    [moveExecutor]
  );

  const highlight = useCallback(
    (params: { square: Square; color?: string }) => {
      const highlightState = boardState.highlights[params.square];
      if (highlightState) {
        highlightState.color.set(params.color ?? defaultHighlightColor);
      }
    },
    [boardState.highlights, defaultHighlightColor]
  );

  const resetAllHighlightedSquares = useCallback(() => {
    for (const square of SQUARES) {
      boardState.highlights[square].color.set(null);
      boardState.squares[square].lastMove.set(false);
      boardState.squares[square].inCheck.set(false);
    }
    boardState.lastMove.set(null);
    boardState.kingInCheckSquare.set(null);
  }, [
    boardState.highlights,
    boardState.squares,
    boardState.lastMove,
    boardState.kingInCheckSquare,
  ]);

  const resetBoard = useCallback(
    (
      fen?: string,
      opts?: {
        slide?: { from: Square; to: Square };
        lastMove?: { from: Square; to: Square } | null;
      }
    ) => {
      // An externally supplied position replaces the game; whatever was undone
      // belongs to the old one. `undo`/`redo` reach the executor's own
      // `resetBoard` directly, so their stack survives.
      moveExecutor.clearRedo();
      return moveExecutor.resetBoard(fen, opts);
    },
    [moveExecutor]
  );

  const getState = useCallback((): ChessboardState => {
    return getChessboardState(chess);
  }, [chess]);

  const refValue = useMemo(
    (): ChessboardRef => ({
      move,
      undo,
      redo,
      canUndo,
      canRedo,
      highlight,
      resetAllHighlightedSquares,
      resetBoard,
      getState,
    }),
    [
      move,
      undo,
      redo,
      canUndo,
      canRedo,
      highlight,
      resetAllHighlightedSquares,
      resetBoard,
      getState,
    ]
  );

  useImperativeHandle(ref, () => refValue, [refValue]);

  return refValue;
};
