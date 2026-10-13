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

// Saved-login records are planet-scoped, so settings use one management host
// per environment rather than the cluster of a particular browser session.
export function browserVaultOrigin(): string {
  const host = new URL(getConstants().API_URL).hostname;
  return host === 'test.tlon.systems' || host.endsWith('.test.tlon.systems')
    ? 'https://browser-session-ovh-test-1.test.tlon.systems'
    : 'https://browser-session-ovh1.tlon.network';
}

/** Owner proofs are read for each request and never stored in app state. */
export async function browserVaultOwnerRequest(
  endpoint: string,
  body: Record<string, unknown>,
  signal?: AbortSignal
): Promise<unknown> {
  const url = new URL(endpoint);
  if (
    url.protocol !== 'https:' ||
    !isTrustedBrowserViewerHost(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/(?:viewer-authorize|vault\/(?:list|delete|permission)|credential-vault\/[A-Za-z0-9_-]{40,64})$/.test(
      url.pathname
    )
  )
    throw new Error('Saved logins require a trusted browser host.');
  const isTestHost = (host: string) =>
    host === 'test.tlon.systems' || host.endsWith('.test.tlon.systems');
  if (
    isTestHost(url.hostname) !==
    isTestHost(new URL(browserVaultOrigin()).hostname)
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

export async function listBrowserLogins(
  moon: string,
  signal?: AbortSignal
): Promise<SavedBrowserLogin[]> {
  const result = await browserVaultOwnerRequest(
    `${browserVaultOrigin()}/vault/list`,
    { moon: moon.replace(/^~/, '') },
    signal
  );
  const parsed = z
    .object({ accounts: z.array(savedBrowserLoginSchema).max(200) })
    .safeParse(result);
  if (!parsed.success)
    throw new Error('The browser returned an invalid saved-login response.');
  return parsed.data.accounts;
}

export async function deleteBrowserLogin(
  moon: string,
  record: BrowserLoginChoice,
  signal?: AbortSignal
): Promise<void> {
  await browserVaultOwnerRequest(
    `${browserVaultOrigin()}/vault/delete`,
    { moon: moon.replace(/^~/, ''), record },
    signal
  );
}

export async function setBrowserLoginPermission(
  moon: string,
  record: BrowserLoginChoice,
  permission: 'ask' | 'allow',
  signal?: AbortSignal
): Promise<void> {
  await browserVaultOwnerRequest(
    `${browserVaultOrigin()}/vault/permission`,
    {
      moon: moon.replace(/^~/, ''),
      record,
      permission,
    },
    signal
  );
}
