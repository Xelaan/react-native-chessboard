import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import type { Chess, Color, Square } from 'chess.js';

import { findKingSquare } from '../helpers/find-king-square';
import { squareToPosition } from '../state/use-board-state';
import type { BoardConfig } from '../state/types';
import type { GameOverLabels, GameResult } from '../types';

// Badge sizing, as fractions of one square.
const BADGE_SIZE = 0.62;
const WINNER_DELAY_MS = 120;
const SPRING = { damping: 12, stiffness: 180 } as const;

const LOSER_COLOR = '#fa412d';
const WINNER_COLOR = '#81b64c';
const DRAW_COLOR = '#8b8987';
const ACCENT = '#ffffff';

/** Draws badge both kings; decisive results badge loser and winner apart. */
const isDraw = (reason: GameResult['reason']): boolean =>
  reason === 'draw' || reason === 'stalemate';

interface BadgeProps {
  square: Square;
  label: string;
  color: string;
  delayMs: number;
  config: BoardConfig;
}

const Badge: React.FC<BadgeProps> = ({
  square,
  label,
  color,
  delayMs,
  config,
}) => {
  const { pieceSize, flipped } = config;
  const { x, y } = squareToPosition(square, pieceSize, flipped);
  const size = pieceSize * BADGE_SIZE;
  const pop = useSharedValue(0);

  useEffect(() => {
    pop.value = withDelay(delayMs, withSpring(1, SPRING));
  }, [pop, delayMs, square, label]);

  const style = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: 0.6 + pop.value * 0.4 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.badge,
        {
          left: x + pieceSize / 2 - size / 2,
          top: y + pieceSize / 2 - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[styles.label, { fontSize: size * 0.34 }]}
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
  /** Localized text; the library ships no copy of its own. */
  labels?: GameOverLabels;
}

/**
 * The game-over annotation: a badge on each king saying how the game ended.
 *
 * React Native views over the canvas rather than Skia nodes. Text is the
 * reason: drawing it in Skia would mean shipping a font and measuring glyphs
 * for strings the *app* supplies in whatever language it likes. This overlay
 * is not on the per-move path — it appears once, when the game is already
 * over — so nothing about the board's per-move cost changes.
 */
export const GameOverBadges: React.FC<GameOverBadgesProps> = ({
  chess,
  config,
  result,
  labels,
}) => {
  if (!result) {
    return null;
  }

  const whiteKing = findKingSquare(chess, 'w');
  const blackKing = findKingSquare(chess, 'b');
  const draw = isDraw(result.reason);
  const reasonLabel = labels?.[result.reason] ?? result.reason;
  const winnerLabel = labels?.winner ?? 'Winner';

  const badgeFor = (color: Color, square: Square | null) => {
    if (!square) {
      return null;
    }
    if (draw) {
      return {
        square,
        label: reasonLabel,
        color: DRAW_COLOR,
        delayMs: 0,
      };
    }
    // Decisive: the reason sits on the king that lost, the winner badge on
    // the other — so the board says both what happened and to whom.
    const lost = result.winner !== color;
    return {
      square,
      label: lost ? reasonLabel : winnerLabel,
      color: lost ? LOSER_COLOR : WINNER_COLOR,
      delayMs: lost ? 0 : WINNER_DELAY_MS,
    };
  };

  const badges = [badgeFor('w', whiteKing), badgeFor('b', blackKing)].filter(
    (badge): badge is NonNullable<typeof badge> => badge !== null
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {badges.map((badge) => (
        <Badge key={badge.square} {...badge} config={config} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  label: {
    color: ACCENT,
    fontWeight: '700',
    textAlign: 'center',
  },
});
