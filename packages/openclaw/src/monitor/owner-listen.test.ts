import { describe, expect, it } from 'vitest';

import { engagementTokens } from '../commands-registry.js';
import {
  isOwnerListenSlashCommand,
  isRegisteredCommandText,
  nestFromCtxFrom,
  shouldEngageInGroup,
} from './utils.js';

const OWNER = '~zod';
const BOT = '~bus';
const STRANGER = '~nec';
const OWNED_BY_OWNER = 'chat/~zod/general';
const OWNED_BY_BOT = 'chat/~bus/garage';
const STRANGER_HOSTED = 'chat/~nec/lounge';

const ALL_ENGAGEMENT_TOKENS = engagementTokens();

function baseOpts(
  overrides: Partial<Parameters<typeof shouldEngageInGroup>[0]> = {}
) {
  return {
    mentioned: false,
    inParticipatedThread: false,
    isOwnerBlob: false,
    isOwnerCommand: false,
    senderShip: OWNER,
    ownerShip: OWNER,
    botShipName: BOT,
    channelNest: OWNED_BY_OWNER,
    groupHost: OWNER,
    ownerListenEnabled: true,
    ownerListenDisabledChannels: new Set<string>(),
    ...overrides,
  };
}

describe('shouldEngageInGroup', () => {
  it('engages on mention regardless of other inputs', () => {
    const result = shouldEngageInGroup(
      baseOpts({
        mentioned: true,
        ownerListenEnabled: false,
        senderShip: STRANGER,
        groupHost: STRANGER,
      })
    );
    expect(result).toEqual({ engage: true, reason: 'mention' });
  });

  it('engages on participated thread', () => {
    const result = shouldEngageInGroup(
      baseOpts({ inParticipatedThread: true, ownerListenEnabled: false })
    );
    expect(result).toEqual({ engage: true, reason: 'thread' });
  });

  it('engages on owner blob-only message even when listen path off', () => {
    const result = shouldEngageInGroup(
      baseOpts({ isOwnerBlob: true, ownerListenEnabled: false })
    );
    expect(result).toEqual({ engage: true, reason: 'owner-blob' });
  });

  it('engages owner in owner-hosted channel', () => {
    expect(shouldEngageInGroup(baseOpts())).toEqual({
      engage: true,
      reason: 'owner-owned',
    });
  });

  it('engages owner in bot-hosted channel', () => {
    const result = shouldEngageInGroup(
      baseOpts({ channelNest: OWNED_BY_BOT, groupHost: BOT })
    );
    expect(result).toEqual({ engage: true, reason: 'owner-owned' });
  });

  it('skips owner in stranger-hosted channel', () => {
    const result = shouldEngageInGroup(
      baseOpts({ channelNest: STRANGER_HOSTED, groupHost: STRANGER })
    );
    expect(result).toEqual({ engage: false, reason: 'skip' });
  });

  it('skips non-owner in owner-hosted channel', () => {
    const result = shouldEngageInGroup(baseOpts({ senderShip: STRANGER }));
    expect(result).toEqual({ engage: false, reason: 'skip' });
  });

  it('skips owner-owned channel when channel is in disabled set', () => {
    const result = shouldEngageInGroup(
      baseOpts({ ownerListenDisabledChannels: new Set([OWNED_BY_OWNER]) })
    );
    expect(result).toEqual({ engage: false, reason: 'skip' });
  });

  it('kill switch wins: skips owner-owned when global is off', () => {
    expect(
      shouldEngageInGroup(baseOpts({ ownerListenEnabled: false }))
    ).toEqual({
      engage: false,
      reason: 'skip',
    });
  });

  it('skips when ownerShip is not configured', () => {
    expect(shouldEngageInGroup(baseOpts({ ownerShip: null }))).toEqual({
      engage: false,
      reason: 'skip',
    });
  });

  it('skips when groupHost cannot be parsed', () => {
    expect(shouldEngageInGroup(baseOpts({ groupHost: null }))).toEqual({
      engage: false,
      reason: 'skip',
    });
  });

  it('engages owner command in a third-party-hosted channel with listen off and muted', () => {
    const result = shouldEngageInGroup(
      baseOpts({
        isOwnerCommand: true,
        channelNest: STRANGER_HOSTED,
        groupHost: STRANGER,
        ownerListenEnabled: false,
        ownerListenDisabledChannels: new Set([STRANGER_HOSTED]),
      })
    );
    expect(result).toEqual({ engage: true, reason: 'owner-command' });
  });

  it('skips a command-shaped message from a non-owner', () => {
    const result = shouldEngageInGroup(
      baseOpts({
        isOwnerCommand: true,
        senderShip: STRANGER,
        channelNest: STRANGER_HOSTED,
        groupHost: STRANGER,
      })
    );
    expect(result).toEqual({ engage: false, reason: 'skip' });
  });

  it('skips an owner command when no owner is configured', () => {
    const result = shouldEngageInGroup(
      baseOpts({ isOwnerCommand: true, ownerShip: null })
    );
    expect(result).toEqual({ engage: false, reason: 'skip' });
  });

  it('mention precedence is unchanged for command-shaped mentions', () => {
    const result = shouldEngageInGroup(
      baseOpts({ mentioned: true, isOwnerCommand: true })
    );
    expect(result).toEqual({ engage: true, reason: 'mention' });
  });

  it('skips owner non-command text in a third-party channel (existing behavior)', () => {
    const result = shouldEngageInGroup(
      baseOpts({ channelNest: STRANGER_HOSTED, groupHost: STRANGER })
    );
    expect(result).toEqual({ engage: false, reason: 'skip' });
  });
});

