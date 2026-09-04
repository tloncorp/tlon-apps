import { describe, expect, it } from 'vitest';

import {
  ENFORCE_HOST_CSP,
  FRAME_SRC_SOURCES,
  HOST_CSP_POLICY,
  hostCspDevHeaders,
  hostCspPlugin,
} from './hostCsp';

/**
 * What the FLAG does, as opposed to what the POLICY does.
 *
 * sandbox-posture/navigation.spec.ts measures the policy — that
 * HOST_CSP_POLICY, delivered as a `<meta>`, refuses a self-navigating
 * sandbox frame on three engines. It builds its own host pages, so it
 * cannot see ENFORCE_HOST_CSP at all.
 *
 * This file covers the other half: that the flag is wired to the only
 * production delivery there is, that the policy stays the one narrow
 * directive it claims to be, and that whichever way the flag is set the
 * page ends up under exactly ONE policy — never an enforcing header,
 * never a meta and a header at once. Those are the three ways this
 * mechanism could quietly stop being what its documentation says it is.
 */

type TransformResult = {
  tags: { tag: string; attrs: Record<string, string>; injectTo: string }[];
};

function injectedTags(html: string) {
  const plugin = hostCspPlugin();
  const transform = plugin.transformIndexHtml;
  if (typeof transform === 'function' || !transform) {
    throw new Error('expected an object-form transformIndexHtml hook');
  }
  const handler = transform.handler;
  const result = handler.call(null as never, html, null as never) as
    | string
    | TransformResult;
  return typeof result === 'string' ? [] : result.tags;
}

describe('HOST_CSP_POLICY', () => {
  it('is exactly one directive', () => {
    // the narrowness IS the safety argument: a second directive would
    // govern something no experiment measured. A `;` here means someone
    // added one.
    expect(HOST_CSP_POLICY).not.toContain(';');
    expect(HOST_CSP_POLICY.split(/\s+/)[0]).toBe('frame-src');
  });

  it('is built from FRAME_SRC_SOURCES and nothing else', () => {
    expect(HOST_CSP_POLICY).toBe(`frame-src ${FRAME_SRC_SOURCES.join(' ')}`);
  });
});

describe('hostCspPlugin', () => {
  const html = '<!doctype html><html><head></head><body></body></html>';

  it('injects the enforcing meta only when ENFORCE_HOST_CSP is on', () => {
    const tags = injectedTags(html);

    if (ENFORCE_HOST_CSP) {
      expect(tags).toEqual([
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: HOST_CSP_POLICY,
          },
          injectTo: 'head-prepend',
        },
      ]);
    } else {
      // off means OFF: the shipped glob carries no policy at all, so a
      // build cannot half-enforce
      expect(tags).toEqual([]);
    }
  });

  it('never injects Report-Only, which a meta tag cannot carry', () => {
    // CSP3 §3.3. A Report-Only meta is ignored by every engine, so
    // injecting one would look like validation and do nothing.
    const attrs = injectedTags(html).map((tag) => tag.attrs['http-equiv']);
    expect(attrs).not.toContain('Content-Security-Policy-Report-Only');
  });
});

describe('hostCspDevHeaders', () => {
  it('never sends an ENFORCING header', () => {
    // an enforcing header could not be delivered in production — the glob
    // serves `content-type` alone — so it would be a posture dev has and
    // production does not, which is the opposite of what these servers
    // are for
    expect(Object.keys(hostCspDevHeaders)).not.toContain(
      'Content-Security-Policy'
    );
  });

  it('carries exactly one policy, counting the injected meta', () => {
    // two policies refusing the same frame means two
    // SecurityPolicyViolationEvents for one fact, which would spend two of
    // the listener's five bounded events and make dev diverge from
    // production
    const metaPolicies = injectedTags(
      '<!doctype html><html><head></head><body></body></html>'
    ).length;
    const headerPolicies = Object.keys(hostCspDevHeaders).length;
    expect(metaPolicies + headerPolicies).toBe(1);

    if (ENFORCE_HOST_CSP) {
      expect(hostCspDevHeaders).toEqual({});
    } else {
      expect(hostCspDevHeaders).toEqual({
        'Content-Security-Policy-Report-Only': HOST_CSP_POLICY,
      });
    }
  });
});
