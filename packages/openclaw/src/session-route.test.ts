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

describe('tlonPlugin messaging surface (target-resolver wiring)', () => {
  const messaging = tlonPlugin.messaging;

  it('declares tlon as an explicit target prefix', () => {
    expect(messaging?.targetPrefixes).toContain('tlon');
  });

  it('normalizes and classifies a canonical DM target', async () => {
    expect(messaging?.normalizeTarget?.('tlon:~ship')).toBe('~ship');
    expect(messaging?.inferTargetChatType?.({ to: '~ship' })).toBe('direct');
    await expect(
      messaging?.targetResolver?.resolveTarget?.({
        cfg,
        accountId: 'default',
        input: 'tlon:~ship',
        normalized: '~ship',
        preferredKind: 'user',
      })
    ).resolves.toMatchObject({ to: '~ship', kind: 'user' });
  });

  it('normalizes and classifies a canonical group target', async () => {
    const target = 'chat/~host/general';
    expect(messaging?.normalizeTarget?.(`tlon:${target}`)).toBe(target);
    expect(messaging?.inferTargetChatType?.({ to: target })).toBe('group');
    await expect(
      messaging?.targetResolver?.resolveTarget?.({
        cfg,
        accountId: 'default',
        input: `tlon:${target}`,
        normalized: target,
        preferredKind: 'group',
      })
    ).resolves.toMatchObject({ to: target, kind: 'group' });
  });

  it('rejects a non-Tlon target', async () => {
    expect(messaging?.targetResolver?.looksLikeId?.('not a target!!')).toBe(
      false
    );
    await expect(
      messaging?.targetResolver?.resolveTarget?.({
        cfg,
        accountId: 'default',
        input: 'not a target!!',
        normalized: 'not a target!!',
      })
    ).resolves.toBeNull();
  });

  it('wires resolveOutboundSessionRoute', () => {
    expect(typeof messaging?.resolveOutboundSessionRoute).toBe('function');
  });
});