describe('isRegisteredCommandText', () => {
  it('matches every registry token and core trio, bare or with args', () => {
    for (const token of ALL_ENGAGEMENT_TOKENS) {
      expect(isRegisteredCommandText(token, ALL_ENGAGEMENT_TOKENS)).toBe(true);
      expect(
        isRegisteredCommandText(`${token} some args`, ALL_ENGAGEMENT_TOKENS)
      ).toBe(true);
    }
  });

  it('is token-boundary safe', () => {
    // /tlon must not match /tlon-version via prefix, and vice versa.
    expect(isRegisteredCommandText('/tlon-version', ['/tlon'])).toBe(false);
    expect(isRegisteredCommandText('/tlon version', ['/tlon-version'])).toBe(
      false
    );
    expect(
      isRegisteredCommandText('/owner-listening on', ['/owner-listen'])
    ).toBe(false);
  });

  it('is case-insensitive and tolerates leading whitespace', () => {
    expect(isRegisteredCommandText('/PENDING', ['/pending'])).toBe(true);
    expect(isRegisteredCommandText('  /Status', ['/status'])).toBe(true);
    expect(isRegisteredCommandText('\t/new fresh start', ['/new'])).toBe(true);
  });

  it('does not match mention-prefixed or mid-text commands', () => {
    expect(isRegisteredCommandText('~bus /pending', ['/pending'])).toBe(false);
    expect(
      isRegisteredCommandText('please run /pending now', ['/pending'])
    ).toBe(false);
  });

  it('does not match near-miss tokens or empty text', () => {
    expect(isRegisteredCommandText('/pendings', ['/pending'])).toBe(false);
    expect(isRegisteredCommandText('pending', ['/pending'])).toBe(false);
    expect(isRegisteredCommandText('', ['/pending'])).toBe(false);
    expect(isRegisteredCommandText('   ', ['/pending'])).toBe(false);
  });
});

describe('isOwnerListenSlashCommand', () => {
  it('matches exact /owner-listen commands with optional args', () => {
    expect(isOwnerListenSlashCommand('/owner-listen')).toBe(true);
    expect(isOwnerListenSlashCommand(' /owner-listen on')).toBe(true);
    expect(isOwnerListenSlashCommand('/OWNER-LISTEN all off')).toBe(true);
  });

  it('does not match mentions or similarly-prefixed commands', () => {
    expect(isOwnerListenSlashCommand('~bus /owner-listen on')).toBe(false);
    expect(isOwnerListenSlashCommand('/owner-listening on')).toBe(false);
    expect(isOwnerListenSlashCommand('hello /owner-listen on')).toBe(false);
  });
});

describe('nestFromCtxFrom', () => {
  it('extracts nest from a tlon group from-header', () => {
    expect(nestFromCtxFrom('tlon:group:chat/~zod/general')).toBe(
      'chat/~zod/general'
    );
  });

  it('returns null for DM from-header', () => {
    expect(nestFromCtxFrom('tlon:~zod')).toBeNull();
  });

  it('returns null for empty/missing input', () => {
    expect(nestFromCtxFrom(undefined)).toBeNull();
    expect(nestFromCtxFrom(null)).toBeNull();
    expect(nestFromCtxFrom('')).toBeNull();
  });
});
