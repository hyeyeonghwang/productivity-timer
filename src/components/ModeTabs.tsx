import type { KeyboardEvent } from 'react';
import type { TimerMode } from '../core/types';

export interface ModeTabsProps {
  mode: TimerMode;
  onChange: (mode: TimerMode) => void;
}

interface ModeDef {
  value: TimerMode;
  label: string;
}

const MODES: readonly ModeDef[] = [
  { value: 'standard', label: 'Countdown' },
  { value: 'pomodoro', label: 'Pomodoro' },
];

/**
 * Accessible mode switcher.
 *
 * Countdown and Pomodoro are mutually exclusive modes that reconfigure the same
 * timer region rather than distinct tab panels, so this uses the ARIA
 * radiogroup pattern (not tabs):
 * - `role="radiogroup"` wraps `role="radio"` options with `aria-checked`.
 * - Roving tabindex: only the selected option is in the tab order; Arrow keys
 *   move and select the next/previous option (standard radio keyboard behavior).
 * - Selected state is conveyed by `aria-checked` and a visible style, not color
 *   alone.
 *
 * (The component name is kept for compatibility; it is a radiogroup.)
 */
export function ModeTabs({ mode, onChange }: ModeTabsProps): JSX.Element {
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = MODES.findIndex((m) => m.value === mode);
    let nextIndex: number | null = null;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % MODES.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + MODES.length) % MODES.length;
        break;
      default:
        return;
    }

    e.preventDefault();
    onChange(MODES[nextIndex].value);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Timer mode"
      className="inline-flex rounded-md border border-slate-200 p-1"
    >
      {MODES.map((m) => {
        const isActive = m.value === mode;
        return (
          <button
            key={m.value}
            role="radio"
            type="button"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(m.value)}
            onKeyDown={handleKeyDown}
            className={[
              'rounded px-4 py-1.5 text-sm font-medium transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              isActive
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-100',
            ].join(' ')}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
