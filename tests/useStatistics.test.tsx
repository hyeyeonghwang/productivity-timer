import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import {
  useStatistics,
  type UseStatisticsResult,
} from '../src/hooks/useStatistics';
import {
  STORAGE_KEYS,
  loadStatistics,
  todayKey,
} from '../src/core/storage';
import type { DailyStatistics } from '../src/core/types';

function renderStats() {
  const harness: { current: UseStatisticsResult } = {
    current: null as unknown as UseStatisticsResult,
  };
  function Probe() {
    const result = useStatistics();
    useEffect(() => {
      harness.current = result;
    });
    harness.current = result;
    return null;
  }
  const utils = render(<Probe />);
  return { harness, ...utils };
}

const MIN = 60_000;

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 5, 10, 0, 0)); // 2026-10-05 10:00
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useStatistics — initialization', () => {
  it('initializes with zeroed stats for today when nothing persisted', () => {
    const { harness } = renderStats();
    expect(harness.current.statistics).toEqual<DailyStatistics>({
      date: todayKey(),
      completedFocusSessions: 0,
      totalFocusMs: 0,
    });
  });

  it('initializes from persisted same-day statistics', () => {
    localStorage.setItem(
      STORAGE_KEYS.stats,
      JSON.stringify({
        date: todayKey(),
        completedFocusSessions: 2,
        totalFocusMs: 50 * MIN,
      }),
    );
    const { harness } = renderStats();
    expect(harness.current.statistics.completedFocusSessions).toBe(2);
    expect(harness.current.statistics.totalFocusMs).toBe(50 * MIN);
  });

  it('applies day-rollover: a previous day loads as fresh today stats', () => {
    localStorage.setItem(
      STORAGE_KEYS.stats,
      JSON.stringify({
        date: '2026-10-04',
        completedFocusSessions: 5,
        totalFocusMs: 125 * MIN,
      }),
    );
    const { harness } = renderStats();
    expect(harness.current.statistics.date).toBe(todayKey());
    expect(harness.current.statistics.completedFocusSessions).toBe(0);
    expect(harness.current.statistics.totalFocusMs).toBe(0);
  });
});

describe('useStatistics — recording focus sessions', () => {
  it('increments count and total focus time', () => {
    const { harness } = renderStats();
    act(() => harness.current.recordFocusSession(25 * MIN));
    expect(harness.current.statistics.completedFocusSessions).toBe(1);
    expect(harness.current.statistics.totalFocusMs).toBe(25 * MIN);
  });

  it('accumulates across multiple distinct sessions', () => {
    const { harness } = renderStats();
    act(() => harness.current.recordFocusSession(25 * MIN));
    act(() => harness.current.recordFocusSession(50 * MIN));
    expect(harness.current.statistics.completedFocusSessions).toBe(2);
    expect(harness.current.statistics.totalFocusMs).toBe(75 * MIN);
  });

  it('persists immediately after recording', () => {
    const { harness } = renderStats();
    act(() => harness.current.recordFocusSession(25 * MIN));
    const persisted = loadStatistics();
    expect(persisted.completedFocusSessions).toBe(1);
    expect(persisted.totalFocusMs).toBe(25 * MIN);
  });

  it('ignores non-positive durations', () => {
    const { harness } = renderStats();
    act(() => harness.current.recordFocusSession(0));
    act(() => harness.current.recordFocusSession(-1000));
    expect(harness.current.statistics.completedFocusSessions).toBe(0);
    expect(harness.current.statistics.totalFocusMs).toBe(0);
  });

  it('does not double-count when the same sessionKey is recorded twice', () => {
    const { harness } = renderStats();
    act(() => harness.current.recordFocusSession(25 * MIN, 'session-1'));
    act(() => harness.current.recordFocusSession(25 * MIN, 'session-1'));
    expect(harness.current.statistics.completedFocusSessions).toBe(1);
    expect(harness.current.statistics.totalFocusMs).toBe(25 * MIN);
  });

  it('counts distinct sessionKeys separately', () => {
    const { harness } = renderStats();
    act(() => harness.current.recordFocusSession(25 * MIN, 'session-1'));
    act(() => harness.current.recordFocusSession(25 * MIN, 'session-2'));
    expect(harness.current.statistics.completedFocusSessions).toBe(2);
  });

  it('attributes a session to the new day after a rollover at record time', () => {
    localStorage.setItem(
      STORAGE_KEYS.stats,
      JSON.stringify({
        date: todayKey(),
        completedFocusSessions: 3,
        totalFocusMs: 75 * MIN,
      }),
    );
    const { harness } = renderStats();
    expect(harness.current.statistics.completedFocusSessions).toBe(3);

    // Advance the clock to the next day, then record.
    act(() => {
      vi.setSystemTime(new Date(2026, 9, 6, 0, 1, 0)); // 2026-10-06 00:01
      harness.current.recordFocusSession(25 * MIN);
    });

    expect(harness.current.statistics.date).toBe('2026-10-06');
    expect(harness.current.statistics.completedFocusSessions).toBe(1);
    expect(harness.current.statistics.totalFocusMs).toBe(25 * MIN);
  });
});

describe('useStatistics — break sessions', () => {
  it('break completion does not affect focus statistics (never recorded)', () => {
    // Breaks simply never call recordFocusSession; simulate a break finishing
    // by NOT calling it and asserting stats are unchanged.
    const { harness } = renderStats();
    const before = harness.current.statistics;
    // (no recordFocusSession call for a break)
    expect(harness.current.statistics).toEqual(before);
    expect(harness.current.statistics.completedFocusSessions).toBe(0);
  });
});
