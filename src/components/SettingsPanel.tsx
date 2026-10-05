import type { Settings } from '../core/types';
import { Toggle } from './ui/Toggle';

export interface SettingsPanelProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  /**
   * Optional note shown under the notifications toggle, e.g. when the browser
   * does not support notifications or permission was denied. Supplied by the
   * parent (which owns the notification permission state).
   */
  notificationsNote?: string;
  /** Disables the notifications toggle (e.g. unsupported browser). */
  notificationsDisabled?: boolean;
}

interface Row {
  key: 'soundEnabled' | 'notificationsEnabled' | 'pomodoroAutoStart';
  label: string;
  description: string;
}

const ROWS: readonly Row[] = [
  {
    key: 'soundEnabled',
    label: 'Sound',
    description: 'Play a chime when the timer finishes.',
  },
  {
    key: 'notificationsEnabled',
    label: 'Browser notifications',
    description: 'Show a notification when the timer finishes.',
  },
  {
    key: 'pomodoroAutoStart',
    label: 'Auto-start next Pomodoro phase',
    description: 'Start the next focus/break phase automatically.',
  },
];

/**
 * Presentational settings panel. It renders toggles for the user-facing boolean
 * preferences already present in the Settings type and reports changes via the
 * `onChange` callback. It performs no persistence or browser API calls.
 */
export function SettingsPanel({
  settings,
  onChange,
  notificationsNote,
  notificationsDisabled = false,
}: SettingsPanelProps): JSX.Element {
  return (
    <section
      className="rounded-lg border border-slate-200 p-4"
      aria-labelledby="settings-heading"
    >
      <h2
        id="settings-heading"
        className="mb-3 text-sm font-semibold text-slate-700"
      >
        Settings
      </h2>
      <ul className="flex flex-col gap-4">
        {ROWS.map((row) => {
          const isNotifications = row.key === 'notificationsEnabled';
          return (
            <li key={row.key} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-800">{row.label}</p>
                <p className="text-xs text-slate-500">{row.description}</p>
                {isNotifications && notificationsNote && (
                  <p className="mt-1 text-xs text-amber-600">{notificationsNote}</p>
                )}
              </div>
              <Toggle
                label={row.label}
                checked={settings[row.key]}
                disabled={isNotifications && notificationsDisabled}
                onChange={(checked) => onChange({ [row.key]: checked })}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
