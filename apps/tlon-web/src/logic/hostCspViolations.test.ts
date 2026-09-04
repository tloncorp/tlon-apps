import { describe, expect, it } from 'vitest';

import { HOST_CSP_POLICY } from '../../hostCsp';
import {
  HOST_CSP_VIOLATION_BOUND,
  HOST_CSP_VIOLATION_EVENT,
  type HostCspViolationLike,
  createHostCspViolationCollector,
  sanitizeBlockedUri,
} from './hostCspViolations';

/**
 * The collector is deliberately a pure function of a structural
 * `SecurityPolicyViolationEvent` subset, so the two properties that
 * matter — it never passes attacker-chosen text through, and it is
 * bounded — can be asserted without a DOM and without an engine.
 *
 * The engine-level half of the same claim (a REAL Report-Only violation,
 * collected exactly once) is e2e/host-csp.spec.ts. Both are needed:
 * engines pre-strip a cross-origin `blockedURI` to its origin, so only a
 * synthetic event can prove this module would drop a path and query that
 * an engine DID hand it.
 */

function violation(
  overrides: Partial<HostCspViolationLike> = {}
): HostCspViolationLike {
  return {
    blockedURI: 'https://attacker.example/',
    disposition: 'report',
    effectiveDirective: 'frame-src',
    violatedDirective: 'frame-src',
    originalPolicy: HOST_CSP_POLICY,
    ...overrides,
  };
}

function collectorWithSpy() {
  const captured: { name: string; properties: Record<string, unknown> }[] = [];
  const collector = createHostCspViolationCollector((name, properties) => {
    captured.push({ name, properties });
  });
  return { collector, captured };
}

describe('sanitizeBlockedUri', () => {
  it('never carries the path, query or fragment of a blocked URL', () => {
    const marker = 'SEKRIT-PAYLOAD-9f3a';
    const sanitized = sanitizeBlockedUri(
      `https://attacker.example/steal/${marker}?token=${marker}#${marker}`
    );

    expect(JSON.stringify(sanitized)).not.toContain(marker);
    expect(sanitized).toMatchObject({
      kind: 'origin',
      scheme: 'https',
      host: 'attacker.example',
      hostTruncated: false,
      hostRewritten: false,
    });
    expect(sanitized.hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('truncates an over-long host and says so', () => {
    const host = `${'a'.repeat(200)}.example`;
    const sanitized = sanitizeBlockedUri(`https://${host}/`);

    expect(sanitized.hostTruncated).toBe(true);
    expect(sanitized.host.length).toBe(64);
    expect(host.startsWith(sanitized.host)).toBe(true);
  });

  it('rewrites characters a hostname cannot contain, and says so', () => {
    // percent-encoding survives URL parsing in the host of a non-special
    // scheme, which is the shape that would otherwise smuggle punctuation
    const sanitized = sanitizeBlockedUri('weird://a%20b%2Cc/');

    expect(sanitized.hostRewritten).toBe(true);
    expect(sanitized.host).not.toContain('%');
    expect(sanitized.scheme).toBe('other');
  });

  it('reports keyword and unparseable blockedURI values without inventing a host', () => {
    expect(sanitizeBlockedUri('inline')).toMatchObject({
      kind: 'keyword',
      scheme: 'inline',
      host: '',
    });
    expect(sanitizeBlockedUri('')).toMatchObject({
      kind: 'keyword',
      scheme: 'empty',
      host: '',
    });
    expect(sanitizeBlockedUri('not a url at all')).toMatchObject({
      kind: 'unparseable',
      scheme: 'unparseable',
      host: '',
    });
    expect(sanitizeBlockedUri(undefined)).toMatchObject({ kind: 'keyword' });
  });

  it('gives the same hash to the same URL and a different one otherwise', () => {
    const a = sanitizeBlockedUri('https://attacker.example/one');
    const b = sanitizeBlockedUri('https://attacker.example/one');
    const c = sanitizeBlockedUri('https://attacker.example/two');

    expect(a.hash).toBe(b.hash);
    expect(a.hash).not.toBe(c.hash);
    // ...and the two different URLs are the same ORIGIN, which is what
    // makes the hash the dedupe key rather than the host
    expect(a.host).toBe(c.host);
  });
});

describe('createHostCspViolationCollector', () => {
  it('emits exactly one event for a violation repeated in a loop', () => {
    const { collector, captured } = collectorWithSpy();

    for (let i = 0; i < 500; i += 1) {
      collector.handle(violation());
    }

    expect(captured).toHaveLength(1);
    expect(captured[0].name).toBe(HOST_CSP_VIOLATION_EVENT);
    expect(collector.snapshot()).toMatchObject({
      emitted: 1,
      dropped: 499,
      bound: HOST_CSP_VIOLATION_BOUND,
    });
  });

  it('stops at the bound when every violation is distinct', () => {
    const { collector, captured } = collectorWithSpy();

    for (let i = 0; i < 500; i += 1) {
      collector.handle(
        violation({ blockedURI: `https://attacker-${i}.example/` })
      );
    }

    expect(captured).toHaveLength(HOST_CSP_VIOLATION_BOUND);
    expect(collector.snapshot()).toMatchObject({
      emitted: HOST_CSP_VIOLATION_BOUND,
      dropped: 500 - HOST_CSP_VIOLATION_BOUND,
    });
    expect(collector.snapshot().records.map((r) => r.seq)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it('puts only enumerated values into telemetry', () => {
    const { collector, captured } = collectorWithSpy();

    collector.handle(
      violation({
        disposition: 'something the engine made up',
        effectiveDirective: 'img-src',
        originalPolicy: "default-src 'none'; frame-src 'self'",
        blockedURI: 'https://attacker.example/steal?token=abc',
      })
    );

    expect(captured[0].properties).toEqual({
      seq: 1,
      directive: 'other',
      disposition: 'unknown',
      policy: 'other',
      blockedKind: 'origin',
      blockedScheme: 'https',
      blockedHost: 'attacker.example',
      blockedHostTruncated: false,
      blockedHostRewritten: false,
      blockedUriHash: expect.stringMatching(/^[0-9a-f]{8}$/),
      enforcing: expect.any(Boolean),
      bound: HOST_CSP_VIOLATION_BOUND,
    });
  });

  it('recognises the shipped policy and the directive it carries', () => {
    const { collector, captured } = collectorWithSpy();

    collector.handle(violation({ disposition: 'enforce' }));

    expect(captured[0].properties).toMatchObject({
      directive: 'frame-src',
      disposition: 'enforce',
      policy: 'host-frame-src',
    });
  });

  it('reads violatedDirective when the engine spells it as a whole directive', () => {
    const { collector, captured } = collectorWithSpy();

    collector.handle(
      violation({
        effectiveDirective: undefined,
        violatedDirective: "frame-src 'self' https://tlon.network",
      })
    );

    expect(captured[0].properties).toMatchObject({ directive: 'frame-src' });
  });
});
