import { describe, it, expect } from 'vitest';
import {
  createTimer,
  getRemainingMs,
  getProgress,
  start,
  pause,
  resume,
  reset,
  setDuration,
  tick,
} from '../src/core/timer';
import type { TimerState } from '../src/core/types';

const MIN = 60_000;
const T0 = 1_000_000; // arbitrary fixed "now" baseline (ms)

describe('createTimer', () => {
  it('creates an idle timer with full duration as remaining', () => {
    const s = createTimer(25 * MIN);
    expect(s).toEqual<TimerState>({
      status: 'idle',
      durationMs: 25 * MIN,
      targetEndTime: null,
      remainingMs: 25 * MIN,
    });
  });

  it('clamps negative durations to zero', () => {
    expect(createTimer(-5000).durationMs).toBe(0);
  });
});

describe('getRemainingMs', () => {
  it('returns captured remaining while idle', () => {
    const s = createTimer(10 * MIN);
    expect(getRemainingMs(s, T0)).toBe(10 * MIN);
  });

  it('derives remaining from targetEndTime while running', () => {
    const s = start(createTimer(10 * MIN), T0);
    // 3 minutes later
    expect(getRemainingMs(s, T0 + 3 * MIN)).toBe(7 * MIN);
  });

  it('never returns negative values', () => {
    const s = start(createTimer(1 * MIN), T0);
    expect(getRemainingMs(s, T0 + 5 * MIN)).toBe(0);
  });

  it('returns captured remaining while paused (independent of now)', () => {
    const running = start(createTimer(10 * MIN), T0);
    const paused = pause(running, T0 + 4 * MIN);
    expect(getRemainingMs(paused, T0 + 999 * MIN)).toBe(6 * MIN);
  });
});

describe('getProgress', () => {
  it('is 0 at start and 1 at the deadline', () => {
    const s = start(createTimer(10 * MIN), T0);
    expect(getProgress(s, T0)).toBe(0);
    expect(getProgress(s, T0 + 10 * MIN)).toBe(1);
  });

  it('is 0.5 at the midpoint', () => {
    const s = start(createTimer(10 * MIN), T0);
    expect(getProgress(s, T0 + 5 * MIN)).toBeCloseTo(0.5, 10);
  });

  it('clamps beyond the deadline to 1', () => {
    const s = start(createTimer(10 * MIN), T0);
    expect(getProgress(s, T0 + 100 * MIN)).toBe(1);
  });

  it('returns 1 for zero-duration timers', () => {
    expect(getProgress(createTimer(0), T0)).toBe(1);
  });
});

describe('start', () => {
  it('sets running status and an absolute targetEndTime of now + duration', () => {
    const s = start(createTimer(25 * MIN), T0);
    expect(s.status).toBe('running');
    expect(s.targetEndTime).toBe(T0 + 25 * MIN);
    expect(s.remainingMs).toBe(25 * MIN);
  });

  it('is a no-op when already running (same reference)', () => {
    const running = start(createTimer(25 * MIN), T0);
    expect(start(running, T0 + 1000)).toBe(running);
  });

  it('does not start a zero-duration timer', () => {
    const s = createTimer(0);
    expect(start(s, T0)).toBe(s);
  });

  it('uses captured remaining when restarting after reset+partial', () => {
    // idle timer whose remaining was lowered (simulate) should start from it
    const s: TimerState = {
      status: 'idle',
      durationMs: 25 * MIN,
      targetEndTime: null,
      remainingMs: 10 * MIN,
    };
    const started = start(s, T0);
    expect(started.targetEndTime).toBe(T0 + 10 * MIN);
  });
});

describe('pause / resume', () => {
  it('pause captures exact remaining and clears targetEndTime', () => {
    const running = start(createTimer(25 * MIN), T0);
    const paused = pause(running, T0 + 10 * MIN);
    expect(paused.status).toBe('paused');
    expect(paused.remainingMs).toBe(15 * MIN);
    expect(paused.targetEndTime).toBeNull();
  });

  it('pause is a no-op when not running', () => {
    const idle = createTimer(25 * MIN);
    expect(pause(idle, T0)).toBe(idle);
  });

  it('resume recomputes targetEndTime from a NEW now + stored remaining', () => {
    const running = start(createTimer(25 * MIN), T0);
    const paused = pause(running, T0 + 10 * MIN); // 15 min remaining
    // Resume much later: new deadline is based on the new now, not the old one.
    const resumeNow = T0 + 60 * MIN;
    const resumed = resume(paused, resumeNow);
    expect(resumed.status).toBe('running');
    expect(resumed.targetEndTime).toBe(resumeNow + 15 * MIN);
    expect(getRemainingMs(resumed, resumeNow)).toBe(15 * MIN);
  });

  it('resume is a no-op when not paused', () => {
    const running = start(createTimer(25 * MIN), T0);
    expect(resume(running, T0 + 1000)).toBe(running);
  });

  it('pause then resume preserves total remaining across a long pause', () => {
    const running = start(createTimer(25 * MIN), T0);
    const paused = pause(running, T0 + 5 * MIN); // 20 min left
    const resumed = resume(paused, T0 + 120 * MIN);
    // After 20 more minutes of real running time, it should hit zero.
    expect(getRemainingMs(resumed, T0 + 120 * MIN + 20 * MIN)).toBe(0);
  });
});

