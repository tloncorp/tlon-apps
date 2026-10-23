import React, { useLayoutEffect } from 'react';
import { Linking } from 'react-native';
import { act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';
import type { BucketItem } from '../../ui';
import { MAX_TEXT_PREVIEW_BYTES } from '../../ui/components/BucketsChannel/BucketFileViewer.shared';
import { useBucketPreview } from './useBucketPreview';

vi.mock('react-native', () => ({ Linking: { openURL: vi.fn() } }));
vi.mock(
  '../../ui',
  () => import('../../ui/components/BucketsChannel/BucketFileViewer.shared')
);

setupReactTestEnvironment();
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.mocked(Linking.openURL).mockReset();
});

const photo: BucketItem = {
  id: '1',
  kind: 'file',
  name: 'photo.jpg',
  author: '~zod',
  modifiedLabel: 'Just now',
  mimeType: 'image/jpeg',
  previewCacheKey: 'object-1',
};
const notes: BucketItem = {
  ...photo,
  id: '2',
  name: 'notes.txt',
  mimeType: 'text/plain',
  size: 32,
};
const grant = (
  readUrl = 'https://files.test/photo.jpg',
  lifetime = 60_000
) => ({
  readUrl,
  expiresAt: new Date(Date.now() + lifetime).toISOString(),
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
function render(readGrant = vi.fn(async (_id: number) => grant())) {
  let preview!: ReturnType<typeof useBucketPreview>;
  function Harness({ bucket }: { bucket: string }) {
    const value = useBucketPreview(readGrant, bucket);
    useLayoutEffect(() => {
      preview = value;
    });
    return null;
  }
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<Harness bucket="~zod/files" />);
  });
  return {
    readGrant,
    get current() {
      return preview;
    },
    switchBucket: () => act(() => tree.update(<Harness bucket="~nec/files" />)),
    unmount: () => act(() => tree.unmount()),
  };
}

