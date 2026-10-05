/**
 * useStatistics — React state/orchestration over persisted {@link DailyStatistics}.
 *
 * Responsibilities (requirements.md Req 9, 10):
 * - Initialize from persisted statistics (`loadStatistics`), which already
 *   applies day-rollover: a stored record from a previous day loads as a fresh
 *   zeroed record for today.
 * - Record completed FOCUS sessions, incrementing both the completed-session
 *   count and the total focus time. Break sessions never call this method, so
 *   they cannot contribute to focus statistics.
 * - Guard against double-counting when a finish callback fires more than once,
 *   via an optional dedupe key.
 * - Persist immediately after each state change.
 * - Perform a day-rollover check on record so a session that completes after
 *   midnight is attributed to the correct day.
 *
 * No timer logic lives here.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DailyStatistics } from '../core/types';
import {
  loadStatistics,
  saveStatistics,
  defaultStatistics,
  todayKey,
} from '../core/storage';

/** Value returned by {@link useStatistics}. */
export interface UseStatisticsResult {
  statistics: DailyStatistics;
  /**
   * Records a completed focus session, adding its duration to the day's totals.
   *
   * @param durationMs completed focus duration in ms (non-positive values ignored)
   * @param sessionKey optional unique key; if the same key is passed again it is
   *   ignored, preventing double-counting from a repeated finish callback.
   */
  recordFocusSession: (durationMs: number, sessionKey?: string) => void;
}

export function useStatistics(): UseStatisticsResult {
  const [statistics, setStatistics] = useState<DailyStatistics>(() =>
    loadStatistics(),
  );

  // Skip persisting the initial value (it just came from storage).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saveStatistics(statistics);
  }, [statistics]);

  // Remembers the last recorded dedupe key to avoid double counting.
  const lastSessionKeyRef = useRef<string | null>(null);

  const recordFocusSession = useCallback(
    (durationMs: number, sessionKey?: string) => {
      if (durationMs <= 0) return;
      if (sessionKey !== undefined && sessionKey === lastSessionKeyRef.current) {
        return; // same finish already counted
      }
      if (sessionKey !== undefined) {
        lastSessionKeyRef.current = sessionKey;
      }

      setStatistics((prev) => {
        // Attribute to the correct day: if the day rolled over since the last
        // record, start a fresh record before adding this session.
        const base =
          prev.date === todayKey() ? prev : defaultStatistics();
        return {
          date: base.date,
          completedFocusSessions: base.completedFocusSessions + 1,
          totalFocusMs: base.totalFocusMs + durationMs,
        };
      });
    },
    [],
  );

  return { statistics, recordFocusSession };
}
