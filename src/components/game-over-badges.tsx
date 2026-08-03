import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { Chess, Color, Square } from 'chess.js';

import { findKingSquare } from '../helpers/find-king-square';
import { gameOverBadgeCenter } from './skia/skia-game-over';
import { squareToPosition } from '../state/use-board-state';
import type { BoardConfig } from '../state/types';
import type { GameOverLabels, GameOverReason, GameResult } from '../types';

// Matches the badge choreography in `skia-game-over`: the pill fades in during
// the grow, breathes through the hold, and is gone by the time the badge
// settles into the corner.
const GROW_MS = 300;
const HOLD_MS = 800;
const SETTLE_MS = 350;
const EDGE_PAD = 2;

const DEFAULT_LABELS: Record<string, string> = {
  winner: 'Winner',
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  draw: 'Draw',
  resign: 'Resigned',
  timeout: 'Timeout',
  abandon: 'Abandoned',
};

const clamp = (value: number, lo: number, hi: number): number =>
  Math.min(Math.max(value, lo), hi);

interface PillProps {
  square: Square;
  label: string;
  winner: boolean;
  draw: boolean;
  config: BoardConfig;
  startDelayMs: number;
}

const Pill: React.FC<PillProps> = ({
  square,
  label,
  winner,
  draw,
  config,
  startDelayMs,
}) => {
  const { pieceSize, flipped, colors, boardSize } = config;
  const { y } = squareToPosition(square, pieceSize, flipped);
  const badge = gameOverBadgeCenter(square, config);

  const fill = winner
    ? colors.gameOverWinner
    : draw
    ? colors.gameOverDraw
    : colors.gameOverLoser;

  // Placement needs the measured width; the pill starts fully transparent and
  // the animation is delayed, so the one-frame pre-measure position is never
  // on screen.
  const [width, setWidth] = useState(0);
  const height = pieceSize * 0.52;
  const left = clamp(
    badge.x - width / 2,
    EDGE_PAD,
    Math.max(EDGE_PAD, boardSize - width - EDGE_PAD)
  );
  const top = clamp(y - height * 0.9, EDGE_PAD, boardSize - height - EDGE_PAD);

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      startDelayMs,
      withTiming(1, { duration: GROW_MS, easing: Easing.out(Easing.cubic) })
    );
    // Out on the same beat the badge starts settling into the corner.
    progress.value = withDelay(
      startDelayMs + GROW_MS + HOLD_MS,
      withTiming(0, { duration: SETTLE_MS, easing: Easing.inOut(Easing.cubic) })
    );
  }, [progress, square, label, startDelayMs]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * pieceSize * 0.15 },
      { scale: 0.8 + 0.2 * progress.value },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[
        styles.pill,
        {
          left,
          top,
          height,
          borderRadius: height / 2,
          paddingHorizontal: pieceSize * 0.24,
          backgroundColor: winner ? colors.gameOverAccent : fill,
        },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          {
            color: winner ? colors.gameOverWinner : colors.gameOverAccent,
            fontSize: Math.max(10, pieceSize * 0.26),
          },
        ]}
      >
        {label}
      </Text>
    </Animated.View>
  );
};

export interface GameOverBadgesProps {
  chess: Chess;
  config: BoardConfig;
  result?: GameResult | null;
  labels?: GameOverLabels;
  startDelayMs?: number;
}

/**
 * The label beside each game-over badge.
 *
 * Views rather than canvas nodes, and the only part of the animation that is:
 * the text is the consumer's, in whatever language they use, and drawing that
 * in Skia would mean shipping a font and measuring arbitrary glyphs. The
 * badges themselves are drawn in the canvas.
 */
export const GameOverBadges: React.FC<GameOverBadgesProps> = ({
  chess,
  config,
  result,
  labels,
  startDelayMs = 0,
}) => {
  if (!result) {
    return null;
  }

  const labelFor = (key: GameOverReason | 'winner') =>
    labels?.[key] ?? DEFAULT_LABELS[key];

  const whiteKing = findKingSquare(chess, 'w');
  const blackKing = findKingSquare(chess, 'b');
  const draw = result.reason === 'draw' || result.reason === 'stalemate';

  const pills: PillProps[] = [];
  const push = (square: Square | null, color: Color) => {
    if (!square) return;
    if (draw) {
      pills.push({
        square,
        label: labelFor(result.reason),
        winner: false,
        draw: true,
        config,
        startDelayMs,
      });
      return;
    }
    if (!result.winner) return;
    const won = result.winner === color;
    pills.push({
      square,
      label: won ? labelFor('winner') : labelFor(result.reason),
      winner: won,
      draw: false,
      config,
      startDelayMs,
    });
  };

  push(whiteKing, 'w');
  push(blackKing, 'b');

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pills.map((pill) => (
        <Pill key={pill.square} {...pill} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    fontWeight: '700',
  },
  pill: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
});
