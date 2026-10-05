import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimerDisplay } from '../src/components/TimerDisplay';
import { ProgressRing } from '../src/components/ProgressRing';
import { ControlBar } from '../src/components/ControlBar';
import type { TimerStatus } from '../src/core/types';

describe('TimerDisplay', () => {
  it('formats MM:SS', () => {
    render(<TimerDisplay remainingMs={25 * 60_000} />);
    expect(screen.getByText('25:00')).toBeInTheDocument();
  });

  it('formats long durations as HH:MM:SS', () => {
    render(<TimerDisplay remainingMs={3_661_000} />);
    expect(screen.getByText('01:01:01')).toBeInTheDocument();
  });

  it('is hidden from the accessibility tree (status announced elsewhere)', () => {
    const { container } = render(<TimerDisplay remainingMs={90_000} />);
    const el = container.firstElementChild;
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el).toHaveTextContent('01:30');
  });
});

describe('ProgressRing', () => {
  it('exposes progressbar role with aria values', () => {
    render(<ProgressRing progress={0.5} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('clamps progress below 0 to 0%', () => {
    render(<ProgressRing progress={-1} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('clamps progress above 1 to 100%', () => {
    render(<ProgressRing progress={5} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('treats non-finite progress as 0%', () => {
    render(<ProgressRing progress={Number.NaN} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('renders center children', () => {
    render(
      <ProgressRing progress={0.25}>
        <span>center</span>
      </ProgressRing>,
    );
    expect(screen.getByText('center')).toBeInTheDocument();
  });
});

describe('ControlBar', () => {
  function setup(status: TimerStatus) {
    const handlers = {
      onStart: vi.fn(),
      onPause: vi.fn(),
      onResume: vi.fn(),
      onReset: vi.fn(),
    };
    render(<ControlBar status={status} {...handlers} />);
    return handlers;
  }

  it('idle: shows Start, disables Reset', () => {
    setup('idle');
    expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
  });

  it('running: shows Pause and enabled Reset, no Start', () => {
    setup('running');
    expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
  });

  it('paused: shows Resume and enabled Reset', () => {
    setup('paused');
    expect(screen.getByRole('button', { name: 'Resume' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled();
  });

  it('finished: shows only Reset (enabled)', () => {
    setup('finished');
    expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument();
  });

  it('invokes the correct callback per control', async () => {
    const handlers = setup('running');
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(handlers.onPause).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(handlers.onReset).toHaveBeenCalledTimes(1);
  });
});
