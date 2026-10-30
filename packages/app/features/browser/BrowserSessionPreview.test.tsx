import React, { useSyncExternalStore } from 'react';
import { Image } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  BrowserSessionPreview,
  BrowserSessionAction,
} from './BrowserSessionPreview';
const mock = vi.hoisted(() => ({
  visible: false,
  fetch: vi.fn(),
  endpoint: vi.fn(),
  error: vi.fn(),
  persist: vi.fn(),
  reset: (_value: unknown) => {},
}));
vi.mock('@tloncorp/shared', () => ({
  createDevLogger: () => ({ trackError: mock.error }),
}));
vi.mock('@tloncorp/ui', () => ({ Pressable: 'Pressable', Text: 'Text' }));
vi.mock('react-native', () => ({ Image: 'Image', View: 'View' }));
vi.mock('tamagui', () => ({
  YStack: 'YStack',
  Spinner: 'Spinner',
  isWeb: false,
}));
vi.mock('./BrowserCredentialHandoffContext', () => ({
  useOptionalBrowserCredentialHandoff: () => null,
}));
vi.mock('./useBrowserPreviewVisible', () => ({
  useBrowserPreviewVisible: () => mock.visible,
}));
vi.mock('./browserPreview', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./browserPreview')>()),
  browserPreviewEndpoint: mock.endpoint,
  fetchBrowserPreview: mock.fetch,
}));
let cache: Record<string, any> = {};
const listeners = new Set<() => void>();
vi.mock('@tloncorp/shared/db', () => ({
  registerStorageItemListener: (_key: string, listener: typeof mock.reset) => {
    mock.reset = listener;
  },
  createStorageItem: () => ({
    config: { key: 'browserPreviewTerminalStates' },
    useValue: () =>
      useSyncExternalStore(
        (callback) => {
          listeners.add(callback);
          return () => {
            listeners.delete(callback);
          };
        },
        () => cache
      ),
    useStorageItem: () => ({
      value: useSyncExternalStore(
        (callback) => {
          listeners.add(callback);
          return () => {
            listeners.delete(callback);
          };
        },
        () => cache
      ),
      isLoading: false,
    }),
    setValue: async (update: (value: any) => any) => {
      cache = update(cache);
      mock.persist(cache);
      listeners.forEach((fn) => fn());
    },
  }),
}));
let renderer: ReactTestRenderer;
const card = () => (
  <BrowserSessionPreview
    viewerUrl="https://viewer.test/s/cap"
    onOpen={() => {}}
  />
);
beforeEach(() => {
  cache = {};
  mock.reset(null);
  vi.useFakeTimers();
  vi.clearAllMocks();
  mock.visible = false;
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mock.endpoint.mockResolvedValue('https://viewer.test/s/cap/preview');
  mock.fetch.mockResolvedValue({
    status: 'ready',
    image: 'data:image/jpeg;base64,test',
    title: 'Page',
    hostname: 'example.test',
    capturedAt: 100,
  });
});
afterEach(() => {
  act(() => renderer?.unmount());
  vi.useRealTimers();
});
it('requests only while visible and stops when the session ends', async () => {
  await act(async () => {
    renderer = create(card());
  });
  expect(mock.fetch).not.toHaveBeenCalled();
  mock.visible = true;
  await act(async () => {
    renderer.update(card());
  });
  expect(mock.fetch).toHaveBeenCalledTimes(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(mock.fetch).toHaveBeenCalledTimes(2);
  mock.visible = false;
  await act(async () => {
    renderer.update(card());
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(mock.fetch).toHaveBeenCalledTimes(2);
  mock.visible = true;
  mock.fetch.mockResolvedValue({ status: 'ended' });
  await act(async () => {
    renderer.update(card());
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20000);
  });
  expect(mock.fetch).toHaveBeenCalledTimes(3);
});
it('removes the previous image during secure entry', async () => {
  mock.visible = true;
  await act(async () => {
    renderer = create(card());
  });
  expect(renderer.root.findAllByType(Image)).toHaveLength(1);
  mock.fetch.mockResolvedValue({ status: 'protected' });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(renderer.root.findAllByType(Image)).toHaveLength(0);
});
it('backs off after a timeout and can retry', async () => {
  mock.visible = true;
  mock.fetch.mockImplementationOnce(
    (_url, signal) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(Error('timeout')))
      )
  );
  await act(async () => {
    renderer = create(card());
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20000);
  });
  expect(mock.error).toHaveBeenCalledTimes(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(mock.fetch).toHaveBeenCalledTimes(2);
  expect(renderer.root.findAllByType(Image)).toHaveLength(1);
});

