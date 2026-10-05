import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../src/components/ui/Button';
import { Toggle } from '../src/components/ui/Toggle';

describe('Button', () => {
  it('renders an accessible name and fires onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Start</Button>);
    const btn = screen.getByRole('button', { name: 'Start' });
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Start
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Start' });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('defaults to type="button"', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute(
      'type',
      'button',
    );
  });
});

describe('Toggle', () => {
  it('exposes switch role and aria-checked state', () => {
    render(<Toggle checked={false} onChange={() => {}} label="Sound" />);
    const sw = screen.getByRole('switch', { name: 'Sound' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('reflects checked state semantically', () => {
    render(<Toggle checked onChange={() => {}} label="Sound" />);
    expect(screen.getByRole('switch', { name: 'Sound' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('calls onChange with the next state', async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Sound" />);
    await userEvent.click(screen.getByRole('switch', { name: 'Sound' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('is keyboard operable (Space/Enter)', async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Sound" />);
    const sw = screen.getByRole('switch', { name: 'Sound' });
    sw.focus();
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not fire when disabled', async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Sound" disabled />);
    await userEvent.click(screen.getByRole('switch', { name: 'Sound' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
