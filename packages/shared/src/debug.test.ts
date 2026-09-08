import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createDevLogger, useDebugStore } from './debug';

// `trackError` reports asynchronously: `getDebugInfo()` resolves first, then
// `report()` calls `capture`. Flushing the microtask queue is enough.
async function flushReport() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function makeError() {
  try {
    // @ts-expect-error deliberate runtime failure so `stack` is real
    null.boom();
  } catch (e) {
    return e as Error;
  }
  throw new Error('unreachable');
}

describe('createDevLogger trackError analytics payload', () => {
  const capture = vi.fn();
  const logger = createDevLogger('test', false);

  beforeEach(() => {
    capture.mockClear();
    useDebugStore.getState().initializeErrorLogger({ capture });
  });

  afterEach(() => {
    useDebugStore.setState({ errorLogger: null });
  });

  async function captured(data?: Error | Record<string, unknown>) {
    logger.trackError('failed to sync latest posts', data);
    await flushReport();
    expect(capture).toHaveBeenCalledTimes(1);
    const [event, payload] = capture.mock.calls[0];
    expect(event).toBe('app_error');
    return payload as Record<string, unknown>;
  }

  // PostHog JSON-serializes properties, and an Error's `message`/`stack` are
  // non-enumerable — so `error: e` alone reaches PostHog as `{}`. These derived
  // string props are what keeps the error legible there.
  test('derives errorMessage and errorStack strings from `{ error }`', async () => {
    const error = makeError();
    const payload = await captured({ error });

    expect(payload.errorMessage).toBe(error.message);
    expect(payload.errorStack).toBe(error.stack);
    expect(typeof payload.errorMessage).toBe('string');
    expect(typeof payload.errorStack).toBe('string');
    expect(payload.message).toBe('[test] failed to sync latest posts');
  });

  test('derives them from a bare Error second argument too', async () => {
    const error = makeError();
    const payload = await captured(error);

    expect(payload.errorMessage).toBe(error.message);
    expect(payload.errorStack).toBe(error.stack);
  });

  test('caller-supplied errorMessage/errorStack strings still win', async () => {
    const payload = await captured({
      errorMessage: 'hand-rolled message',
      errorStack: 'hand-rolled stack',
    });

    expect(payload.errorMessage).toBe('hand-rolled message');
    expect(payload.errorStack).toBe('hand-rolled stack');
  });

  test('a non-Error `error` value reports without message or stack', async () => {
    const payload = await captured({ error: 'just a string' });

    expect(payload.error).toBe('just a string');
    expect(payload.errorMessage).toBeUndefined();
    expect(payload.errorStack).toBeUndefined();
  });
});
