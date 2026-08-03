import React from 'react';
import { Circle, Group, Rect } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';

import type { BoardConfig, BoardState } from '../../state/types';
import { squareToPosition } from '../../state/use-board-state';

interface SkiaHoverProps {
  config: BoardConfig;
  boardState: BoardState;
}

/**
 * The cell under the finger while a piece is being dragged: a fill plus a
 * translucent disc around it, chess.com style.
 *
 * Exists because `dragOffsetY` lifts the piece above the finger — once the
 * sprite is no longer under the touch, the player needs something else to
 * tell them which square they are about to drop on. Driven entirely by a
 * shared value, so following the finger costs no renders.
 */
export const SkiaHover: React.FC<SkiaHoverProps> = React.memo(
  ({ config, boardState }) => {
    const { pieceSize, flipped, colors, dragHoverEnabled, dragHoverRingScale } =
      config;
    const radius = (pieceSize * dragHoverRingScale) / 2;

    const position = useDerivedValue(() => {
      const square = boardState.hoverSquare.get();
      if (!square) {
        return null;
      }
      return squareToPosition(square, pieceSize, flipped);
    });

    // Off-board when nothing is hovered: a Skia node can't be conditionally
    // unmounted from a worklet, so park it where it cannot be seen instead.
    const hidden = -pieceSize * 4;
    const cellX = useDerivedValue(() => position.value?.x ?? hidden);
    const cellY = useDerivedValue(() => position.value?.y ?? hidden);
    const centreX = useDerivedValue(() =>
      position.value ? position.value.x + pieceSize / 2 : hidden
    );
    const centreY = useDerivedValue(() =>
      position.value ? position.value.y + pieceSize / 2 : hidden
    );

    if (!dragHoverEnabled) {
      return null;
    }

    return (
      <Group>
        <Circle cx={centreX} cy={centreY} r={radius} color={colors.hoverRing} />
        <Rect
          x={cellX}
          y={cellY}
          width={pieceSize}
          height={pieceSize}
          color={colors.hoverSquare}
        />
      </Group>
    );
  }
);

SkiaHover.displayName = 'SkiaHover';
