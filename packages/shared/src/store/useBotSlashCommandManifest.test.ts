import { describe, expect, test } from 'vitest';

import * as db from '../db';
import { getStaticSlashCommandManifest } from '../domain';
import {
  resolveBotManifestShipId,
  selectBotSlashCommandManifest,
  shouldBackfillBotCommands,
} from './useBotSlashCommandManifest';

const staticOpenclaw = getStaticSlashCommandManifest('openclaw');
const manifestJson = JSON.stringify({
  v: 1,
  commands: [
    { command: '/allow', title: 'Allow' },
    { command: '/pending', title: 'Pending' },
  ],
});

const dmChannel = (contactId: string | null) =>
  ({ type: 'dm', contactId, id: contactId ?? '' }) as db.Channel;
const homeGroupChatChannel = () =>
  ({
    type: 'chat',
    contactId: null,
    id: 'chat/~zod/home-group-chat',
  }) as db.Channel;

describe('selectBotSlashCommandManifest', () => {
  test('prefers the advertised manifest', () => {
    const manifest = selectBotSlashCommandManifest({
      enabled: true,
      botCommands: manifestJson,
    });
    expect(manifest?.commands.map((c) => c.command)).toEqual([
      '/allow',
      '/pending',
    ]);
    expect(manifest?.agent).toBeUndefined();
  });

  test('falls back to the static list when no manifest is stored', () => {
    expect(
      selectBotSlashCommandManifest({ enabled: true, botCommands: null })
    ).toBe(staticOpenclaw);
    expect(
      selectBotSlashCommandManifest({ enabled: true, botCommands: undefined })
    ).toBe(staticOpenclaw);
  });

  test('falls back to the static list when the manifest is invalid', () => {
    expect(
      selectBotSlashCommandManifest({
        enabled: true,
        botCommands: 'not-json',
      })
    ).toBe(staticOpenclaw);
    expect(
      selectBotSlashCommandManifest({
        enabled: true,
        botCommands: JSON.stringify({ v: 2, commands: [] }),
      })
    ).toBe(staticOpenclaw);
  });

  test('returns null when slash commands are not enabled', () => {
    expect(
      selectBotSlashCommandManifest({
        enabled: false,
        botCommands: manifestJson,
      })
    ).toBeNull();
  });
});

describe('resolveBotManifestShipId', () => {
  test('DM channels resolve to the counterpart ship', () => {
    expect(resolveBotManifestShipId(dmChannel('~bot'))).toBe('~bot');
  });

  test('home-group chat (a group channel) resolves to null: static fallback', () => {
    expect(resolveBotManifestShipId(homeGroupChatChannel())).toBeNull();
    // No ship to look up, so selection stays on the static list.
    expect(
      selectBotSlashCommandManifest({ enabled: true, botCommands: undefined })
    ).toBe(staticOpenclaw);
  });

  test('null/undefined channels resolve to null', () => {
    expect(resolveBotManifestShipId(null)).toBeNull();
    expect(resolveBotManifestShipId(undefined)).toBeNull();
  });
});

describe('shouldBackfillBotCommands', () => {
  const base = {
    enabled: true,
    botShipId: '~bot',
    contactQuerySettled: true,
    hasAdvertisedManifest: false,
  };

  test('fires once the contact query settled without a manifest', () => {
    expect(shouldBackfillBotCommands(base)).toBe(true);
  });

  test('does not fire while the contact query is still loading', () => {
    expect(
      shouldBackfillBotCommands({ ...base, contactQuerySettled: false })
    ).toBe(false);
  });

  test('does not fire when a manifest is already present', () => {
    expect(
      shouldBackfillBotCommands({ ...base, hasAdvertisedManifest: true })
    ).toBe(false);
  });

  test('does not fire when the channel is not bot-enabled', () => {
    expect(shouldBackfillBotCommands({ ...base, enabled: false })).toBe(false);
  });

  test('does not fire without a bot ship to fetch (home-group chat)', () => {
    expect(shouldBackfillBotCommands({ ...base, botShipId: null })).toBe(false);
  });
});
