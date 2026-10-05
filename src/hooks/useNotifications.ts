/**
 * useNotifications — React adapter over the browser notification helpers in
 * `src/lib/notifications.ts`. It does NOT reimplement any browser API; it only
 * exposes support/permission state in a React-friendly way and wraps the helper
 * calls.
 *
 * Notification state is intentionally decoupled from timer state (requirements
 * Req 8): this hook knows nothing about countdowns.
 */
import { useCallback, useState } from 'react';
import {
  type NotificationStatus,
  getNotificationStatus,
  isNotificationSupported,
  notify as notifyHelper,
  requestNotificationPermission,
} from '../lib/notifications';

/** Value returned by {@link useNotifications}. */
export interface UseNotificationsResult {
  /** True when the Notification API exists in this environment. */
  supported: boolean;
  /** Current permission status (reactive). */
  status: NotificationStatus;
  /**
   * Requests permission; must be called from a user gesture. Updates `status`
   * and returns the resulting status.
   */
  requestPermission: () => Promise<NotificationStatus>;
  /**
   * Sends a completion notification when permission is granted. Returns true
   * when a notification was shown, false otherwise. Safe no-op when unsupported
   * or not granted.
   */
  notify: (title: string, body?: string) => boolean;
}

export function useNotifications(): UseNotificationsResult {
  // Initialize once from the helper; no listeners are required because the
  // browser does not emit permission-change events reliably across engines.
  const [supported] = useState<boolean>(() => isNotificationSupported());
  const [status, setStatus] = useState<NotificationStatus>(() =>
    getNotificationStatus(),
  );

  const requestPermission = useCallback(async (): Promise<NotificationStatus> => {
    const result = await requestNotificationPermission();
    setStatus(result);
    return result;
  }, []);

  const notify = useCallback((title: string, body?: string): boolean => {
    return notifyHelper(title, body);
  }, []);

  return { supported, status, requestPermission, notify };
}
