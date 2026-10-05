/**
 * useTimerController — feature-level orchestration hook.
 *
 * This is the single place that composes the reusable adapters (`useTimer`,
 * `useSettings`, `useStatistics`, `useNotifications`), the pure Pomodoro core,
 * and the browser side-effect helpers (audio). It owns mode/phase state and the
 * one completion path. It deliberately lives in `src/hooks` (React
 * orchestration) and keeps all of this out of the pure core and the
 * presentational components.
 *
 * It is extracted from `App` so the orchestration is independently testable; the
 * component tree stays purely presentational.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { PomodoroPhase, PresetMinutes, TimerMode } from "../core/types";
import {
  INITIAL_POMODORO_PHASE,
  nextPomodoroPhase,
  phaseDuration,
} from "../core/pomodoro";
import { playChime, unlockAudio } from "../lib/audio";
import { showCelebration } from "../lib/tauri";
import { useTimer } from "./useTimer";
import { useSettings } from "./useSettings";
import { useStatistics } from "./useStatistics";
import { useNotifications } from "./useNotifications";

/** Human-readable status announcements for the live region. */
export interface ControllerStatusMessage {
  text: string;
}

function durationForSettings(
  mode: TimerMode,
  phase: PomodoroPhase,
  selectedPreset: PresetMinutes | null,
  customDurationMs: number,
): number {
  if (mode === "pomodoro") return phaseDuration(phase);
  if (selectedPreset !== null) return selectedPreset * 60_000;
  return customDurationMs;
}

