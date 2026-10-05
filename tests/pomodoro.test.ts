import { describe, it, expect } from 'vitest';
import {
  POMODORO_DURATIONS,
  INITIAL_POMODORO_PHASE,
  phaseDuration,
  isFocusPhase,
  nextPomodoroPhase,
} from '../src/core/pomodoro';

const MIN = 60_000;

describe('Pomodoro durations', () => {
  it('focus is 25 minutes and break is 5 minutes', () => {
    expect(POMODORO_DURATIONS.focus).toBe(25 * MIN);
    expect(POMODORO_DURATIONS.break).toBe(5 * MIN);
  });

  it('phaseDuration returns the matching duration', () => {
    expect(phaseDuration('focus')).toBe(25 * MIN);
    expect(phaseDuration('break')).toBe(5 * MIN);
  });

  it('a session begins in the focus phase', () => {
    expect(INITIAL_POMODORO_PHASE).toBe('focus');
  });
});

describe('isFocusPhase', () => {
  it('is true only for focus', () => {
    expect(isFocusPhase('focus')).toBe(true);
    expect(isFocusPhase('break')).toBe(false);
  });
});

describe('nextPomodoroPhase', () => {
  it('transitions focus -> break with 5 minutes', () => {
    expect(nextPomodoroPhase('focus')).toEqual({ phase: 'break', durationMs: 5 * MIN });
  });

  it('transitions break -> focus with 25 minutes', () => {
    expect(nextPomodoroPhase('break')).toEqual({ phase: 'focus', durationMs: 25 * MIN });
  });

  it('alternates over multiple cycles', () => {
    let phase = INITIAL_POMODORO_PHASE;
    const seen: string[] = [phase];
    for (let i = 0; i < 4; i++) {
      phase = nextPomodoroPhase(phase).phase;
      seen.push(phase);
    }
    expect(seen).toEqual(['focus', 'break', 'focus', 'break', 'focus']);
  });
});
