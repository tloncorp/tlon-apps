type DiagnosticRef = {
  subscribeScrollDiagnostics?: (
    options: { scope: string; maxRecords: number },
    sink: (record: unknown) => void
  ) => () => void;
};

export type ScrollCorrectionRecording = {
  source: 'opt-in-legend-native-corrections';
  scope: string;
  startedAt: number;
  observedThrough: number;
  clock: 'performance.now milliseconds';
  status: 'recording' | 'disposed' | 'unavailable';
  error?: string;
  records: unknown[];
};

/** Fixture-only observation; no subscription is installed unless requested. */
export function observeScrollCorrections(
  ref: object,
  scope: string,
  now = () => performance.now()
) {
  const startedAt = now();
  const records: unknown[] = [];
  let status: ScrollCorrectionRecording['status'] = 'recording';
  let error: string | undefined;
  let stoppedAt: number | undefined;
  let unsubscribe: (() => void) | undefined;
  let ownerId: number | undefined;
  let sessionId: number | undefined;
  let previousTime = -Infinity;
  let lastSequence = 0;
  const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
  try {
    if (!Number.isFinite(startedAt))
      throw new Error('Invalid diagnostic clock');
    const subscribe = (ref as DiagnosticRef).subscribeScrollDiagnostics;
    if (!scope || !subscribe) throw new Error('Missing scoped diagnostic hook');
    unsubscribe = subscribe.call(
      ref,
      { scope, maxRecords: 4096 },
      (record: unknown) => {
        if (status !== 'recording') return;
        try {
          const receivedAt = now();
          // The dependency permits one additional terminal overflow record.
          if (records.length >= 4097)
            throw new Error('Diagnostic producer exceeded its declared bound');
          const detached = copy(record);
          records.push(detached);
          const value = detached as {
            schemaVersion: number;
            ownerId: number;
            sessionId: number;
            scope: string;
            sequence: number;
            time: number;
            event: string;
            reason?: string;
          };
          if (
            !value ||
            value.schemaVersion !== 1 ||
            value.scope !== scope ||
            !Number.isInteger(value.ownerId) ||
            value.ownerId <= 0 ||
            !Number.isInteger(value.sessionId) ||
            value.sessionId <= 0 ||
            (ownerId !== undefined && ownerId !== value.ownerId) ||
            (sessionId !== undefined && sessionId !== value.sessionId) ||
            value.sequence !== lastSequence + 1 ||
            !Number.isFinite(value.time) ||
            !Number.isFinite(receivedAt) ||
            value.time < startedAt ||
            value.time > receivedAt ||
            value.time < previousTime ||
            typeof value.event !== 'string' ||
            !value.event ||
            (lastSequence === 0 && value.event !== 'subscribed')
          )
            throw new Error(
              'Diagnostic scope, owner, sequence or clock changed'
            );
          ownerId = value.ownerId;
          sessionId = value.sessionId;
          previousTime = value.time;
          lastSequence = value.sequence;
          if (value.event === 'terminal') {
            if (value.reason !== 'unsubscribed')
              throw new Error(`Diagnostic collection ended: ${value.reason}`);
            status = 'disposed';
            stoppedAt = now();
          }
        } catch (cause) {
          status = 'unavailable';
          error = String(cause);
          stoppedAt = now();
        }
      }
    );
    if (typeof unsubscribe !== 'function')
      throw new Error('Diagnostic hook did not provide cleanup');
    if (!records.length)
      throw new Error('Diagnostic hook did not record its initial state');
  } catch (cause) {
    status = 'unavailable';
    error = String(cause);
    stoppedAt = now();
  }
  return {
    read: (): ScrollCorrectionRecording => ({
      source: 'opt-in-legend-native-corrections',
      scope,
      startedAt,
      observedThrough: stoppedAt ?? now(),
      clock: 'performance.now milliseconds',
      status,
      ...(error ? { error } : {}),
      records: copy(records),
    }),
    dispose: () => {
      if (status === 'disposed') return;
      const expectedTerminal = status === 'recording';
      const cleanup = unsubscribe;
      unsubscribe = undefined;
      try {
        cleanup?.();
      } catch (cause) {
        status = 'unavailable';
        error = String(cause);
      }
      if (expectedTerminal && status === 'recording') {
        status = 'unavailable';
        error = 'Diagnostic cleanup did not emit its terminal record';
      }
      stoppedAt ??= now();
    },
  };
}
