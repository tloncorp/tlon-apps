import { z } from 'zod';

import { getConstants } from '../types';
import { isTrustedBrowserViewerHost } from './browserSession';
import { getBrowserVaultOwnerAuthorization } from './urbit';

export const savedBrowserLoginSchema = z.object({
  id: z.string().uuid(),
  origin: z.string().url(),
  revision: z.number().int().positive(),
  updatedAt: z.number(),
  label: z.string().min(1).max(256),
  username: z.string().min(1).max(4096).optional(),
  permission: z.enum(['ask', 'allow']),
});
export type SavedBrowserLogin = z.infer<typeof savedBrowserLoginSchema>;
export type BrowserLoginChoice = Pick<SavedBrowserLogin, 'id' | 'revision'>;

export async function authorizeBrowserLoginHandoff(
  endpoint: string,
  signal?: AbortSignal
) {
  const result = await browserVaultOwnerRequest(endpoint, {}, signal);
  const parsed = z
    .object({
      grant: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
      accounts: z.array(savedBrowserLoginSchema).max(200),
    })
    .safeParse(result);
  if (!parsed.success)
    throw new Error('The browser returned an invalid saved-login response.');
  return parsed.data;
}

/** Send an owner proof only to a trusted browser endpoint in this environment. */
export async function browserVaultOwnerRequest(
  endpoint: string,
  body: Record<string, unknown>,
  signal?: AbortSignal
): Promise<unknown> {
  const url = new URL(endpoint);
  if (
    url.protocol !== 'https:' ||
    url.port ||
    !isTrustedBrowserViewerHost(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/(?:viewer-authorize|credential-vault\/[A-Za-z0-9_-]{40,64})$/.test(
      url.pathname
    )
  )
    throw new Error('Saved logins require a trusted browser host.');
  const isTestHost = (host: string) =>
    host === 'test.tlon.systems' || host.endsWith('.test.tlon.systems');
  if (
    isTestHost(url.hostname) !==
    isTestHost(new URL(getConstants().API_URL).hostname)
  )
    throw new Error(
      'Saved logins require a trusted browser host in this environment.'
    );
  const { planet, ownerToken } = await getBrowserVaultOwnerAuthorization();
  if (signal?.aborted) throw new Error('Canceled');
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, planet, ownerToken }),
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    redirect: 'error',
    signal,
  });
  if (!response.ok)
    throw new Error('Saved logins are unavailable. Reconnect and try again.');
  return response.json();
}
