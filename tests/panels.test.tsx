import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  };

  it('shows completed sessions count', () => {
    render(<StatsPanel statistics={stats} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Completed sessions')).toBeInTheDocument();
  });

  it('shows total focus time formatted as hours and minutes', () => {
    render(<StatsPanel statistics={stats} />);
    expect(screen.getByText('1h 25m')).toBeInTheDocument();
  });

  it('shows minutes-only when under an hour', () => {
    render(
      <StatsPanel
        statistics={{ ...stats, totalFocusMs: 40 * 60_000 }}
      />,
    );
    expect(screen.getByText('40m')).toBeInTheDocument();
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
});