describe('useBucketPreview session cache', () => {
  it('reuses the signed URL and fetched text without a loading state on return', async () => {
    const fetchFile = vi.fn(async () => new Response('Saved notes'));
    vi.stubGlobal('fetch', fetchFile);
    const hook = render();
    await act(async () => hook.current.load(notes));
    await act(async () => hook.current.load(photo));
    act(() => {
      void hook.current.load(notes);
    });
    expect(hook.current.loading).toBe(false);
    expect(hook.current.item).toMatchObject({
      id: '2',
      textContent: 'Saved notes',
      previewCached: true,
    });
    expect(hook.readGrant).toHaveBeenCalledTimes(2);
    expect(fetchFile).toHaveBeenCalledTimes(1);
  });

  it('shares an unfinished request when navigating away and immediately back', async () => {
    const pending = deferred<ReturnType<typeof grant>>();
    const hook = render(vi.fn((_id: number) => pending.promise));
    let first!: Promise<void>, second!: Promise<void>;
    act(() => {
      first = hook.current.load(photo);
    });
    act(() => {
      second = hook.current.load({ ...photo, id: '3' });
    });
    act(() => {
      void hook.current.load(photo);
    });
    expect(hook.readGrant).toHaveBeenCalledTimes(2);
    await act(async () => {
      pending.resolve(grant());
      await Promise.all([first, second]);
    });
    expect(hook.current.item?.id).toBe('1');
    expect(hook.current.loading).toBe(false);
  });

  it('renews an expired URL and does not cache an invalid expiration', async () => {
    const hook = render(
      vi
        .fn()
        .mockResolvedValueOnce(grant('https://files.test/expired', -1000))
        .mockResolvedValueOnce({ ...grant(), expiresAt: 'invalid' })
        .mockResolvedValue(grant())
    );
    await act(async () => hook.current.load(photo));
    expect(hook.current.getCached(photo)).toBeUndefined();
    await act(async () => hook.current.load(photo));
    expect(hook.current.getCached(photo)).toBeUndefined();
    await act(async () => hook.current.load(photo));
    expect(hook.readGrant).toHaveBeenCalledTimes(3);
    expect(hook.current.getCached(photo)?.previewUri).toBe(
      'https://files.test/photo.jpg'
    );
  });

  it.each([
    ['recording.mp3', 'audio/mpeg'],
    ['video.mp4', 'video/mp4'],
    ['document.pdf', 'application/pdf'],
  ])(
    'renews %s before its cached grant is too close to expiry',
    async (name, mimeType) => {
      vi.useFakeTimers();
      const start = new Date('2026-10-14T12:00:00Z').getTime();
      vi.setSystemTime(start);
      const target = { ...photo, name, mimeType };
      const renewed = deferred<ReturnType<typeof grant>>();
      const hook = render(
        vi
          .fn()
          .mockResolvedValueOnce(grant('https://files.test/original', 300_000))
          .mockResolvedValueOnce(grant('https://files.test/other', 300_000))
          .mockReturnValueOnce(renewed.promise)
      );
      const other = { ...photo, id: '3' };
      await act(async () => hook.current.load(target));
      await act(async () => hook.current.load(other));

      vi.setSystemTime(start + 269_999);
      act(() => void hook.current.load(target));
      expect(hook.current.item?.previewCached).toBe(true);
      expect(hook.current.loading).toBe(false);
      expect(hook.readGrant).toHaveBeenCalledTimes(2);
      await act(async () => hook.current.load(other));

      vi.setSystemTime(start + 270_000);
      expect(hook.current.getCached(target)).toBeUndefined();
      let request!: Promise<void>;
      act(() => {
        request = hook.current.load(target);
      });
      expect(hook.readGrant).toHaveBeenCalledTimes(3);
      expect(hook.current.item?.previewUri).toBeUndefined();
      expect(hook.current.loading).toBe(true);
      await act(async () => {
        renewed.resolve(grant('https://files.test/renewed', 300_000));
        await request;
      });
      expect(hook.current.item?.previewUri).toBe('https://files.test/renewed');
      expect(hook.current.loading).toBe(false);
    }
  );

  it('retries a failed text request and permits an explicit refresh of a cached file', async () => {
    const fetchFile = vi
      .fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockImplementation(async () => new Response('Recovered'));
    vi.stubGlobal('fetch', fetchFile);
    const hook = render();
    await act(async () => hook.current.load(notes));
    expect(hook.current.error).toBe('Offline');
    await act(async () => hook.current.load(notes));
    expect(hook.current.error).toBeNull();
    expect(hook.current.item?.textContent).toBe('Recovered');
    await act(async () =>
      hook.current.load(hook.current.item!, { refresh: true })
    );
    expect(hook.readGrant).toHaveBeenCalledTimes(3);
    expect(fetchFile).toHaveBeenCalledTimes(3);
  });

  it('does not reuse a replaced object or a file ID from another bucket', async () => {
    const hook = render();
    await act(async () => hook.current.load(photo));
    await act(async () =>
      hook.current.load({ ...photo, previewCacheKey: 'replacement' })
    );
    hook.switchBucket();
    expect(hook.current.getCached(photo)).toBeUndefined();
    await act(async () => hook.current.load(photo));
    expect(hook.readGrant).toHaveBeenCalledTimes(3);
  });

  it('does not repopulate the session after it closes with a request in flight', async () => {
    const pending = deferred<ReturnType<typeof grant>>();
    const hook = render(vi.fn((_id: number) => pending.promise));
    let request!: Promise<void>;
    act(() => {
      request = hook.current.load(photo);
    });
    act(() => hook.current.close());
    await act(async () => {
      pending.resolve(grant());
      await request;
    });
    expect(hook.current.item).toBeNull();
    expect(hook.current.getCached(photo)).toBeUndefined();
    await act(async () => hook.current.load(photo));
    expect(hook.readGrant).toHaveBeenCalledTimes(2);
  });

  it('tracks image readiness separately from a completed grant', async () => {
    const pending = deferred<ReturnType<typeof grant>>();
    const hook = render(vi.fn((_id: number) => pending.promise));
    let request!: Promise<void>;
    act(() => {
      request = hook.current.load(photo);
    });
    act(() => {
      void hook.current.load({ ...photo, id: '3' });
    });
    await act(async () => {
      pending.resolve(grant());
      await request;
    });
    await act(async () => hook.current.load(photo));
    expect(hook.current.item?.previewCached).toBe(true);
    expect(hook.current.item?.previewImageLoaded).toBe(false);
    act(() => hook.current.markImageLoaded(hook.current.item!));
    expect(hook.current.getCached(photo)?.previewImageLoaded).toBe(true);
  });

  it('evicts a failed image so returning retries the read', async () => {
    const hook = render();
    await act(async () => hook.current.load(photo));
    act(() => hook.current.invalidate(hook.current.item!));
    expect(hook.current.getCached(photo)).toBeUndefined();
    await act(async () => hook.current.load(photo));
    expect(hook.readGrant).toHaveBeenCalledTimes(2);
    expect(hook.current.item?.previewImageLoaded).toBe(false);
  });

  it('bounds retained previews and keeps the most recently selected files', async () => {
    const hook = render();
    for (let id = 1; id <= 20; id++) {
      await act(async () => hook.current.load({ ...photo, id: String(id) }));
    }
    await act(async () => hook.current.load(photo));
    await act(async () => hook.current.load({ ...photo, id: '21' }));
    expect(hook.current.getCached(photo)).toBeDefined();
    expect(hook.current.getCached({ ...photo, id: '2' })).toBeUndefined();
  });
});

