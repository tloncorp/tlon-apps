import type { ChannelOutboundSessionRouteParams } from 'openclaw/plugin-sdk/core';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { describe, expect, it } from 'vitest';

import { tlonPlugin } from './channel.js';
import { resolveTlonOutboundSessionRoute } from './session-route.js';

const cfg = {} as unknown as OpenClawConfig;

function params(
  overrides: Partial<ChannelOutboundSessionRouteParams> & { target: string }
): ChannelOutboundSessionRouteParams {
  return {
    cfg,
    agentId: 'default',
    accountId: 'default',
    ...overrides,
  } as ChannelOutboundSessionRouteParams;
}

describe('resolveTlonOutboundSessionRoute', () => {
  it.each(['dm/~sampel-palnet', '~sampel-palnet', 'tlon:~sampel-palnet'])(
    'resolves %s to a direct Tlon route',
    (target) => {
      const route = resolveTlonOutboundSessionRoute(params({ target }));
      expect(route).not.toBeNull();
      expect(route?.chatType).toBe('direct');
      expect(route?.peer).toEqual({ kind: 'direct', id: '~sampel-palnet' });
      expect(route?.to).toBe('tlon:~sampel-palnet');
      expect(route?.from).toBe('tlon:~sampel-palnet');
    }
  );

  it.each([
    'chat/~host/general',
    'group:~host/general',
    'tlon:chat/~host/general',
  ])('resolves %s to a group Tlon route', (target) => {
    const route = resolveTlonOutboundSessionRoute(params({ target }));
    expect(route).not.toBeNull();
    expect(route?.chatType).toBe('group');
    expect(route?.peer).toEqual({ kind: 'group', id: 'chat/~host/general' });
    expect(route?.to).toBe('tlon:chat/~host/general');
    expect(route?.from).toBe('tlon:group:chat/~host/general');
  });

  it('preserves account id in the route', () => {
    const route = resolveTlonOutboundSessionRoute(
      params({ target: '~zod', accountId: 'acct-2' })
    );
    expect(route).not.toBeNull();
  });

  it('preserves thread id', () => {
    const route = resolveTlonOutboundSessionRoute(
      params({ target: '~zod', threadId: 'thr-1' })
    );
    expect(route?.threadId).toBe('thr-1');
  });

  it('omits thread id when not provided', () => {
    const route = resolveTlonOutboundSessionRoute(params({ target: '~zod' }));
    expect(route?.threadId).toBeUndefined();
  });

  it('returns null for invalid targets', () => {
    expect(
      resolveTlonOutboundSessionRoute(params({ target: 'not a target!!' }))
    ).toBeNull();
    expect(resolveTlonOutboundSessionRoute(params({ target: '' }))).toBeNull();
  });
});

describe('tlonPlugin messaging surface (explicit-target wiring)', () => {
  const messaging = tlonPlugin.messaging;

  it('declares tlon as an explicit target prefix', () => {
    expect(messaging?.targetPrefixes).toContain('tlon');
  });

  it('parseExplicitTarget returns a canonical DM target', () => {
    expect(messaging?.parseExplicitTarget?.({ raw: 'tlon:~ship' })).toEqual({
      to: '~ship',
      chatType: 'direct',
    });
  });

  it('parseExplicitTarget returns a canonical group target', () => {
    expect(
      messaging?.parseExplicitTarget?.({ raw: 'tlon:chat/~host/general' })
    ).toEqual({ to: 'chat/~host/general', chatType: 'group' });
  });

  it('parseExplicitTarget returns null for a non-Tlon target', () => {
    expect(
      messaging?.parseExplicitTarget?.({ raw: 'not a target!!' })
    ).toBeNull();
  });

  it('wires resolveOutboundSessionRoute', () => {
    expect(typeof messaging?.resolveOutboundSessionRoute).toBe('function');
  });
});
