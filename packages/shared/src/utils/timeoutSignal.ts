interface ManualAbortSignal extends AbortSignal {
  cleanup: () => void;
}

export function createTimeoutSignal(ms: number): ManualAbortSignal {
  const controller = new AbortController();
  const signal = controller.signal;

  const timeout = setTimeout(() => {
    controller.abort();
  }, ms);

  // Clean up the timeout if signal is aborted from elsewhere
  signal.addEventListener(
    'abort',
    () => {
      clearTimeout(timeout);
    },
    { once: true }
  );

  (signal as ManualAbortSignal).cleanup = () => {
    clearTimeout(timeout);
  };

  return signal as ManualAbortSignal;
}
