# Productivity Timer

A simple, client-only productivity timer web app. It supports a countdown timer
with preset and custom durations, a Pomodoro focus/break workflow, a visual
progress ring, sound and browser notifications on completion, and daily focus
statistics. Everything runs in the browser — there is no backend, no
authentication, and no external database. Settings and statistics are persisted
in `localStorage`.

## Features

- **Countdown timer** with a readable `MM:SS` / `HH:MM:SS` display
- **Preset durations:** 5, 10, 25, and 50 minutes
- **Custom duration:** any whole number of minutes from 1 to 999
- **Controls:** start, pause, resume, reset (only valid controls are shown)
- **Pomodoro mode:** 25-minute focus and 5-minute break phases
  - Auto-start is **off by default**: when a phase ends, the next phase is
    loaded but stays idle until you press Start. You can enable auto-start in
    Settings.
- **Visual progress ring** (accessible `progressbar` with a numeric value)
- **Sound notification** on completion (toggleable)
- **Browser notification** on completion when permitted (toggleable)
- **Daily statistics:** completed focus sessions and total focus time, reset at
  the start of each local day
- **Persistence:** settings and statistics survive reloads via `localStorage`,
  with tolerant parsing so corrupt or outdated data falls back to safe defaults

## Accurate timing (why it doesn't drift)

The timer does **not** decrement a counter every second. It stores an absolute
target end timestamp based on `Date.now()` and always derives the remaining time
from that timestamp. The interval is used only to refresh the UI, and a
`visibilitychange` listener recomputes immediately when you return to the tab.
As a result the timer stays accurate even when the browser tab is inactive or
`setInterval` is throttled.

## Tech stack

