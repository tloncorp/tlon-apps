/**
 * Outbound-media contract for the tlon CLI (TLON-6318).
 *
 * Ports OpenClaw's fail-loud outbound-media contract (`packages/openclaw`
 * PR #6195, `src/urbit/upload.ts`) into the standalone CLI:
 *
 * - `classifyMediaUrl` — the OpenClaw `classifyInput` classification
 *   (https / local / http / userinfo / invalid) with the WHATWG-canonical
 *   URL as the only form that is ever fetched or posted. The CLI has no
 *   `MEDIA:` message-tool labeling, so no prefix normalization is ported.
 * - `fetchGuardedMedia` — SSRF-guarded fetch with pinned connections. The
 *   hostname is resolved exactly once (inside the deadline), every resolved
 *   address is screened — IPv4 against the private/special-use table, IPv6
 *   allow-listed to global unicast (2000::/3 minus carve-outs), fail closed
 *   on anything unparseable — and the connection is dialed only to a
 *   validated address, closing the DNS-rebinding window between validation
 *   and connect the same way OpenClaw core's pinned dispatcher does. SNI and
 *   certificate verification run against the hostname.
 *
 * Transport note (requires Bun >= 1.3.11): both schemes run over the same
 * maintained client — `node:http`/`node:https` `request` with a `lookup`
 * override that hands back only the validated address being attempted. The
 * connection is therefore pinned to that address while SNI and certificate
 * identity are still verified against the hostname, and the HTTP/1.1 framing
 * is the runtime's rather than ours. Requests are GET only, with
 * `Connection: close` and `Accept-Encoding: identity`. Bun 1.3.4's
 * `node:https` could not be used this way: with a custom `lookup` it
 * substituted the resolved address into its internal fetch and verified the
 * peer certificate against that address instead of the hostname (every hop
 * failed ERR_TLS_CERT_ALTNAME_INVALID, then retried unpinned). That is
 * oven-sh/bun#27890, fixed by PR #27891 in 1.3.11; this repo pins Bun 1.3.14.
 *
 * Content-Encoding note: both transports request `Accept-Encoding: identity`
 * and refuse any response that is encoded anyway. Only an absent or
 * `identity` Content-Encoding proceeds; gzip, deflate, br, an unknown token,
 * or a stacked list all fail closed to the fixed error rather than being
 * decoded, so the byte cap always applies to the bytes actually streamed.
 *
 * All failures collapse to fixed literal errors; caller input never appears
 * in an error message or log (signed-URL query strings and secret-bearing
 * paths must not echo).
 */
import dns from 'node:dns';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

import { commandError } from './commands/command';

export const LOCAL_MEDIA_ERROR =
  'Local file paths are not supported for --image — upload the file first (e.g. `tlon upload <path>`) and pass the returned https URL.';
export const HTTPS_ONLY_ERROR = 'Only https media URLs are supported.';
export const USERINFO_ERROR =
  'Media URLs with embedded credentials are not supported.';
export const INVALID_MEDIA_ERROR =
  'Invalid media URL — pass a public https URL. If this is a local file, upload it first (e.g. `tlon upload <path>`) and resend with the returned https URL.';
export const FETCH_FAILED_ERROR =
  'Could not fetch media from the provided URL.';

export type ClassifiedMedia =
  | { kind: 'https'; canonical: string }
  | { kind: 'local' }
  | { kind: 'http' }
  | { kind: 'userinfo' }
  | { kind: 'invalid' };

/**
 * Classify a media URL/path. Port of OpenClaw's `classifyInput`; the CLI has
 * no `MEDIA:` label normalization, so the input is only trimmed.
 */