describe('reset', () => {
  it('restores idle status at full duration', () => {
    const running = start(createTimer(25 * MIN), T0);
    const afterPartial = pause(running, T0 + 10 * MIN);
    const r = reset(afterPartial);
    expect(r.status).toBe('idle');
    expect(r.remainingMs).toBe(25 * MIN);
    expect(r.targetEndTime).toBeNull();
  });
});

describe('setDuration', () => {
  it('updates duration and remaining when idle', () => {
    const s = setDuration(createTimer(25 * MIN), 50 * MIN);
    expect(s.durationMs).toBe(50 * MIN);
    expect(s.remainingMs).toBe(50 * MIN);
    expect(s.status).toBe('idle');
  });

  it('is a no-op while running', () => {
    const running = start(createTimer(25 * MIN), T0);
    expect(setDuration(running, 50 * MIN)).toBe(running);
  });

  it('is a no-op while paused', () => {
    const paused = pause(start(createTimer(25 * MIN), T0), T0 + MIN);
    expect(setDuration(paused, 50 * MIN)).toBe(paused);
  });

  it('allows changing duration after finish', () => {
    const finished = tick(start(createTimer(1 * MIN), T0), T0 + 2 * MIN);
    expect(finished.status).toBe('finished');
    const s = setDuration(finished, 5 * MIN);
    expect(s.durationMs).toBe(5 * MIN);
    expect(s.status).toBe('idle');
  });
});

describe('tick', () => {
  it('is a no-op while not running', () => {
    const idle = createTimer(25 * MIN);
    expect(tick(idle, T0 + 999 * MIN)).toBe(idle);
  });

  it('keeps running when the deadline has not passed (same reference)', () => {
    const running = start(createTimer(25 * MIN), T0);
    expect(tick(running, T0 + 10 * MIN)).toBe(running);
  });

  it('transitions to finished exactly at the deadline', () => {
    const running = start(createTimer(25 * MIN), T0);
    const finished = tick(running, T0 + 25 * MIN);
    expect(finished.status).toBe('finished');
    expect(finished.remainingMs).toBe(0);
    expect(finished.targetEndTime).toBeNull();
  });
});

/**
 * Accuracy under tab throttling / background inactivity (Req 11).
 *
 * These tests prove that correctness does NOT depend on the number of interval
 * ticks: remaining time is always derived from the absolute target timestamp.
 */
describe('throttling / background-tab accuracy (Req 11)', () => {
  it('a single tick far past the deadline marks finished (skipped ticks)', () => {
    // Simulate: tab goes to background right after start; setInterval is frozen
    // for the entire 25-minute duration and fires exactly once, 5 minutes LATE.
    const running = start(createTimer(25 * MIN), T0);
    const wakeNow = T0 + 25 * MIN + 5 * MIN; // 30 min elapsed, only now do we tick
    const finished = tick(running, wakeNow);
    expect(finished.status).toBe('finished');
    expect(finished.remainingMs).toBe(0);
  });

  it('remaining is real elapsed time, not tick count, after a throttled gap', () => {
    // Start, then the tab is throttled: no ticks for 10 real minutes.
    const running = start(createTimer(25 * MIN), T0);
    const wakeNow = T0 + 10 * MIN;
    // Even though zero ticks fired, remaining reflects true wall-clock elapsed.
    expect(getRemainingMs(running, wakeNow)).toBe(15 * MIN);
    // The first tick after waking keeps it running (deadline not yet reached).
    expect(tick(running, wakeNow)).toBe(running);
  });

  it('is immune to tick frequency: 1 tick vs many ticks give the same result', () => {
    const duration = 10 * MIN;
    const base = start(createTimer(duration), T0);
    const endNow = T0 + duration;

    // Scenario A: only one tick, right at the end.
    const singleTick = tick(base, endNow);

    // Scenario B: many throttled ticks at irregular, sparse intervals.
    let many = base;
    for (const offset of [1_000, 120_000, 500_000, duration]) {
      many = tick(many, T0 + offset);
    }

    expect(singleTick.status).toBe('finished');
    expect(many.status).toBe('finished');
    expect(singleTick.remainingMs).toBe(many.remainingMs);
  });

  it('a long real pause does not consume countdown time (throttle while paused)', () => {
    const running = start(createTimer(25 * MIN), T0);
    const paused = pause(running, T0 + 5 * MIN); // 20 min remaining
    // Tab backgrounded for an hour while paused: remaining is unchanged.
    expect(getRemainingMs(paused, T0 + 65 * MIN)).toBe(20 * MIN);
  });
});
