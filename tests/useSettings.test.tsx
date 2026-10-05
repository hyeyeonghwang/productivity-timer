import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { useSettings, type UseSettingsResult } from '../src/hooks/useSettings';
import {
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  loadSettings,
} from '../src/core/storage';

function renderSettings() {
  const harness: { current: UseSettingsResult } = {
    current: null as unknown as UseSettingsResult,
  };
  function Probe() {
    const result = useSettings();
    useEffect(() => {
      harness.current = result;
    });
    harness.current = result;
    return null;
  }
  const utils = render(<Probe />);
  return { harness, ...utils };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useSettings — initialization', () => {
  it('initializes with defaults when nothing is persisted', () => {
    const { harness } = renderSettings();
    expect(harness.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('initializes from persisted settings', () => {
    localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ ...DEFAULT_SETTINGS, soundEnabled: false, mode: 'pomodoro' }),
    );
    const { harness } = renderSettings();
    expect(harness.current.settings.soundEnabled).toBe(false);
    expect(harness.current.settings.mode).toBe('pomodoro');
  });

  it('backfills defaults for partially missing persisted settings', () => {
    localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ notificationsEnabled: true }),
    );
    const { harness } = renderSettings();
    expect(harness.current.settings.notificationsEnabled).toBe(true);
    // Missing fields fall back to defaults.
    expect(harness.current.settings.mode).toBe(DEFAULT_SETTINGS.mode);
    expect(harness.current.settings.customDurationMs).toBe(
      DEFAULT_SETTINGS.customDurationMs,
    );
  });
});

describe('useSettings — updates and persistence', () => {
  it('does not overwrite storage on initial mount', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    renderSettings();
    expect(spy).not.toHaveBeenCalled();
  });

  it('persists after updateSettings', () => {
    const { harness } = renderSettings();
    act(() => harness.current.updateSettings({ soundEnabled: false }));
    expect(harness.current.settings.soundEnabled).toBe(false);
    expect(loadSettings().soundEnabled).toBe(false);
  });

  it('persists after setSetting (single field, typed)', () => {
    const { harness } = renderSettings();
    act(() => harness.current.setSetting('mode', 'pomodoro'));
    expect(harness.current.settings.mode).toBe('pomodoro');
    expect(loadSettings().mode).toBe('pomodoro');
  });

  it('supports setting a nullable preset to null', () => {
    const { harness } = renderSettings();
    act(() => harness.current.setSetting('selectedPreset', null));
    expect(harness.current.settings.selectedPreset).toBeNull();
    expect(loadSettings().selectedPreset).toBeNull();
  });

  it('merges multiple partial updates predictably', () => {
    const { harness } = renderSettings();
    act(() =>
      harness.current.updateSettings({
        selectedPreset: 50,
        customDurationMs: 50 * 60_000,
      }),
    );
    act(() => harness.current.updateSettings({ pomodoroAutoStart: true }));
    const s = harness.current.settings;
    expect(s.selectedPreset).toBe(50);
    expect(s.customDurationMs).toBe(50 * 60_000);
    expect(s.pomodoroAutoStart).toBe(true);
    // Earlier defaults remain intact.
    expect(s.soundEnabled).toBe(DEFAULT_SETTINGS.soundEnabled);
  });
});
