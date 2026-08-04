import { useMemo, useCallback } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { Square } from 'chess.js';
import type { BoardState, BoardConfig } from '../state/types';
import { positionToSquare, squareToPosition } from '../state/use-board-state';
import { castleDragTarget } from '../helpers/castle-drag-target';
import type { MoveExecutor } from '../state/move-executor';

interface UseBoardGestureProps {
  boardState: BoardState;
  config: BoardConfig;
  moveExecutor: MoveExecutor;
  gestureEnabled: boolean;
  onIllegalMove?: (from: Square, to: Square) => void;
}

export const useBoardGesture = ({
  boardState,
  config,
  moveExecutor,
  gestureEnabled,
  onIllegalMove,
}: UseBoardGestureProps) => {
  const {
    pieceSize,
    animations,
    flipped,
    playerSide,
    premovesEnabled,
    dragScale,
    tapScale,
    dragOffsetY,
    dragHoverEnabled,
    castleByDraggingToRook,
  } = config;
  // Visual lift, in px. Applied to the rendered piece only — every target
  // decision below reads the finger, so the player aims with the thing they
  // are touching rather than the thing floating above it.
  const liftPx = pieceSize * dragOffsetY;

  // Track the currently dragged piece
  const draggedSquare = useSharedValue<Square | null>(null);
  // Whether the pan actually crossed `minDistance` and became a drag. This
  // has to be tracked explicitly: `zIndex` is shared with the move/reset
  // animations, so it is not a reliable signal of who is holding the piece.
  const dragStarted = useSharedValue(false);
  const dragStartX = useSharedValue(0);
  const dragStartY = useSharedValue(0);
  // Offset between touch point and piece position (to follow finger exactly)
  const touchOffsetX = useSharedValue(0);
  const touchOffsetY = useSharedValue(0);
  // Whether the current touch is the one that selected the piece. Without it,
  // selecting on touch-down means the same touch's release reads as "tapped
  // the already-selected piece" and immediately deselects it.
  const selectedOnThisTouch = useSharedValue(false);

  // Stable callback for tryMove
  const handleTryMove = useCallback(
    (from: Square, to: Square) => {
      moveExecutor.tryMove(from, to);
    },
    [moveExecutor]
  );

  // Stable callback for selectPiece
  const handleSelectPiece = useCallback(
    (square: Square) => {
      moveExecutor.selectPiece(square);
    },
    [moveExecutor]
  );

  const handleQueuePremove = useCallback(
    (from: Square, to: Square) => {
      moveExecutor.queuePremove(from, to);
    },
    [moveExecutor]
  );

  // Stable callback for illegal move
  const handleIllegalMove = useCallback(
    (from: Square, to: Square) => {
      onIllegalMove?.(from, to);
    },
    [onIllegalMove]
  );

  const gesture = useMemo(() => {
    // Lift the tapped piece the way a drag does, and drop the previous one
    // back. Tap-to-move otherwise gave no feedback that a piece was picked
    // up at all — the dots appeared, but nothing said which piece they
    // belonged to.
    const selectPiece = (square: Square) => {
      'worklet';
      const previous = boardState.selectedSquare.get();
      if (previous && previous !== square) {
        boardState.squares[previous].scale.set(withSpring(1, animations.scale));
        boardState.squares[previous].zIndex.set(0);
      }
      boardState.squares[square].scale.set(
        withSpring(tapScale, animations.scale)
      );
      // Deliberately NOT raising zIndex. Selection happens on touch-down, and
      // a touch can land while a move animation still owns this square's
      // zIndex — writing it here would clobber that animation's rollback. The
      // grow is small enough that clipping against a neighbour doesn't show;
      // a drag raises to 100 in `onStart`, where it owns the square outright.
    };

    const clearSelection = () => {
      'worklet';
      const previous = boardState.selectedSquare.get();
      if (previous) {
        boardState.squares[previous].scale.set(withSpring(1, animations.scale));
        boardState.squares[previous].zIndex.set(0);
      }
      boardState.selectedSquare.set(null);
      boardState.validMoves.set([]);
    };

    const panGesture = Gesture.Pan()
      .enabled(gestureEnabled)
      .minDistance(5) // Require some movement before starting drag
      .onBegin((event) => {
        'worklet';
        dragStarted.set(false);
        // Just prepare for potential drag - store touch info
        const { x, y } = event;
        const square = positionToSquare(x, y, pieceSize, flipped);
        const squareState = boardState.squares[square];
        const piece = squareState.piece.get();

        // Only pieces the player can actually move are picked up at all —
        // not raised, not dragged, not snapped back. Two conditions, and
        // both matter:
        //
        //   * it is ours: our colour when `playerSide` is set, whichever
        //     side is to move in hot-seat / review (`'both'`)
        //   * it is playable: our turn, or premoving into the opponent's
        //
        // Lifting an opponent piece and springing it back tells the player
        // it was theirs to try, which is worse than nothing happening.
        const turn = boardState.turn.get();
        const mine =
          !!piece &&
          (playerSide === 'both' ? piece[0] === turn : piece[0] === playerSide);
        const premoving =
          premovesEnabled && playerSide !== 'both' && turn !== playerSide;
        const controllable = mine && (premoving || piece?.[0] === turn);

        if (controllable) {
          // Show the move dots the instant the finger lands, rather than
          // waiting for a release or for the drag to clear its threshold —
          // by then the player has already committed to a move.
          selectPiece(square);
          selectedOnThisTouch.set(true);
          scheduleOnRN(handleSelectPiece, square);

          // Store drag start info (but don't start drag yet)
          draggedSquare.set(square);
          dragStartX.set(squareState.translateX.get());
          dragStartY.set(squareState.translateY.get());

          const pieceCenterX = squareState.translateX.get() + pieceSize / 2;
          const pieceCenterY = squareState.translateY.get() + pieceSize / 2;
          touchOffsetX.set(x - pieceCenterX);
          touchOffsetY.set(y - pieceCenterY);
        }
      })
      .onStart(() => {
        'worklet';
        // Drag actually started (minDistance exceeded)
        const square = draggedSquare.get();
        if (!square) return;

        const squareState = boardState.squares[square];

        dragStarted.set(true);

        // Raise and scale the piece
        squareState.zIndex.set(100);
        squareState.scale.set(withSpring(dragScale, animations.scale));

        // Selection (and its dots) already happened on touch-down; the drag
        // only takes over the piece's presentation.
      })
      .onUpdate((event) => {
        'worklet';
        const square = draggedSquare.get();
        if (!square) return;

        const squareState = boardState.squares[square];

        // Update piece position using center-based offset
        // Subtracting pieceSize/2 converts from center back to top-left (translateX/Y)
        squareState.translateX.set(
          event.x - touchOffsetX.get() - pieceSize / 2
        );
        squareState.translateY.set(
          event.y - touchOffsetY.get() - pieceSize / 2 - liftPx
        );

        if (dragHoverEnabled) {
          boardState.hoverSquare.set(
            positionToSquare(
              Math.max(0, Math.min(event.x, pieceSize * 8 - 1)),
              Math.max(0, Math.min(event.y, pieceSize * 8 - 1)),
              pieceSize,
              flipped
            )
          );
        }
      })
      .onEnd((event) => {
        'worklet';
        const square = draggedSquare.get();
        if (!square) return;

        const squareState = boardState.squares[square];

        // Only process drop if the pan actually became a drag. `zIndex` used
        // to stand in for this, but the move and reset animations write it
        // too: a rollback spring cancelled mid-pan zeroes it and the live
        // drag then looked like it never started, stranding the piece under
        // the finger.
        const wasDragged = dragStarted.get();
        if (!wasDragged) {
          draggedSquare.set(null);
          return;
        }

        squareState.scale.set(withSpring(1, animations.scale));

        // Ours to drop? Same rule the pickup used: our colour, and either our
        // turn or a premove into the opponent's. Requiring `piece[0] === turn`
        // here meant every premove drag reached this point off-turn, failed,
        // and snapped back — the premove branch below was unreachable.
        const piece = squareState.piece.get();
        const turn = boardState.turn.get();
        const isMine =
          !!piece &&
          (playerSide === 'both' ? piece[0] === turn : piece[0] === playerSide);
        const canPremove =
          premovesEnabled && playerSide !== 'both' && turn !== playerSide;
        const isOwnPiece = isMine && (canPremove || piece?.[0] === turn);

        // If not own piece, just snap back (can't make moves with opponent's pieces)
        if (!isOwnPiece) {
          const originalPos = squareToPosition(square, pieceSize, flipped);
          squareState.translateX.set(
            withSpring(originalPos.x, animations.snapBack)
          );
          squareState.translateY.set(
            withSpring(originalPos.y, animations.snapBack)
          );
          squareState.zIndex.set(0);
          // Clear any previous selection/valid moves
          boardState.selectedSquare.set(null);
          boardState.validMoves.set([]);
          dragStarted.set(false);
          draggedSquare.set(null);
          return;
        }

        // Drop where the FINGER is, not where the piece is drawn: with
        // `dragOffsetY` the piece floats above the touch, and judging the drop
        // by the sprite would land moves a square away from where the player
        // aimed.
        const clampedX = Math.max(0, Math.min(event.x, pieceSize * 8 - 1));
        const clampedY = Math.max(0, Math.min(event.y, pieceSize * 8 - 1));
        const targetSquare = positionToSquare(
          clampedX,
          clampedY,
          pieceSize,
          flipped
        );

        // Judge the drop against the position's own legality map, NOT against
        // `validMoves`. `validMoves` is written by `selectPiece` on the JS
        // thread, one `scheduleOnRN` hop after `onStart` asks for it — so a
        // fast drag reaches `onEnd` while it still holds the previous
        // selection's targets, or nothing at all. That silently threw away
        // legal moves, and when the stale list happened to contain the drop
        // square it animated the piece to a square chess.js never moved it to.
        // Off turn, the position offers this side no moves at all, so judge
        // the drop against the premove map instead (empty unless premoves are
        // on and we are waiting).
        const premoving =
          premovesEnabled &&
          playerSide !== 'both' &&
          boardState.turn.get() !== playerSide;
        const targets = premoving
          ? boardState.premoveTargets.get()[square] ?? []
          : boardState.legalTargets.get()[square] ?? [];
        let isValidMove =
          targetSquare !== square && targets.includes(targetSquare);

        // A king dropped on its own rook is castling. Resolve it to the
        // king's real destination here, before anything moves, so the piece
        // travels to the square it actually lands on rather than sliding onto
        // the rook and being corrected afterwards. Premoves included: they
        // read the same shape of target map, so a queued castle works too.
        let destination = targetSquare;
        if (!isValidMove && castleByDraggingToRook) {
          const castled = castleDragTarget(
            square,
            targetSquare,
            piece,
            targets
          );
          if (castled) {
            destination = castled;
            isValidMove = true;
          }
        }

        if (isValidMove && premoving) {
          // The piece goes home: a premove is a promise, not a move, so the
          // board must keep showing the real position until it fires.
          const originalPos = squareToPosition(square, pieceSize, flipped);
          squareState.translateX.set(
            withSpring(originalPos.x, animations.snapBack)
          );
          squareState.translateY.set(
            withSpring(originalPos.y, animations.snapBack)
          );
          squareState.zIndex.set(0);
          boardState.selectedSquare.set(null);
          boardState.validMoves.set([]);
          scheduleOnRN(handleQueuePremove, square, destination);
          dragStarted.set(false);
          draggedSquare.set(null);
          return;
        }

        if (isValidMove) {
          const targetPos = squareToPosition(destination, pieceSize, flipped);
          squareState.translateX.set(withSpring(targetPos.x, animations.move));
          squareState.translateY.set(withSpring(targetPos.y, animations.move));
          // Note: zIndex stays elevated during animation - move-executor resets it after completion
          scheduleOnRN(handleTryMove, square, destination);
          dragStarted.set(false);
          draggedSquare.set(null);
          return;
        }

        // Invalid move - snap back to original position and clear selection
        const originalPos = squareToPosition(square, pieceSize, flipped);
        squareState.translateX.set(
          withSpring(originalPos.x, animations.snapBack)
        );
        squareState.translateY.set(
          withSpring(originalPos.y, animations.snapBack)
        );
        squareState.zIndex.set(0);
        boardState.selectedSquare.set(null);
        boardState.validMoves.set([]);
        // Notify about illegal move (only if actually moved to different square)
        if (targetSquare !== square) {
          scheduleOnRN(handleIllegalMove, square, targetSquare);
        }
        dragStarted.set(false);
        draggedSquare.set(null);
      })
      .onFinalize(() => {
        'worklet';
        // Always, however the drag ended — dropped, cancelled or snapped
        // back. Clearing this per-branch left the ring stranded on whichever
        // path forgot it.
        boardState.hoverSquare.set(null);
        selectedOnThisTouch.set(false);
        const square = draggedSquare.get();
        if (square) {
          const squareState = boardState.squares[square];
          // Only reset if piece was actually dragged. Same reasoning as
          // `onEnd`: reading `zIndex` here would clobber an animation that
          // legitimately owns the square.
          if (dragStarted.get()) {
            squareState.scale.set(withSpring(1, animations.scale));
            squareState.zIndex.set(0);
          }
        }
        dragStarted.set(false);
        draggedSquare.set(null);
      });

    // Add tap gesture for selecting pieces
    const tapGesture = Gesture.Tap()
      .enabled(gestureEnabled)
      .onEnd((event) => {
        'worklet';
        const { x, y } = event;
        const square = positionToSquare(x, y, pieceSize, flipped);
        const selectedSquare = boardState.selectedSquare.get();
        const piece = boardState.squares[square].piece.get();
        const turn = boardState.turn.get();
        const isOwnPiece =
          piece &&
          piece[0] === turn &&
          (playerSide === 'both' || piece[0] === playerSide);

        // Case 1: No piece selected - try to select own piece
        if (!selectedSquare) {
          if (isOwnPiece) {
            selectPiece(square);
            scheduleOnRN(handleSelectPiece, square);
          }
          return;
        }

        // Case 2: Tapped the selected piece. A release that belongs to the
        // touch which just selected it keeps the selection — only a fresh tap
        // on an already-selected piece toggles it off.
        if (square === selectedSquare) {
          if (!selectedOnThisTouch.get()) {
            clearSelection();
          }
          return;
        }

        // Case 3: Tapped on valid move target - execute move
        const validMoves = boardState.validMoves.get();
        if (validMoves.includes(square)) {
          // Settle the piece before it travels: the move animation starts
          // from wherever the sprite is, and a grown piece would shrink
          // mid-flight.
          boardState.squares[selectedSquare].scale.set(
            withSpring(1, animations.scale)
          );
          scheduleOnRN(handleTryMove, selectedSquare, square);
          return;
        }

        // Case 4: Tapped on another own piece - switch selection
        if (isOwnPiece) {
          selectPiece(square);
          scheduleOnRN(handleSelectPiece, square);
          return;
        }

        // Case 5: Invalid target - deselect
        clearSelection();
      });

    // Combine gestures - pan takes precedence
    return Gesture.Simultaneous(tapGesture, panGesture);
  }, [
    boardState,
    pieceSize,
    flipped,
    draggedSquare,
    dragStarted,
    dragStartX,
    dragStartY,
    touchOffsetX,
    touchOffsetY,
    animations,
    gestureEnabled,
    playerSide,
    premovesEnabled,
    dragScale,
    tapScale,
    selectedOnThisTouch,
    dragHoverEnabled,
    castleByDraggingToRook,
    liftPx,
    handleQueuePremove,
    handleTryMove,
    handleSelectPiece,
    handleIllegalMove,
  ]);

  return gesture;
};