export function classifyMediaUrl(raw: string): ClassifiedMedia {
  const value = raw.trim();

  if (
    /^[A-Za-z]:/.test(value) ||
    value.startsWith('\\') ||
    /^\.\.?[\\/]/.test(value) ||
    value.startsWith('~') ||
    (/^\//.test(value) && !value.startsWith('//')) ||
    /^\/{3,}/.test(value)
  ) {
    return { kind: 'local' };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { kind: 'invalid' };
  }

  if (parsed.protocol === 'file:') {
    return { kind: 'local' };
  }

  if (parsed.protocol === 'http:') {
    return { kind: 'http' };
  }

  if (parsed.protocol === 'https:') {
    if (!/^https:\/\/[^/\\]/i.test(value)) {
      return { kind: 'invalid' };
    }
    if (
      parsed.username ||
      parsed.password ||
      /^https:\/\/[^/?#\\]*@/i.test(value)
    ) {
      return { kind: 'userinfo' };
    }
    return { kind: 'https', canonical: parsed.href };
  }

  return { kind: 'invalid' };
}

/**
 * Strict postable-URL check for upload results (port of OpenClaw's
 * `strictPostableUrl`). Returns the canonical https URL when postable,
 * otherwise null. The storage backends perform no such validation on their
 * return path, so `tlon upload` runs this before printing.
 */
export function strictPostableUrl(u: string): string | null {
  if (u !== u.trim()) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') {
    return null;
  }
  if (!/^https:\/\/[^/\\]/i.test(u)) {
    return null;
  }
  if (parsed.username || parsed.password || /^https:\/\/[^/?#\\]*@/i.test(u)) {
    return null;
  }
  return parsed.href;
}

export interface ResolvedAddress {
  address: string;
  family: number;
}

export interface GuardedFetchOptions {
  /** Streamed cap on received bytes; never trusts Content-Length. */
  maxBytes: number;
  /** Single wall-clock budget covering every hop and the body read. */
  deadlineMs: number;
  /** Maximum redirects to follow (default 3). */
  maxRedirects?: number;
  /** Reject plain-http hops, including redirect targets (default false). */
  requireHttps?: boolean;
  /** Test seam: trust a fixture CA for local TLS servers. Never set in prod. */
  tlsOptions?: { ca?: string[] };
  /** Test seam: resolver injection. Defaults to `node:dns` lookup. */
  resolveHost?: (hostname: string) => Promise<ResolvedAddress[]>;
  /**
   * Test seam: address policy injection. Defaults to `isAllowedAddress`.
   * Transport tests need to reach a loopback server, which the real policy
   * (correctly) refuses; injecting the policy keeps the rest of the pipeline —
   * resolve-once, pin, connect — exactly as it runs in production.
   */
  allowAddress?: (address: string) => boolean;
}

export interface GuardedFetchResult {
  bytes: Uint8Array;
  finalUrl: string;
  contentType: string | undefined;
}

const DENIED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
]);

const DENIED_HOSTNAME_SUFFIXES = ['.localhost', '.local', '.internal'];

export function isDeniedHostname(hostname: string): boolean {
  const lowered = hostname.toLowerCase().replace(/\.$/, '');
  if (!lowered) {
    return true;
  }
  if (DENIED_HOSTNAMES.has(lowered)) {
    return true;
  }
  return DENIED_HOSTNAME_SUFFIXES.some((suffix) => lowered.endsWith(suffix));
}

function parseIPv4(address: string): [number, number, number, number] | null {
  const parts = address.split('.');
  if (parts.length !== 4) {
    return null;
  }
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const value = Number(part);
    if (value > 255) {
      return null;
    }
    octets.push(value);
  }
  return octets as [number, number, number, number];
}

function isPrivateIPv4(octets: [number, number, number, number]): boolean {
  const [a, b] = octets;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 0 && octets[2] === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 0 && octets[2] === 2) return true; // TEST-NET-1
  if (a === 192 && b === 88 && octets[2] === 99) return true; // 6to4 relay
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && octets[2] === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && octets[2] === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast + reserved (incl. broadcast)
  return false;
}

function parseIPv6Groups(address: string): number[] | null {
  let value = address;
  const zone = value.indexOf('%');
  if (zone !== -1) {
    value = value.slice(0, zone);
  }

  // Embedded-IPv4 tail (::ffff:1.2.3.4 or plain v4-in-v6) expands to groups.
  const lastColon = value.lastIndexOf(':');
  if (lastColon !== -1 && value.slice(lastColon + 1).includes('.')) {
    const v4 = parseIPv4(value.slice(lastColon + 1));
    if (!v4) {
      return null;
    }
    value =
      value.slice(0, lastColon + 1) +
      ((v4[0] << 8) | v4[1]).toString(16) +
      ':' +
      ((v4[2] << 8) | v4[3]).toString(16);
  }

  const halves = value.split('::');
  if (halves.length > 2) {
    return null;
  }
  const parseSide = (side: string): number[] | null => {
    if (side === '') {
      return [];
    }
    const groups: number[] = [];
    for (const piece of side.split(':')) {
      if (!/^[0-9a-f]{1,4}$/i.test(piece)) {
        return null;
      }
      groups.push(Number.parseInt(piece, 16));
    }
    return groups;
  };
  const head = parseSide(halves[0]);
  const tail = halves.length === 2 ? parseSide(halves[1]) : [];
  if (!head || !tail) {
    return null;
  }
  if (halves.length === 1) {
    return head.length === 8 ? head : null;
  }
  if (head.length + tail.length > 7) {
    return null;
  }
  return [...head, ...Array(8 - head.length - tail.length).fill(0), ...tail];
}

