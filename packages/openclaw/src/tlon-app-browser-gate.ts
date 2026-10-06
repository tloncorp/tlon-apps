/**
 * Hosted-browser gate for the Tlon web app, applied to `mcp__call` by the
 * before_tool_call hook (index.ts). Stateless by design: it blocks explicit
 * browser destinations on Tlon app routes only. URL-less actions (`browser_run`,
 * `browser_act`) and redirects are left to the prompt rule, and public ship
 * pages (exposed content, published notes, profiles, invite links) stay open.
 */
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';

import {
  type TlonResolvedAccount,
  listTlonAccountIds,
  resolveTlonAccount,
} from './types.js';

export const TLON_APP_BROWSER_BLOCK_REASON =
  'Blocked by policy: the hosted browser must not open or operate the Tlon app. Use the tlon and message tools; ' +
  'if they cannot do this, tell the user it is not supported yet and suggest the Tlon app.';

const BROWSER_TOOL_PREFIX = 'browser_';

// `zod.tlon.network.` (DNS root label) reaches the same ship as
// `zod.tlon.network`; strip one trailing dot, keeping any port.
function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/\.(?=(:\d+)?$)/, '');
}

/** `URL.host` values (hostname plus any non-default port) of known ships. */
export function tlonShipOrigins(
  accounts: readonly Pick<TlonResolvedAccount, 'url' | 'ship' | 'ownerShip'>[]
): ReadonlySet<string> {
  const hosts = new Set<string>();
  for (const account of accounts) {
    if (account.url && URL.canParse(account.url)) {
      hosts.add(normalizeHost(new URL(account.url).host));
    }
    for (const ship of [account.ship, account.ownerShip]) {
      const name = ship?.trim().replace(/^~/, '').toLowerCase();
      if (name) hosts.add(`${name}.tlon.network`);
    }
  }
  return hosts;
}

/** Known ship hosts across the root account and every named account. */
export function configuredTlonShipHosts(
  cfg: OpenClawConfig
): ReadonlySet<string> {
  return tlonShipOrigins(
    ['default', ...listTlonAccountIds(cfg)].map((id) =>
      resolveTlonAccount(cfg, id)
    )
  );
}

// Decoded path segments as Urbit routes them: interior empty segments are
// kept, and at most one trailing slash is ignored.
function pathSegments(pathname: string): string[] {
  return pathname
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .split('/')
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
}

export function isTlonWebAppUrl(
  raw: string,
  shipHosts: ReadonlySet<string>
): boolean {
  if (!URL.canParse(raw)) return false;
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const segments = pathSegments(url.pathname);
  // Urbit web-UI routes match on any host, covering self-hosted ships whose
  // host the plugin cannot derive.
  if (
    (segments[0] === 'apps' &&
      (segments[1] === 'groups' || segments[1] === 'landscape')) ||
    (segments.length === 2 && segments[0] === '~' && segments[1] === 'login')
  ) {
    return true;
  }
  if (!shipHosts.has(normalizeHost(url.host))) return false;
  if (url.pathname === '/' || segments[0] === 'apps' || segments[0] === '~') {
    return true;
  }
  // %notes serves its UI under /notes but public pages under pub/ and share/.
  return (
    segments[0] === 'notes' && segments[1] !== 'pub' && segments[1] !== 'share'
  );
}

function record(value: unknown): Record<string, unknown> | null {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}

function destinationUrls(tool: string, args: Record<string, unknown> | null) {
  // browser_wait_for's `url` is a substring condition, not a destination.
  if (!args || tool === 'browser_wait_for') return [];
  const urls = typeof args.url === 'string' ? [args.url] : [];
  if (tool === 'browser_batch' && Array.isArray(args.steps)) {
    for (const step of args.steps) {
      const stepRecord = record(step);
      const stepUrl = record(stepRecord?.arguments)?.url;
      if (
        stepRecord?.tool === 'browser_navigate' &&
        typeof stepUrl === 'string'
      ) {
        urls.push(stepUrl);
      }
    }
  }
  return urls;
}

/**
 * `params` is the `mcp__call` payload `{ name, arguments }`. The hosted browser
 * upstream id is `browser`, so its tools arrive prefixed
 * (`browser_browser_navigate`) or bare (`browser_navigate`).
 */
export function resolveTlonAppBrowserBlock(
  params: unknown,
  shipHosts: ReadonlySet<string>
): { blocked: boolean; reason?: string } {
  const call = record(params);
  const name = call?.name;
  if (typeof name !== 'string' || !name.startsWith(BROWSER_TOOL_PREFIX)) {
    return { blocked: false };
  }
  const unprefixed = name.slice(BROWSER_TOOL_PREFIX.length);
  const tool = unprefixed.startsWith(BROWSER_TOOL_PREFIX) ? unprefixed : name;
  const blocked = destinationUrls(tool, record(call?.arguments)).some((url) =>
    isTlonWebAppUrl(url, shipHosts)
  );
  return blocked
    ? { blocked, reason: TLON_APP_BROWSER_BLOCK_REASON }
    : { blocked };
}
