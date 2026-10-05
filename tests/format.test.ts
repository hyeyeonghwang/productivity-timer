import { describe, it, expect } from 'vitest';
import { formatDuration } from '../src/core/format';

describe('formatDuration', () => {
  it('formats zero as 00:00', () => {
    expect(formatDuration(0)).toBe('00:00');
  });

  it('clamps negative values to 00:00', () => {
    expect(formatDuration(-5000)).toBe('00:00');
  });

  it('rounds up partial seconds (1ms -> 00:01)', () => {
    expect(formatDuration(1)).toBe('00:01');
  });

  it('formats sub-minute durations', () => {
    expect(formatDuration(59_000)).toBe('00:59');
  });

  it('formats exactly one minute', () => {
    expect(formatDuration(60_000)).toBe('01:00');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(25 * 60_000)).toBe('25:00');
    expect(formatDuration(90_000)).toBe('01:30');
  });

  it('switches to HH:MM:SS at exactly one hour', () => {
    expect(formatDuration(60 * 60_000)).toBe('01:00:00');
  });

  it('formats durations over one hour', () => {
    expect(formatDuration(3_661_000)).toBe('01:01:01');
  });

  it('rounds up boundary just under one hour to 01:00:00', () => {
    // 59:59.5 -> ceil to 3600s -> 01:00:00
    expect(formatDuration(59 * 60_000 + 59_500)).toBe('01:00:00');
  });
});