/**
 * Allow-list check for a non-mapped IPv6 address: only global unicast
 * (2000::/3) may be dialed, minus the special-use carve-outs inside it. This
 * is deliberately NOT a denylist — everything outside 2000::/3 (loopback,
 * unspecified, link-local fe80::/10, unique-local fc00::/7, deprecated
 * site-local fec0::/10, IPv4-compatible ::a.b.c.d, NAT64 64:ff9b::,
 * discard-only 100::/64, multicast, and any range assigned in the future) is
 * refused without needing to be named.
 */
function isGlobalUnicastIPv6(groups: number[]): boolean {
  const g0 = groups[0];
  if ((g0 & 0xe000) !== 0x2000) {
    return false; // outside 2000::/3
  }
  if (g0 === 0x2001 && groups[1] === 0x0db8) {
    return false; // 2001:db8::/32 documentation
  }
  if (g0 === 0x2001 && (groups[1] & 0xfe00) === 0) {
    return false; // 2001::/23 IETF protocol assignments (incl. Teredo)
  }
  if (g0 === 0x2002) {
    return false; // 2002::/16 6to4 (embeds an arbitrary IPv4 address)
  }
  if (g0 === 0x3fff && (groups[1] & 0xf000) === 0) {
    return false; // 3fff::/20 documentation (RFC 9637)
  }
  if (g0 === 0x5f00) {
    return false; // 5f00::/16 SRv6 SIDs (RFC 9602, not for general use)
  }
  return true;
}

/**
 * True when an address may be fetched. IPv4 screens against the private/
 * special-use table; IPv6 is allow-listed to global unicast (2000::/3, minus
 * documentation/protocol/6to4 carve-outs), with IPv4-mapped forms screened as
 * the embedded IPv4 address. Anything unparseable fails closed.
 */
export function isAllowedAddress(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) {
    const octets = parseIPv4(address);
    return octets !== null && !isPrivateIPv4(octets);
  }
  if (version === 6) {
    const groups = parseIPv6Groups(address);
    if (!groups) {
      return false;
    }
    // IPv4-mapped (::ffff:a.b.c.d): screen the embedded IPv4 address.
    const mapped =
      groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
    if (mapped) {
      const embedded = `${groups[6] >> 8}.${groups[6] & 0xff}.${groups[7] >> 8}.${groups[7] & 0xff}`;
      const octets = parseIPv4(embedded);
      return octets !== null && !isPrivateIPv4(octets);
    }
    return isGlobalUnicastIPv6(groups);
  }
  return false;
}

async function defaultResolveHost(
  hostname: string
): Promise<ResolvedAddress[]> {
  const bare = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname;
  const literalVersion = net.isIP(bare);
  if (literalVersion !== 0) {
    return [{ address: bare, family: literalVersion }];
  }
  // Not verbatim: let getaddrinfo order results (IPv4 first), so a bot
  // without IPv6 connectivity is not handed an AAAA record as its first
  // dial target for a dual-stack host.
  const results = await dns.promises.lookup(bare, {
    all: true,
    verbatim: false,
  });
  return results.map((entry) => ({
    address: entry.address,
    family: entry.family,
  }));
}

function fetchFailed(): Error {
  return commandError(FETCH_FAILED_ERROR);
}

type HopOutcome =
  | { kind: 'redirect'; location: string }
  | { kind: 'body'; bytes: Uint8Array; contentType: string | undefined };

/**
 * Fail-closed Content-Encoding rule: absent or `identity` proceeds; every
 * other value — gzip, deflate, br, unknown, or stacked — is a fetch failure.
 * We ask for `Accept-Encoding: identity`, so a server that compresses anyway
 * is refused rather than decoded (raw `http.request` streams do not
 * transparently decode the way `fetch` does).
 */
function encodingIsIdentity(contentEncoding: string | undefined): boolean {
  const raw = (contentEncoding ?? '').trim();
  return raw === '' || raw.toLowerCase() === 'identity';
}

/**
 * A response-body source: emits `data`/`end`/`error` (and `aborted` on
 * node:http responses).
 */
type BodySource = EventEmitter;

/**
 * Stream a response body (from either transport) through the fail-closed
 * Content-Encoding rule and the byte cap. On every failure — cap, source
 * error/abort — the source is detached, so an oversized body stops costing
 * anything the moment it is rejected.
 */
