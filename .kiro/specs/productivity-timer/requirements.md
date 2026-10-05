# Requirements — Productivity Timer

## Introduction

A client-side productivity timer web application that helps users focus using
countdown timers, preset durations, custom durations, and a Pomodoro workflow.
The app provides a visual progress indicator, sound and browser notifications on
completion, and tracks daily focus statistics. All settings and statistics are
persisted locally in the browser via `localStorage`. There is no backend,
authentication, or external database.

The application is built with React, TypeScript, Vite, and Tailwind CSS. Timer
logic is decoupled from UI components, components are reusable, and the interface
is responsive.

## Glossary

- **Session**: A single run of a countdown from a chosen duration to zero.
- **Focus session**: A session whose purpose is focused work (preset, custom, or
  Pomodoro focus phase). Counts toward daily statistics.
- **Break session**: A short rest period in Pomodoro mode. Does not count toward
  focus statistics.
- **Target end timestamp**: The absolute wall-clock time (`Date.now()` based) at
  which the active timer is scheduled to reach zero.
- **Daily statistics**: Aggregated counts and durations scoped to a single
  calendar day (local time).

---

## Requirement 1 — Countdown Timer

**User Story:** As a user, I want a countdown timer, so that I can track how much
time remains for a task.

#### Acceptance Criteria

1. WHEN a timer is started with a duration THEN the system SHALL count down from
   that duration toward zero.
2. WHILE a timer is running THE system SHALL display the remaining time in
   `MM:SS` format (or `HH:MM:SS` when remaining time is one hour or more).
3. WHEN the remaining time reaches zero THE system SHALL stop the countdown and
   mark the session as finished.
4. WHILE a timer is running THE system SHALL update the displayed remaining time
   at least once per second.

---

## Requirement 2 — Preset Timer Durations

**User Story:** As a user, I want preset durations, so that I can start common
timers quickly.

#### Acceptance Criteria

1. THE system SHALL provide preset durations of 5, 10, 25, and 50 minutes.
2. WHEN a user selects a preset THE system SHALL load that duration as the active
   timer duration without starting it automatically.
3. WHEN a preset is selected THE system SHALL visually indicate which preset is
   currently active.

---

## Requirement 3 — Custom Timer Duration

**User Story:** As a user, I want to set a custom duration, so that I can time
tasks that do not match a preset.

#### Acceptance Criteria

1. WHEN a user enters a custom duration in minutes (and optionally seconds) THE
   system SHALL load that duration as the active timer duration.
2. IF a user enters a non-positive, empty, or non-numeric value THEN the system
   SHALL reject the input and SHALL NOT change the active duration.
3. THE system SHALL enforce a maximum custom duration (e.g., 999 minutes) and
   reject values above the maximum.
4. WHEN a valid custom duration is applied THE system SHALL clear any active
   preset selection.

---

## Requirement 4 — Timer Controls (Start, Pause, Resume, Reset)

**User Story:** As a user, I want start, pause, resume, and reset controls, so
that I can manage the timer during a task.

#### Acceptance Criteria

1. WHEN the timer is idle and a duration is set AND the user activates Start THE
   system SHALL begin the countdown.
2. WHILE the timer is running AND the user activates Pause THE system SHALL halt
   the countdown and preserve the exact remaining time.
3. WHEN the timer is paused AND the user activates Resume THE system SHALL
   continue the countdown from the preserved remaining time.
4. WHEN the user activates Reset THE system SHALL stop the countdown and restore
   the remaining time to the currently selected duration.
5. THE system SHALL only enable controls that are valid for the current timer
   state (e.g., Pause disabled when not running).

---

## Requirement 5 — Pomodoro Mode

**User Story:** As a user, I want a Pomodoro mode, so that I can alternate focus
and break periods automatically.

#### Acceptance Criteria

1. THE system SHALL provide a Pomodoro mode with a 25-minute focus session and a
   5-minute break session.
2. WHEN a Pomodoro focus session finishes THE system SHALL transition to a break
   session.
3. WHEN a Pomodoro break session finishes THE system SHALL transition to a new
   focus session.
4. THE system SHALL display the current Pomodoro phase (focus or break) to the
   user.
5. WHEN switching into or out of Pomodoro mode THE system SHALL stop any running
   timer and set the duration appropriate to the mode/phase.
