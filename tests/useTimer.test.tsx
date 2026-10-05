import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { useTimer, type UseTimerResult } from '../src/hooks/useTimer';

const MIN = 60_000;

/**
 * Test harness: renders a component using useTimer and exposes the latest hook
 * result + control methods to the test via a mutable ref object.
 */
interface Harness {
  current: UseTimerResult;
  finishCalls: number[];
}

function renderTimer(initialDurationMs: number, refreshIntervalMs = 200) {
  const harness: Harness = {
    current: null as unknown as UseTimerResult,
    finishCalls: [],
  };

  function Probe() {
    const result = useTimer({
      initialDurationMs,
      refreshIntervalMs,
      onFinish: (d) => harness.finishCalls.push(d),
    });
    useEffect(() => {
      harness.current = result;
    });
    harness.current = result;
    return null;
  }

  const utils = render(<Probe />);
  return { harness, ...utils };
}

/** Sets the mocked wall clock. */
function setNow(ms: number) {
  vi.setSystemTime(ms);
}

beforeEach(() => {
  vi.useFakeTimers();
  setNow(1_000_000);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useTimer — basic lifecycle', () => {
  it('starts idle with full remaining time', () => {
    const { harness } = renderTimer(25 * MIN);
    expect(harness.current.state.status).toBe('idle');
    expect(harness.current.remainingMs).toBe(25 * MIN);
    expect(harness.current.progress).toBe(0);
  });

  it('start transitions to running and sets an absolute deadline', () => {
    const { harness } = renderTimer(25 * MIN);
    act(() => harness.current.start());
    expect(harness.current.state.status).toBe('running');
    expect(harness.current.state.targetEndTime).toBe(1_000_000 + 25 * MIN);
  });

  it('reset returns to idle at full duration', () => {
    const { harness } = renderTimer(10 * MIN);
    act(() => harness.current.start());
    act(() => {
      setNow(1_000_000 + 3 * MIN);
      harness.current.pause();
    });
    act(() => harness.current.reset());
    expect(harness.current.state.status).toBe('idle');
    expect(harness.current.remainingMs).toBe(10 * MIN);
  });
});

describe('useTimer — pause/resume consistency with engine', () => {
  it('pause captures remaining; resume recomputes deadline from new now', () => {
    const { harness } = renderTimer(25 * MIN);
    act(() => harness.current.start());

    act(() => {
      setNow(1_000_000 + 10 * MIN);
      harness.current.pause();
    });
    expect(harness.current.state.status).toBe('paused');
    expect(harness.current.remainingMs).toBe(15 * MIN);

    // Resume much later — deadline must be new now + 15 min.
    act(() => {
      setNow(1_000_000 + 60 * MIN);
      harness.current.resume();
    });
    expect(harness.current.state.targetEndTime).toBe(1_000_000 + 60 * MIN + 15 * MIN);
    expect(harness.current.remainingMs).toBe(15 * MIN);
  });
});

describe('useTimer — throttling / drift resistance (Req 11)', () => {
  it('does not drift when interval ticks are sparse/throttled', () => {
    const { harness } = renderTimer(25 * MIN, 200);
    act(() => harness.current.start());

    // Simulate a backgrounded tab: wall clock advances 10 minutes while the
    // interval is throttled to a SINGLE late callback (not 3000 ticks).
    // Position the clock so the single fired tick lands exactly at +10 min
    // (advanceTimersByTime also advances the mocked Date.now()).
    act(() => {
      setNow(1_000_000 + 10 * MIN - 200);
      vi.advanceTimersByTime(200); // one refresh fires after waking
    });

    // Remaining reflects true elapsed wall-clock time (derived from the
    // timestamp), independent of how many ticks fired.
    expect(harness.current.remainingMs).toBe(15 * MIN);
    expect(harness.current.state.status).toBe('running');
  });

  it('a single tick far past the deadline finishes exactly once', () => {
    const { harness } = renderTimer(5 * MIN, 200);
    act(() => harness.current.start());

    // Tab frozen for the whole duration + extra; wall clock jumps way past end.
    act(() => {
      setNow(1_000_000 + 10 * MIN);
      // Fire a single interval tick after waking.
      vi.advanceTimersByTime(200);
    });

    expect(harness.current.state.status).toBe('finished');
    expect(harness.current.remainingMs).toBe(0);
    expect(harness.finishCalls).toEqual([5 * MIN]);
  });

  it('visibilitychange forces an immediate recompute to finished', () => {
    const { harness } = renderTimer(5 * MIN, 10_000);
    act(() => harness.current.start());

    // Advance wall clock past the deadline without firing the interval.
    act(() => {
      setNow(1_000_000 + 6 * MIN);
      // Simulate the tab becoming visible again.
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(harness.current.state.status).toBe('finished');
    expect(harness.finishCalls).toEqual([5 * MIN]);
  });

  it('onFinish fires only once even with many ticks after the deadline', () => {
    const { harness } = renderTimer(1 * MIN, 100);
    act(() => harness.current.start());

    act(() => {
      setNow(1_000_000 + 2 * MIN);
      vi.advanceTimersByTime(1000); // many 100ms ticks
    });

    expect(harness.current.state.status).toBe('finished');
    expect(harness.finishCalls).toHaveLength(1);
  });
});

describe('useTimer — cleanup', () => {
  it('clears the interval on unmount (no further ticks)', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const { harness, unmount } = renderTimer(25 * MIN, 200);
    act(() => harness.current.start());

    unmount();
    expect(clearSpy).toHaveBeenCalled();

    // Advancing timers after unmount must not throw or fire callbacks.
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
    }).not.toThrow();
  });

  it('removes the visibilitychange listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderTimer(25 * MIN);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});
