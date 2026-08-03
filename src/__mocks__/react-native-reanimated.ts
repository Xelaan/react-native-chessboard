// Mock for react-native-reanimated
import { useRef } from 'react';

const createMockSharedValue = <T>(initialValue: T) => {
  let value = initialValue;
  return {
    get: () => value,
    set: (newValue: T) => {
      value = newValue;
    },
    value, // For compatibility
  };
};

// The real hook returns the SAME mutable across renders. Returning a fresh
// object here would make every shared value an unstable dependency, so effects
// keyed on them would re-run every render in tests but not on device — hiding
// exactly the class of bug those dependency arrays exist to prevent.
export const useSharedValue = <T>(initialValue: T) => {
  const ref = useRef<ReturnType<typeof createMockSharedValue<T>> | null>(null);
  if (!ref.current) {
    ref.current = createMockSharedValue(initialValue);
  }
  return ref.current;
};

export const makeMutable = <T>(initialValue: T) =>
  createMockSharedValue(initialValue);

export const useDerivedValue = <T>(fn: () => T) => {
  return createMockSharedValue(fn());
};

export const withTiming = <T>(
  toValue: T,
  _config?: any,
  callback?: () => void
) => {
  // Execute callback immediately in tests
  if (callback) {
    callback();
  }
  return toValue;
};

export const withSpring = <T>(
  toValue: T,
  _config?: any,
  callback?: (finished?: boolean) => void
) => {
  // Execute callback immediately in tests, as a settled animation
  if (callback) {
    callback(true);
  }
  return toValue;
};

export const runOnJS = (fn: Function) => fn;

export const Easing = {
  out: (easing: any) => easing,
  in: (easing: any) => easing,
  inOut: (easing: any) => easing,
  linear: (t: number) => t,
  quad: (t: number) => t * t,
  cubic: (t: number) => t * t * t,
  sin: (t: number) => Math.sin(t),
};

// Delayed animations settle to their target like the others do here; tests
// assert on the resting value, not the choreography.
export const withDelay = <T>(_delayMs: number, animation: T) => animation;

// Fires the reaction once with no previous value, mirroring the initial
// invocation on device.
export const useAnimatedReaction = <T>(
  prepare: () => T,
  react: (current: T, previous: T | null) => void,
  _deps?: unknown[]
) => {
  react(prepare(), null);
};

/**
 * Returns the style object the caller built. Enough for assertions about what
 * a component renders; the animation itself is out of scope here — the mocked
 * timings settle instantly anyway.
 */
export const useAnimatedStyle = <T>(factory: () => T): T => factory();

// Animated views render as plain hosts, so a tree can be searched for them by
// name like any other RN element.
// Entering/exiting builders are chainable in the real library; tests only
// care that a component using them renders.
const layoutAnimation = () => {
  const builder: Record<string, unknown> = {};
  for (const method of ['duration', 'delay', 'springify', 'easing']) {
    builder[method] = () => builder;
  }
  return builder;
};
export const FadeIn = layoutAnimation();
export const FadeOut = layoutAnimation();

export const Animated = {
  View: 'Animated.View',
  Text: 'Animated.Text',
};

export default {
  ...Animated,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useAnimatedReaction,
  useSharedValue,
  makeMutable,
  useDerivedValue,
  withTiming,
  withDelay,
  withSpring,
  runOnJS,
  Easing,
};
