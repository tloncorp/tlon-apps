import type * as NodeFs from 'node:fs';
import * as fs from 'node:fs';

import type { GatewayStatusCoordinatorLogger } from './gateway-status.js';

/** Env var (set by the hosted entrypoint) naming the marker file; unset ⇒ no marker logic. */
export const GATEWAY_STOP_REASON_FILE_ENV = 'TLON_GATEWAY_STOP_REASON_FILE';
/** A marker older than this is ignored (defence against a stale file). */
export const GATEWAY_STOP_REASON_MAX_AGE_MS = 300_000;
/** One lowercase token, e.g. `model-change`. */
export const GATEWAY_STOP_REASON_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
/** Refuse to read absurdly large files before trimming. */
export const GATEWAY_STOP_REASON_MAX_RAW_BYTES = 256;

export interface ReadGatewayStopReasonOptions {
  env?: NodeJS.ProcessEnv;
  now?: () => number;
  fs?: Pick<typeof NodeFs, 'lstatSync' | 'readFileSync'>;
  logger?: GatewayStatusCoordinatorLogger;
}

export function readGatewayStopReason(
  opts: ReadGatewayStopReasonOptions = {}
): string | null {
  const f = opts.fs ?? fs;
  const path = (opts.env ?? process.env)[GATEWAY_STOP_REASON_FILE_ENV]?.trim();
  if (!path) {
    return null;
  }

  let st: NodeFs.Stats;
  try {
    st = f.lstatSync(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    opts.logger?.error?.(
      '[gateway-status] stop reason marker unreadable: ' + String(err)
    );
    return null;
  }

  if (!st.isFile()) {
    opts.logger?.error?.(
      '[gateway-status] stop reason marker is not a regular file; ignoring'
    );
    return null;
  }

  if (st.uid !== 0) {
    opts.logger?.error?.(
      `[gateway-status] stop reason marker not owned by root (uid=${st.uid}); ignoring`
    );
    return null;
  }

  const age = (opts.now ?? Date.now)() - st.mtimeMs;
  if (age > GATEWAY_STOP_REASON_MAX_AGE_MS) {
    opts.logger?.error?.(
      `[gateway-status] stop reason marker stale (age=${Math.round(age)}ms); ignoring`
    );
    return null;
  }

  let raw: string;
  try {
    raw = f.readFileSync(path, 'utf8');
  } catch (err) {
    opts.logger?.error?.(
      '[gateway-status] stop reason marker unreadable: ' + String(err)
    );
    return null;
  }

  if (Buffer.byteLength(raw, 'utf8') > GATEWAY_STOP_REASON_MAX_RAW_BYTES) {
    opts.logger?.error?.(
      '[gateway-status] stop reason marker oversize; ignoring'
    );
    return null;
  }

  const token = raw.trim();
  if (!GATEWAY_STOP_REASON_PATTERN.test(token)) {
    opts.logger?.error?.(
      '[gateway-status] stop reason marker token invalid; ignoring'
    );
    return null;
  }

  return token;
}
