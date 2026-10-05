/**
 * Notification helper — a tiny wrapper around the browser Notification API.
 * Holds NO timer state. Degrades gracefully when the API is unsupported or
 * permission is denied; no function throws.
 */

/** Permission state, mirroring `NotificationPermission` plus 'unsupported'. */
export type NotificationStatus =
  | 'unsupported'
  | 'default'
  | 'granted'
  | 'denied';

/** True when the Notification API exists in this environment. */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Returns the current permission status, or 'unsupported'. */
export function getNotificationStatus(): NotificationStatus {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Requests notification permission. Returns the resulting status. Never throws;
 * returns 'unsupported' when the API is absent.
 */
export async function requestNotificationPermission(): Promise<NotificationStatus> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    // Older browsers used a callback form; treat failures as current state.
    return getNotificationStatus();
  }
}

/**
 * Shows a notification when permission is granted. No-op (returns false) when
 * unsupported or not granted. Never throws.
 *
 * @returns true when a notification was created, false otherwise.
 */
export function notify(title: string, body?: string): boolean {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  try {
    new Notification(title, body !== undefined ? { body } : undefined);
    return true;
  } catch {
    return false;
  }
}
