import React, { useEffect } from 'react';
import { Atlas, Group, rect, Skia } from '@shopify/react-native-skia';
import type { SkRect, SkRSXform, SkImage } from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { Square } from 'chess.js';
import { SQUARES, BoardState, PieceCode } from '../../state/types';

// Sprite sheet layout: 6x2 grid (p, n, b, r, q, k for each color)
// Row 0: white pieces, Row 1: black pieces.
//
// The cell size is read from the sheet (width / 6) rather than assumed, so a
// consumer can ship art at whatever resolution their pieces were drawn at —
// forcing everyone through 128px meant either upscaling on a 3x screen or
// throwing away detail that was already there.
const FALLBACK_CELL_SIZE = 128;
const COLUMNS = 6;

const spriteRects = (cell: number): Record<NonNullable<PieceCode>, SkRect> => ({
  wp: rect(0, 0, cell, cell),
  wn: rect(cell, 0, cell, cell),
  wb: rect(cell * 2, 0, cell, cell),
  wr: rect(cell * 3, 0, cell, cell),
  wq: rect(cell * 4, 0, cell, cell),
  wk: rect(cell * 5, 0, cell, cell),
  bp: rect(0, cell, cell, cell),
  bn: rect(cell, cell, cell, cell),
  bb: rect(cell * 2, cell, cell, cell),
  br: rect(cell * 3, cell, cell, cell),
  bq: rect(cell * 4, cell, cell, cell),
  bk: rect(cell * 5, cell, cell, cell),
});

/**
 * Which pieces this atlas draws.
 *
 * `resting` — everything sitting on its square. Drawn UNDER the move dots, so
 * a dot on an occupied square (i.e. a capture target) stays visible.
 * `raised` — whatever a drag or an in-flight move has lifted (`zIndex > 0`).
 * Drawn OVER the dots, so the piece under the finger is never occluded by
 * them.
 */
export type PieceLayer = 'resting' | 'raised';

interface SkiaPiecesAtlasProps {
  spriteImage: SkImage | null;
  boardState: BoardState;
  pieceSize: number;
  layer: PieceLayer;
}

/**
 * Renders chess pieces using a single Atlas draw call per layer.
 *
 * Benefits:
 * - Single draw call for all pieces in the layer (vs 64+ individual draws)
 * - zIndex handled by array order (last = on top)
 * - Transforms calculated in worklet (no JS thread overhead)
 */
export const SkiaPiecesAtlas: React.FC<SkiaPiecesAtlasProps> = React.memo(
  ({ spriteImage, boardState, pieceSize, layer }) => {
    // Cell size comes from the sheet itself; fall back only while it is still
    // decoding, when nothing is drawn anyway.
    const cellSize = spriteImage
      ? spriteImage.width() / COLUMNS
      : FALLBACK_CELL_SIZE;
    const rects = spriteRects(cellSize);
    // Scale factor from sprite sheet cell size to piece size
    const scale = pieceSize / cellSize;

    // When the sheet decodes asynchronously the pieces would otherwise hard-pop
    // onto an already-visible checkerboard — fade them in instead. A cached
    // sheet is there on the first render, so it starts fully opaque and no
    // fade is ever seen.
    const piecesOpacity = useSharedValue(spriteImage ? 1 : 0);
    useEffect(() => {
      if (spriteImage) {
        piecesOpacity.value = withTiming(1, { duration: 180 });
      }
    }, [spriteImage, piecesOpacity]);

    // Build sprites + transforms in a single UI-thread pass over the board.
    // Two projection derived values pull from this so we don't iterate the
    // 64 squares twice per frame.
    const atlasData = useDerivedValue(() => {
      const sprites: SkRect[] = [];
      const transforms: SkRSXform[] = [];
      const pieces: Array<{
        square: Square;
        piece: NonNullable<PieceCode>;
        zIndex: number;
      }> = [];

      for (const square of SQUARES) {
        const squareState = boardState.squares[square];
        const piece = squareState.piece.get();
        if (!piece) continue;

        // `zIndex > 0` is exactly "lifted by a drag or an in-flight move",
        // which is the one case that must draw above the dots.
        const zIndex = squareState.zIndex.get();
        const isRaised = zIndex > 0;
        if (isRaised !== (layer === 'raised')) continue;

        pieces.push({ square, piece, zIndex });
      }

      // zIndex ascending — higher draws last (on top).
      pieces.sort((a, b) => a.zIndex - b.zIndex);

      for (const { square, piece } of pieces) {
        sprites.push(rects[piece]);

        const squareState = boardState.squares[square];
        const x = squareState.translateX.get();
        const y = squareState.translateY.get();
        const pieceScale = squareState.scale.get() * scale;

        // RSXform scales from (0,0); shift so the sprite's centre lands on
        // the square's centre.
        const centerX = x + pieceSize / 2;
        const centerY = y + pieceSize / 2;
        const scaledHalf = (cellSize / 2) * pieceScale;
        transforms.push(
          Skia.RSXform(
            pieceScale,
            0,
            centerX - scaledHalf,
            centerY - scaledHalf
          )
        );
      }

      return { sprites, transforms };
    });

    const sprites = useDerivedValue(() => atlasData.value.sprites);
    const transforms = useDerivedValue(() => atlasData.value.transforms);

    if (!spriteImage) {
      return null;
    }

    return (
      <Group opacity={piecesOpacity}>
        <Atlas image={spriteImage} sprites={sprites} transforms={transforms} />
      </Group>
    );
  }
);

SkiaPiecesAtlas.displayName = 'SkiaPiecesAtlas';