- [React](https://react.dev/) 18 + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) (dev server and build)
- [Tailwind CSS](https://tailwindcss.com/)
- [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/)
  for unit, hook, and integration tests

## Getting started

Prerequisites: a recent **Node.js** (18+) and **npm**.

```bash
# clone the repository
git clone https://github.com/hyeyeonghwang/productivity-timer.git
cd productivity-timer

# install dependencies (first time only)
npm install

# start the dev server → http://localhost:5173
npm run dev
```

## Available scripts

| Command              | Description                                      |
| -------------------- | ------------------------------------------------ |
| `npm run dev`        | Start the Vite dev server                        |
| `npm run build`      | Type-check and build for production into `dist/` |
| `npm run preview`    | Preview the production build locally             |
| `npm test`           | Run the full test suite once                     |
| `npm run test:watch` | Run tests in watch mode                          |
| `npm run typecheck`  | Type-check without emitting output               |
| `npm run tauri:dev`  | Run the desktop app in dev mode (requires Rust)  |
| `npm run tauri:build`| Build the desktop installer (requires Rust)      |

## Desktop app (Tauri v2, Windows)

The same web app is packaged as a native **Windows desktop application** using
[Tauri v2](https://v2.tauri.app/). The timer architecture is unchanged — the
desktop shell loads the existing web UI and adds one feature: a transparent,
always-on-top, fullscreen **celebration overlay** that appears whenever a timer
completes (countdown finish, or a Pomodoro focus/break phase finish).

### How the overlay works

- On completion, the frontend calls a Tauri command (`show_celebration`) from
  the single completion path in `useTimerController`. In a plain browser build
  this call is a safe no-op, so the web app is unaffected.
- Rust creates a separate `overlay.html` window that is transparent,
  borderless, fullscreen, always-on-top, skipped in the taskbar, not focused,
  and **click-through** (`set_ignore_cursor_events`) so it never blocks you.
- The overlay shows a confetti burst + a "Done!" banner, respects
  `prefers-reduced-motion`, and auto-dismisses after a few seconds.

### Prerequisites

- The web prerequisites above (Node 18+, npm)
- The [Rust toolchain](https://www.rust-lang.org/tools/install) (`rustup`/`cargo`)
- On Windows: **Microsoft C++ Build Tools** and **WebView2** (preinstalled on
  Windows 11; the installer bundles it otherwise)
- See the Tauri prerequisites guide: https://v2.tauri.app/start/prerequisites/

### Run / build the desktop app

```bash
# install JS dependencies (first time only)
npm install

# run the desktop app in development (hot-reloads the web UI)
npm run tauri:dev

# build a Windows installer (NSIS) into src-tauri/target/release/bundle/
npm run tauri:build
```

> **Icons:** `src-tauri/icons/` currently contains simple solid-color
> placeholder icons so the project builds out of the box. Replace them with your
> own by running `npm run tauri icon path/to/icon.png`.

Timer logic is kept separate from the UI. The layers are:

```
src/
  core/          Pure, framework-agnostic domain logic (no React)
    types.ts       Shared types
    format.ts      Duration formatting (MM:SS / HH:MM:SS)
    timer.ts       Timestamp-based TimerEngine (pure functions)
    pomodoro.ts    Pomodoro phase state machine
    storage.ts     Tolerant localStorage read/write + day rollover
  lib/           Browser side effects
    audio.ts       Web Audio completion chime
    notifications.ts  Notification API wrapper
    tauri.ts       Desktop bridge (no-op in the browser)
  hooks/         React state/orchestration adapters
    useTimer.ts
    useSettings.ts
    useStatistics.ts
    useNotifications.ts
    useTimerController.ts   Feature orchestration (composes the above)
  components/    Presentational UI
    ui/Button.tsx  ui/Toggle.tsx
    TimerDisplay.tsx  ProgressRing.tsx  ControlBar.tsx
    PresetGrid.tsx    CustomInput.tsx   ModeTabs.tsx
    PomodoroBadge.tsx StatsPanel.tsx    SettingsPanel.tsx
  overlay/       Celebration overlay (separate HTML entry)
    main.tsx  Celebration.tsx  overlay.css
  App.tsx        Layout and wiring only
  main.tsx       Entry point
index.html       Main app entry
overlay.html     Celebration overlay entry
src-tauri/       Tauri v2 desktop shell (Rust)
  src/lib.rs     show_celebration / close_celebration commands
  tauri.conf.json  capabilities/  icons/
tests/           Vitest unit / hook / integration tests
```

Design principle: `src/core` is pure and independently testable; browser APIs
live in `src/lib`; React state lives in `src/hooks`; `src/components` stay
presentational; and `App` only composes them. Timer calculations, storage,
audio, and Notification calls are never placed inside presentational components.

## Testing

```bash
npm test
```

The suite currently includes **177 tests** across 16 files, covering the pure
timer engine (including tab-throttling/background accuracy), the Pomodoro
machine, formatting, persistence with tolerant parsing and day rollover, the
hooks, each component, and full end-to-end app workflows (countdown, Pomodoro,
completion effects, mode switching, persistence across reload, and notification
permission flows).

## Accessibility

- Keyboard-operable controls with visible focus states
- Progress exposed as an accessible `progressbar` with a numeric value
- Mode switcher implemented as an ARIA radiogroup (arrow-key navigable)
- Toggle state exposed via `role="switch"` + `aria-checked`
- Form inputs have associated labels; validation errors use `role="alert"`
- State is never conveyed by color alone
- The timer display is not announced on every tick; only meaningful state
  transitions are announced via a polite status region

## Browser permissions and autoplay

- **Notifications** are requested only when you turn the notifications toggle on,
  and only if the browser supports them. If permission is denied or
  unsupported, the app stays stable and the UI reflects that notifications can't
  be delivered. Permission is not requested automatically or repeatedly.
- **Sound** is unlocked on a user gesture (Start/Resume) to comply with browser
  autoplay policies. An audio failure never interferes with timer completion.

## License

No license file is included. Add one (for example, MIT) if you intend to allow
others to reuse the code.
