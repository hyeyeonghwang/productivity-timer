# Implementation Tasks — Productivity Timer

Each task is incremental, test-driven where practical, and references the
requirements it fulfills. Do not start implementation until the spec is approved.

- [ ] 1. Scaffold project (Vite + React + TS + Tailwind)
  - Initialize Vite React-TS project; add Tailwind CSS and configure
    `tailwind.config`, `postcss`, and `index.css` directives.
  - Add Vitest + React Testing Library + jsdom for tests.
  - Verify dev server and `npm run build` succeed.
  - _Requirements: 12.1, 12.2_

- [ ] 2. Define shared types and formatting utility
  - [ ] 2.1 Create `src/core/types.ts` (`TimerStatus`, `TimerState`,
        `PomodoroPhase`, settings/stats interfaces).
  - [ ] 2.2 Implement `src/core/format.ts` `formatDuration` with `MM:SS` and
        `HH:MM:SS` output; unit test boundaries (0, 59s, 1h).
  - _Requirements: 1.2, 12.3_

- [ ] 3. Implement timestamp-based timer core (pure TS)
  - [ ] 3.1 Implement `src/core/timer.ts`: `getRemainingMs`, `start`, `pause`,
        `resume`, `reset`, `tick` using absolute `targetEndTime` (no counter
        decrement).
  - [ ] 3.2 Unit tests: idle/running/paused remaining; pause→resume recomputes
        `targetEndTime` from new `now`; **throttle simulation** where `tick` is
        called with `now` far beyond deadline yields `finished`/`0`.
  - _Requirements: 1.1, 1.3, 4.1–4.4, 11.1–11.5_

- [ ] 4. Implement Pomodoro state machine
  - [ ] 4.1 `src/core/pomodoro.ts`: constants + `nextPomodoroPhase`.
  - [ ] 4.2 Unit tests for focus↔break alternation and durations.
  - _Requirements: 5.1–5.4_

- [ ] 5. Implement persistence layer
  - [ ] 5.1 `src/core/storage.ts`: versioned keys, tolerant `loadJSON`,
        `saveJSON`.
  - [ ] 5.2 Unit tests: missing key → fallback; malformed JSON → fallback.
  - _Requirements: 10.1–10.4_

- [ ] 6. Implement audio and notification helpers
  - [ ] 6.1 `src/lib/audio.ts`: `playChime()` with gesture-based unlock; no-op
        when disabled.
  - [ ] 6.2 `src/lib/notifications.ts`: `requestPermission`, `notify`; graceful
        no-op when unsupported/denied.
  - _Requirements: 7.1–7.3, 8.1–8.3_

- [ ] 7. Implement `useTimer` hook
  - UI-only refresh interval (~200ms); recompute remaining from `targetEndTime`
    each render; `visibilitychange` listener forces recompute on focus; invoke
    `onFinish` when `tick` → `finished`; cleanup on unmount.
  - Expose `remainingMs`, `progress`, and control methods + `setDuration`.
  - _Requirements: 1.1–1.4, 4.1–4.5, 6.1–6.3, 11.1–11.4_

- [ ] 8. Implement `useSettings` and `useStatistics` hooks
  - [ ] 8.1 `useSettings`: load/save settings; typed setters.
  - [ ] 8.2 `useStatistics`: load/save daily stats; day-rollover reset;
        `recordFocusSession`.
  - [ ] 8.3 Unit test day-rollover reset logic.
  - _Requirements: 9.1–9.4, 10.1–10.3_

- [ ] 9. Implement `useNotifications` hook
  - Wrap permission request + `notify`; expose permission state to UI.
  - _Requirements: 8.1–8.3_

- [ ] 10. Build reusable UI primitives
  - `ui/Button.tsx`, `ui/Toggle.tsx` with accessibility (aria, focus-visible,
    disabled states).
  - _Requirements: 12.4, 12.5_

- [ ] 11. Build timer presentational components
  - [ ] 11.1 `TimerDisplay` (formatted remaining).
  - [ ] 11.2 `ProgressRing` (SVG circular progress from `progress`).
  - [ ] 11.3 `ControlBar` (state-aware enable/disable).
  - _Requirements: 1.2, 4.5, 6.1–6.3_

- [ ] 12. Build configuration components
  - [ ] 12.1 `PresetGrid` (5/10/25/50, active highlight, no auto-start).
  - [ ] 12.2 `CustomInput` (validation, max cap, clears preset on apply).
  - [ ] 12.3 `ModeTabs` + `PomodoroBadge` (phase display; switching resets timer).
  - _Requirements: 2.1–2.3, 3.1–3.4, 5.4, 5.5_

- [ ] 13. Build statistics and settings panels
  - [ ] 13.1 `StatsPanel` (today's completed sessions + total focus time).
  - [ ] 13.2 `SettingsPanel` (sound & notification toggles wired to hooks).
  - _Requirements: 7.2, 8.1, 9.3_

- [ ] 14. Compose `App` and wire completion side effects
  - Integrate hooks + components; on finish: play sound (if enabled), send
    notification (if permitted), record focus session (focus phase only),
    perform Pomodoro transition.
  - Persist settings/stats on change; restore on load.
  - _Requirements: 5.2, 5.3, 5.6, 7.1, 8.2, 9.1, 9.2, 10.1–10.3_

- [ ] 15. Responsive layout and styling pass
  - Tailwind responsive layout: stacked on mobile, multi-column on wider
    viewports; verify at common breakpoints.
  - _Requirements: 6.1, 12.5_

- [ ] 16. Final verification
  - Run unit tests, typecheck, and `npm run build`; fix any failures.
  - Manual smoke: throttled-tab accuracy, persistence across reload, notification
    permission flow, Pomodoro transitions, day-rollover.
  - _Requirements: all_
