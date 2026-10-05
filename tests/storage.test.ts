import { describe, it, expect, beforeEach } from 'vitest';
import {
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  defaultStatistics,
  todayKey,
  loadJSON,
  saveJSON,
  loadSettings,
  saveSettings,
  loadStatistics,
  saveStatistics,
} from '../src/core/storage';
import type { Settings, DailyStatistics } from '../src/core/types';

beforeEach(() => {
  localStorage.clear();
});

describe('todayKey', () => {
  it('formats a date as YYYY-MM-DD in local time', () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(todayKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('loadJSON — tolerant parsing', () => {
  const fallback = { a: 1, b: 'x', c: true };

  it('returns fallback when key is missing', () => {
    expect(loadJSON('missing', fallback)).toEqual(fallback);
  });

  it('returns fallback for invalid JSON', () => {
    localStorage.setItem('k', '{not valid json');
    expect(loadJSON('k', fallback)).toEqual(fallback);
  });

  it('returns fallback when stored JSON is an array', () => {
    localStorage.setItem('k', '[1,2,3]');
    expect(loadJSON('k', fallback)).toEqual(fallback);
  });

  it('returns fallback when stored JSON is a primitive', () => {
    localStorage.setItem('k', '42');
    expect(loadJSON('k', fallback)).toEqual(fallback);
  });

  it('backfills missing fields from fallback (partial object)', () => {
    localStorage.setItem('k', JSON.stringify({ a: 99 }));
    expect(loadJSON('k', fallback)).toEqual({ a: 99, b: 'x', c: true });
  });

  it('ignores fields whose type does not match the fallback', () => {
    localStorage.setItem('k', JSON.stringify({ a: 'wrong-type', b: 'ok' }));
    expect(loadJSON('k', fallback)).toEqual({ a: 1, b: 'ok', c: true });
  });

  it('drops unknown/outdated keys not present in fallback', () => {
    localStorage.setItem('k', JSON.stringify({ a: 2, legacy: 'drop-me' }));
    const result = loadJSON('k', fallback);
    expect(result).toEqual({ a: 2, b: 'x', c: true });
    expect('legacy' in result).toBe(false);
  });

  it('round-trips a full valid object via saveJSON', () => {
    const value = { a: 7, b: 'hello', c: false };
    saveJSON('k', value);
    expect(loadJSON('k', fallback)).toEqual(value);
  });
});

describe('settings persistence', () => {
  it('returns defaults when nothing persisted', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips modified settings', () => {
    const next: Settings = {
      ...DEFAULT_SETTINGS,
      soundEnabled: false,
      notificationsEnabled: true,
      mode: 'pomodoro',
      selectedPreset: null,
      customDurationMs: 42 * 60_000,
      pomodoroAutoStart: true,
    };
    saveSettings(next);
    expect(loadSettings()).toEqual(next);
  });

  it('backfills defaults for a partially outdated settings blob', () => {
    localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ soundEnabled: false }),
    );
    const loaded = loadSettings();
    expect(loaded.soundEnabled).toBe(false);
    expect(loaded.mode).toBe(DEFAULT_SETTINGS.mode);
    expect(loaded.customDurationMs).toBe(DEFAULT_SETTINGS.customDurationMs);
  });

  it('falls back to defaults on corrupted settings JSON', () => {
    localStorage.setItem(STORAGE_KEYS.settings, '%%corrupt%%');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('statistics persistence', () => {
  it('returns zeroed stats for today when nothing persisted', () => {
    const now = new Date(2026, 9, 5);
    expect(loadStatistics(now)).toEqual(defaultStatistics(now));
  });

  it('round-trips same-day statistics', () => {
    const now = new Date(2026, 9, 5);
    const stats: DailyStatistics = {
      date: todayKey(now),
      completedFocusSessions: 3,
      totalFocusMs: 75 * 60_000,
      completedCountdownSessions: 2,
      totalCountdownMs: 30 * 60_000,
    };
    saveStatistics(stats);
    expect(loadStatistics(now)).toEqual(stats);
  });

  it('resets to zero when the persisted day is in the past (rollover)', () => {
    const yesterday: DailyStatistics = {
      date: '2026-10-04',
      completedFocusSessions: 5,
      totalFocusMs: 125 * 60_000,
      completedCountdownSessions: 4,
      totalCountdownMs: 60 * 60_000,
    };
    saveStatistics(yesterday);
    const today = new Date(2026, 9, 5);
    expect(loadStatistics(today)).toEqual(defaultStatistics(today));
  });

  it('falls back to zeroed today stats on corrupted JSON', () => {
    localStorage.setItem(STORAGE_KEYS.stats, 'not-json');
    const now = new Date(2026, 9, 5);
    expect(loadStatistics(now)).toEqual(defaultStatistics(now));
  });

  it('backfills missing countdown fields on older persisted stats with zeros', () => {
    const now = new Date(2026, 9, 5);
    // Legacy blob written before the countdown fields existed.
    localStorage.setItem(
      STORAGE_KEYS.stats,
      JSON.stringify({
        date: todayKey(now),
        completedFocusSessions: 4,
        totalFocusMs: 100 * 60_000,
      }),
    );
    const loaded = loadStatistics(now);
    // Existing focus data is preserved...
    expect(loaded.completedFocusSessions).toBe(4);
    expect(loaded.totalFocusMs).toBe(100 * 60_000);
    // ...and the new countdown fields are safely backfilled with zeros.
    expect(loaded.completedCountdownSessions).toBe(0);
    expect(loaded.totalCountdownMs).toBe(0);
    // The full shape matches the current schema.
    expect(loaded).toEqual<DailyStatistics>({
      date: todayKey(now),
      completedFocusSessions: 4,
      totalFocusMs: 100 * 60_000,
      completedCountdownSessions: 0,
      totalCountdownMs: 0,
    });
  });
});
