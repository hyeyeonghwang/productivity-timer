/**
 * useStatistics — React state/orchestration over persisted DailyStatistics.
 *
 * Responsibilities:
 * - Initialize persisted daily statistics.
 * - Record completed Pomodoro focus sessions.
 * - Record completed countdown sessions separately.
 * - Never count Pomodoro break sessions.
 * - Guard against duplicate recording using an optional session key.
 * - Persist statistics after state changes.
 * - Handle day rollover when a session completes after midnight.
 *
 * No timer logic lives here.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { DailyStatistics } from "../core/types";
import {
  loadStatistics,
  saveStatistics,
  defaultStatistics,
  todayKey,
} from "../core/storage";

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
  recordCountdownSession: (durationMs: number, sessionKey?: string) => void;
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
  const lastFocusSessionKeyRef = useRef<string | null>(null);
  const lastCountdownSessionKeyRef = useRef<string | null>(null);

  const recordFocusSession = useCallback(
    (durationMs: number, sessionKey?: string) => {
      if (durationMs <= 0) return;
      if (
        sessionKey !== undefined &&
        sessionKey === lastFocusSessionKeyRef.current
      ) {
        return; // same finish already counted
      }
      if (sessionKey !== undefined) {
        lastFocusSessionKeyRef.current = sessionKey;
      }

      setStatistics((prev) => {
        // Attribute to the correct day: if the day rolled over since the last
        // record, start a fresh record before adding this session.
        const base = prev.date === todayKey() ? prev : defaultStatistics();
        return {
          ...base,
          completedFocusSessions: base.completedFocusSessions + 1,
          totalFocusMs: base.totalFocusMs + durationMs,
        };
      });
    },
    [],
  );

  const recordCountdownSession = useCallback(
    (durationMs: number, sessionKey?: string) => {
      if (durationMs <= 0) return;

      if (
        sessionKey !== undefined &&
        sessionKey === lastCountdownSessionKeyRef.current
      ) {
        return;
      }

      if (sessionKey !== undefined) {
        lastCountdownSessionKeyRef.current = sessionKey;
      }

      setStatistics((prev) => {
        const base = prev.date === todayKey() ? prev : defaultStatistics();

        return {
          ...base,
          completedCountdownSessions: base.completedCountdownSessions + 1,
          totalCountdownMs: base.totalCountdownMs + durationMs,
        };
      });
    },
    [],
  );

  return { statistics, recordFocusSession, recordCountdownSession };
}
