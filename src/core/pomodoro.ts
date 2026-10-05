/**
 * Pomodoro state machine — pure, framework-agnostic.
 *
 * A 25-minute focus phase alternates with a 5-minute break phase. Only the
 * `focus` phase completion counts toward daily statistics (handled by callers).
 *
 * Auto-start is OFF by default (requirements.md Req 5 + approved decision): on
 * phase completion the caller should LOAD the next phase's duration but remain
 * idle until the user presses Start. This module only computes the next phase
 * and its duration; it holds no timer state and performs no side effects.
 */
import type { PomodoroPhase } from './types';

/** Fixed Pomodoro phase durations in milliseconds. */
export const POMODORO_DURATIONS: Readonly<Record<PomodoroPhase, number>> = {
  focus: 25 * 60 * 1000,
  break: 5 * 60 * 1000,
};

/** The phase a fresh Pomodoro session begins in. */
export const INITIAL_POMODORO_PHASE: PomodoroPhase = 'focus';

/** Returns the duration (ms) for a given Pomodoro phase. */
export function phaseDuration(phase: PomodoroPhase): number {
  return POMODORO_DURATIONS[phase];
}

/** Returns true when a completed phase should be recorded as a focus session. */
export function isFocusPhase(phase: PomodoroPhase): boolean {
  return phase === 'focus';
}

/**
 * Given the phase that just completed, returns the next phase and its duration.
 * focus -> break, break -> focus.
 */
export function nextPomodoroPhase(current: PomodoroPhase): {
  phase: PomodoroPhase;
  durationMs: number;
} {
  const phase: PomodoroPhase = current === 'focus' ? 'break' : 'focus';
  return { phase, durationMs: POMODORO_DURATIONS[phase] };
}
