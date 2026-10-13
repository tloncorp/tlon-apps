import React, { useLayoutEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';
import type { BucketItem } from '../../ui';
import { useBucketPreview } from './useBucketPreview';

vi.mock('react-native', () => ({ Linking: { openURL: vi.fn() } }));
vi.mock('../../ui', async () => ({
  canPreviewAsText: (
    await import('../../ui/components/BucketsChannel/BucketFileViewer.shared')
  ).canPreviewAsText,
}));

setupReactTestEnvironment();
afterEach(() => {
  vi.unstubAllGlobals();
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
  };
}

describe('useBucketPreview session cache', () => {
  it('reuses the signed URL and fetched text without a loading state on return', async () => {
    const fetchFile = vi.fn(async () => ({
      ok: true,
      text: async () => 'Saved notes',
    }));
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

  it('retries a failed text request and permits an explicit refresh of a cached file', async () => {
    const fetchFile = vi
      .fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValue({ ok: true, text: async () => 'Recovered' });
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
