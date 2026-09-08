import { describe, expect, it, vi } from 'vitest';

import { observeScrollCorrections } from './scrollCorrectionDiagnostics';

const record = (sequence: number, extra = {}) => ({
  schemaVersion: 1,
  ownerId: 1,
  sessionId: 1,
  scope: 'channel::1',
  sequence,
  time: sequence * 10,
  event: sequence === 1 ? 'subscribed' : 'mvcp-prepare',
  ...extra,
});

function source() {
  let sink: (value: unknown) => void = () => {};
  let clock = 0;
  const cleanup = vi.fn(() => {
    clock = 30;
    sink(record(3, { event: 'terminal', reason: 'unsubscribed' }));
  });
  const subscribe = vi.fn((_, listener: typeof sink) => {
    sink = listener;
    clock = 10;
    sink(record(1));
    return cleanup;
  });
  return {
    ref: { subscribeScrollDiagnostics: subscribe },
    send: (value: unknown, receivedAt = 20) => {
      clock = receivedAt;
      sink(value);
    },
    now: () => clock,
    cleanup,
    subscribe,
  };
}

describe('fixture correction observation', () => {
  it('records missing hooks as unavailable without changing the list', () => {
    const ref = { scroll: 42 };
    const observed = observeScrollCorrections(ref, 'channel::1');
    expect(observed.read()).toMatchObject({
      status: 'unavailable',
      records: [],
    });
    expect(ref).toEqual({ scroll: 42 });
  });

  it('copies dependency values and exports independent snapshots', () => {
    const dependency = source();
    const observed = observeScrollCorrections(
      dependency.ref,
      'channel::1',
      dependency.now
    );
    const value = { ...record(2), state: { idsInView: ['reader'] } };
    dependency.send(value);
    value.state.idsInView.push('later');
    const first = observed.read();
    expect(first.records[1]).toMatchObject({
      state: { idsInView: ['reader'] },
    });
    first.records.length = 0;
    expect(observed.read().records).toHaveLength(2);
    expect(dependency.subscribe.mock.calls[0][0]).toEqual({
      scope: 'channel::1',
      maxRecords: 4096,
    });
  });

  it('closes the actual subscription once and refuses delayed records', () => {
    const dependency = source();
    const observed = observeScrollCorrections(
      dependency.ref,
      'channel::1',
      dependency.now
    );
    dependency.send(record(2));
    observed.dispose();
    observed.dispose();
    dependency.send(record(4));
    expect(dependency.cleanup).toHaveBeenCalledTimes(1);
    expect(observed.read()).toMatchObject({ status: 'disposed' });
    expect(observed.read().records).toHaveLength(3);
  });

  it.each([
    { scope: 'other::1' },
    { ownerId: 2 },
    { sessionId: 2 },
    { sequence: 4 },
    { time: 1 },
    { schemaVersion: 2 },
  ])('retains an invalid observation and reports loss: %j', (invalid) => {
    const dependency = source();
    const observed = observeScrollCorrections(
      dependency.ref,
      'channel::1',
      dependency.now
    );
    dependency.send(record(2, invalid));
    expect(observed.read().status).toBe('unavailable');
    expect(observed.read().records).toHaveLength(2);
    observed.dispose();
    expect(dependency.cleanup).toHaveBeenCalledTimes(1);
  });

  it.each(['max-records', 'max-record-bytes', 'unmounted', 'sink-threw'])(
    'does not qualify a lossy terminal: %s',
    (reason) => {
      const dependency = source();
      const observed = observeScrollCorrections(
        dependency.ref,
        'channel::1',
        dependency.now
      );
      dependency.send(record(2, { event: 'terminal', reason }));
      expect(observed.read().status).toBe('unavailable');
      expect(observed.read().records[1]).toMatchObject({ reason });
    }
  );

  it('requires the promised initial state observation', () => {
    const cleanup = vi.fn();
    const observed = observeScrollCorrections(
      { subscribeScrollDiagnostics: () => cleanup },
      'channel::1'
    );
    expect(observed.read().status).toBe('unavailable');
    observed.dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('rejects a producer timestamp later than its receipt', () => {
    const dependency = source();
    const observed = observeScrollCorrections(
      dependency.ref,
      'channel::1',
      dependency.now
    );
    dependency.send(record(2, { time: 1000 }), 20);
    expect(observed.read().status).toBe('unavailable');
    expect(observed.read().records).toHaveLength(2);
  });

  it('rejects a producer timestamp before subscription started', () => {
    const dependency = source();
    const observed = observeScrollCorrections(
      dependency.ref,
      'channel::1',
      () => 100
    );
    expect(observed.read().status).toBe('unavailable');
    expect(observed.read().records).toHaveLength(1);
  });

  it('does not start observation with an invalid clock', () => {
    const dependency = source();
    const observed = observeScrollCorrections(
      dependency.ref,
      'channel::1',
      () => NaN
    );
    expect(observed.read().status).toBe('unavailable');
    expect(dependency.subscribe).not.toHaveBeenCalled();
  });

  it('requires the terminal event when the dependency cleans up', () => {
    const dependency = source();
    dependency.cleanup.mockImplementation(() => {});
    const observed = observeScrollCorrections(
      dependency.ref,
      'channel::1',
      dependency.now
    );
    observed.dispose();
    expect(observed.read()).toMatchObject({
      status: 'unavailable',
      error: 'Diagnostic cleanup did not emit its terminal record',
    });
    observed.dispose();
    expect(dependency.cleanup).toHaveBeenCalledTimes(1);
  });

  it('contains subscription and cleanup errors', () => {
    const broken = observeScrollCorrections(
      {
        subscribeScrollDiagnostics: () => {
          throw new Error('setup');
        },
      },
      'channel::1'
    );
    expect(broken.read().status).toBe('unavailable');
    expect(() => broken.dispose()).not.toThrow();
    const dependency = source();
    dependency.cleanup.mockImplementation(() => {
      throw new Error('cleanup');
    });
    const observed = observeScrollCorrections(
      dependency.ref,
      'channel::1',
      dependency.now
    );
    expect(() => observed.dispose()).not.toThrow();
    expect(observed.read().status).toBe('unavailable');
  });
});