function consumeBody(
  source: BodySource,
  contentType: string | undefined,
  contentEncoding: string | undefined,
  options: GuardedFetchOptions,
  succeed: (outcome: HopOutcome) => void,
  fail: () => void
): void {
  if (!encodingIsIdentity(contentEncoding)) {
    fail();
    return;
  }

  const chunks: Buffer[] = [];
  let receivedBytes = 0;
  let done = false;

  const failClosed = (): void => {
    if (done) {
      return;
    }
    done = true;
    source.removeAllListeners('data');
    fail();
  };

  const onData = (chunk: Buffer): void => {
    if (done) {
      return;
    }
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    receivedBytes += buffer.byteLength;
    if (receivedBytes > options.maxBytes) {
      failClosed();
      return;
    }
    chunks.push(buffer);
  };

  const finish = (): void => {
    if (done) {
      return;
    }
    done = true;
    succeed({
      kind: 'body',
      bytes: new Uint8Array(Buffer.concat(chunks)),
      contentType,
    });
  };

  source.on('data', onData);
  source.on('end', finish);
  source.on('error', () => failClosed());
  source.on('aborted', () => failClosed());
}

/**
 * One pinned request attempt against a single validated address, for either
 * scheme. The `lookup` override is the pin: it ignores the hostname it is
 * handed and returns only this attempt's already-validated address, so no
 * second DNS resolve can rebind the hostname between validation and connect.
 * Everything above the socket — TLS identity against the hostname, HTTP/1.1
 * framing, chunked decoding — is the runtime's.
 *
 * Rejects with a `retryNextAddress`-marked error when the request fails
 * before its response callback fires (connection-phase failure); once a
 * response has started, every failure is terminal.
 */
function attemptPinnedRequest(
  target: URL,
  address: ResolvedAddress,
  options: GuardedFetchOptions,
  deadlineAt: number
): Promise<HopOutcome> {
  return new Promise<HopOutcome>((resolve, reject) => {
    type LookupCallback = (
      err: NodeJS.ErrnoException | null,
      address: unknown,
      family?: number
    ) => void;
    const lookup = (
      _hostname: string,
      lookupOptions: object | LookupCallback,
      lookupCallback?: LookupCallback
    ): void => {
      const opts =
        typeof lookupOptions === 'function'
          ? {}
          : (lookupOptions as { all?: boolean });
      const cb =
        typeof lookupOptions === 'function' ? lookupOptions : lookupCallback;
      if (!cb) {
        return;
      }
      if (opts.all) {
        cb(null, [{ address: address.address, family: address.family }]);
        return;
      }
      cb(null, address.address, address.family);
    };

    const isHttps = target.protocol === 'https:';
    const requestOptions: https.RequestOptions = {
      protocol: target.protocol,
      host: target.hostname,
      port: target.port || (isHttps ? 443 : 80),
      path: `${target.pathname || '/'}${target.search || ''}`,
      method: 'GET',
      agent: false,
      lookup: lookup as unknown as http.RequestOptions['lookup'],
      headers: {
        // Keep the byte cap meaningful and the encoding rule decidable; the
        // fail-closed decode rule handles servers that encode anyway.
        'Accept-Encoding': 'identity',
        // Every hop — including same-origin redirects — dials a fresh pinned
        // connection instead of reusing a pooled socket.
        Connection: 'close',
        'User-Agent': 'tlon-cli',
      },
      // Test seam: trust a fixture CA for local TLS servers (never set in
      // prod). Certificate verification otherwise uses the default roots and
      // runs against the hostname, not the pinned address.
      ...(isHttps && options.tlsOptions?.ca
        ? { ca: options.tlsOptions.ca }
        : {}),
    };

    let settled = false;
    let responseStarted = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let activeRequest: http.ClientRequest | undefined;

    const fail = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      activeRequest?.destroy();
      reject(fetchFailed());
    };

    const failRetryable = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      activeRequest?.destroy();
      const error = new Error() as Error & { retryNextAddress: boolean };
      error.retryNextAddress = true;
      reject(error);
    };

    const succeed = (outcome: HopOutcome): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      // A redirect resolves before the connection is done with (a server can
      // trail an unbounded body after the redirect head); tear it down rather
      // than letting it drain outside the cap and deadline.
      activeRequest?.destroy();
      resolve(outcome);
    };

    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) {
      reject(fetchFailed());
      return;
    }

    const transport = isHttps ? https : http;
    const request = transport.request(requestOptions, (response) => {
      responseStarted = true;
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume(); // drain; the connection closes (Connection: close)
        succeed({ kind: 'redirect', location: response.headers.location });
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        fail();
        return;
      }
      consumeBody(
        response,
        response.headers['content-type'],
        response.headers['content-encoding'],
        options,
        succeed,
        fail
      );
    });

    activeRequest = request;
    request.on('error', () => {
      // A failure before any response head arrived (unreachable/refused
      // address, TLS negotiation or identity error against this address) may
      // be address-specific — let the caller try the next validated address.
      // Retrying cannot weaken identity: every attempt runs the same check.
      if (!responseStarted) {
        failRetryable();
        return;
      }
      fail();
    });
    timer = setTimeout(() => fail(), remainingMs);
    request.end();
  });
}

