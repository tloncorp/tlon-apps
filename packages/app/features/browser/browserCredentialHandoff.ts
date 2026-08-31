const VIEWER_LABEL = 'browser-session-[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const PRODUCTION_VIEWER_HOST = new RegExp(
  `^(?:${VIEWER_LABEL}|browser-session|session-viewer)\\.tlon\\.network$`
);
const TEST_VIEWER_HOST = new RegExp(
  `^(?:${VIEWER_LABEL}|browser-session|session-viewer)\\.test\\.tlon\\.systems$`
);

type BrowserCredentialHandoffBase = {
  fillUrl: string;
  origin: string;
  expiresAt: number;
};

export type BrowserCredentialHandoff = BrowserCredentialHandoffBase &
  (
    | { kind: 'password'; hasUsername: boolean }
    | { kind: 'otp'; codeLength?: number }
  );

export type BrowserCredentialValues =
  | { username?: string; password: string; submit?: boolean }
  | { code: string; submit?: boolean };

function parseViewerUrl(viewerUrl: string): { url: URL; capability: string } {
  const url = new URL(viewerUrl);
  const trustedHostedViewer =
    url.protocol === 'https:' &&
    (PRODUCTION_VIEWER_HOST.test(url.hostname) ||
      TEST_VIEWER_HOST.test(url.hostname));
  if (!trustedHostedViewer) {
    throw new Error('This browser login link is not from a trusted Tlon host.');
  }
  if (url.username || url.password) {
    throw new Error('This browser login link is invalid.');
  }
  const match = /^\/s\/([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(url.pathname);
  if (!match) {
    throw new Error('This browser login link is invalid or incomplete.');
  }
  return { url, capability: match[1] };
}

async function responseJson(
  response: Response
): Promise<Record<string, unknown>> {
  const body = await response.json().catch(() => undefined);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  return body as Record<string, unknown>;
}

function responseError(body: Record<string, unknown>, fallback: string): Error {
  return new Error(typeof body.error === 'string' ? body.error : fallback);
}

export async function beginBrowserCredentialHandoff(
  viewerUrl: string,
  signal?: AbortSignal
): Promise<BrowserCredentialHandoff> {
  const { url, capability } = parseViewerUrl(viewerUrl);
  const endpoint = new URL(`/credentials/${capability}`, url.origin);
  const response = await fetch(endpoint, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal,
  });
  const body = await responseJson(response);
  if (!response.ok) {
    throw responseError(body, 'Could not find a live browser login form.');
  }
  if (
    typeof body.handoffId !== 'string' ||
    !/^[A-Za-z0-9_-]{40,64}$/.test(body.handoffId) ||
    typeof body.origin !== 'string' ||
    (body.kind !== 'password' && body.kind !== 'otp') ||
    (body.kind === 'password' && typeof body.hasUsername !== 'boolean') ||
    (body.kind === 'otp' &&
      body.codeLength !== undefined &&
      (typeof body.codeLength !== 'number' ||
        !Number.isSafeInteger(body.codeLength) ||
        body.codeLength < 1 ||
        body.codeLength > 12)) ||
    typeof body.expiresAt !== 'number'
  ) {
    throw new Error('The browser returned an invalid login handoff.');
  }
  const targetOrigin = new URL(body.origin);
  if (
    (targetOrigin.protocol !== 'http:' && targetOrigin.protocol !== 'https:') ||
    targetOrigin.origin !== body.origin
  ) {
    throw new Error('The browser returned an invalid login origin.');
  }
  const base = {
    fillUrl: new URL(
      `/credential-fills/${body.handoffId}`,
      url.origin
    ).toString(),
    origin: body.origin,
    expiresAt: body.expiresAt,
  };
  return body.kind === 'password'
    ? { ...base, kind: 'password', hasUsername: body.hasUsername as boolean }
    : {
        ...base,
        kind: 'otp',
        ...(body.codeLength === undefined
          ? {}
          : { codeLength: body.codeLength as number }),
      };
}

export async function submitBrowserCredentials(
  handoff: BrowserCredentialHandoff,
  values: BrowserCredentialValues,
  signal?: AbortSignal
): Promise<{ submitted: boolean }> {
  if (Date.now() >= handoff.expiresAt) {
    throw new Error('This browser login handoff has expired.');
  }
  const response = await fetch(handoff.fillUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(values),
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal,
  });
  const body = await responseJson(response);
  if (!response.ok) {
    throw responseError(body, 'Could not fill the browser login form.');
  }
  return { submitted: body.submitted === true };
}
