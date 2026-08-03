import React from 'react';
import { act, create } from 'react-test-renderer';

import {
  BoardStateProvider,
  useBoardConfig,
} from '../state/board-state-context';
import {
  MOVE_SPRING,
  SCALE_SPRING,
  SNAP_BACK_SPRING,
} from '../config/animations';
import type { BoardConfig } from '../state/types';

const configFrom = (
  animations?: Partial<BoardConfig['animations']>
): BoardConfig['animations'] => {
  let captured: BoardConfig['animations'] | null = null;
  const Probe = () => {
    captured = useBoardConfig().animations;
    return null;
  };
  act(() => {
    create(
      <BoardStateProvider animations={animations}>
        <Probe />
      </BoardStateProvider>
    );
  });
  if (!captured) throw new Error('config was not captured');
  return captured;
};

/** 1% settling time for a critically damped spring, in ms. */
const settleMs = (stiffness: number, mass = 1) =>
  (6.64 / Math.sqrt(stiffness / mass)) * 1000;

describe('animation config', () => {
  it('uses the library defaults when the consumer says nothing', () => {
    expect(configFrom()).toEqual({
      move: MOVE_SPRING,
      scale: SCALE_SPRING,
      snapBack: SNAP_BACK_SPRING,
    });
  });

  it('merges an override rather than replacing the set', () => {
    const move = { stiffness: 5000, damping: 141, mass: 1 };

    const animations = configFrom({ move });

    expect(animations.move).toEqual(move);
    // Retuning moves must not silently reset lift and snap-back.
    expect(animations.scale).toEqual(SCALE_SPRING);
    expect(animations.snapBack).toEqual(SNAP_BACK_SPRING);
  });

  it('keeps the defaults snappy enough to read as responsive', () => {
    // The board previously settled a move in ~330ms, which reads as sluggish
    // beside a view-tree board doing it in 90. Guard the intent, not the
    // exact constant.
    expect(settleMs(MOVE_SPRING.stiffness as number)).toBeLessThan(200);
    expect(settleMs(SNAP_BACK_SPRING.stiffness as number)).toBeLessThan(200);
    expect(settleMs(SCALE_SPRING.stiffness as number)).toBeLessThan(200);
  });

  it('keeps every default critically damped — a bouncing piece reads as a bug', () => {
    for (const spring of [MOVE_SPRING, SCALE_SPRING, SNAP_BACK_SPRING]) {
      const critical = 2 * Math.sqrt((spring.stiffness as number) * 1);
      expect(spring.damping).toBeCloseTo(critical, -1);
    }
  });
});
