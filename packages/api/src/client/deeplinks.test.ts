import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  extractNormalizedInviteLink,
  getMetadataFromInviteToken,
  inviteUrlFromDeferredPayload,
  parseInviteDeepLink,
} from './deeplinks';

describe('parseInviteDeepLink', () => {
  test('parses single-segment invite tokens from invite domains', () => {
    expect(parseInviteDeepLink('https://join.tlon.io/0vabc')).toEqual({
      type: 'lure',
      token: '0vabc',
    });
    expect(parseInviteDeepLink('invite.tlon.io/0vxyz')).toEqual({
      type: 'lure',
      token: '0vxyz',
    });
    expect(
      parseInviteDeepLink('https://serverless-infra.vercel.app/0vabc')
    ).toEqual({
      type: 'lure',
      token: '0vabc',
    });
  });

  test('rejects paths that are not exact ship/term flags', () => {
    expect(parseInviteDeepLink('https://join.tlon.io/~zod/foo/bar')).toBeNull();
    expect(
      parseInviteDeepLink('https://join.tlon.io/~zod/Bad%20Name')
    ).toBeNull();
  });

  test('parses legacy flag invite tokens', () => {
    expect(parseInviteDeepLink('https://join.tlon.io/~zod/team')).toEqual({
      type: 'lure',
      token: '~zod/team',
    });
  });

  test('parses app.link and configured Branch domains', () => {
    expect(parseInviteDeepLink('https://sa96e.app.link/0vabc')).toEqual({
      type: 'lure',
      token: '0vabc',
    });
    expect(
      parseInviteDeepLink('https://custom.branch.test/0vabc', {
        branchDomain: 'custom.branch.test',
      })
    ).toEqual({
      type: 'lure',
      token: '0vabc',
    });
  });

  test('parses fallback tlon.network lure links', () => {
    expect(parseInviteDeepLink('https://tlon.network/lure/~zod/team')).toEqual({
      type: 'lure',
      token: '~zod/team',
    });
  });

  test('maps dm aliases to wer paths', () => {
    expect(parseInviteDeepLink('https://join.tlon.io/dm-~zod')).toEqual({
      type: 'wer',
      wer: 'dm/~zod',
    });
  });

  test('rejects flag tokens whose ship is not a valid @p', () => {
    expect(
      parseInviteDeepLink('https://join.tlon.io/~not-a-ship/team')
    ).toBeNull();
    expect(parseInviteDeepLink('https://join.tlon.io/~zod/team')).toEqual({
      type: 'lure',
      token: '~zod/team',
    });
  });

  test('ignores unrelated links and malformed tokens', () => {
    expect(parseInviteDeepLink('https://example.com/0vabc')).toBeNull();
    expect(parseInviteDeepLink('https://join.tlon.io/not-a-token')).toBeNull();
  });
});

describe('inviteUrlFromDeferredPayload', () => {
  test('synthesizes urls from raw tokens', () => {
    expect(inviteUrlFromDeferredPayload('0vabcde')).toBe(
      'https://join.tlon.io/0vabcde'
    );
    expect(inviteUrlFromDeferredPayload('~zod/team')).toBe(
      'https://join.tlon.io/~zod/team'
    );
  });

  test('extracts token key-value referrer payloads', () => {
    expect(inviteUrlFromDeferredPayload('token=0vabcde')).toBe(
      'https://join.tlon.io/0vabcde'
    );
    expect(inviteUrlFromDeferredPayload('utm_source=x&token=~zod%2Fteam')).toBe(
      'https://join.tlon.io/~zod/team'
    );
  });

  test('passes through full invite urls', () => {
    expect(inviteUrlFromDeferredPayload('https://join.tlon.io/0vabcde')).toBe(
      'https://join.tlon.io/0vabcde'
    );
    expect(
      inviteUrlFromDeferredPayload('https://invite.tlon.io/~zod/team')
    ).toBe('https://invite.tlon.io/~zod/team');
  });

  test('rejects organic-install noise and arbitrary content', () => {
    expect(
      inviteUrlFromDeferredPayload('utm_source=google-play&utm_medium=organic')
    ).toBeNull();
    expect(inviteUrlFromDeferredPayload('https://example.com/page')).toBeNull();
    expect(inviteUrlFromDeferredPayload('~zod')).toBeNull();
    expect(inviteUrlFromDeferredPayload('')).toBeNull();
  });
});

describe('extractNormalizedInviteLink', () => {
  test('normalizes any accepted invite link to the canonical domain', () => {
    expect(extractNormalizedInviteLink('https://invite.tlon.io/0vabcde')).toBe(
      'https://join.tlon.io/0vabcde'
    );
    expect(
      extractNormalizedInviteLink('https://sa96e.app.link/~zod/team')
    ).toBe('https://join.tlon.io/~zod/team');
    expect(extractNormalizedInviteLink('https://example.com/0vabc')).toBeNull();
  });
});

describe('getMetadataFromInviteToken', () => {
  // getConstants reads window[tlonEnv], which only exists in app runtimes
  const stubEnv = () =>
    vi.stubGlobal('window', {
      tlonEnv: {
        INVITE_PROVIDER: 'https://provider.test',
        BRANCH_DOMAIN: 'join.tlon.io',
        BRANCH_KEY: 'key',
      },
    });

  const stubProvider = (fields: Record<string, string>) => {
    stubEnv();
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ fields }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
    );
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('accepts personal invites, whose metadata has an empty invitedGroupId', async () => {
    stubProvider({
      inviteType: 'user',
      invitedGroupId: '',
      inviterUserId: '~zod',
      inviterNickname: 'Zod',
    });

    const invite = await getMetadataFromInviteToken('0vpersonal');
    expect(invite?.inviterUserId).toBe('~zod');
    expect(invite?.inviteType).toBe('user');
  });

  test('derives flag-style tokens when the provider has no metadata', async () => {
    stubEnv();
    vi.stubGlobal(
      'fetch',
      async () => new Response('not found', { status: 404 })
    );

    const invite = await getMetadataFromInviteToken('~zod/gardening');
    expect(invite?.inviterUserId).toBe('~zod');
    expect(invite?.invitedGroupId).toBe('~zod/gardening');

    expect(await getMetadataFromInviteToken('0vplain')).toBeNull();
    // raw query tokens bypass the parser — the derivation validates itself
    expect(await getMetadataFromInviteToken('~zod/foo/bar')).toBeNull();
    expect(await getMetadataFromInviteToken('not-a-ship/team')).toBeNull();
  });

  test('still rejects group invites without a group id', async () => {
    stubProvider({
      inviteType: 'group',
      invitedGroupId: '',
      inviterUserId: '~zod',
      inviterNickname: 'Zod',
    });

    expect(await getMetadataFromInviteToken('0vgroupless')).toBeNull();
  });
});