/**
 * One hop, pinned. Validated addresses are tried in order: a connection-phase
 * failure moves to the next address within the deadline; anything after the
 * response has started fails the hop outright — a mid-response retry could
 * observe two different servers.
 */
async function requestPinnedHop(
  target: URL,
  addresses: ResolvedAddress[],
  options: GuardedFetchOptions,
  deadlineAt: number
): Promise<HopOutcome> {
  for (const address of addresses) {
    if (Date.now() >= deadlineAt) {
      break;
    }
    try {
      return await attemptPinnedRequest(target, address, options, deadlineAt);
    } catch (error) {
      if ((error as { retryNextAddress?: boolean }).retryNextAddress) {
        continue;
      }
      throw fetchFailed();
    }
  }
  throw fetchFailed();
}

/**
 * Fetch a canonical media URL under the SSRF guard. Throws the fixed
 * `FETCH_FAILED_ERROR` command error on any failure; underlying errors are
 * discarded (leak invariant: no caller text or resolved addresses in
 * errors/logs).
 */
export async function fetchGuardedMedia(
  canonicalUrl: string,
  options: GuardedFetchOptions
): Promise<GuardedFetchResult> {
  const maxRedirects = options.maxRedirects ?? 3;
  const requireHttps = options.requireHttps ?? false;
  const resolveHost = options.resolveHost ?? defaultResolveHost;
  const allowAddress = options.allowAddress ?? isAllowedAddress;
  const deadlineAt = Date.now() + options.deadlineMs;
  const visited = new Set<string>();

  let currentUrl = canonicalUrl;
  let redirects = 0;

  for (;;) {
    let target: URL;
    try {
      target = new URL(currentUrl);
    } catch {
      throw fetchFailed();
    }
    if (
      target.protocol !== 'https:' &&
      (target.protocol !== 'http:' || requireHttps)
    ) {
      throw fetchFailed();
    }
    if (visited.has(currentUrl)) {
      throw fetchFailed(); // redirect loop
    }
    visited.add(currentUrl);

    if (isDeniedHostname(target.hostname)) {
      throw fetchFailed();
    }

    // The deadline covers DNS too: a slow resolver must surface the fixed
    // fetch error inside the budget, not push the whole command into an outer
    // process timeout. The losing resolve is abandoned (no cancellation API),
    // which is fine — its result is never used.
    const resolveBudgetMs = deadlineAt - Date.now();
    if (resolveBudgetMs <= 0) {
      throw fetchFailed();
    }
    let addresses: ResolvedAddress[];
    let resolveTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      addresses = await Promise.race([
        resolveHost(target.hostname),
        new Promise<never>((_resolve, reject) => {
          resolveTimer = setTimeout(() => reject(new Error()), resolveBudgetMs);
        }),
      ]);
    } catch {
      throw fetchFailed();
    } finally {
      if (resolveTimer) {
        clearTimeout(resolveTimer);
      }
    }
    if (addresses.length === 0) {
      throw fetchFailed();
    }
    for (const entry of addresses) {
      if (!allowAddress(entry.address)) {
        throw fetchFailed();
      }
    }

    let outcome: HopOutcome;
    try {
      outcome = await requestPinnedHop(target, addresses, options, deadlineAt);
    } catch {
      throw fetchFailed();
    }

    if (outcome.kind === 'redirect') {
      redirects += 1;
      if (redirects > maxRedirects) {
        throw fetchFailed();
      }
      let next: URL;
      try {
        // No request headers are forwarded across hops, so there is nothing
        // auth-sensitive to strip cross-origin.
        next = new URL(outcome.location, currentUrl);
      } catch {
        throw fetchFailed();
      }
      currentUrl = next.href;
      continue;
    }

    return {
      bytes: outcome.bytes,
      finalUrl: currentUrl,
      contentType: outcome.contentType,
    };
  }
}
