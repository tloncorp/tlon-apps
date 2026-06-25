import { describe, expect, it } from 'vitest';

import { extractLensConversation, lensRunMatchesChannel } from './contextLens';

function payload(chatType: string, conversationId?: string, schemaVersion = 1) {
  return {
    schemaVersion,
    lens: {
      chatType,
      triggerDetails: conversationId ? { conversationId } : undefined,
    },
  };
}

describe('extractLensConversation', () => {
  it('returns null for missing or malformed payloads', () => {
    expect(extractLensConversation(null)).toBeNull();
    expect(extractLensConversation(undefined)).toBeNull();
    expect(extractLensConversation('garbage')).toBeNull();
    expect(extractLensConversation({})).toBeNull();
    expect(extractLensConversation({ schemaVersion: 1 })).toBeNull();
  });

  it('returns null for unknown schema versions', () => {
    expect(
      extractLensConversation(payload('channel', 'chat/~zod/general', 2))
    ).toBeNull();
  });

  it('returns null for unknown chat types', () => {
    expect(extractLensConversation(payload('mystery'))).toBeNull();
  });

  it('extracts chat type and conversation id', () => {
    expect(
      extractLensConversation(payload('channel', 'chat/~zod/general'))
    ).toEqual({ chatType: 'channel', conversationId: 'chat/~zod/general' });
    expect(extractLensConversation(payload('dm', '~sampel-palnet'))).toEqual({
      chatType: 'dm',
      conversationId: '~sampel-palnet',
    });
    expect(extractLensConversation(payload('internal'))).toEqual({
      chatType: 'internal',
      conversationId: null,
    });
  });
});

describe('lensRunMatchesChannel', () => {
  it('matches dm runs against the bot DM channel regardless of sig', () => {
    const run = { botShip: 'malmur-halmex', payload: payload('dm', '~zod') };
    expect(lensRunMatchesChannel(run, '~malmur-halmex')).toBe(true);
    const signedRun = {
      botShip: '~malmur-halmex',
      payload: payload('dm', '~zod'),
    };
    expect(lensRunMatchesChannel(signedRun, '~malmur-halmex')).toBe(true);
  });

  it('does not match dm runs against other ships or group channels', () => {
    const run = { botShip: '~malmur-halmex', payload: payload('dm', '~zod') };
    expect(lensRunMatchesChannel(run, '~sampel-palnet')).toBe(false);
    expect(lensRunMatchesChannel(run, 'chat/~zod/general')).toBe(false);
  });

  it('matches channel runs on the trigger nest', () => {
    const run = {
      botShip: '~malmur-halmex',
      payload: payload('channel', 'chat/~zod/general'),
    };
    expect(lensRunMatchesChannel(run, 'chat/~zod/general')).toBe(true);
    expect(lensRunMatchesChannel(run, 'chat/~zod/other')).toBe(false);
    expect(lensRunMatchesChannel(run, '~malmur-halmex')).toBe(false);
  });

  it('excludes internal runs and unparseable payloads', () => {
    expect(
      lensRunMatchesChannel(
        { botShip: '~malmur-halmex', payload: payload('internal') },
        'chat/~zod/general'
      )
    ).toBe(false);
    expect(
      lensRunMatchesChannel(
        { botShip: '~malmur-halmex', payload: null },
        '~malmur-halmex'
      )
    ).toBe(false);
  });
});
