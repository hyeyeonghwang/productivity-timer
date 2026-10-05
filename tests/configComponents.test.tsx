import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PresetGrid } from '../src/components/PresetGrid';
import { CustomInput, validateMinutes } from '../src/components/CustomInput';
import { ModeTabs } from '../src/components/ModeTabs';
import { PomodoroBadge } from '../src/components/PomodoroBadge';

describe('PresetGrid', () => {
  it('renders the four approved presets', () => {
    render(<PresetGrid selected={25} onSelect={() => {}} />);
    for (const m of [5, 10, 25, 50]) {
      expect(screen.getByRole('button', { name: `${m} min` })).toBeInTheDocument();
    }
  });

  it('marks the selected preset via aria-pressed', () => {
    render(<PresetGrid selected={25} onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: '25 min' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '5 min' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('calls onSelect with the chosen preset', async () => {
    const onSelect = vi.fn();
    render(<PresetGrid selected={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: '50 min' }));
    expect(onSelect).toHaveBeenCalledWith(50);
  });
});

describe('validateMinutes (pure validation)', () => {
  it('accepts the lower and upper bounds', () => {
    expect(validateMinutes('1')).toEqual({ minutes: 1 });
    expect(validateMinutes('999')).toEqual({ minutes: 999 });
  });

  it('rejects empty, non-numeric, zero, negative, decimal, over-limit', () => {
    expect('error' in validateMinutes('')).toBe(true);
    expect('error' in validateMinutes('abc')).toBe(true);
    expect('error' in validateMinutes('0')).toBe(true);
    expect('error' in validateMinutes('-5')).toBe(true);
    expect('error' in validateMinutes('2.5')).toBe(true);
    expect('error' in validateMinutes('1000')).toBe(true);
  });
});

describe('CustomInput', () => {
  it('applies a valid duration in ms', async () => {
    const onApply = vi.fn();
    render(<CustomInput onApply={onApply} />);
    await userEvent.type(
      screen.getByLabelText('Custom duration (minutes)'),
      '30',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Set' }));
    expect(onApply).toHaveBeenCalledWith(30 * 60_000);
  });

  it('shows an error and does not apply an invalid value', async () => {
    const onApply = vi.fn();
    render(<CustomInput onApply={onApply} />);
    await userEvent.type(
      screen.getByLabelText('Custom duration (minutes)'),
      '0',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Set' }));
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText('Custom duration (minutes)')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('rejects over-limit values', async () => {
    const onApply = vi.fn();
    render(<CustomInput onApply={onApply} />);
    await userEvent.type(
      screen.getByLabelText('Custom duration (minutes)'),
      '1500',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Set' }));
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Maximum is 999');
  });
});

describe('ModeTabs', () => {
  it('renders radio options with the active one checked', () => {
    render(<ModeTabs mode="standard" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Countdown' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: 'Pomodoro' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('switches mode on click', async () => {
    const onChange = vi.fn();
    render(<ModeTabs mode="standard" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Pomodoro' }));
    expect(onChange).toHaveBeenCalledWith('pomodoro');
  });

  it('is keyboard navigable with arrow keys', async () => {
    const onChange = vi.fn();
    render(<ModeTabs mode="standard" onChange={onChange} />);
    const active = screen.getByRole('radio', { name: 'Countdown' });
    active.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('pomodoro');
  });
});

describe('PomodoroBadge', () => {
  it('renders the focus phase with text (not color only)', () => {
    render(<PomodoroBadge phase="focus" />);
    expect(screen.getByText('Focus')).toBeInTheDocument();
  });

  it('renders the break phase with text', () => {
    render(<PomodoroBadge phase="break" />);
    expect(screen.getByText('Break')).toBeInTheDocument();
  });
});
