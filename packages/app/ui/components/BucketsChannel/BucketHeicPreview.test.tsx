import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BucketHeicPreview } from './BucketHeicPreview';
import { BucketPreviewImage } from './BucketPreviewImage';
import { loadBucketHeicPreview } from './loadBucketHeicPreview';

const mocks = vi.hoisted(() => ({ trackError: vi.fn() }));
vi.mock('@tloncorp/shared', () => ({ createDevLogger: () => mocks }));
vi.mock('@tloncorp/ui', () => ({ Pressable: 'Pressable', Text: 'Text' }));
vi.mock('tamagui', () => ({ Spinner: 'Spinner', YStack: 'YStack' }));
vi.mock('./BucketPreviewImage', () => ({ BucketPreviewImage: () => null }));
vi.mock('./loadBucketHeicPreview', () => ({ loadBucketHeicPreview: vi.fn() }));

function deferred() {
  let resolve!: (blob: Blob) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Blob>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

let renderer: ReactTestRenderer | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('BucketHeicPreview', () => {
  it('shows the converted image and revokes it when leaving the viewer', async () => {
    const request = deferred();
    vi.mocked(loadBucketHeicPreview).mockReturnValue(request.promise);
    act(() => {
      renderer = create(
        <BucketHeicPreview uri="blob:original" name="Photo.HEIC" />
      );
    });
    expect(renderer!.root.findAllByType('Spinner' as never)).toHaveLength(1);
    const signal = vi.mocked(loadBucketHeicPreview).mock.calls[0][1];
    await act(async () => {
      request.resolve(new Blob(['jpeg']));
    });
    expect(renderer!.root.findByType(BucketPreviewImage).props.uri).toBe(
      'blob:preview'
    );
    act(() => renderer!.unmount());
    renderer = undefined;
    expect(signal.aborted).toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  it('ignores a previous photo finishing after the next photo opens', async () => {
    const first = deferred();
    const second = deferred();
    vi.mocked(loadBucketHeicPreview)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    act(() => {
      renderer = create(
        <BucketHeicPreview uri="blob:first" name="First.heic" />
      );
    });
    const firstSignal = vi.mocked(loadBucketHeicPreview).mock.calls[0][1];
    act(() =>
      renderer!.update(
        <BucketHeicPreview uri="blob:second" name="Second.heic" />
      )
    );
    expect(firstSignal.aborted).toBe(true);
    await act(async () => {
      first.resolve(new Blob(['old']));
    });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(renderer!.root.findAllByType(BucketPreviewImage)).toHaveLength(0);
    await act(async () => {
      second.resolve(new Blob(['new']));
    });
    expect(renderer!.root.findByType(BucketPreviewImage).props.name).toBe(
      'Second.heic'
    );
  });

  it('reports a failed conversion once and retries only when pressed', async () => {
    const first = deferred();
    const retry = deferred();
    const onError = vi.fn();
    const onRetry = vi.fn();
    vi.mocked(loadBucketHeicPreview)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(retry.promise);
    act(() => {
      renderer = create(
        <BucketHeicPreview
          uri="blob:original"
          name="Photo.heic"
          onError={onError}
          onRetry={onRetry}
        />
      );
    });
    await act(async () => {
      first.reject(new Error('size'));
    });
    expect(JSON.stringify(renderer!.toJSON())).toContain(
      'too large to preview'
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(mocks.trackError).toHaveBeenCalledTimes(1);
    expect(loadBucketHeicPreview).toHaveBeenCalledTimes(1);
    act(() => renderer!.root.findByType('Pressable' as never).props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(loadBucketHeicPreview).toHaveBeenCalledTimes(2);
    expect(renderer!.root.findAllByType('Spinner' as never)).toHaveLength(1);
  });
});
