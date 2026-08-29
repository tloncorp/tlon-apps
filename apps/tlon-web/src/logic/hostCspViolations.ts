import { ENFORCE_HOST_CSP, HOST_CSP_POLICY } from '../../hostCsp';

/**
 * Host-page CSP violation telemetry.
 *
 * WHY THIS EXISTS
 *
 * The host-page `frame-src` policy (../../hostCsp.ts) reaches production
 * as a `<meta http-equiv>` injected at build time, because `%docket`
 * serves the glob with `content-type` and nothing else. A `<meta>` policy
 * cannot carry `report-uri` (CSP3 §3.3 forbids it there alongside
 * Report-Only, `frame-ancestors` and `sandbox`), so once the policy
 * enforces, an origin missing from FRAME_SRC_SOURCES does not produce a
 * report anywhere — it produces a feature that silently stops working.
 *
 * `SecurityPolicyViolationEvent` is the only violation signal that
 * survives into that world. It fires on the Document for enforced and
 * Report-Only policies alike, so this one listener is both the
 * production canary and the instrument the Report-Only dev/preview run is
 * measured with.
 *
 * WHAT IT MAY SAY
 *
 * `blockedURI` is derived from a URL that a hostile mini-app bundle chose.
 * Everything here follows from that:
 *
 *   - Only `protocol` and `host` of the blocked URL are ever READ. The
 *     path, query and fragment — where an exfiltration payload would sit —
 *     are not truncated or redacted, they are never looked at. (Engines
 *     already strip a cross-origin `blockedURI` to its origin before
 *     reporting; this does not depend on that.)
 *   - The host is lowercased, restricted to the characters a hostname or
 *     IPv6 literal can contain, and truncated. A rewrite or a truncation
 *     is reported as a flag, so a sanitised value is never mistaken for a
 *     faithful one.
 *   - The scheme is mapped onto a known set, or reported as `other`.
 *   - The disposition and the directive are enums, never the strings the
 *     event carried.
 *   - The full raw `blockedURI` is reduced to a 32-bit FNV-1a hash. It is
 *     a correlation and dedupe token, not a value to read back: it says
 *     "the same URL again" without saying what the URL was.
 *
 * Residual, stated rather than papered over: `blockedHost` is still up to
 * HOST_LABEL_MAX characters a bundle can influence, so the channel into
 * telemetry is not zero. It is bounded — at most
 * HOST_CSP_VIOLATION_BOUND events per page load, so at most
 * HOST_CSP_VIOLATION_BOUND × HOST_LABEL_MAX constrained characters — and
 * it is the field that makes the signal actionable at all: the point of a
 * violation report is to learn WHICH origin nobody allowlisted.
 *
 * HOW MUCH IT MAY SAY
 *
 * A bundle that navigates in a loop would otherwise emit telemetry in a
 * loop. Two independent bounds, checked in this order:
 *
 *   1. a hard cap of HOST_CSP_VIOLATION_BOUND emitted events per page
 *      load. Past it nothing is emitted and nothing is remembered;
 *   2. below the cap, one event per distinct violation. The dedupe set is
 *      only ever added to when an event is emitted, so it inherits the
 *      cap and cannot itself grow without bound.
 *
 * Order matters: deduping first would let a loop of DISTINCT URLs grow
 * the dedupe set forever. Suppressed violations are counted in `dropped`
 * rather than emitted, so an operator reading the page can still tell
 * that suppression happened without that costing another event.
 */

/** PostHog event name. */
export const HOST_CSP_VIOLATION_EVENT = 'Host CSP Violation';

/** Emitted telemetry events per page load. See "HOW MUCH IT MAY SAY". */
export const HOST_CSP_VIOLATION_BOUND = 5;

/** Characters of blocked host kept. Longer hosts are truncated and flagged. */
const HOST_LABEL_MAX = 64;

/**
 * Where the live collector hangs. Under an enforcing `<meta>` policy
 * there is no `report-uri` and no server-side record, so this in-page
 * snapshot is the only thing a support flow or an e2e run can read.
 */
export const HOST_CSP_VIOLATION_GLOBAL = '__hostCspViolations';

export type HostCspDisposition = 'enforce' | 'report' | 'unknown';

export type HostCspBlockedKind = 'origin' | 'keyword' | 'unparseable';

