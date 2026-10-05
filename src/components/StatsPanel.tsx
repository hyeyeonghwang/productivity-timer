import type { DailyStatistics } from '../core/types';

export interface StatsPanelProps {
  statistics: DailyStatistics;
}

/** Formats a ms duration as a human label like "1h 25m" or "40m". */
function formatFocusTotal(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Presentational panel showing today's focus statistics. Values are supplied by
 * the parent (via useStatistics); this component holds no state.
 */
export function StatsPanel({ statistics }: StatsPanelProps): JSX.Element {
  return (
    <section
      className="rounded-lg border border-slate-200 p-4"
      aria-labelledby="stats-heading"
    >
      <h2 id="stats-heading" className="mb-3 text-sm font-semibold text-slate-700">
        Today
      </h2>
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-slate-500">Completed sessions</dt>
          <dd className="text-2xl font-semibold tabular-nums text-slate-900">
            {statistics.completedFocusSessions}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Total focus time</dt>
          <dd className="text-2xl font-semibold tabular-nums text-slate-900">
            {formatFocusTotal(statistics.totalFocusMs)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
