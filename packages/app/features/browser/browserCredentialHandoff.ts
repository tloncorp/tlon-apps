const VIEWER_LABEL = 'browser-session-[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const PRODUCTION_VIEWER_HOST = new RegExp(
  `^(?:${VIEWER_LABEL}|browser-session|session-viewer)\\.tlon\\.network$`
);
const TEST_VIEWER_HOST = new RegExp(
  `^(?:${VIEWER_LABEL}|browser-session|session-viewer)\\.test\\.tlon\\.systems$`
);

export type BrowserCredentialHandoff = {
  fillUrl: string;
  origin: string;
  hasUsername: boolean;
  expiresAt: number;
};

function isLocalViewer(url: URL): boolean {
  return (
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  );
}

function parseViewerUrl(viewerUrl: string): { url: URL; capability: string } {
  const url = new URL(viewerUrl);
  const trustedHostedViewer =
    url.protocol === 'https:' &&
    (PRODUCTION_VIEWER_HOST.test(url.hostname) ||
      TEST_VIEWER_HOST.test(url.hostname));
  if (!trustedHostedViewer && !isLocalViewer(url)) {
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
    typeof body.hasUsername !== 'boolean' ||
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
  return {
    fillUrl: new URL(
      `/credential-fills/${body.handoffId}`,
      url.origin
    ).toString(),
    origin: body.origin,
    hasUsername: body.hasUsername,
    expiresAt: body.expiresAt,
  };
}

export async function submitBrowserCredentials(
  handoff: BrowserCredentialHandoff,
  values: { username?: string; password: string; submit?: boolean },
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
