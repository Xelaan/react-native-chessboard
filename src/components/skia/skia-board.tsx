import React from 'react';
import { Canvas, Group } from '@shopify/react-native-skia';
import type { SkImage } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { StyleSheet } from 'react-native';
import type { BoardConfig, BoardState } from '../../state';
import type {
  Arrow,
  EffectParams,
  SquareHighlight,
  SquareMark,
} from '../../types';
import { BoardBackground } from './board-background';
import { SkiaHighlights } from './skia-highlights';
import { SkiaDots } from './skia-dots';
import { SkiaPiecesAtlas } from './skia-pieces-atlas';
import { SkiaMarks } from './skia-marks';
import { SkiaArrows } from './skia-arrows';
import { SkiaSquareHighlights } from './skia-square-highlights';
import { SkiaHover } from './skia-hover';

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
});

interface SkiaBoardProps {
  config: BoardConfig;
  boardState: BoardState;
  spriteImage: SkImage | null;
  renderEffect?: (params: EffectParams) => React.ReactNode;
  effectParams?: EffectParams;
  marks?: SquareMark[];
  arrows?: Arrow[];
  highlightedSquares?: SquareHighlight[];
}

/**
 * Same reasoning as `BoardBackground`: an inline `colors` prop rebuilds
 * `config` every parent render, which would otherwise re-render the entire
 * canvas subtree. Only the fields this tree draws participate — notably
 * `gestureEnabled` and `animations` do not, since they never reach a Skia
 * node.
 *
 * Keep in sync with what the subtree reads; a field added to the render path
 * but not compared here will not repaint.
 */
const areVisualPropsEqual = (
  previous: Readonly<SkiaBoardProps>,
  next: Readonly<SkiaBoardProps>
) => {
  const previousConfig = previous.config;
  const nextConfig = next.config;

  return (
    previous.boardState === next.boardState &&
    previous.spriteImage === next.spriteImage &&
    previous.renderEffect === next.renderEffect &&
    previous.effectParams === next.effectParams &&
    // Identity, so callers should keep the array stable (memoize it) unless
    // the marks actually changed — otherwise every parent render repaints.
    previous.marks === next.marks &&
    previous.arrows === next.arrows &&
    previous.highlightedSquares === next.highlightedSquares &&
    previousConfig.boardSize === nextConfig.boardSize &&
    previousConfig.pieceSize === nextConfig.pieceSize &&
    previousConfig.flipped === nextConfig.flipped &&
    previousConfig.withLetters === nextConfig.withLetters &&
    previousConfig.withNumbers === nextConfig.withNumbers &&
    previousConfig.fontSource === nextConfig.fontSource &&
    previousConfig.colors.white === nextConfig.colors.white &&
    previousConfig.colors.black === nextConfig.colors.black &&
    previousConfig.colors.lastMoveHighlight ===
      nextConfig.colors.lastMoveHighlight &&
    previousConfig.colors.checkmateHighlight ===
      nextConfig.colors.checkmateHighlight
  );
};

export const SkiaBoard: React.FC<SkiaBoardProps> = React.memo(
  ({
    config,
    boardState,
    spriteImage,
    renderEffect,
    effectParams,
    marks,
    arrows,
    highlightedSquares,
  }) => {
    const { boardSize, pieceSize } = config;

    const progressSV = effectParams?.progress;
    const effectOpacity = useDerivedValue(() => {
      if (!progressSV) return 0;
      const p = progressSV.value;
      // Hard on while the shader is animating, hard off otherwise. The
      // shader itself tapers amplitude + chromatic separation to zero
      // before progress hits 1, so the cut is invisible.
      return p > 0 && p < 1 ? 1 : 0;
    });

    // Skia paints in declaration order. The dots sit BETWEEN the two piece
    // layers: above the resting pieces, so a dot on an occupied square (a
    // capture target) stays visible, but below whatever a drag or an in-flight
    // move has raised, so the piece under the finger is never occluded.
    const board = (
      <>
        <BoardBackground config={config} />
        <SkiaHighlights config={config} boardState={boardState} />
        {/* Caller-declared, so drawn over the board's own highlights: an app
            asking for a ring means it on top of a last-move tint. */}
        <SkiaSquareHighlights config={config} highlights={highlightedSquares} />
        <SkiaPiecesAtlas
          layer="resting"
          spriteImage={spriteImage}
          boardState={boardState}
          pieceSize={pieceSize}
        />
        {/* Under the raised piece and the dots: it marks the destination,
            so it must not paint over what is being dropped there. */}
        <SkiaHover config={config} boardState={boardState} />
        <SkiaDots config={config} boardState={boardState} />
        <SkiaPiecesAtlas
          layer="raised"
          spriteImage={spriteImage}
          boardState={boardState}
          pieceSize={pieceSize}
        />
        {/* Above the pieces: an arrow points at them, and a badge must never
            be hidden by the piece it is judging. */}
        <SkiaArrows config={config} arrows={arrows} />
        <SkiaMarks config={config} marks={marks} />
      </>
    );

    return (
      <Canvas style={[styles.canvas, { width: boardSize, height: boardSize }]}>
        {board}
        {renderEffect && effectParams && (
          <Group layer opacity={effectOpacity}>
            {renderEffect(effectParams)}
            {board}
          </Group>
        )}
      </Canvas>
    );
  },
  areVisualPropsEqual
);

SkiaBoard.displayName = 'SkiaBoard';
