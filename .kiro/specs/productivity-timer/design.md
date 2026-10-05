# Design — Productivity Timer

## Overview

A single-page, client-only React application built with Vite, TypeScript, and
Tailwind CSS. The core timer is implemented as framework-agnostic TypeScript
logic driven by an **absolute target end timestamp** (`Date.now()` based) so it
stays accurate under tab throttling. React hooks adapt that logic to the UI, and
presentational components render state. Settings and statistics persist to
`localStorage` behind a small typed storage layer.

### Design Goals

- Keep timer logic pure/decoupled from React so it is testable in isolation.
- Guarantee accuracy independent of `setInterval` cadence.
- Reusable, responsive components styled with Tailwind.
- Graceful degradation for notifications/audio and corrupt storage.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        App (UI)                           │
│  ┌───────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ TimerDisplay  │  │ ControlBar   │  │ ModeTabs      │  │
│  │ ProgressRing  │  │ PresetGrid   │  │ StatsPanel    │  │
│  │               │  │ CustomInput  │  │ SettingsPanel │  │
│  └───────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
└──────────┼─────────────────┼──────────────────┼──────────┘
           │                 │                  │
     ┌─────▼─────────────────▼──────────────────▼─────┐
     │                React Hooks                       │
     │  useTimer    useStatistics   useSettings         │
     │  useNotifications                                │
     └─────┬─────────────┬───────────────┬──────────────┘
           │             │               │
   ┌───────▼──────┐ ┌────▼─────────┐ ┌───▼────────────┐
   │ TimerEngine  │ │ storage.ts   │ │ notifications/ │
   │ (pure TS)    │ │ (localStorage│ │ audio helpers  │
   │ timestamp-   │ │  typed I/O)  │ │                │
   │ based        │ │              │ │                │
   └──────────────┘ └──────────────┘ └────────────────┘
```

### Layering

1. **Core logic (pure TS, no React):** timer math, Pomodoro state machine,
   formatting, storage serialization. Unit-testable.
2. **Hooks (React adapters):** wire core logic to component state, own the UI
   refresh interval, side effects (persist, notify).
3. **Components (presentational):** render props, emit callbacks. Minimal logic.

---

## Core Timer Logic (Timestamp-Based)

The engine never stores "seconds left" as a decrementing counter. Instead it
stores the absolute `targetEndTime` and derives remaining time on demand.

### Types

```ts
export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface TimerState {
  status: TimerStatus;
  /** Full configured duration for this run, in ms. */
  durationMs: number;
  /** Absolute end time (Date.now()-based) while running; null otherwise. */
  targetEndTime: number | null;
  /** Remaining ms captured while paused/idle; source of truth when not running. */
  remainingMs: number;
}
```

### Pure functions

```ts
// Remaining time is ALWAYS derived from the target timestamp while running.
export function getRemainingMs(state: TimerState, now: number): number {
  if (state.status === 'running' && state.targetEndTime !== null) {
    return Math.max(0, state.targetEndTime - now);
  }
  return state.remainingMs; // idle / paused / finished
}

export function start(state: TimerState, now: number): TimerState {
  const remaining = state.remainingMs > 0 ? state.remainingMs : state.durationMs;
  return { ...state, status: 'running', targetEndTime: now + remaining,
           remainingMs: remaining };
}

export function pause(state: TimerState, now: number): TimerState {
  if (state.status !== 'running') return state;
  return { ...state, status: 'paused',
           remainingMs: getRemainingMs(state, now), targetEndTime: null };
}

export function resume(state: TimerState, now: number): TimerState {
  if (state.status !== 'paused') return state;
  return { ...state, status: 'running', targetEndTime: now + state.remainingMs };
}

export function reset(state: TimerState): TimerState {
  return { ...state, status: 'idle', targetEndTime: null,
           remainingMs: state.durationMs };
}

