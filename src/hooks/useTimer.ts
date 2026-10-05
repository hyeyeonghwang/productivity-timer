/**
 * useTimer — a thin React adapter over the pure TimerEngine (src/core/timer.ts).
 *
 * Responsibilities (requirements.md Req 1, 4, 6, 11):
 * - Hold the current {@link TimerState} and expose control methods that delegate
 *   to the engine's pure functions. The hook does NOT reimplement timer math.
 * - Run a `setInterval` used ONLY to trigger UI refreshes. Remaining time is
 *   always derived from the engine via `getRemainingMs`/`getProgress` using a
 *   fresh `Date.now()`, so correctness is independent of tick frequency.
 * - Listen for `visibilitychange` to recompute immediately when a throttled or
 *   backgrounded tab regains focus.
 * - Invoke `onFinish` exactly once when the engine transitions to `finished`.
 * - Clean up the interval and the visibility listener on unmount.
 *
 * All business logic stays in the pure core; this file only wires it to React.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimerState } from '../core/types';
import {
  createTimer,
  getProgress,
  getRemainingMs,
  pause as pauseEngine,
  reset as resetEngine,
  resume as resumeEngine,
  setDuration as setDurationEngine,
  start as startEngine,
  tick as tickEngine,
} from '../core/timer';

/** Options for {@link useTimer}. */
export interface UseTimerOptions {
  /** Initial duration in milliseconds. */
  initialDurationMs: number;
  /** UI refresh interval in ms (default 200). Does NOT affect accuracy. */
  refreshIntervalMs?: number;
  /** Called once when the timer reaches zero. Receives the finished duration. */
  onFinish?: (durationMs: number) => void;
}

/** Value returned by {@link useTimer}. */
export interface UseTimerResult {
  state: TimerState;
  /** Remaining time in ms, derived from the engine using the latest now. */
  remainingMs: number;
  /** Elapsed progress in [0, 1]. */
  progress: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  /** Sets a new duration (idle/finished only; see engine semantics). */
  setDuration: (durationMs: number) => void;
}

const DEFAULT_REFRESH_MS = 200;

export function useTimer(options: UseTimerOptions): UseTimerResult {
  const { initialDurationMs, refreshIntervalMs = DEFAULT_REFRESH_MS, onFinish } =
    options;

  const [state, setState] = useState<TimerState>(() =>
    createTimer(initialDurationMs),
  );

  // Bumped on every UI refresh to force a re-render so the derived remaining
  // time updates even when the pure engine's `tick` is a referential no-op
  // (i.e. still running, deadline not yet reached). This keeps the engine pure
  // while guaranteeing the display advances each tick.
  const [, setRefreshTick] = useState(0);

  // Keep the latest onFinish in a ref so the effect need not re-subscribe.
  const onFinishRef = useRef<UseTimerOptions['onFinish']>(onFinish);
  const finishNotifiedRef = useRef(false);
  
  useEffect(() => {
  if (state.status === 'finished' && !finishNotifiedRef.current) {
    finishNotifiedRef.current = true;
    onFinishRef.current?.(state.durationMs);
   }
  }, [state.status, state.durationMs]);


  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);
  
  /**
   * Advances the engine against the current wall-clock time. Pure `tick` returns
   * the same reference when nothing changes; we still force a re-render via the
   * refresh counter so the derived remaining time stays current. Fires
   * `onFinish` exactly once on the running -> finished edge.
   */
  const evaluate = useCallback(() => {
    setState((prev) => tickEngine(prev, Date.now()));
    setRefreshTick((n) => n + 1);
  }, []);

  // UI refresh interval: active only while running. Used purely to re-render
  // and re-evaluate the engine; the engine derives remaining time from the
  // absolute target timestamp, so skipped/throttled ticks cannot cause drift.
  useEffect(() => {
    if (state.status !== 'running') return;

    const id = setInterval(evaluate, refreshIntervalMs);
    return () => {
      clearInterval(id);
    };
  }, [state.status, refreshIntervalMs, evaluate]);

  // Recompute immediately when the tab regains visibility (throttled timers may
  // have skipped ticks while the tab was backgrounded).
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        evaluate();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [evaluate]);

  const start = useCallback(() => {
    finishNotifiedRef.current = false;
    setState((prev) => startEngine(prev, Date.now()));
  }, []);

  const pause = useCallback(() => {
    setState((prev) => pauseEngine(prev, Date.now()));
  }, []);

  const resume = useCallback(() => {
    setState((prev) => resumeEngine(prev, Date.now()));
  }, []);

  const reset = useCallback(() => {
    finishNotifiedRef.current = false;setState((prev) => resetEngine(prev));
  }, []);

  const setDuration = useCallback((durationMs: number) => {
    finishNotifiedRef.current = false;
    setState((prev) => setDurationEngine(prev, durationMs));
  }, []);

  // Derived values recomputed every render from a fresh now.
  const now = Date.now();
  const remainingMs = getRemainingMs(state, now);
  const progress = getProgress(state, now);

  return {
    state,
    remainingMs,
    progress,
    start,
    pause,
    resume,
    reset,
    setDuration,
  };
}
