import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadBucketHeicPreview } from './loadBucketHeicPreview';

class PreviewWorker {
  static instances: PreviewWorker[] = [];
  onmessage?: (event: { data: { blob?: Blob; error?: string } }) => void;
  onerror?: () => void;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    PreviewWorker.instances.push(this);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(globalThis, 'setTimeout');
  vi.spyOn(globalThis, 'clearTimeout');
  PreviewWorker.instances = [];
  vi.stubGlobal('Worker', PreviewWorker);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function expectDeadlineCleared() {
  const timers = vi.mocked(setTimeout);
  const index = timers.mock.calls.findIndex(([, delay]) => delay === 30_000);
  expect(index).toBeGreaterThanOrEqual(0);
  expect(clearTimeout).toHaveBeenCalledWith(timers.mock.results[index].value);
}

describe('loadBucketHeicPreview', () => {
  it('returns the JPEG and releases the worker and timeout', async () => {
    const controller = new AbortController();
    const preview = loadBucketHeicPreview('blob:original', controller.signal);
    const worker = PreviewWorker.instances[0];
    const blob = new Blob(['jpeg'], { type: 'image/jpeg' });
    expect(worker.postMessage).toHaveBeenCalledWith('blob:original');
    worker.onmessage?.({ data: { blob } });
    expectDeadlineCleared();
    await expect(preview).resolves.toBe(blob);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    controller.abort();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it.each(['size', 'decode'])(
    'propagates %s errors and releases the worker',
    async (error) => {
      const preview = loadBucketHeicPreview(
        'blob:original',
        new AbortController().signal
      );
      const assertion = expect(preview).rejects.toThrow(error);
      const worker = PreviewWorker.instances[0];
      worker.onmessage?.({ data: { error } });
      expectDeadlineCleared();
      await assertion;
      expect(worker.terminate).toHaveBeenCalledTimes(1);
    }
  );

  it('turns worker startup/runtime errors into a decoder error', async () => {
    const preview = loadBucketHeicPreview(
      'blob:original',
      new AbortController().signal
    );
    const assertion = expect(preview).rejects.toThrow('decode');
    const worker = PreviewWorker.instances[0];
    worker.onerror?.();
    await assertion;
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('terminates a hung decode at the deadline', async () => {
    const preview = loadBucketHeicPreview(
      'blob:original',
      new AbortController().signal
    );
    const assertion = expect(preview).rejects.toThrow('timeout');
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
    expect(PreviewWorker.instances[0].terminate).toHaveBeenCalledTimes(1);
  });

  it('cancels the worker immediately when the viewer leaves', async () => {
    const controller = new AbortController();
    const preview = loadBucketHeicPreview('blob:original', controller.signal);
    const assertion = expect(preview).rejects.toMatchObject({
      name: 'AbortError',
    });
    controller.abort();
    expectDeadlineCleared();
    await assertion;
    expect(PreviewWorker.instances[0].terminate).toHaveBeenCalledTimes(1);
  });

  it('never starts work for an already cancelled request', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      loadBucketHeicPreview('blob:original', controller.signal)
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(PreviewWorker.instances).toHaveLength(0);
  });
});
