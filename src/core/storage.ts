/**
 * Persistence layer — tolerant typed localStorage I/O.
 *
 * Design (requirements.md Req 10): all reads are tolerant. Missing, malformed,
 * or partially outdated data falls back to safe defaults and never throws, so
 * corrupted persisted state cannot crash the app. Keys are versioned to allow
 * future schema migration.
 *
 * This module is framework-agnostic and holds no application state.
 */
import type { Settings, DailyStatistics } from './types';

/** Versioned localStorage keys. */
export const STORAGE_KEYS = {
  settings: 'pt.settings.v1',
  stats: 'pt.stats.v1',
} as const;

/** Returns the local calendar day as `YYYY-MM-DD`. */
export function todayKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Default settings used when nothing is persisted or data is unusable. */
export const DEFAULT_SETTINGS: Settings = {
  soundEnabled: true,
  notificationsEnabled: false,
  mode: 'standard',
  selectedPreset: 25,
  customDurationMs: 25 * 60 * 1000,
  pomodoroAutoStart: false,
};

/** Default (empty) statistics for the current day. */
export function defaultStatistics(date: Date = new Date()): DailyStatistics {
  return {
    date: todayKey(date),
    completedFocusSessions: 0,
    totalFocusMs: 0,
  };
}

/** Narrows an unknown value to a plain (non-array, non-null) object. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Returns true when `localStorage` is available in the current environment. */
function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Reads and parses JSON for `key`, tolerantly merging onto `fallback`.
 *
 * - Missing key -> `fallback`.
 * - Malformed JSON -> `fallback`.
 * - Non-object JSON (array/primitive/null) -> `fallback`.
 * - Partial object -> merged over `fallback`, so missing fields are backfilled.
 *
 * The merge is shallow by design: the persisted shapes (settings, stats) are
 * flat. Only keys already present in `fallback` are kept, dropping unknown or
 * outdated keys from older schema versions.
 */
export function loadJSON<T extends object>(key: string, fallback: T): T {
  if (!hasLocalStorage()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;

    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return fallback;

    const fallbackRecord = fallback as Record<string, unknown>;
    const result: Record<string, unknown> = { ...fallbackRecord };
    for (const field of Object.keys(fallbackRecord)) {
      if (!(field in parsed)) continue;
      const value = parsed[field];
      // Accept the persisted value when it is null (nullable union fields like
      // `selectedPreset`) or when its primitive type matches the fallback.
      // Wrongly-typed values from an outdated schema are ignored safely.
      const typeMatches = typeof value === typeof fallbackRecord[field];
      if (value === null || typeMatches) {
        result[field] = value;
      }
    }
    return result as T;
  } catch {
    return fallback;
  }
}

/** Serializes and stores `value` under `key`. Silently ignores write errors. */
export function saveJSON<T>(key: string, value: T): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded / serialization error — ignore */
  }
}

/** Loads settings, backfilling defaults for any missing/invalid fields. */
export function loadSettings(): Settings {
  return loadJSON<Settings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
}

/** Persists settings. */
export function saveSettings(settings: Settings): void {
  saveJSON(STORAGE_KEYS.settings, settings);
}

/**
 * Loads statistics. If the persisted day differs from today (local), returns a
 * fresh zeroed record for today (Req 9.4 day rollover).
 */
export function loadStatistics(now: Date = new Date()): DailyStatistics {
  const fallback = defaultStatistics(now);
  const loaded = loadJSON<DailyStatistics>(STORAGE_KEYS.stats, fallback);

  if (loaded.date !== todayKey(now)) {
    return fallback;
  }
  return loaded;
}

/** Persists statistics. */
export function saveStatistics(stats: DailyStatistics): void {
  saveJSON(STORAGE_KEYS.stats, stats);
}
