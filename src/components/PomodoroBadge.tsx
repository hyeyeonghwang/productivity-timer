import type { PomodoroPhase } from '../core/types';

export interface PomodoroBadgeProps {
  phase: PomodoroPhase;
}

const PHASE_META: Record<
  PomodoroPhase,
  { label: string; className: string }
> = {
  focus: { label: 'Focus', className: 'bg-indigo-100 text-indigo-800' },
  break: { label: 'Break', className: 'bg-emerald-100 text-emerald-800' },
};

/**
 * Purely presentational badge showing the current Pomodoro phase. The phase is
 * conveyed by text (not color alone) so it is distinguishable without color.
 */
export function PomodoroBadge({ phase }: PomodoroBadgeProps): JSX.Element {
  const meta = PHASE_META[phase];
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
        meta.className,
      ].join(' ')}
    >
      {meta.label}
    </span>
  );
}
