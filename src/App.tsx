import { useTimerController } from './hooks/useTimerController';
import { ModeTabs } from './components/ModeTabs';
import { PomodoroBadge } from './components/PomodoroBadge';
import { ProgressRing } from './components/ProgressRing';
import { TimerDisplay } from './components/TimerDisplay';
import { ControlBar } from './components/ControlBar';
import { PresetGrid } from './components/PresetGrid';
import { CustomInput } from './components/CustomInput';
import { StatsPanel } from './components/StatsPanel';
import { SettingsPanel } from './components/SettingsPanel';

/**
 * App — feature orchestration shell. All state/side-effect coordination lives
 * in useTimerController; this component is layout + wiring only.
 *
 * Layout: a single centered column that stays comfortably within small mobile
 * widths (no horizontal overflow at ~320px) and caps its width on larger
 * screens. Visual hierarchy, top to bottom: mode → phase → time → progress →
 * controls → duration config → stats/settings.
 */
export default function App(): JSX.Element {
  const c = useTimerController();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:py-10">
        <header className="flex flex-col items-center gap-4">
          <h1 className="text-xl font-semibold sm:text-2xl">Productivity Timer</h1>
          <ModeTabs mode={c.mode} onChange={c.setMode} />
        </header>

        {/* Polite, low-frequency status region: announces meaningful state
            transitions only (started/paused/resumed/reset/phase changes). */}
        <p className="sr-only" role="status" aria-live="polite">
          {c.statusMessage}
        </p>

        {/* Primary timer card — the visual focus. */}
        <section className="flex flex-col items-center gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex h-7 items-center">
            {c.mode === 'pomodoro' && <PomodoroBadge phase={c.phase} />}
          </div>
          <ProgressRing progress={c.progress}>
            <TimerDisplay remainingMs={c.remainingMs} />
          </ProgressRing>
          <ControlBar
            status={c.timerState.status}
            onStart={c.start}
            onPause={c.pause}
            onResume={c.resume}
            onReset={c.reset}
          />
        </section>

        {/* Duration configuration (Countdown mode only). */}
        {c.mode === 'standard' && (
          <section
            className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
            aria-label="Duration"
          >
            <PresetGrid
              selected={c.settings.selectedPreset}
              onSelect={c.selectPreset}
            />
            <CustomInput onApply={c.applyCustomDuration} />
          </section>
        )}

        {/* Secondary info: stacks on mobile, two columns from sm up. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatsPanel statistics={c.statistics} />
          <SettingsPanel
            settings={c.settings}
            notificationsNote={c.notificationsNote}
            notificationsDisabled={c.notificationsDisabled}
            showNotifications={c.showNotifications}
            onChange={(patch) => {
              if ('soundEnabled' in patch && patch.soundEnabled !== undefined) {
                c.setSoundEnabled(patch.soundEnabled);
              }
              if (
                'notificationsEnabled' in patch &&
                patch.notificationsEnabled !== undefined
              ) {
                void c.setNotificationsEnabled(patch.notificationsEnabled);
              }
              if (
                'pomodoroAutoStart' in patch &&
                patch.pomodoroAutoStart !== undefined
              ) {
                c.setPomodoroAutoStart(patch.pomodoroAutoStart);
              }
            }}
          />
        </div>

        <footer className="pb-2 text-center text-xs text-slate-400">
          Runs entirely in your browser. Settings and stats are saved locally.
        </footer>
      </main>
    </div>
  );
}