// Called on each UI tick; returns finished state when the deadline has passed.
export function tick(state: TimerState, now: number): TimerState {
  if (state.status !== 'running') return state;
  const remaining = getRemainingMs(state, now);
  if (remaining <= 0) {
    return { ...state, status: 'finished', remainingMs: 0, targetEndTime: null };
  }
  return state;
}
```

**Accuracy guarantee (Req 11):** `setInterval` only triggers re-evaluation of
`getRemainingMs`/`tick`. If the tab was throttled and ticks were skipped, the
first tick after waking recomputes `targetEndTime - now`, which immediately
reflects true elapsed time and can jump straight to `finished`. In addition, a
`visibilitychange` listener forces an immediate recompute when the tab regains
focus.

---

## Pomodoro State Machine

```ts
export type PomodoroPhase = 'focus' | 'break';

export const POMODORO = {
  focusMs: 25 * 60 * 1000,
  breakMs: 5 * 60 * 1000,
};

// On finish of a phase, choose the next phase + duration.
export function nextPomodoroPhase(phase: PomodoroPhase): {
  phase: PomodoroPhase; durationMs: number;
} {
  return phase === 'focus'
    ? { phase: 'break', durationMs: POMODORO.breakMs }
    : { phase: 'focus', durationMs: POMODORO.focusMs };
}
```

- Only `focus` phase completion records statistics.
- Entering/leaving Pomodoro mode resets the running timer (Req 5.5).
- Auto-transition loads the next phase's duration but does not auto-start unless
  configured (default: load next phase in `idle`, user presses Start). This keeps
  behavior predictable; auto-start can be a settings toggle (optional).

---

## React Hooks

### `useTimer`

Owns `TimerState`, the UI refresh interval, and completion side effects.

```ts
interface UseTimerResult {
  state: TimerState;
  remainingMs: number;      // derived each render from Date.now()
  progress: number;         // 0..1 elapsed
  start(): void; pause(): void; resume(): void; reset(): void;
  setDuration(ms: number): void;
}
```

Implementation notes:
- Uses a single `setInterval` (~200–250ms) purely to force re-render; remaining
  time is recomputed from `targetEndTime` on every render, not accumulated.
- Adds a `visibilitychange` listener to recompute immediately on tab focus.
- When `tick` returns `finished`, invokes an `onFinish` callback (sound,
  notification, statistics, Pomodoro transition).
- Cleans up interval and listener on unmount.

### `useSettings`

Loads/saves settings (`soundEnabled`, `notificationsEnabled`, `mode`,
`selectedPreset`, `customDurationMs`, optional `pomodoroAutoStart`) to
`localStorage`; exposes typed setters.

### `useStatistics`

Tracks `{ date: string; completedFocusSessions: number; totalFocusMs: number }`.
On load, if stored `date` !== today (local), reset counters for the new day
(Req 9.4). Exposes `recordFocusSession(durationMs)`.

### `useNotifications`

Wraps the Notification API: `requestPermission()`, `notify(title, body)`.
No-ops gracefully when unsupported or denied (Req 8.3).

---

## Persistence Layer (`storage.ts`)

```ts
const KEYS = { settings: 'pt.settings.v1', stats: 'pt.stats.v1' } as const;

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as T; // tolerant merge
  } catch {
    return fallback; // malformed -> safe defaults (Req 10.4)
  }
}

