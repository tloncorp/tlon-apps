export function loadBucketHeicPreview(
  uri: string,
  signal: AbortSignal
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Cancelled', 'AbortError'));
      return;
    }
    const worker = new Worker(
      new URL('./bucketHeic.worker.ts', import.meta.url),
      { type: 'module' }
    );
    const cleanup = () => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      worker.terminate();
    };
    const fail = (error: Error) => {
      cleanup();
      reject(error);
    };
    const abort = () => fail(new DOMException('Cancelled', 'AbortError'));
    const timeout = setTimeout(() => fail(new Error('timeout')), 30_000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = () => fail(new Error('decode'));
    worker.onmessage = ({
      data,
    }: MessageEvent<{ blob?: Blob; error?: string }>) => {
      cleanup();
      if (data.blob) resolve(data.blob);
      else reject(new Error(data.error ?? 'decode'));
    };
    worker.postMessage(uri);
  });
}
