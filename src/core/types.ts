/**
 * Shared domain types for the productivity timer.
 *
 * These types are framework-agnostic and contain no React dependencies so the
 * core logic remains independently testable.
 */

/** Lifecycle status of a single countdown. */
export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

/**
 * Immutable snapshot of a countdown timer.
 *
 * Remaining time is NEVER stored as a decrementing per-second counter. While
 * running, the source of truth is {@link TimerState.targetEndTime} (an absolute
 * `Date.now()`-based timestamp). When not running, {@link TimerState.remainingMs}
 * holds the captured remaining time.
 */
export interface TimerState {
  /** Current lifecycle status. */
  status: TimerStatus;
  /** Full configured duration for this run, in milliseconds. */
  durationMs: number;
  /**
   * Absolute wall-clock time (ms, `Date.now()`-based) at which the countdown
   * reaches zero. Non-null only while `status === 'running'`.
   */
  targetEndTime: number | null;
  /**
   * Remaining time in ms captured while idle/paused/finished. Source of truth
   * when not running; recomputed from `targetEndTime` while running.
   */
  remainingMs: number;
}

/** Pomodoro phase. */
export type PomodoroPhase = 'focus' | 'break';

/** Timer operating mode. */
export type TimerMode = 'standard' | 'pomodoro';

/** User-configurable preset durations, in minutes. */
export type PresetMinutes = 5 | 10 | 25 | 50;

/** Persisted user settings. */
export interface Settings {
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  mode: TimerMode;
  /** Selected preset in minutes, or null when a custom duration is active. */
  selectedPreset: PresetMinutes | null;
  /** Custom duration in ms (used when no preset is selected). */
  customDurationMs: number;
  /** When true, auto-start the next Pomodoro phase. Default false. */
  pomodoroAutoStart: boolean;
}

/** Persisted daily statistics, scoped to a single local calendar day. */
export interface DailyStatistics {
  /** Local calendar day in `YYYY-MM-DD` form. */
  date: string;
  /** Count of completed focus sessions for the day. */
  completedFocusSessions: number;
  /** Total focused time for the day, in ms. */
  totalFocusMs: number;
}
