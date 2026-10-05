import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import {
  useNotifications,
  type UseNotificationsResult,
} from '../src/hooks/useNotifications';

const createdNotifications: Array<{ title: string; options?: NotificationOptions }> = [];

interface MockNotificationStatic {
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
}

/**
 * Installs a mock Notification API. `requestResult` lets a 'default' install
 * resolve to a different status when permission is requested.
 */
function installNotificationMock(
  permission: NotificationPermission,
  requestResult: NotificationPermission = permission,
): void {
  const ctor = function (
    this: unknown,
    title: string,
    options?: NotificationOptions,
  ) {
    createdNotifications.push({ title, options });
  } as unknown as MockNotificationStatic &
    (new (t: string, o?: NotificationOptions) => unknown);
  ctor.permission = permission;
  ctor.requestPermission = vi.fn(async () => requestResult);
  // @ts-expect-error — assign mock onto global
  globalThis.Notification = ctor;
}

function removeNotificationMock(): void {
  // @ts-expect-error — cleanup
  delete globalThis.Notification;
}

function renderNotifications() {
  const harness: { current: UseNotificationsResult } = {
    current: null as unknown as UseNotificationsResult,
  };
  function Probe() {
    const result = useNotifications();
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
  createdNotifications.length = 0;
});

afterEach(() => {
  removeNotificationMock();
  vi.restoreAllMocks();
});

describe('useNotifications — unsupported', () => {
  beforeEach(() => removeNotificationMock());

  it('reports unsupported and status "unsupported"', () => {
    const { harness } = renderNotifications();
    expect(harness.current.supported).toBe(false);
    expect(harness.current.status).toBe('unsupported');
  });

  it('requestPermission resolves to unsupported', async () => {
    const { harness } = renderNotifications();
    let result: string | undefined;
    await act(async () => {
      result = await harness.current.requestPermission();
    });
    expect(result).toBe('unsupported');
  });

  it('notify is a safe no-op returning false', () => {
    const { harness } = renderNotifications();
    let returned = true;
    act(() => {
      returned = harness.current.notify('Done');
    });
    expect(returned).toBe(false);
    expect(createdNotifications).toHaveLength(0);
  });
});

describe('useNotifications — default permission', () => {
  beforeEach(() => installNotificationMock('default', 'granted'));

  it('starts supported with status "default"', () => {
    const { harness } = renderNotifications();
    expect(harness.current.supported).toBe(true);
    expect(harness.current.status).toBe('default');
  });

  it('requestPermission updates status reactively', async () => {
    const { harness } = renderNotifications();
    await act(async () => {
      await harness.current.requestPermission();
    });
    await waitFor(() => expect(harness.current.status).toBe('granted'));
  });

  it('notify does not fire while permission is still default', () => {
    const { harness } = renderNotifications();
    let returned = true;
    act(() => {
      returned = harness.current.notify('Done');
    });
    expect(returned).toBe(false);
    expect(createdNotifications).toHaveLength(0);
  });
});

describe('useNotifications — granted', () => {
  beforeEach(() => installNotificationMock('granted'));

  it('reports granted status', () => {
    const { harness } = renderNotifications();
    expect(harness.current.status).toBe('granted');
  });

  it('notify shows a notification with title and body', () => {
    const { harness } = renderNotifications();
    let returned = false;
    act(() => {
      returned = harness.current.notify('Timer finished', 'Focus complete');
    });
    expect(returned).toBe(true);
    expect(createdNotifications).toHaveLength(1);
    expect(createdNotifications[0].title).toBe('Timer finished');
    expect(createdNotifications[0].options).toEqual({ body: 'Focus complete' });
  });
});

describe('useNotifications — denied', () => {
  beforeEach(() => installNotificationMock('denied'));

  it('reports denied status', () => {
    const { harness } = renderNotifications();
    expect(harness.current.status).toBe('denied');
  });

  it('notify does not fire when denied', () => {
    const { harness } = renderNotifications();
    let returned = true;
    act(() => {
      returned = harness.current.notify('Done', 'body');
    });
    expect(returned).toBe(false);
    expect(createdNotifications).toHaveLength(0);
  });

  it('requestPermission resolves to denied and keeps status denied', async () => {
    const { harness } = renderNotifications();
    let result: string | undefined;
    await act(async () => {
      result = await harness.current.requestPermission();
    });
    expect(result).toBe('denied');
    expect(harness.current.status).toBe('denied');
  });
});
