import { describe, expect, test } from 'vitest';

import { parseInviteDeepLink } from './deeplinks';

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
      parseInviteDeepLink(
        'https://serverless-infra-git-db-invite-page-service-tlon.vercel.app/0vabc',
        options
      )
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

  test('ignores unrelated links and malformed tokens', () => {
    expect(
      parseInviteDeepLink('https://example.com/0vabc', options)
    ).toBeNull();
    expect(
      parseInviteDeepLink('https://join.tlon.io/not-a-token', options)
    ).toBeNull();
  });
});