export function useTimerController() {
  const { settings, updateSettings } = useSettings();
  const { statistics, recordFocusSession, recordCountdownSession } =
    useStatistics();
  const notifications = useNotifications();

  const [phase, setPhase] = useState<PomodoroPhase>(INITIAL_POMODORO_PHASE);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const initialDuration = durationForSettings(
    settings.mode,
    INITIAL_POMODORO_PHASE,
    settings.selectedPreset,
    settings.customDurationMs,
  );

  // A stable identity for the currently running session, used to defensively
  // deduplicate focus-session recording within this mounted app session.
  const sessionKeyRef = useRef<string | null>(null);
  const sessionCounterRef = useRef(0);

  // Latest-values refs so the (stable) onFinish closure reads fresh state.
  const stateRef = useRef({ mode: settings.mode, phase, settings });
  useEffect(() => {
    stateRef.current = { mode: settings.mode, phase, settings };
  }, [settings, phase]);

  const timer = useTimer({
    initialDurationMs: initialDuration,
    onFinish: (durationMs) => handleFinish(durationMs),
  });
  const timerRef = useRef(timer);
  useEffect(() => {
    timerRef.current = timer;
  });

  /** Plays sound/notification per settings. Never throws into timer logic. */
  const fireCompletionEffects = useCallback(
    (title: string, body: string) => {
      const { settings: s } = stateRef.current;
      if (s.soundEnabled) {
        try {
          playChime();
        } catch {
          /* audio must never break completion */
        }
      }
      if (s.notificationsEnabled && notifications.status === "granted") {
        notifications.notify(title, body);
      }
      // Desktop-only: show the transparent fullscreen celebration overlay.
      // No-op in the browser; fire-and-forget so it never blocks completion.
      void showCelebration();
    },
    [notifications],
  );

  /**
   * The single completion path. Reads the mode/phase that was active at finish.
   */
  const handleFinish = useCallback(
    (durationMs: number) => {
      const { mode, phase: finishedPhase } = stateRef.current;
      const t = timerRef.current;

      if (mode !== "pomodoro") {
        const key =
          sessionKeyRef.current ?? `session-${sessionCounterRef.current}`;
        // Record the completed countdown session.
        recordCountdownSession(durationMs, key);
        // Countdown completion: effects only; no Pomodoro stats; stay finished.
        fireCompletionEffects("Timer finished", "Your countdown is complete.");
        setStatusMessage("Countdown finished.");
        return;
      }

      // Pomodoro completion.
      if (finishedPhase === "focus") {
        // Record exactly one focus session (defensive dedupe via sessionKey).
        const key =
          sessionKeyRef.current ?? `session-${sessionCounterRef.current}`;
        recordFocusSession(durationMs, key);
        fireCompletionEffects("Focus session complete", "Time for a break.");
      } else {
        fireCompletionEffects("Break complete", "Back to focus.");
      }

      const next = nextPomodoroPhase(finishedPhase);
      setPhase(next.phase);
      // Load the next phase duration (finished -> idle at new duration).
      t.setDuration(next.durationMs);
      setStatusMessage(
        next.phase === "focus"
          ? "Break finished. Focus phase loaded."
          : "Focus finished. Break phase loaded.",
      );

      // Auto-start only when enabled.
      if (stateRef.current.settings.pomodoroAutoStart) {
        // New running session gets a fresh key.
        sessionCounterRef.current += 1;
        sessionKeyRef.current = `session-${sessionCounterRef.current}`;
        t.start();
      }
    },
    [fireCompletionEffects, recordFocusSession, recordCountdownSession],
  );

  // ---- Controls (wrap the timer, add orchestration concerns) --------------

  const start = useCallback(() => {
    // Unlock audio on this user gesture to satisfy autoplay policies.
    unlockAudio();
    // Assign a fresh session identity for this run.
    sessionCounterRef.current += 1;
    sessionKeyRef.current = `session-${sessionCounterRef.current}`;
    timer.start();
    setStatusMessage("Timer started.");
  }, [timer]);

  const pause = useCallback(() => {
    timer.pause();
    setStatusMessage("Timer paused.");
  }, [timer]);

  const resume = useCallback(() => {
    unlockAudio();
    timer.resume();
    setStatusMessage("Timer resumed.");
  }, [timer]);

  const reset = useCallback(() => {
    timer.reset();
    sessionKeyRef.current = null;
    setStatusMessage("Timer reset.");
  }, [timer]);

  // ---- Countdown duration selection ---------------------------------------

  const selectPreset = useCallback(
    (minutes: PresetMinutes) => {
      updateSettings({ selectedPreset: minutes });
      timer.reset();
      timer.setDuration(minutes * 60_000);
    },
    [timer, updateSettings],
  );

  const applyCustomDuration = useCallback(
    (durationMs: number) => {
      updateSettings({ selectedPreset: null, customDurationMs: durationMs });
      timer.reset();
      timer.setDuration(durationMs);
    },
    [timer, updateSettings],
  );

  // ---- Mode switching ------------------------------------------------------

  const setMode = useCallback(
    (mode: TimerMode) => {
      if (mode === settings.mode) return;
      // Reset any running/paused timer before switching (no carry-over).
      timer.reset();
      sessionKeyRef.current = null;
      updateSettings({ mode });

      if (mode === "pomodoro") {
        setPhase("focus");
        timer.setDuration(phaseDuration("focus"));
        setStatusMessage("Switched to Pomodoro. Focus phase loaded.");
      } else {
        const duration = durationForSettings(
          "standard",
          "focus",
          settings.selectedPreset,
          settings.customDurationMs,
        );
        timer.setDuration(duration);
        setStatusMessage("Switched to Countdown.");
      }
    },
    [
      settings.mode,
      settings.selectedPreset,
      settings.customDurationMs,
      timer,
      updateSettings,
    ],
  );

  // ---- Settings: notifications permission on user gesture -----------------

  const setSoundEnabled = useCallback(
    (enabled: boolean) => updateSettings({ soundEnabled: enabled }),
    [updateSettings],
  );

  const setPomodoroAutoStart = useCallback(
    (enabled: boolean) => updateSettings({ pomodoroAutoStart: enabled }),
    [updateSettings],
  );

  /**
   * Toggles notifications. When enabling and permission is still 'default',
   * requests permission as part of this user gesture. Never auto-requests.
   */
  const setNotificationsEnabled = useCallback(
    async (enabled: boolean) => {
      if (!enabled) {
        updateSettings({ notificationsEnabled: false });
        return;
      }
      if (!notifications.supported) {
        updateSettings({ notificationsEnabled: false });
        return;
      }
      let status = notifications.status;
      if (status === "default") {
        status = await notifications.requestPermission();
      }
      // Only mark enabled when actually granted; otherwise keep it off so the
      // UI reflects that notifications cannot be delivered.
      updateSettings({ notificationsEnabled: status === "granted" });
    },
    [notifications, updateSettings],
  );

  // A note for the settings UI when notifications can't currently be delivered.
  let notificationsNote: string | undefined;
  let notificationsDisabled = false;
  if (!notifications.supported) {
    notificationsNote = "Notifications are not supported in this browser.";
    notificationsDisabled = true;
  } else if (notifications.status === "denied") {
    notificationsNote =
      "Permission denied. Enable notifications in your browser settings.";
  }

  return {
    // state
    timerState: timer.state,
    remainingMs: timer.remainingMs,
    progress: timer.progress,
    mode: settings.mode,
    phase,
    settings,
    statistics,
    statusMessage,
    notificationsNote,
    notificationsDisabled,
    // controls
    start,
    pause,
    resume,
    reset,
    selectPreset,
    applyCustomDuration,
    setMode,
    setSoundEnabled,
    setNotificationsEnabled,
    setPomodoroAutoStart,
  };
}
