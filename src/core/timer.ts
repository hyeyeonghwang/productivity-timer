/**
 * TimerEngine — pure, framework-agnostic countdown logic.
 *
 * Design invariant (requirements.md Req 11):
 * The timer NEVER decrements a per-second counter. While running, remaining time
 * is always derived from an absolute `Date.now()`-based target end timestamp
 * (`targetEndTime`). Any interval in the UI layer is used ONLY to trigger a
 * recompute/re-render; correctness does not depend on how many ticks fire. This
 * keeps the timer accurate when the tab is inactive or `setInterval` is throttled.
 *
 * All functions are pure: they take the current state and an explicit `now`
 * (milliseconds, `Date.now()`-based) and return a new state. No globals, no
 * `Date.now()` calls, no side effects — which makes the engine fully testable.
 */
import type { TimerState } from './types';

/**
 * Creates an idle timer state for the given duration.
 * @param durationMs full duration in milliseconds (clamped to >= 0)
 */
export function createTimer(durationMs: number): TimerState {
  const safeDuration = durationMs > 0 ? durationMs : 0;
  return {
    status: 'idle',
    durationMs: safeDuration,
    targetEndTime: null,
    remainingMs: safeDuration,
  };
}

/**
 * Returns the remaining time in milliseconds, never negative.
 *
 * While running, this is computed from the absolute target end timestamp
 * (`targetEndTime - now`). Otherwise the captured `remainingMs` is returned.
 */
export function getRemainingMs(state: TimerState, now: number): number {
  if (state.status === 'running' && state.targetEndTime !== null) {
    return Math.max(0, state.targetEndTime - now);
  }
  return Math.max(0, state.remainingMs);
}

/**
 * Returns elapsed progress in the range [0, 1].
 * 0 means no time elapsed; 1 means the full duration has elapsed.
 */
export function getProgress(state: TimerState, now: number): number {
  if (state.durationMs <= 0) return 1;
  const remaining = getRemainingMs(state, now);
  const elapsed = state.durationMs - remaining;
  const ratio = elapsed / state.durationMs;
  if (ratio < 0) return 0;
  if (ratio > 1) return 1;
  return ratio;
}

/**
 * Starts (or restarts) the countdown.
 *
 * If there is captured remaining time (e.g. the timer is `idle` after a reset or
 * mid-run), it is used; otherwise the full duration is used. A fresh absolute
 * `targetEndTime` is computed from `now + remaining`.
 *
 * No-op when already running.
 */
export function start(state: TimerState, now: number): TimerState {
  if (state.status === 'running') return state;
  const remaining = state.remainingMs > 0 ? state.remainingMs : state.durationMs;
  if (remaining <= 0) return state;
  return {
    ...state,
    status: 'running',
    remainingMs: remaining,
    targetEndTime: now + remaining,
  };
}

/**
 * Pauses a running countdown, capturing the exact remaining time derived from
 * the target timestamp. No-op when not running.
 */
export function pause(state: TimerState, now: number): TimerState {
  if (state.status !== 'running') return state;
  return {
    ...state,
    status: 'paused',
    remainingMs: getRemainingMs(state, now),
    targetEndTime: null,
  };
}

/**
 * Resumes a paused countdown by recomputing a fresh absolute target timestamp
 * from the current `now` plus the stored remaining time. No-op when not paused.
 */
export function resume(state: TimerState, now: number): TimerState {
  if (state.status !== 'paused') return state;
  return {
    ...state,
    status: 'running',
    targetEndTime: now + state.remainingMs,
  };
}

/**
 * Resets the timer to idle at the full configured duration.
 */
export function reset(state: TimerState): TimerState {
  return {
    ...state,
    status: 'idle',
    targetEndTime: null,
    remainingMs: state.durationMs,
  };
}

/**
 * Changes the configured duration. Only permitted while idle/finished; the timer
 * is placed in `idle` with the new duration as remaining time. No-op while
 * running or paused (callers should reset first).
 */
export function setDuration(state: TimerState, durationMs: number): TimerState {
  if (state.status === 'running' || state.status === 'paused') return state;
  const safeDuration = durationMs > 0 ? durationMs : 0;
  return {
    status: 'idle',
    durationMs: safeDuration,
    targetEndTime: null,
    remainingMs: safeDuration,
  };
}

/**
 * Evaluates the timer against the current `now`. If running and the absolute
 * deadline has been reached or passed, transitions to `finished` with zero
 * remaining — regardless of how many interval ticks actually fired. Otherwise
 * returns the state unchanged (referential equality preserved for no-ops).
 */
export function tick(state: TimerState, now: number): TimerState {
  if (state.status !== 'running') return state;
  const remaining = getRemainingMs(state, now);
  if (remaining <= 0) {
    return {
      ...state,
      status: 'finished',
      remainingMs: 0,
      targetEndTime: null,
    };
  }
  return state;
}
