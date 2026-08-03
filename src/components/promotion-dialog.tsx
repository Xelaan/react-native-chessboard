import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Image,
  Pressable,
  View,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import type { PieceSymbol } from 'chess.js';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import type { BoardConfig } from '../state';
import { DEFAULT_SPRITE_SOURCE } from '../assets/piece-images';

const PROMOTION_PIECES: PieceSymbol[] = ['q', 'r', 'b', 'n'];

// Sheet layout: 6 columns (p n b r q k) x 2 rows (white, black).
const SHEET_COLUMNS = 6;
const SHEET_ROWS = 2;
const COLUMN_OF: Record<PieceSymbol, number> = {
  p: 0,
  n: 1,
  b: 2,
  r: 3,
  q: 4,
  k: 5,
};

interface PromotionDialogProps {
  color: 'w' | 'b';
  onSelect: (piece: PieceSymbol) => void;
  onCancel: () => void;
  config: BoardConfig;
  /** The board's sprite sheet, so the dialog offers the pieces in play. */
  spriteSource?: ImageSourcePropType;
}

/**
 * One piece, taken out of the sprite sheet.
 *
 * Shown the way a CSS sprite is: a window one cell wide holding the whole
 * sheet, offset so the wanted cell lands in view. The dialog can't just use
 * per-piece image files — a consumer supplying custom art supplies one sheet,
 * and the picker has to offer the same pieces the board is playing with.
 */
const SpritePiece: React.FC<{
  source: ImageSourcePropType;
  piece: PieceSymbol;
  color: 'w' | 'b';
  size: number;
}> = ({ source, piece, color, size }) => (
  <View style={[styles.spriteWindow, { width: size, height: size }]}>
    <Image
      source={source}
      resizeMode="stretch"
      style={{
        width: size * SHEET_COLUMNS,
        height: size * SHEET_ROWS,
        marginLeft: -size * COLUMN_OF[piece],
        marginTop: -size * (color === 'w' ? 0 : 1),
      }}
    />
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  pieceButton: {
    padding: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  // Clips the sheet down to the single cell showing through.
  spriteWindow: {
    overflow: 'hidden',
  },
});

/**
 * The promotion picker, overlaid on the board.
 *
 * Not a `Modal`: a modal centres on the *screen*, so on any layout where the
 * board isn't dead centre the picker turned up somewhere unrelated to the
 * game it belongs to. As an absolute fill inside the board's own container it
 * is always centred on the board.
 */
export const PromotionDialog: React.FC<PromotionDialogProps> = React.memo(
  ({ color, onSelect, onCancel, config, spriteSource }) => {
    const { colors, pieceSize } = config;
    const sheet = spriteSource ?? DEFAULT_SPRITE_SOURCE;

    return (
      <Pressable
        style={[styles.overlay, { backgroundColor: colors.promotionOverlay }]}
        onPress={onCancel}
      >
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={[
            styles.container,
            { backgroundColor: colors.promotionDialogBackground },
          ]}
        >
          {PROMOTION_PIECES.map((piece) => (
            <TouchableOpacity
              key={piece}
              style={[
                styles.pieceButton,
                { backgroundColor: colors.promotionPieceButton },
              ]}
              onPress={() => onSelect(piece)}
              activeOpacity={0.7}
            >
              <SpritePiece
                source={sheet}
                piece={piece}
                color={color}
                size={pieceSize}
              />
            </TouchableOpacity>
          ))}
        </Animated.View>
      </Pressable>
    );
  }
);

PromotionDialog.displayName = 'PromotionDialog';
