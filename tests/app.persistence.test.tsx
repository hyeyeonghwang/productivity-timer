import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import App from '../src/App';
import { STORAGE_KEYS, DEFAULT_SETTINGS, loadStatistics } from '../src/core/storage';
import type { Settings } from '../src/core/types';

vi.mock('../src/lib/audio', () => ({
  unlockAudio: vi.fn(() => null),
  playChime: vi.fn(),
  isAudioSupported: vi.fn(() => true),
  resetAudioForTesting: vi.fn(),
}));

const MIN = 60_000;
const START_NOW = 1_000_000;

function seedSettings(patch: Partial<Settings>): void {
  localStorage.setItem(
    STORAGE_KEYS.settings,
    JSON.stringify({ ...DEFAULT_SETTINGS, ...patch }),
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(START_NOW);
  // No Notification API by default here (unsupported path stays safe).
  // @ts-expect-error cleanup
  delete globalThis.Notification;
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Persistence across reload (remount)', () => {
  it('settings survive a reload', () => {
    seedSettings({ mode: 'standard', soundEnabled: true });
    const { unmount } = render(<App />);

    act(() => {
      screen.getByRole('switch', { name: 'Sound' }).click();
    });
    expect(screen.getByRole('switch', { name: 'Sound' })).toHaveAttribute(
      'aria-checked',
      'false',
    );

    // Simulate reload: unmount and mount a fresh App; it reads from storage.
    unmount();
    render(<App />);
    expect(screen.getByRole('switch', { name: 'Sound' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it("today's statistics survive a reload", () => {
    seedSettings({ mode: 'pomodoro' });
    const { unmount } = render(<App />);

    act(() => {
      screen.getByRole('button', { name: 'Start' }).click();
    });
    act(() => {
      vi.setSystemTime(START_NOW + 25 * MIN + 1000);
      vi.advanceTimersByTime(300);
    });
    expect(loadStatistics().completedFocusSessions).toBe(1);

    unmount();
    render(<App />);
    // Stats panel reflects the persisted session after "reload".
    expect(screen.getByText('Completed sessions')).toBeInTheDocument();
    expect(loadStatistics().completedFocusSessions).toBe(1);
  });

  it('invalid persisted values do not crash the app', () => {
    localStorage.setItem(STORAGE_KEYS.settings, '{{ not json');
    localStorage.setItem(STORAGE_KEYS.stats, 'garbage');
    expect(() => render(<App />)).not.toThrow();
    // Falls back to defaults (standard mode shows presets).
    expect(screen.getByRole('button', { name: '25 min' })).toBeInTheDocument();
  });

  it('previous-day statistics reset to zero on load', () => {
    localStorage.setItem(
      STORAGE_KEYS.stats,
      JSON.stringify({
        date: '2020-01-01',
        completedFocusSessions: 9,
        totalFocusMs: 200 * MIN,
      }),
    );
    seedSettings({ mode: 'standard' });
    render(<App />);
    // Day rollover => zeroed; the stats region shows 0 sessions and 0m.
    expect(loadStatistics().completedFocusSessions).toBe(0);
    expect(screen.getByText('0m')).toBeInTheDocument();
  });
});

describe('Background throttling + visibility', () => {
  it('updates immediately on visibilitychange after a throttled gap', () => {
    seedSettings({ mode: 'standard', selectedPreset: 25 });
    render(<App />);

    act(() => {
      screen.getByRole('button', { name: 'Start' }).click();
    });

    // Tab backgrounded: advance wall clock 10 min WITHOUT firing the interval.
    act(() => {
      vi.setSystemTime(START_NOW + 10 * MIN);
    });

    // Returning to the tab fires visibilitychange -> immediate recompute.
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(screen.getByText('15:00')).toBeInTheDocument();
  });

  it('a single late tick past the deadline reaches completion (no drift)', () => {
    seedSettings({ mode: 'standard', selectedPreset: 5, soundEnabled: false });
    render(<App />);
    act(() => {
      screen.getByRole('button', { name: 'Start' }).click();
    });

    // Frozen tab for the whole duration + extra; one tick after waking.
    act(() => {
      vi.setSystemTime(START_NOW + 20 * MIN);
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText('00:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled();
  });
});
