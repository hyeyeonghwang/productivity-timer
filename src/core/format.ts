/**
 * Formats a duration in milliseconds as `MM:SS`, or `HH:MM:SS` when the duration
 * is one hour or more.
 *
 * Uses `Math.ceil` on seconds so the display shows the next whole second until
 * the moment it truly reaches zero (e.g. 1ms remaining still displays `00:01`).
 *
 * Negative inputs are clamped to zero.
 */
export function formatDuration(ms: number): string {
  const safeMs = ms > 0 ? ms : 0;
  const totalSeconds = Math.ceil(safeMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number): string => String(n).padStart(2, '0');

  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}