it('remounts with the previous image and remembers terminal states without another fetch', async () => {
  mock.visible = true;
  await act(async () => {
    renderer = create(card());
  });
  act(() => renderer.unmount());
  await act(async () => {
    renderer = create(card());
  });
  expect(renderer.root.findAllByType(Image)).toHaveLength(1);
  expect(mock.fetch).toHaveBeenCalledTimes(1);
  mock.fetch.mockResolvedValue({ status: 'ended' });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(renderer.root.findAllByType(Image)).toHaveLength(0);
  act(() => renderer.unmount());
  await act(async () => {
    renderer = create(card());
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(mock.fetch).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(renderer.toJSON())).toContain('Session ended');
});
it('shows a spinner only before the first preview, and preserves images on transient failures', async () => {
  await act(async () => {
    renderer = create(card());
  });
  expect(JSON.stringify(renderer.toJSON())).toContain(
    'Loading browser preview'
  );
  mock.visible = true;
  await act(async () => {
    renderer.update(card());
  });
  mock.fetch.mockRejectedValueOnce(new Error('offline'));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(renderer.root.findAllByType(Image)).toHaveLength(1);
});

it('hides the open action for a remembered ended session', async () => {
  cache['https://viewer.test/s/cap'] = {
    preview: { status: 'expired' },
    checkedAt: Date.now(),
  };
  await act(async () => {
    renderer = create(
      <BrowserSessionAction viewerUrl="https://viewer.test/s/cap">
        <span>Open browser</span>
      </BrowserSessionAction>
    );
  });
  expect(renderer.toJSON()).toBeNull();
});
it('does not let a late screenshot overwrite a known terminal receipt', async () => {
  const { mergeBrowserPreview } = await import('./browserPreviewCache');
  const ended = { preview: { status: 'ended' as const }, checkedAt: 10 };
  expect(
    mergeBrowserPreview(ended, {
      status: 'ready',
      image: 'old',
      title: '',
      hostname: '',
      capturedAt: 1,
    })
  ).toBe(ended);
});

it.each(['expired', 'ended'])(
  'remembers %s before a preview endpoint can be authorized',
  async (status) => {
    mock.visible = true;
    mock.endpoint.mockResolvedValue({ status });
    await act(async () => {
      renderer = create(card());
    });
    expect(cache['https://viewer.test/s/cap'].preview.status).toBe(status);
    act(() => renderer.unmount());
    await act(async () => {
      renderer = create(card());
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(mock.endpoint).toHaveBeenCalledTimes(1);
    expect(mock.fetch).not.toHaveBeenCalled();
  }
);

it('keeps images in memory and persists only terminal receipts', async () => {
  mock.visible = true;
  await act(async () => {
    renderer = create(card());
  });
  expect(renderer.root.findAllByType(Image)).toHaveLength(1);
  expect(mock.persist).not.toHaveBeenCalled();
  mock.fetch.mockResolvedValue({ status: 'ended' });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(mock.persist).toHaveBeenCalledOnce();
  expect(JSON.stringify(mock.persist.mock.calls)).not.toContain('data:image');
  expect(cache['https://viewer.test/s/cap'].preview).toEqual({
    status: 'ended',
  });
});
it('reauthorizes after a rejected preview grant without disabling the card', async () => {
  const { BrowserPreviewAuthorizationError } = await import('./browserPreview');
  mock.visible = true;
  mock.fetch.mockRejectedValueOnce(new BrowserPreviewAuthorizationError());
  await act(async () => {
    renderer = create(card());
  });
  expect(mock.persist).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(mock.endpoint).toHaveBeenCalledTimes(2);
  expect(renderer.root.findAllByType(Image)).toHaveLength(1);
});
it('drops in-memory images when app storage is reset on logout', async () => {
  mock.visible = true;
  await act(async () => {
    renderer = create(card());
  });
  expect(renderer.root.findAllByType(Image)).toHaveLength(1);
  await act(async () => {
    mock.reset(null);
  });
  expect(renderer.root.findAllByType(Image)).toHaveLength(0);
});
