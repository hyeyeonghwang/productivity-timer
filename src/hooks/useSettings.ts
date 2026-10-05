/**
 * useSettings — React state/orchestration over the persisted {@link Settings}.
 *
 * Responsibilities (requirements.md Req 10, approved decisions):
 * - Initialize from the persistence layer (`loadSettings`), which already
 *   backfills defaults for partially missing / outdated persisted data.
 * - Persist to localStorage whenever settings change (`saveSettings`).
 * - Expose typed, predictable updates. Validation rules already encoded in the
 *   domain types and persistence helpers are NOT duplicated here.
 *
 * This hook performs no timer logic and owns no browser side effects beyond the
 * persistence helpers it delegates to.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Settings } from '../core/types';
import { loadSettings, saveSettings } from '../core/storage';

/** Value returned by {@link useSettings}. */
export interface UseSettingsResult {
  settings: Settings;
  /** Replaces one or more settings fields in a typed, predictable way. */
  updateSettings: (patch: Partial<Settings>) => void;
  /** Convenience setter for a single field. */
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

export function useSettings(): UseSettingsResult {
  // Lazy initializer: read persisted settings exactly once on mount.
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  // Skip persisting on the very first render (value just came from storage).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saveSettings(settings);
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const setSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return { settings, updateSettings, setSetting };
}