describe('external-open ownership', () => {
  it.each(['page', 'close', 'bucket', 'unmount'])(
    'does not launch a late Open grant after %s changes the selection',
    async (change) => {
      const hook = render();
      await act(async () => hook.current.load(photo));
      const pending = deferred<ReturnType<typeof grant>>();
      hook.readGrant.mockImplementationOnce(() => pending.promise);
      act(() => hook.current.openExternally?.());
      if (change === 'page')
        await act(async () => hook.current.load({ ...photo, id: '3' }));
      else if (change === 'close') act(() => hook.current.close());
      else if (change === 'bucket') hook.switchBucket();
      else hook.unmount();
      await act(async () => pending.resolve(grant('https://files.test/stale')));
      expect(Linking.openURL).not.toHaveBeenCalled();
    }
  );

  it('opens the fresh grant when the initiating file remains selected', async () => {
    const hook = render();
    await act(async () => hook.current.load(photo));
    hook.readGrant.mockResolvedValueOnce(grant('https://files.test/fresh'));
    await act(async () => hook.current.openExternally?.());
    expect(Linking.openURL).toHaveBeenCalledWith('https://files.test/fresh');
  });

  it.each(['grant', 'launch'])(
    'ignores a stale %s error after paging to another file',
    async (stage) => {
      const hook = render();
      const other = { ...photo, id: '3', name: 'other.jpg' };
      await act(async () => hook.current.load(photo));
      const rejected = deferred<ReturnType<typeof grant>>();
      if (stage === 'grant')
        hook.readGrant.mockImplementationOnce(() => rejected.promise);
      else
        vi.mocked(Linking.openURL).mockImplementationOnce(
          () => rejected.promise
        );
      await act(async () => hook.current.openExternally?.());
      await act(async () => hook.current.load(other));
      await act(async () => rejected.reject(new Error('Previous file failed')));
      expect(hook.current.item?.id).toBe('3');
      expect(hook.current.error).toBeNull();
      expect(hook.current.loading).toBe(false);
    }
  );

  it('does not restore an external-open error after closing the preview', async () => {
    const hook = render();
    await act(async () => hook.current.load(photo));
    const rejected = deferred<ReturnType<typeof grant>>();
    hook.readGrant.mockImplementationOnce(() => rejected.promise);
    act(() => hook.current.openExternally?.());
    act(() => hook.current.close());
    await act(async () => rejected.reject(new Error('Closed file failed')));
    expect(hook.current.item).toBeNull();
    expect(hook.current.error).toBeNull();
  });

  it('reports an external-open failure while the initiating file is still selected', async () => {
    const hook = render();
    await act(async () => hook.current.load(photo));
    hook.readGrant.mockRejectedValueOnce(new Error('Open failed'));
    await act(async () => hook.current.openExternally?.());
    expect(hook.current.error).toBe('Open failed');
  });
});

it('reads and caches HTML using its declared encoding while paging', async () => {
  const html = { ...notes, name: 'report.html', mimeType: 'text/html' };
  const bytes = new Uint8Array([
    ...new TextEncoder().encode('<meta charset="windows-1252"><p>caf'),
    0xe9,
  ]);
  const fetchFile = vi.fn(async () => new Response(bytes));
  vi.stubGlobal('fetch', fetchFile);
  const hook = render();
  await act(async () => hook.current.load(html));
  expect(hook.current.item?.textContent).toBe(
    '<meta charset="windows-1252"><p>café'
  );
  await act(async () => hook.current.load(photo));
  await act(async () => hook.current.load(html));
  expect(hook.current.item?.previewCached).toBe(true);
  expect(hook.current.item?.textContent).toContain('café');
  expect(fetchFile).toHaveBeenCalledOnce();
  hook.unmount();
});

it.each(['notes.txt', 'report.html'])(
  'does not cache an oversized %s response as preview text',
  async (name) => {
    const file = {
      ...notes,
      name,
      mimeType: name.endsWith('.html') ? 'text/html' : 'text/plain',
      size: 1,
    };
    const fetchFile = vi.fn(
      async () => new Response('x'.repeat(MAX_TEXT_PREVIEW_BYTES + 1))
    );
    vi.stubGlobal('fetch', fetchFile);
    const hook = render();
    await act(async () => hook.current.load(file));
    expect(hook.current.error).toBeNull();
    expect(hook.current.loading).toBe(false);
    expect(hook.current.item?.previewUri).toBeDefined();
    expect(hook.current.item?.textContent).toBeUndefined();
    expect(hook.current.getCached(file)?.textContent).toBeUndefined();
    hook.unmount();
  }
);
