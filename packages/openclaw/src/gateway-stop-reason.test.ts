import { describe, expect, it, vi } from 'vitest';

import {
  GATEWAY_STOP_REASON_FILE_ENV,
  GATEWAY_STOP_REASON_MAX_AGE_MS,
  readGatewayStopReason,
} from './gateway-stop-reason.js';

const NOW = 1_700_000_000_000;
const now = () => NOW;
const env = { [GATEWAY_STOP_REASON_FILE_ENV]: '/tmp/marker' };

function stat(overrides: Record<string, unknown> = {}) {
  return {
    isFile: () => true,
    uid: 0,
    mtimeMs: NOW - 1_000,
    ...overrides,
  };
}

function fakeFs({
  lstat,
  content,
}: {
  lstat?: (path: string) => unknown;
  content?: string;
} = {}) {
  return {
    lstatSync: vi.fn(lstat ?? (() => stat())),
    readFileSync: vi.fn(() => content ?? 'model-change\n'),
  };
}

function recordingLogger() {
  return { log: vi.fn(), error: vi.fn() };
}

function errnoError(code: string): NodeJS.ErrnoException {
  const err = new Error(`${code}: fake fs failure`);
  err.code = code;
  return err;
}

describe('readGatewayStopReason', () => {
  it('returns null silently when the env var is unset', () => {
    const f = fakeFs();
    const logger = recordingLogger();
    expect(readGatewayStopReason({ env: {}, fs: f, logger, now })).toBeNull();
    expect(f.lstatSync).not.toHaveBeenCalled();
    expect(f.readFileSync).not.toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('returns null silently when the marker file does not exist (ENOENT)', () => {
    const f = fakeFs();
    f.lstatSync.mockImplementation(() => {
      throw errnoError('ENOENT');
    });
    const logger = recordingLogger();
    expect(readGatewayStopReason({ env, fs: f, logger, now })).toBeNull();
    expect(logger.log).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('returns null and logs an error when lstat fails with a non-ENOENT error', () => {
    const f = fakeFs();
    f.lstatSync.mockImplementation(() => {
      throw errnoError('EACCES');
    });
    const logger = recordingLogger();
    expect(readGatewayStopReason({ env, fs: f, logger, now })).toBeNull();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('returns the token from a fresh, valid marker', () => {
    const f = fakeFs({ content: 'model-change\n' });
    const logger = recordingLogger();
    expect(readGatewayStopReason({ env, fs: f, logger, now })).toBe(
      'model-change'
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('rejects a non-regular file (symlink) without reading it', () => {
    const f = fakeFs({ lstat: () => stat({ isFile: () => false }) });
    const logger = recordingLogger();
    expect(readGatewayStopReason({ env, fs: f, logger, now })).toBeNull();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0][0]).toContain('regular file');
    expect(f.readFileSync).not.toHaveBeenCalled();
  });

  it('rejects a marker not owned by root without reading it', () => {
    const f = fakeFs({ lstat: () => stat({ uid: 999 }) });
    const logger = recordingLogger();
    expect(readGatewayStopReason({ env, fs: f, logger, now })).toBeNull();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0][0]).toContain('root');
    expect(f.readFileSync).not.toHaveBeenCalled();
  });

  it('rejects a stale marker but accepts one exactly at the max age', () => {
    const stale = fakeFs({
      lstat: () => stat({ mtimeMs: NOW - GATEWAY_STOP_REASON_MAX_AGE_MS - 1 }),
    });
    const staleLogger = recordingLogger();
    expect(
      readGatewayStopReason({ env, fs: stale, logger: staleLogger, now })
    ).toBeNull();
    expect(staleLogger.error).toHaveBeenCalledTimes(1);
    expect(staleLogger.error.mock.calls[0][0]).toContain('stale');

    const boundary = fakeFs({
      lstat: () => stat({ mtimeMs: NOW - GATEWAY_STOP_REASON_MAX_AGE_MS }),
    });
    const boundaryLogger = recordingLogger();
    expect(
      readGatewayStopReason({ env, fs: boundary, logger: boundaryLogger, now })
    ).toBe('model-change');
    expect(boundaryLogger.error).not.toHaveBeenCalled();
  });

  it.each(['Model Change', 'model_change', '../etc'])(
    'rejects the invalid token %j without echoing it into the log',
    (badContent) => {
      const f = fakeFs({ content: badContent });
      const logger = recordingLogger();
      expect(readGatewayStopReason({ env, fs: f, logger, now })).toBeNull();
      expect(logger.error).toHaveBeenCalledTimes(1);
      const message = logger.error.mock.calls[0][0];
      expect(message).toContain('invalid');
      expect(message).not.toContain(badContent);
    }
  );

  it('rejects an oversize marker', () => {
    const f = fakeFs({ content: 'a'.repeat(300) });
    const logger = recordingLogger();
    expect(readGatewayStopReason({ env, fs: f, logger, now })).toBeNull();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0][0]).toContain('oversize');
  });
});
