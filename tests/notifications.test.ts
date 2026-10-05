import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isNotificationSupported,
  getNotificationStatus,
  requestNotificationPermission,
  notify,
} from '../src/lib/notifications';

/** Minimal mock of the Notification API for jsdom. */
interface MockNotificationStatic {
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
}

const instances: Array<{ title: string; options?: NotificationOptions }> = [];

function installNotificationMock(permission: NotificationPermission): void {
  const ctor = function (this: unknown, title: string, options?: NotificationOptions) {
    instances.push({ title, options });
  } as unknown as MockNotificationStatic & (new (t: string, o?: NotificationOptions) => unknown);
  ctor.permission = permission;
  ctor.requestPermission = vi.fn(async () => permission);
  // @ts-expect-error — assigning mock onto window for the test
  globalThis.Notification = ctor;
}

function removeNotificationMock(): void {
  // @ts-expect-error — cleanup
  delete globalThis.Notification;
}

beforeEach(() => {
  instances.length = 0;
});

afterEach(() => {
  removeNotificationMock();
  vi.restoreAllMocks();
});

describe('notifications — unsupported environment', () => {
  it('reports unsupported when Notification is absent', () => {
    removeNotificationMock();
    expect(isNotificationSupported()).toBe(false);
    expect(getNotificationStatus()).toBe('unsupported');
  });

  it('requestNotificationPermission resolves to unsupported', async () => {
    removeNotificationMock();
    await expect(requestNotificationPermission()).resolves.toBe('unsupported');
  });

  it('notify is a no-op returning false when unsupported', () => {
    removeNotificationMock();
    expect(notify('Done')).toBe(false);
  });
});

describe('notifications — permission denied', () => {
  beforeEach(() => installNotificationMock('denied'));

  it('reports denied status', () => {
    expect(getNotificationStatus()).toBe('denied');
  });

  it('notify does not create a notification when denied', () => {
    expect(notify('Done', 'body')).toBe(false);
    expect(instances).toHaveLength(0);
  });
});

describe('notifications — permission granted', () => {
  beforeEach(() => installNotificationMock('granted'));

  it('reports granted status', () => {
    expect(getNotificationStatus()).toBe('granted');
  });

  it('notify creates a notification with title and body', () => {
    expect(notify('Timer finished', 'Focus session complete')).toBe(true);
    expect(instances).toHaveLength(1);
    expect(instances[0].title).toBe('Timer finished');
    expect(instances[0].options).toEqual({ body: 'Focus session complete' });
  });

  it('requestNotificationPermission returns granted', async () => {
    await expect(requestNotificationPermission()).resolves.toBe('granted');
  });
});
