import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import App from '../src/App';
import { STORAGE_KEYS, DEFAULT_SETTINGS, loadStatistics } from '../src/core/storage';
import type { Settings } from '../src/core/types';

// --- Mocks for browser side effects -----------------------------------------
const chimeCalls = { count: 0 };
vi.mock('../src/lib/audio', () => ({
  unlockAudio: vi.fn(() => null),
  playChime: vi.fn(() => {
    chimeCalls.count += 1;
  }),
  isAudioSupported: vi.fn(() => true),
  resetAudioForTesting: vi.fn(),
}));

const notificationCalls: Array<{ title: string; body?: string }> = [];

interface MockNotificationStatic {
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
}

function installNotificationMock(
  permission: NotificationPermission,
  requestResult: NotificationPermission = permission,
): void {
  const ctor = function (
    this: unknown,
    title: string,
    options?: NotificationOptions,
  ) {
    notificationCalls.push({ title, body: options?.body });
  } as unknown as MockNotificationStatic &
    (new (t: string, o?: NotificationOptions) => unknown);
  ctor.permission = permission;
  ctor.requestPermission = vi.fn(async () => requestResult);
  // @ts-expect-error — install mock
  globalThis.Notification = ctor;
}

function removeNotificationMock(): void {
  // @ts-expect-error — cleanup
  delete globalThis.Notification;
}

const MIN = 60_000;
const START_NOW = 1_000_000;

function seedSettings(patch: Partial<Settings>): void {
  localStorage.setItem(
    STORAGE_KEYS.settings,
    JSON.stringify({ ...DEFAULT_SETTINGS, ...patch }),
  );
}

/** Advances wall clock to `START_NOW + ms` and fires one interval tick. */
function advanceTo(ms: number): void {
  act(() => {
    vi.setSystemTime(START_NOW + ms);
    vi.advanceTimersByTime(250); // one refresh tick (>= default 200ms)
  });
}

beforeEach(() => {
  localStorage.clear();
  chimeCalls.count = 0;
  notificationCalls.length = 0;
  vi.useFakeTimers();
  vi.setSystemTime(START_NOW);
  installNotificationMock('granted');
});

afterEach(() => {
  vi.useRealTimers();
  removeNotificationMock();
  vi.clearAllMocks();
});

function clickButton(name: string): void {
  act(() => {
    screen.getByRole('button', { name }).click();
  });
}

describe('Countdown workflow', () => {
  it('selects a preset, starts, pauses, resumes, resets', () => {
    seedSettings({ mode: 'standard', selectedPreset: 25 });
    render(<App />);

    // Choose the 10-minute preset.
    clickButton('10 min');
    expect(screen.getByText('10:00')).toBeInTheDocument();

    clickButton('Start');
    advanceTo(3 * MIN); // 7:00 remaining
    expect(screen.getByText('07:00')).toBeInTheDocument();

    clickButton('Pause');
    // Clock advances while paused — remaining must NOT change.
    advanceTo(8 * MIN);
    expect(screen.getByText('07:00')).toBeInTheDocument();

    clickButton('Resume');
    advanceTo(8 * MIN + 2 * MIN); // 2 more minutes of real running time
    expect(screen.getByText('05:00')).toBeInTheDocument();

    clickButton('Reset');
    expect(screen.getByText('10:00')).toBeInTheDocument();
  });

  it('applies a valid custom duration and uses it', () => {
    seedSettings({ mode: 'standard' });
    render(<App />);

    const input = screen.getByLabelText('Custom duration (minutes)');
    act(() => {
      (input as HTMLInputElement).focus();
    });
    // Set value directly (fake timers + userEvent don't mix well here).
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(input, '42');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    clickButton('Set');
    expect(screen.getByText('42:00')).toBeInTheDocument();
  });
});

describe('Countdown completion', () => {
  it('reaches finished, plays sound when enabled, notifies when granted, stats unchanged', () => {
    seedSettings({
      mode: 'standard',
      selectedPreset: 5,
      soundEnabled: true,
      notificationsEnabled: true,
    });
    render(<App />);

    clickButton('Start');
    advanceTo(5 * MIN + 1000); // past the 5-minute deadline

    expect(screen.getByText('00:00')).toBeInTheDocument();
    // Only Reset remains (finished state).
    expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();

    expect(chimeCalls.count).toBe(1);
    expect(notificationCalls).toHaveLength(1);
    // Countdown must not touch focus statistics.
    const stats = loadStatistics();
    expect(stats.completedFocusSessions).toBe(0);
    expect(stats.totalFocusMs).toBe(0);
  });

  it('does not play audio when sound is disabled', () => {
    seedSettings({ mode: 'standard', selectedPreset: 5, soundEnabled: false });
    render(<App />);
    clickButton('Start');
    advanceTo(5 * MIN + 1000);
    expect(chimeCalls.count).toBe(0);
  });

  it('does not notify when notifications are disabled', () => {
    seedSettings({
      mode: 'standard',
      selectedPreset: 5,
      notificationsEnabled: false,
    });
    render(<App />);
    clickButton('Start');
    advanceTo(5 * MIN + 1000);
    expect(notificationCalls).toHaveLength(0);
  });
});

