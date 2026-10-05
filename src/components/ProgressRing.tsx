import type { ReactNode } from 'react';

export interface ProgressRingProps {
  /** Elapsed progress in [0, 1]. Values outside the range are clamped. */
  progress: number;
  /** Diameter in px (default 240). */
  size?: number;
  /** Stroke width in px (default 12). */
  strokeWidth?: number;
  /** Optional center content (e.g. the TimerDisplay). */
  children?: ReactNode;
}

/** Clamps a value into the [0, 1] range, treating non-finite input as 0. */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Circular SVG progress indicator.
 *
 * Receives `progress` (0..1) as a prop and performs no timer math. The arc is
 * drawn with `stroke-dasharray`/`stroke-dashoffset`. Accessibility is provided
 * via `role="progressbar"` with `aria-valuenow/min/max` and a text label, so
 * progress is not communicated by color alone.
 */
export function ProgressRing({
  progress,
  size = 240,
  strokeWidth = 12,
  children,
}: ProgressRingProps): JSX.Element {
  const safeProgress = clamp01(progress);
  const percent = Math.round(safeProgress * 100);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - safeProgress);
  const center = size / 2;

  return (
    <div
      className="relative inline-flex max-w-full items-center justify-center"
      style={{ width: size, aspectRatio: '1 / 1' }}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Timer progress: ${percent}% elapsed`}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-full w-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-200"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="text-indigo-600 transition-[stroke-dashoffset] duration-200"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
