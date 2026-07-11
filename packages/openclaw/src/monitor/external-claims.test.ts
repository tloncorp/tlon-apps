import { describe, expect, it } from 'vitest';

import { parseExternalClaims } from '../settings.js';
import { findExternalClaim } from './utils.js';

const NOW = 1_700_000_000_000;

const claim = (scope: string, expiresAt = NOW + 60_000) => ({
  scope,
  holder: 'claude-code',
  expiresAt,
});

describe('parseExternalClaims', () => {
  it('parses a JSON string of claims (settings-store format)', () => {
    const value = JSON.stringify([claim('chat/~zod/general')]);
    expect(parseExternalClaims(value)).toEqual([claim('chat/~zod/general')]);
  });

  it('parses a plain array', () => {
    expect(parseExternalClaims([claim('~ten')])).toEqual([claim('~ten')]);
  });

  it('drops malformed entries but keeps valid ones', () => {
    const value = [
      claim('~ten'),
      { scope: 'chat/~zod/general' }, // missing holder/expiresAt
      'not-an-object',
      null,
    ];
    expect(parseExternalClaims(value)).toEqual([claim('~ten')]);
  });

  it('returns undefined for garbage', () => {
    expect(parseExternalClaims('not json')).toBeUndefined();
    expect(parseExternalClaims(42)).toBeUndefined();
    expect(parseExternalClaims(undefined)).toBeUndefined();
  });
});

describe('findExternalClaim', () => {
  it('matches a DM claim by sender ship', () => {
    const claims = [claim('~ten')];
    expect(
      findExternalClaim(
        claims,
        { isGroup: false, senderShip: '~ten' },
        NOW
      )
    ).toEqual(claims[0]);
    expect(
      findExternalClaim(
        claims,
        { isGroup: false, senderShip: 'ten' },
        NOW
      )
    ).toEqual(claims[0]);
  });

  it('matches a channel claim for any message in the channel', () => {
    const claims = [claim('chat/~zod/general')];
    expect(
      findExternalClaim(
        claims,
        {
          isGroup: true,
          channelNest: 'chat/~zod/general',
          senderShip: '~ten',
        },
        NOW
      )
    ).toEqual(claims[0]);
    expect(
      findExternalClaim(
        claims,
        {
          isGroup: true,
          channelNest: 'chat/~zod/general',
          parentId: '170.141.184',
          senderShip: '~ten',
        },
        NOW
      )
    ).toEqual(claims[0]);
  });

  it('matches a thread claim only for replies under that post', () => {
    const claims = [claim('chat/~zod/general/170.141.184')];
    expect(
      findExternalClaim(
        claims,
        {
          isGroup: true,
          channelNest: 'chat/~zod/general',
          parentId: '170141184', // undotted form still matches
          senderShip: '~ten',
        },
        NOW
      )
    ).toEqual(claims[0]);
    expect(
      findExternalClaim(
        claims,
        {
          isGroup: true,
          channelNest: 'chat/~zod/general',
          parentId: '999.999.999',
          senderShip: '~ten',
        },
        NOW
      )
    ).toBeUndefined();
    // Top-level channel messages are not covered by a thread claim.
    expect(
      findExternalClaim(
        claims,
        {
          isGroup: true,
          channelNest: 'chat/~zod/general',
          senderShip: '~ten',
        },
        NOW
      )
    ).toBeUndefined();
  });

  it('ignores expired claims', () => {
    const claims = [claim('~ten', NOW - 1)];
    expect(
      findExternalClaim(
        claims,
        { isGroup: false, senderShip: '~ten' },
        NOW
      )
    ).toBeUndefined();
  });

  it('does not cross-match DMs against channel scopes', () => {
    const claims = [claim('chat/~zod/general')];
    expect(
      findExternalClaim(
        claims,
        { isGroup: false, senderShip: '~ten' },
        NOW
      )
    ).toBeUndefined();
  });
});
