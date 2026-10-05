import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatsPanel } from '../src/components/StatsPanel';
import { SettingsPanel } from '../src/components/SettingsPanel';
import { DEFAULT_SETTINGS } from '../src/core/storage';
import type { DailyStatistics } from '../src/core/types';

describe('StatsPanel', () => {
  const stats: DailyStatistics = {
    date: '2026-10-05',
    completedFocusSessions: 3,
    totalFocusMs: 85 * 60_000, // 1h 25m
    completedCountdownSessions: 2,
    totalCountdownMs: 40 * 60_000, // 40m
  };

  /** Returns the subsection container for a given heading ("Pomodoro"/"Countdown"). */
  function sectionFor(headingName: string): HTMLElement {
    const heading = screen.getByRole('heading', { name: headingName });
    // The heading's parent div wraps that subsection's labels and values.
    return heading.parentElement as HTMLElement;
  }

  it('renders separate Pomodoro and Countdown subsections', () => {
    render(<StatsPanel statistics={stats} />);
    expect(
      screen.getByRole('heading', { name: 'Pomodoro' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Countdown' }),
    ).toBeInTheDocument();
    // Each subsection has its own "Completed sessions" label.
    expect(screen.getAllByText('Completed sessions')).toHaveLength(2);
  });

  it('shows Pomodoro completed sessions and focus time', () => {
    render(<StatsPanel statistics={stats} />);
    const pomodoro = within(sectionFor('Pomodoro'));
    expect(pomodoro.getByText('Completed sessions')).toBeInTheDocument();
    expect(pomodoro.getByText('3')).toBeInTheDocument();
    expect(pomodoro.getByText('Focus time')).toBeInTheDocument();
    expect(pomodoro.getByText('1h 25m')).toBeInTheDocument();
  });

  it('shows Countdown completed sessions and total time', () => {
    render(<StatsPanel statistics={stats} />);
    const countdown = within(sectionFor('Countdown'));
    expect(countdown.getByText('Completed sessions')).toBeInTheDocument();
    expect(countdown.getByText('2')).toBeInTheDocument();
    expect(countdown.getByText('Total time')).toBeInTheDocument();
    expect(countdown.getByText('40m')).toBeInTheDocument();
  });

  it('formats focus time as minutes-only when under an hour', () => {
    render(
      <StatsPanel
        statistics={{ ...stats, totalFocusMs: 40 * 60_000, totalCountdownMs: 0 }}
      />,
    );
    const pomodoro = within(sectionFor('Pomodoro'));
    expect(pomodoro.getByText('40m')).toBeInTheDocument();
    // Countdown total of 0 renders as "0m".
    const countdown = within(sectionFor('Countdown'));
    expect(countdown.getByText('0m')).toBeInTheDocument();
  });

  it('formats countdown time as hours and minutes when over an hour', () => {
    render(
      <StatsPanel
        statistics={{ ...stats, totalCountdownMs: 95 * 60_000 }}
      />,
    );
    const countdown = within(sectionFor('Countdown'));
    expect(countdown.getByText('1h 35m')).toBeInTheDocument();
  });
});

describe('SettingsPanel', () => {
  it('reflects current toggle states semantically', () => {
    render(
      <SettingsPanel
        settings={{ ...DEFAULT_SETTINGS, soundEnabled: true, notificationsEnabled: false }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('switch', { name: 'Sound' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(
      screen.getByRole('switch', { name: 'Browser notifications' }),
    ).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange when a toggle is flipped', async () => {
    const onChange = vi.fn();
    render(
      <SettingsPanel
        settings={{ ...DEFAULT_SETTINGS, soundEnabled: true }}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole('switch', { name: 'Sound' }));
    expect(onChange).toHaveBeenCalledWith({ soundEnabled: false });
  });

  it('disables the notifications toggle and shows a note when unsupported', () => {
    render(
      <SettingsPanel
        settings={DEFAULT_SETTINGS}
        onChange={() => {}}
        notificationsDisabled
        notificationsNote="Notifications are not supported in this browser."
      />,
    );
    expect(
      screen.getByRole('switch', { name: 'Browser notifications' }),
    ).toBeDisabled();
    expect(
      screen.getByText('Notifications are not supported in this browser.'),
    ).toBeInTheDocument();
  });

  it('exposes the pomodoro auto-start preference', () => {
    render(
      <SettingsPanel
        settings={{ ...DEFAULT_SETTINGS, pomodoroAutoStart: true }}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByRole('switch', { name: 'Auto-start next Pomodoro phase' }),
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('hides the browser notifications row when showNotifications is false', () => {
    render(
      <SettingsPanel
        settings={DEFAULT_SETTINGS}
        onChange={() => {}}
        showNotifications={false}
      />,
    );
    // Notifications toggle is gone...
    expect(
      screen.queryByRole('switch', { name: 'Browser notifications' }),
    ).not.toBeInTheDocument();
    // ...while sound and pomodoro auto-start remain visible.
    expect(
      screen.getByRole('switch', { name: 'Sound' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: 'Auto-start next Pomodoro phase' }),
    ).toBeInTheDocument();
  });

  it('shows the browser notifications row by default', () => {
    render(<SettingsPanel settings={DEFAULT_SETTINGS} onChange={() => {}} />);
    expect(
      screen.getByRole('switch', { name: 'Browser notifications' }),
    ).toBeInTheDocument();
  });
});
