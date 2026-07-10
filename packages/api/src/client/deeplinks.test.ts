import { afterEach, describe, expect, test } from 'vitest';

import { getMetadataFromInviteToken, parseInviteDeepLink } from './deeplinks';

const options = {
  branchDomain: 'custom.branch.test',
  appLinkDomains: ['example.app.link'],
};

describe('parseInviteDeepLink', () => {
  test('parses single-segment invite tokens from invite domains', () => {
    expect(parseInviteDeepLink('https://join.tlon.io/0vabc', options)).toEqual({
      type: 'lure',
      token: '0vabc',
    });
    expect(parseInviteDeepLink('invite.tlon.io/0vxyz', options)).toEqual({
      type: 'lure',
      token: '0vxyz',
    });
    expect(
      parseInviteDeepLink('https://serverless-infra.vercel.app/0vabc', options)
    ).toEqual({
      type: 'lure',
      token: '0vabc',
    });
  });

  test('parses legacy multi-segment invite tokens', () => {
    expect(
      parseInviteDeepLink('https://join.tlon.io/~zod/team', options)
    ).toEqual({
      type: 'lure',
      token: '~zod/team',
    });
  });

  test('parses app.link and configured Branch domains', () => {
    expect(
      parseInviteDeepLink('https://example.app.link/0vabc', options)
    ).toEqual({
      type: 'lure',
      token: '0vabc',
    });
    expect(
      parseInviteDeepLink('https://custom.branch.test/0vabc', options)
    ).toEqual({
      type: 'lure',
      token: '0vabc',
    });
  });

  test('parses fallback tlon.network lure links', () => {
    expect(
      parseInviteDeepLink('https://tlon.network/lure/~zod/team', options)
    ).toEqual({
      type: 'lure',
      token: '~zod/team',
    });
  });

  test('maps dm aliases to wer paths', () => {
    expect(
      parseInviteDeepLink('https://join.tlon.io/dm-~zod', options)
    ).toEqual({
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
    expect(
      parseInviteDeepLink('https://example.com/0vabc', options)
    ).toBeNull();
    expect(
      parseInviteDeepLink('https://join.tlon.io/not-a-token', options)
    ).toBeNull();
  });
});

describe('getMetadataFromInviteToken', () => {
  const realFetch = globalThis.fetch;

  const stubProvider = (fields: Record<string, string>) => {
    // getConstants reads window[tlonEnv] and references window bare, which
    // only exists in app runtimes
    (globalThis as any).window = {
      tlonEnv: {
        INVITE_PROVIDER: 'https://provider.test',
        BRANCH_DOMAIN: 'join.tlon.io',
        BRANCH_KEY: 'key',
      },
    };
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ fields }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;
  };

  afterEach(() => {
    globalThis.fetch = realFetch;
    delete (globalThis as any).window;
  });

  test('accepts personal invites minted with an empty invitedGroupId', async () => {
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
    (globalThis as any).window = {
      tlonEnv: {
        INVITE_PROVIDER: 'https://provider.test',
        BRANCH_DOMAIN: 'join.tlon.io',
        BRANCH_KEY: 'key',
      },
    };
    globalThis.fetch = (async () =>
      new Response('not found', { status: 404 })) as typeof fetch;

    const invite = await getMetadataFromInviteToken('~zod/gardening');
    expect(invite?.inviterUserId).toBe('~zod');
    expect(invite?.invitedGroupId).toBe('~zod/gardening');

    expect(await getMetadataFromInviteToken('0vplain')).toBeNull();
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
