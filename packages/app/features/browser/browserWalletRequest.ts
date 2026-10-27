/** The local playground exposes this bridge on the signed-in ship origin.
 * No URL from a message can select where its authentication cookies are sent.
 */
export function walletActionUrl(
  shipUrl: string | null,
  requestId: string,
  operation: string
) {
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      requestId
    )
  )
    throw new Error('Invalid wallet request.');
  if (!['view', 'approve', 'cancel', 'preview'].includes(operation))
    throw new Error('Invalid wallet operation.');
  if (!shipUrl) throw new Error('Sign in to your ship first.');
  const url = new URL(shipUrl);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error('Invalid ship origin.');
  return new URL(
    `/apps/browser-wallet/actions/${requestId}/${operation}`,
    url.origin
  ).href;
}

export function walletActionRequest({
  shipUrl,
  requestId,
  operation,
  body,
  signal,
  native,
}: {
  shipUrl: string | null;
  requestId: string;
  operation: string;
  body: object;
  signal?: AbortSignal;
  native: boolean;
}) {
  const url = walletActionUrl(shipUrl, requestId, operation);
  return fetch(url, {
    method: 'POST',
    // Native networking reuses the cookie jar established by ship login.
    credentials: native ? undefined : 'same-origin',
    cache: 'no-store',
    redirect: 'error',
    headers: {
      'content-type': 'application/json',
      ...(native ? { Origin: new URL(url).origin } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
}
