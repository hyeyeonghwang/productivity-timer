import { useCallback, useEffect, useState } from 'react';
import { onCelebrate } from '../lib/tauri';

/** Number of confetti pieces (tuned for the small popup). */
const CONFETTI_COUNT = 40;

const COLORS = [
  '#6366f1',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ef4444',
  '#a855f7',
];

interface ConfettiPiece {
  left: number;
  delay: number;
  duration: number;
  color: string;
}

function makeConfetti(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 2.2 + Math.random() * 1.8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));
}

/**
 * Small per-monitor celebration popup shown on timer completion.
 *
 * It renders a confetti burst and a banner inside a compact card, and restarts
 * whenever a new `celebrate` event arrives (back-to-back completions). The Rust
 * side owns window creation/teardown (one popup per monitor); outside Tauri the
 * listen call is a no-op, so this still renders harmlessly in the web build.
 */
export function Celebration(): JSX.Element {
  // `runId` forces a remount of the confetti on each new celebration.
  const [runId, setRunId] = useState(0);
  const [pieces, setPieces] = useState<ConfettiPiece[]>(() => makeConfetti());

  const start = useCallback(() => {
    setPieces(makeConfetti());
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
  // newer one). We intentionally do NOT call closeCelebration() from here: each
  // monitor runs its own copy of this component, and having any one of them
  // destroy windows would race the generation logic. We still track `runId` so
  // the confetti remounts on back-to-back `celebrate` events.
  useEffect(() => {
    // no-op effect kept to document that auto-dismiss is handled in Rust.
    return undefined;
  }, [runId]);

  return (
    <div className="celebration-stage" key={runId}>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
      <div className="celebration-banner">🎉 Done!</div>
    </div>
  );
}