export function saveJSON<T>(key: string, value: T): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}
```

- Versioned keys allow future schema migration.
- All reads are tolerant: missing/corrupt data falls back to defaults.

---

## Audio & Notification Helpers

- **Audio:** Preload a short chime (bundled asset or WebAudio-generated beep).
  `playChime()` is a no-op when sound disabled. Audio is created/unlocked on a
  user gesture (Start) to satisfy browser autoplay policies.
- **Notifications:** Request permission only when the user enables the toggle.
  Fire on completion when `permission === 'granted'`.

---

## Components (Reusable, Responsive)

| Component       | Responsibility                                            | Key props |
|-----------------|-----------------------------------------------------------|-----------|
| `TimerDisplay`  | Render formatted remaining time                           | `remainingMs` |
| `ProgressRing`  | SVG circular progress indicator                           | `progress` (0..1) |
| `ControlBar`    | Start/Pause/Resume/Reset buttons with state-aware enable  | `status`, handlers |
| `PresetGrid`    | 5/10/25/50 preset buttons, active highlight               | `presets`, `selected`, `onSelect` |
| `CustomInput`   | Validated minutes/seconds input                           | `onApply`, `max` |
| `ModeTabs`      | Switch between Standard and Pomodoro                      | `mode`, `onChange` |
| `PomodoroBadge` | Shows current phase (focus/break)                         | `phase` |
| `StatsPanel`    | Today's completed sessions + total focus time             | `stats` |
| `SettingsPanel` | Toggles for sound & notifications                         | `settings`, setters |
| `Button`/`Toggle` | Primitive reusable UI elements                          | generic |

- `ProgressRing` uses SVG `stroke-dasharray`/`stroke-dashoffset` for the arc.
- Tailwind responsive utilities (`sm:`, `md:`) adjust layout: stacked on mobile,
  side-by-side (timer + stats/settings) on wider screens.
- Buttons/toggles meet accessibility basics: `aria-label`, focus-visible rings,
  disabled states, and keyboard operability.

---

## Formatting Utility

```ts
export function formatDuration(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
```

`Math.ceil` ensures the display shows `00:01` until the moment it truly hits zero.

---

## Error Handling & Edge Cases

- **Corrupt localStorage:** tolerant parse → defaults (Req 10.4).
- **Notification unsupported/denied:** feature no-ops; UI shows disabled state.
- **Autoplay blocked:** audio unlocked on first Start gesture.
- **Day rollover:** stats reset when stored date differs from today.
- **Invalid custom input:** rejected; active duration unchanged; inline hint.
- **Throttled/background tab:** remaining time always recomputed from timestamp;
  `visibilitychange` forces immediate refresh and can mark `finished`.
- **Rapid control clicks:** reducer/state transitions are idempotent per status
  (e.g., `pause` ignored when not running).

---

## Testing Strategy

Unit tests (Vitest) focus on the decoupled core:

- `getRemainingMs` with simulated `now` values across idle/running/paused.
- Throttling simulation: start at T0, call `tick` with `now = T0 + duration +
  5000` → status `finished`, remaining `0` (proves Req 11).
- `pause`/`resume` recompute correct `targetEndTime` from a new `now`.
- Pomodoro `nextPomodoroPhase` alternation.
- `formatDuration` boundaries (0, <1h, ≥1h).
- `loadJSON` with missing and malformed data → fallback.
- Statistics day-rollover reset logic.

Component smoke tests (optional) with React Testing Library for control enabling
by status.

---

## Project Structure

```
src/
  core/
    timer.ts            # TimerState + pure functions (timestamp-based)
    pomodoro.ts         # phase machine + constants
    format.ts           # formatDuration
    storage.ts          # typed localStorage I/O
    types.ts            # shared types
  hooks/
    useTimer.ts
    useSettings.ts
    useStatistics.ts
    useNotifications.ts
  components/
    TimerDisplay.tsx  ProgressRing.tsx  ControlBar.tsx
    PresetGrid.tsx    CustomInput.tsx   ModeTabs.tsx
    PomodoroBadge.tsx StatsPanel.tsx    SettingsPanel.tsx
    ui/Button.tsx     ui/Toggle.tsx
  lib/
    audio.ts          notifications.ts
  App.tsx  main.tsx  index.css
tests/
  timer.test.ts  pomodoro.test.ts  format.test.ts  storage.test.ts
```

---

## Requirements Traceability

| Requirement | Covered by |
|-------------|-----------|
| 1 Countdown | `core/timer.ts`, `useTimer`, `TimerDisplay` |
| 2 Presets | `PresetGrid`, `useSettings` |
| 3 Custom duration | `CustomInput` (validation) |
| 4 Controls | `ControlBar`, timer transitions |
| 5 Pomodoro | `core/pomodoro.ts`, `ModeTabs`, `PomodoroBadge` |
| 6 Progress | `ProgressRing`, `progress` from `useTimer` |
| 7 Sound | `lib/audio.ts`, settings toggle |
| 8 Notifications | `lib/notifications.ts`, `useNotifications` |
| 9 Statistics | `useStatistics`, `StatsPanel` |
| 10 Persistence | `core/storage.ts`, settings/stats hooks |
| 11 Accuracy | timestamp-based `core/timer.ts`, `visibilitychange` |
| 12 Tech constraints | overall stack & structure |