describe('Pomodoro focus completion', () => {
  it('records exactly one focus session, accumulates time, advances to break', () => {
    seedSettings({ mode: 'pomodoro', soundEnabled: true });
    render(<App />);

    // Focus badge visible, 25:00 loaded.
    expect(screen.getByText('Focus')).toBeInTheDocument();
    expect(screen.getByText('25:00')).toBeInTheDocument();

    clickButton('Start');
    advanceTo(25 * MIN + 1000); // complete focus

    // Phase advanced to break; break duration loaded; idle (auto-start OFF).
    expect(screen.getByText('Break')).toBeInTheDocument();
    expect(screen.getByText('05:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();

    const stats = loadStatistics();
    expect(stats.completedFocusSessions).toBe(1);
    expect(stats.totalFocusMs).toBe(25 * MIN);
  });
});

describe('Pomodoro break completion', () => {
  it('does not change focus statistics and advances back to focus', () => {
    seedSettings({ mode: 'pomodoro' });
    render(<App />);

    // Complete focus first.
    clickButton('Start');
    advanceTo(25 * MIN + 1000);
    expect(screen.getByText('Break')).toBeInTheDocument();

    // Start and complete the break.
    clickButton('Start');
    advanceTo(25 * MIN + 1000 + 5 * MIN + 1000);

    expect(screen.getByText('Focus')).toBeInTheDocument();
    expect(screen.getByText('25:00')).toBeInTheDocument();

    const stats = loadStatistics();
    // Still exactly one focus session from the focus phase; break added nothing.
    expect(stats.completedFocusSessions).toBe(1);
    expect(stats.totalFocusMs).toBe(25 * MIN);
  });
});

describe('Pomodoro auto-start', () => {
  it('OFF: next phase remains idle', () => {
    seedSettings({ mode: 'pomodoro', pomodoroAutoStart: false });
    render(<App />);
    clickButton('Start');
    advanceTo(25 * MIN + 1000);
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });

  it('ON: next phase starts automatically', () => {
    seedSettings({ mode: 'pomodoro', pomodoroAutoStart: true });
    render(<App />);
    clickButton('Start');
    advanceTo(25 * MIN + 1000);
    // Running => Pause is shown, not Start.
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.getByText('Break')).toBeInTheDocument();
  });
});

describe('Mode switching', () => {
  it('resets a running timer and loads the new mode duration', () => {
    seedSettings({ mode: 'standard', selectedPreset: 50 });
    render(<App />);

    clickButton('Start');
    advanceTo(5 * MIN); // 45:00 remaining, running

    // Switch to Pomodoro: should reset and load focus 25:00.
    act(() => {
      screen.getByRole('radio', { name: 'Pomodoro' }).click();
    });
    expect(screen.getByText('25:00')).toBeInTheDocument();
    expect(screen.getByText('Focus')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();

    // Switch back to Countdown: loads the selected 50:00 preset.
    act(() => {
      screen.getByRole('radio', { name: 'Countdown' }).click();
    });
    expect(screen.getByText('50:00')).toBeInTheDocument();
  });
});

describe('Duplicate finish protection', () => {
  it('a single focus completion records stats and effects exactly once', () => {
    seedSettings({ mode: 'pomodoro', soundEnabled: true, notificationsEnabled: true });
    render(<App />);
    clickButton('Start');

    // Fire MANY ticks after the deadline — effects must still be once.
    act(() => {
      vi.setSystemTime(START_NOW + 25 * MIN + 10_000);
      vi.advanceTimersByTime(2000); // many 250ms ticks
    });

    const stats = loadStatistics();
    expect(stats.completedFocusSessions).toBe(1);
    expect(chimeCalls.count).toBe(1);
    expect(notificationCalls).toHaveLength(1);
  });
});

describe('Notification permission interaction', () => {
  it('requests permission only via the user toggle, and reflects denial', async () => {
    installNotificationMock('default', 'denied');
    seedSettings({ mode: 'standard', notificationsEnabled: false });
    render(<App />);

    const toggle = screen.getByRole('switch', { name: 'Browser notifications' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await act(async () => {
      toggle.click();
    });

    // Denied => stays off and a note is shown; no crash.
    expect(
      screen.getByRole('switch', { name: 'Browser notifications' }),
    ).toHaveAttribute('aria-checked', 'false');
    expect(
      screen.getByText(/Permission denied/i),
    ).toBeInTheDocument();
  });

  it('unsupported browser disables the notifications toggle', () => {
    removeNotificationMock();
    seedSettings({ mode: 'standard' });
    render(<App />);
    expect(
      screen.getByRole('switch', { name: 'Browser notifications' }),
    ).toBeDisabled();
    expect(
      screen.getByText(/not supported/i),
    ).toBeInTheDocument();
  });
});

describe('Statistics panel', () => {
  it('reflects a recorded focus session in the UI', () => {
    seedSettings({ mode: 'pomodoro' });
    render(<App />);
    clickButton('Start');
    advanceTo(25 * MIN + 1000);

    const panel = screen.getByRole('region', { name: 'Today' });
    expect(within(panel).getByText('1')).toBeInTheDocument(); // sessions
    expect(within(panel).getByText('25m')).toBeInTheDocument(); // total time
  });
});
