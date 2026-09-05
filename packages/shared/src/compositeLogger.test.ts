import { describe, expect, it, vi } from 'vitest';

import { createCompositeLogger } from './compositeLogger';

describe('createCompositeLogger', () => {
  it('forwards app_error to both sinks with the same event name', () => {
    const posthog = vi.fn();
    const sentry = vi.fn();
    const logger = createCompositeLogger({ posthog, sentry });

    logger.capture('app_error', { message: 'boom' });

    expect(posthog).toHaveBeenCalledTimes(1);
    expect(posthog.mock.calls[0][0]).toBe('app_error');
    expect(sentry).toHaveBeenCalledTimes(1);
    expect(sentry.mock.calls[0][0]).toBe('app_error');
  });

  it('forwards App Error to both sinks', () => {
    const posthog = vi.fn();
    const sentry = vi.fn();
    const logger = createCompositeLogger({ posthog, sentry });

    logger.capture('App Error', { message: 'boom' });

    expect(posthog).toHaveBeenCalledTimes(1);
    expect(posthog.mock.calls[0][0]).toBe('App Error');
    expect(sentry).toHaveBeenCalledTimes(1);
    expect(sentry.mock.calls[0][0]).toBe('App Error');
  });

  it('sends Debug Logs to posthog only', () => {
    const posthog = vi.fn();
    const sentry = vi.fn();
    const logger = createCompositeLogger({ posthog, sentry });

    logger.capture('Debug Logs', { message: 'logs' });

    expect(posthog).toHaveBeenCalledTimes(1);
    expect(sentry).not.toHaveBeenCalled();
  });

  it('sends Attestation Error and Error Sending Post to posthog only', () => {
    const posthog = vi.fn();
    const sentry = vi.fn();
    const logger = createCompositeLogger({ posthog, sentry });

    logger.capture('Attestation Error', { message: 'attestation' });
    logger.capture('Error Sending Post', { message: 'send' });

    expect(posthog).toHaveBeenCalledTimes(2);
    expect(sentry).not.toHaveBeenCalled();
  });

  it('strips errorObject from the posthog payload but keeps it for sentry', () => {
    const posthog = vi.fn();
    const sentry = vi.fn();
    const logger = createCompositeLogger({ posthog, sentry });
    const errorObject = new Error('boom');

    logger.capture('app_error', {
      message: 'something failed',
      error: 'Error: boom',
      errorObject,
    });

    const [, forPostHog] = posthog.mock.calls[0];
    const [, forSentry] = sentry.mock.calls[0];

    expect(forPostHog).not.toHaveProperty('errorObject');
    expect(forPostHog).toHaveProperty('message', 'something failed');
    expect(forPostHog).toHaveProperty('error', 'Error: boom');

    expect(forSentry).toHaveProperty('errorObject');
    expect(forSentry.errorObject).toBe(errorObject);
    expect(forSentry).toHaveProperty('message', 'something failed');
    expect(forSentry).toHaveProperty('error', 'Error: boom');
  });

  it('still calls sentry for app_error when posthog is omitted', () => {
    const sentry = vi.fn();
    const logger = createCompositeLogger({ sentry });

    expect(() =>
      logger.capture('app_error', { message: 'boom' })
    ).not.toThrow();

    expect(sentry).toHaveBeenCalledTimes(1);
    expect(sentry).toHaveBeenCalledWith('app_error', { message: 'boom' });
  });

  it('calls sentry when the posthog sink throws', () => {
    const posthog = vi.fn(() => {
      throw new Error('posthog down');
    });
    const sentry = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createCompositeLogger({ posthog, sentry });

    try {
      logger.capture('app_error', { message: 'boom' });
    } finally {
      warn.mockRestore();
    }

    expect(sentry).toHaveBeenCalledTimes(1);
  });

  it('does not propagate when the sentry sink throws', () => {
    const posthog = vi.fn();
    const sentry = vi.fn(() => {
      throw new Error('sentry down');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createCompositeLogger({ posthog, sentry });

    try {
      expect(() =>
        logger.capture('app_error', { message: 'boom' })
      ).not.toThrow();
    } finally {
      warn.mockRestore();
    }

    expect(posthog).toHaveBeenCalledTimes(1);
    expect(sentry).toHaveBeenCalledTimes(1);
  });

  it('flush delegates to options.flush when given', async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const logger = createCompositeLogger({ sentry: vi.fn(), flush });

    await logger.flush();

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('flush resolves when options.flush is not given', async () => {
    const logger = createCompositeLogger({ sentry: vi.fn() });

    await expect(logger.flush()).resolves.toBeUndefined();
  });
});
