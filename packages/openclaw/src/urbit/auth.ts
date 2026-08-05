import {
  type LookupFn,
  SsrFBlockedError,
  type SsrFPolicy,
} from 'openclaw/plugin-sdk/ssrf-runtime';

import { UrbitAuthError, UrbitHttpError, UrbitUrlError } from './errors.js';
import { urbitFetch } from './fetch.js';

export type UrbitAuthenticateOptions = {
  ssrfPolicy?: SsrFPolicy;
  lookupFn?: LookupFn;
  fetchImpl?: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>;
  timeoutMs?: number;
};

export function isPermanentAuthenticationFailure(error: unknown): boolean {
  return (
    error instanceof UrbitAuthError ||
    error instanceof UrbitUrlError ||
    error instanceof SsrFBlockedError
  );
}

export async function authenticate(
  url: string,
  code: string,
  options: UrbitAuthenticateOptions = {}
): Promise<string> {
  const { response, release } = await urbitFetch({
    baseUrl: url,
    path: '/~/login',
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ password: code }).toString(),
    },
    ssrfPolicy: options.ssrfPolicy,
    lookupFn: options.lookupFn,
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs ?? 15_000,
    maxRedirects: 3,
    auditContext: 'tlon-urbit-login',
  });

  try {
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new UrbitAuthError(
          'auth_failed',
          `Login failed with status ${response.status}`
        );
      }
      throw new UrbitHttpError({
        operation: 'Login',
        status: response.status,
      });
    }

    // Some Urbit setups require the response body to be read before cookie headers finalize.
    await response.text().catch(() => {});
    const cookie = response.headers.get('set-cookie');
    if (!cookie) {
      throw new UrbitAuthError(
        'missing_cookie',
        'No authentication cookie received'
      );
    }
    return cookie;
  } finally {
    await release();
  }
}