export type HostCspPolicyMatch = 'host-frame-src' | 'other';

/**
 * The structural subset of `SecurityPolicyViolationEvent` this module
 * reads. Everything is `unknown` because every one of these fields is
 * attacker-influenced or engine-divergent, and the normalisers below are
 * the only things allowed to make assumptions about them.
 */
export type HostCspViolationLike = {
  blockedURI?: unknown;
  disposition?: unknown;
  effectiveDirective?: unknown;
  violatedDirective?: unknown;
  originalPolicy?: unknown;
};

export type SanitizedBlockedUri = {
  kind: HostCspBlockedKind;
  scheme: string;
  host: string;
  hostTruncated: boolean;
  hostRewritten: boolean;
  hash: string;
};

export type HostCspViolationRecord = {
  /** 1-based position within this page load's bound */
  seq: number;
  directive: string;
  disposition: HostCspDisposition;
  policy: HostCspPolicyMatch;
  blockedKind: HostCspBlockedKind;
  blockedScheme: string;
  blockedHost: string;
  blockedHostTruncated: boolean;
  blockedHostRewritten: boolean;
  blockedUriHash: string;
  /** whether this build ships the enforcing <meta>, per ENFORCE_HOST_CSP */
  enforcing: boolean;
};

export type HostCspViolationSnapshot = {
  bound: number;
  emitted: number;
  dropped: number;
  enforcing: boolean;
  records: HostCspViolationRecord[];
};

export type HostCspViolationCollector = {
  handle: (event: HostCspViolationLike) => HostCspViolationRecord | null;
  snapshot: () => HostCspViolationSnapshot;
};

/**
 * The telemetry sink, injected rather than imported. This module stays a
 * pure function of a violation event and of hostCsp.ts's constants, so
 * the bound and the sanitisation can be asserted without dragging the
 * PostHog client into a unit environment — and so the one place that
 * decides where violations go is the install site.
 */
export type HostCspViolationCapture = (
  name: string,
  properties: Record<string, unknown>
) => void;

/**
 * Schemes reported as themselves. Anything else becomes `other` rather
 * than putting an unbounded scheme token into telemetry.
 */
const KNOWN_SCHEMES = new Set([
  'http',
  'https',
  'ws',
  'wss',
  'data',
  'blob',
  'file',
  'filesystem',
  'about',
  'javascript',
]);

/**
 * `blockedURI` is not always a URL. CSP reports these bare keywords, and
 * the empty string, for violations that have no URL to report.
 */
const BLOCKED_URI_KEYWORDS = new Set([
  '',
  'inline',
  'eval',
  'self',
  'data',
  'blob',
  'wasm-eval',
  'trusted-types-policy',
  'trusted-types-sink',
]);

/**
 * Directives reported as themselves. The shipped policy has exactly one
 * (`frame-src`), and `child-src`/`default-src` are the two an engine may
 * name as the fallback that actually matched.
 */
const KNOWN_DIRECTIVES = new Set(['frame-src', 'child-src', 'default-src']);

/**
 * FNV-1a, 32-bit, over UTF-16 code units a byte at a time. Not a
 * cryptographic hash and not used as one: it exists so two violations can
 * be compared without either being read.
 */
