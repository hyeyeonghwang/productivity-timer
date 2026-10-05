import { useCallback, useEffect, useState } from 'react';
import { onCelebrate } from '../lib/tauri';

/** Number of sparkles in the burst around the checkmark. */
const SPARKLE_COUNT = 10;

interface Sparkle {
  /** Angle around the checkmark, in degrees. */
  angle: number;
  /** Distance travelled outward, in px. */
  distance: number;
  /** Sparkle size, in px. */
  size: number;
  /** Animation delay, in seconds. */
  delay: number;
}

/**
 * Builds a ring of sparkles at evenly spaced angles with a little jitter so the
 * burst feels organic without being noisy.
 */
function makeSparkles(): Sparkle[] {
  const step = 360 / SPARKLE_COUNT;
  return Array.from({ length: SPARKLE_COUNT }, (_, i) => ({
    angle: i * step + (Math.random() - 0.5) * step * 0.5,
    distance: 42 + Math.random() * 14,
    size: 4 + Math.random() * 4,
    delay: 0.18 + Math.random() * 0.12,
  }));
}

/**
 * Small per-monitor completion popup shown on timer completion.
 *
 * It renders a clean checkmark with a short spring scale-in, a soft glow/pulse
 * behind it, a subtle sparkle burst, and a simple "Focus complete" caption. It
 * restarts whenever a new `celebrate` event arrives (back-to-back completions).
 * The Rust side owns window creation/teardown (one popup per monitor); outside
 * Tauri the listen call is a no-op, so this still renders harmlessly in the web
 * build.
 */
export function Celebration(): JSX.Element {
  // `runId` forces a remount of the animation on each new celebration.
  const [runId, setRunId] = useState(0);
  const [sparkles, setSparkles] = useState<Sparkle[]>(() => makeSparkles());

  const start = useCallback(() => {
    setSparkles(makeSparkles());
    setRunId((n) => n + 1);
  }, []);

  // Re-trigger when the Rust side emits `celebrate`.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let active = true;
    void onCelebrate(() => start()).then((fn) => {
      if (active) unlisten = fn;
      else fn();
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, [start]);

  // Teardown is owned by the Rust side, which destroys every popup after the
  // timeout in a generation-safe way (so an older celebration can never close a
  // newer one). We intentionally do NOT close the window from here: each monitor
  // runs its own copy of this component, and having any one of them destroy
  // windows would race the generation logic.

  return (
    <div className="celebration-stage" key={runId}>
      <div className="celebration-badge">
        {/* Soft glow / pulse behind the checkmark. */}
        <span className="celebration-glow" aria-hidden="true" />

        {/* Sparkle burst around the checkmark. */}
        <span className="celebration-sparkles" aria-hidden="true">
          {sparkles.map((s, i) => (
            <span
              key={i}
              className="sparkle"
              style={{
                width: `${s.size}px`,
                height: `${s.size}px`,
                animationDelay: `${s.delay}s`,
                // Fly outward along the chosen angle.
                ['--angle' as string]: `${s.angle}deg`,
                ['--distance' as string]: `${s.distance}px`,
              }}
            />
          ))}
        </span>

        {/* The checkmark itself: a circle that scales in with a spring, and a
            tick that draws on. */}
        <svg
          className="celebration-check"
          viewBox="0 0 52 52"
          role="img"
          aria-label="Focus complete"
        >
          <circle className="check-circle" cx="26" cy="26" r="24" />
          <path className="check-tick" fill="none" d="M14 27 l8 8 l16 -18" />
        </svg>
      </div>

      <p className="celebration-text">Focus complete</p>
    </div>
  );
}