6. WHEN a Pomodoro focus session finishes THE system SHALL record a completed
   focus session in daily statistics; break sessions SHALL NOT count as focus
   sessions.

---

## Requirement 6 — Visual Progress Indicator

**User Story:** As a user, I want a visual progress indicator, so that I can see
timer progress at a glance.

#### Acceptance Criteria

1. WHILE a timer is active THE system SHALL display a visual indicator reflecting
   the proportion of time elapsed or remaining.
2. WHEN remaining time changes THE system SHALL update the indicator accordingly.
3. WHEN the timer reaches zero THE system SHALL show the indicator in its
   completed state (0% remaining).

---

## Requirement 7 — Sound Notification on Completion

**User Story:** As a user, I want a sound when the timer finishes, so that I am
alerted even if I am not looking at the screen.

#### Acceptance Criteria

1. WHEN a timer reaches zero THE system SHALL play an audible notification.
2. THE system SHALL allow the user to enable or disable the sound notification.
3. IF sound is disabled THEN the system SHALL NOT play audio on completion.

---

## Requirement 8 — Browser Notification When Permitted

**User Story:** As a user, I want a browser notification when the timer finishes,
so that I am alerted when the tab is in the background.

#### Acceptance Criteria

1. WHEN the user enables browser notifications THE system SHALL request
   notification permission from the browser.
2. WHEN a timer reaches zero AND notification permission is granted THE system
   SHALL display a browser notification indicating the session finished.
3. IF notification permission is denied or unavailable THEN the system SHALL NOT
   display a browser notification and SHALL degrade gracefully without errors.

---

## Requirement 9 — Daily Statistics

**User Story:** As a user, I want daily statistics, so that I can see my focus
progress for the day.

#### Acceptance Criteria

1. WHEN a focus session completes THE system SHALL increment the count of
   completed focus sessions for the current day.
2. WHEN a focus session completes THE system SHALL add its duration to the total
   focus time for the current day.
3. THE system SHALL display the completed focus session count and total focus
   time for the current day.
4. WHEN the local calendar day changes THE system SHALL scope statistics to the
   new day (previous day's totals are not shown as today's).

---

## Requirement 10 — Persistence with localStorage

**User Story:** As a user, I want my settings and statistics saved, so that they
persist across page reloads.

#### Acceptance Criteria

1. WHEN settings change (e.g., sound on/off, notifications on/off, selected
   mode/duration) THE system SHALL persist them to `localStorage`.
2. WHEN daily statistics change THE system SHALL persist them to `localStorage`.
3. WHEN the application loads THE system SHALL restore persisted settings and
   statistics from `localStorage`.
4. IF persisted data is missing or malformed THEN the system SHALL fall back to
   safe defaults without crashing.

---

## Requirement 11 — Timer Accuracy (Absolute Timestamp)

**User Story:** As a user, I want the timer to stay accurate when the tab is
inactive, so that it does not drift when the browser throttles timers.

#### Acceptance Criteria

1. THE system SHALL compute remaining time from an absolute target end timestamp
   derived from `Date.now()`, NOT by decrementing a per-second counter.
2. WHILE a timer is running THE system SHALL use an interval only to refresh the
   UI, and SHALL recompute remaining time from the target end timestamp on each
   refresh.
3. WHEN the browser tab is inactive or `setInterval` is throttled AND the tab
   becomes active again THE system SHALL display remaining time consistent with
   real elapsed wall-clock time.
4. IF the computed remaining time is less than or equal to zero THEN the system
   SHALL treat the timer as finished regardless of how many interval ticks
   occurred.
5. WHEN a timer is paused THE system SHALL store the remaining duration, and on
   resume SHALL recompute a new target end timestamp from the current `Date.now()`
   plus the stored remaining duration.

---

## Requirement 12 — Technical Constraints

**User Story:** As a developer, I want the app to meet the specified technical
constraints, so that it is maintainable and matches the chosen stack.

#### Acceptance Criteria

1. THE system SHALL be implemented with React, TypeScript, Vite, and Tailwind CSS.
2. THE system SHALL operate entirely client-side with no backend, no
   authentication, and no external database.
3. THE system SHALL keep timer logic separate from UI components (e.g., in hooks
   and/or plain TypeScript modules).
4. THE system SHALL provide reusable UI components.
5. THE system SHALL present a responsive interface across common mobile and
   desktop viewport widths.