function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    const unit = input.charCodeAt(i);
    hash = Math.imul(hash ^ (unit & 0xff), 0x01000193);
    hash = Math.imul(hash ^ ((unit >>> 8) & 0xff), 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function sanitizeBlockedUri(raw: unknown): SanitizedBlockedUri {
  const value = typeof raw === 'string' ? raw : '';
  const hash = fnv1a32(value);

  if (BLOCKED_URI_KEYWORDS.has(value)) {
    return {
      kind: 'keyword',
      scheme: value === '' ? 'empty' : value,
      host: '',
      hostTruncated: false,
      hostRewritten: false,
      hash,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return {
      kind: 'unparseable',
      scheme: 'unparseable',
      host: '',
      hostTruncated: false,
      hostRewritten: false,
      hash,
    };
  }

  // `protocol` and `host` are the only members read. `pathname`,
  // `search` and `hash` are where a payload would be, and nothing below
  // can reach them.
  const scheme = parsed.protocol.replace(/:$/, '').toLowerCase();
  const rawHost = parsed.host.toLowerCase();
  const rewritten = rawHost.replace(/[^a-z0-9.:[\]-]/g, '*');
  const truncated = rewritten.length > HOST_LABEL_MAX;

  return {
    kind: 'origin',
    scheme: KNOWN_SCHEMES.has(scheme) ? scheme : 'other',
    host: truncated ? rewritten.slice(0, HOST_LABEL_MAX) : rewritten,
    hostTruncated: truncated,
    hostRewritten: rewritten !== rawHost,
    hash,
  };
}

export function normalizeDisposition(raw: unknown): HostCspDisposition {
  return raw === 'enforce' || raw === 'report' ? raw : 'unknown';
}

/**
 * `effectiveDirective` is the modern field; some engines populate only
 * `violatedDirective`, and some spell it as the whole directive including
 * its source list. Take the first token of whichever is present, then
 * hold it to the known set.
 */
export function normalizeDirective(event: HostCspViolationLike): string {
  const raw =
    typeof event.effectiveDirective === 'string' && event.effectiveDirective
      ? event.effectiveDirective
      : typeof event.violatedDirective === 'string'
        ? event.violatedDirective
        : '';
  const name = raw.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return KNOWN_DIRECTIVES.has(name) ? name : 'other';
}

/**
 * Whether the policy that fired is the one this app ships. A page can
 * carry policies we did not author (an extension, an embedding host), and
 * those are not evidence about FRAME_SRC_SOURCES.
 */
export function normalizePolicy(raw: unknown): HostCspPolicyMatch {
  return typeof raw === 'string' && raw.trim() === HOST_CSP_POLICY
    ? 'host-frame-src'
    : 'other';
}

export function createHostCspViolationCollector(
  capture: HostCspViolationCapture
): HostCspViolationCollector {
  const records: HostCspViolationRecord[] = [];
  const seen = new Set<string>();
  let emitted = 0;
  let dropped = 0;

  return {
    handle(event) {
      // 1. the hard cap, checked before anything is remembered
      if (emitted >= HOST_CSP_VIOLATION_BOUND) {
        dropped += 1;
        return null;
      }

      const blocked = sanitizeBlockedUri(event.blockedURI);
      const directive = normalizeDirective(event);
      const disposition = normalizeDisposition(event.disposition);
      const policy = normalizePolicy(event.originalPolicy);

      // 2. one event per distinct violation. `seen` only grows on emit,
      //    so it is bounded by the cap above.
      const key = `${directive}|${disposition}|${policy}|${blocked.hash}`;
      if (seen.has(key)) {
        dropped += 1;
        return null;
      }
      seen.add(key);
      emitted += 1;

      const record: HostCspViolationRecord = {
        seq: emitted,
        directive,
        disposition,
        policy,
        blockedKind: blocked.kind,
        blockedScheme: blocked.scheme,
        blockedHost: blocked.host,
        blockedHostTruncated: blocked.hostTruncated,
        blockedHostRewritten: blocked.hostRewritten,
        blockedUriHash: blocked.hash,
        enforcing: ENFORCE_HOST_CSP,
      };
      records.push(record);
      capture(HOST_CSP_VIOLATION_EVENT, {
        ...record,
        bound: HOST_CSP_VIOLATION_BOUND,
      });
      return record;
    },

    snapshot() {
      return {
        bound: HOST_CSP_VIOLATION_BOUND,
        emitted,
        dropped,
        enforcing: ENFORCE_HOST_CSP,
        records: records.slice(),
      };
    },
  };
}

/**
 * Installs the listener and publishes the collector at
 * HOST_CSP_VIOLATION_GLOBAL. Idempotent: a second call (HMR, a double
 * import) returns the collector already installed rather than adding a
 * second listener, which would double every event.
 */
export function installHostCspViolationListener(
  capture: HostCspViolationCapture
): HostCspViolationCollector {
  const host = globalThis as Record<string, unknown>;
  const existing = host[HOST_CSP_VIOLATION_GLOBAL] as
    | HostCspViolationCollector
    | undefined;
  if (existing) {
    return existing;
  }

  const collector = createHostCspViolationCollector(capture);
  host[HOST_CSP_VIOLATION_GLOBAL] = collector;
  document.addEventListener('securitypolicyviolation', (event) => {
    collector.handle(event as SecurityPolicyViolationEvent);
  });
  return collector;
}
