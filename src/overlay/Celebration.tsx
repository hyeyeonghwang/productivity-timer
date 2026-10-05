import { useCallback, useEffect, useState } from 'react';
import { closeCelebration, onCelebrate } from '../lib/tauri';

/** How long the celebration stays up before auto-dismissing (ms). */
const AUTO_DISMISS_MS = 4000;

/** Number of confetti pieces. */
const CONFETTI_COUNT = 120;

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
  drift: number;
}

function makeConfetti(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 2.2 + Math.random() * 1.8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    drift: (Math.random() - 0.5) * 20,
  }));
}

/**
 * Fullscreen celebration overlay shown on timer completion.
 *
 * It renders a confetti burst and a banner, then auto-dismisses by asking the
 * Rust side to close the overlay window. It also restarts whenever a new
 * `celebrate` event arrives (back-to-back completions). Outside Tauri, the
 * close/listen calls are no-ops, so this still renders harmlessly in the web
 * build.
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

  // Auto-dismiss after the animation. Re-armed on each run.
  useEffect(() => {
    console.log('[celebration] auto-dismiss timer started', runId);
    
    const id = window.setTimeout(() => {
      console.log('[celebration] auto-dismiss fired');
      void closeCelebration();
    }, AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [runId]);

  return (
    <div className="celebration-stage" key={runId}>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}vw`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `translateX(${p.drift}vw)`,
          }}
        />
      ))}
      <div className="celebration-banner">🎉 Done!</div>
    </div>
  );
}
