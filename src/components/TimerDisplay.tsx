import { formatDuration } from "../core/format";

export interface TimerDisplayProps {
  /** Remaining time in milliseconds (computed by the parent/hook). */
  remainingMs: number;
}

/**
 * Presentational display of the remaining time.
 *
 * Performs NO timer math — it only formats the `remainingMs` prop via the shared
 * {@link formatDuration} utility, which handles long (HH:MM:SS) durations.
 *
 * Accessibility: this element is intentionally NOT a live region. Announcing the
 * remaining time on every tick would be extremely chatty for screen readers.
 * Status changes (started/paused/finished) are announced elsewhere via a
 * dedicated low-frequency status region owned by the app.
 */
export function TimerDisplay({ remainingMs }: TimerDisplayProps): JSX.Element {
  const formatted = formatDuration(remainingMs);
  return (
    <div
      className="font-mono text-5xl font-semibold tabular-nums text-slate-900 sm:text-6xl"
      aria-hidden="true"
    >
      {formatted}
    </div>
  );
}
