import { describe, expect, test } from 'vitest';

import * as db from '../db';
import { getStaticSlashCommandManifest } from '../domain';
import {
  resolveBotManifestShipId,
  selectBotSlashCommandManifest,
} from './useBotSlashCommandManifest';

const staticOpenclaw = getStaticSlashCommandManifest('openclaw');
const staticHermes = getStaticSlashCommandManifest('hermes');
const claim = (harness: string) =>
  JSON.stringify({ v: 1, harness, version: '0.1.0' });

const dmChannel = (contactId: string | null) =>
  ({ type: 'dm', contactId, id: contactId ?? '' }) as db.Channel;
const homeGroupChatChannel = () =>
  ({
    type: 'chat',
    contactId: null,
    id: 'chat/~zod/home-group-chat',
  }) as db.Channel;

describe('selectBotSlashCommandManifest', () => {
  test("the claimed harness selects that harness's list", () => {
    expect(
      selectBotSlashCommandManifest({ enabled: true, botInfo: claim('hermes') })
    ).toBe(staticHermes);
    expect(
      selectBotSlashCommandManifest({
        enabled: true,
        botInfo: claim('openclaw'),
      })
    ).toBe(staticOpenclaw);
  });

  test('falls back to the openclaw list when no claim is stored', () => {
    expect(
      selectBotSlashCommandManifest({ enabled: true, botInfo: null })
    ).toBe(staticOpenclaw);
    expect(
      selectBotSlashCommandManifest({ enabled: true, botInfo: undefined })
    ).toBe(staticOpenclaw);
  });

  test('falls back when the claim is invalid or names an unknown harness', () => {
    expect(
      selectBotSlashCommandManifest({ enabled: true, botInfo: 'not-json' })
    ).toBe(staticOpenclaw);
    expect(
      selectBotSlashCommandManifest({
        enabled: true,
        botInfo: JSON.stringify({ v: 2, harness: 'hermes', version: '1' }),
      })
    ).toBe(staticOpenclaw);
    expect(
      selectBotSlashCommandManifest({
        enabled: true,
        botInfo: claim('third-party-bot'),
      })
    ).toBe(staticOpenclaw);
  });

  test('returns null when slash commands are not enabled', () => {
    expect(
      selectBotSlashCommandManifest({
        enabled: false,
        botInfo: claim('hermes'),
      })
    ).toBeNull();
  });
});

describe('resolveBotManifestShipId', () => {
  test('DM channels resolve to the counterpart ship', () => {
    expect(resolveBotManifestShipId(dmChannel('~bot'))).toBe('~bot');
  });

  test('home-group chat (a group channel) resolves to null: default list', () => {
    expect(resolveBotManifestShipId(homeGroupChatChannel())).toBeNull();
    // No ship to look up, so selection stays on the default list.
    expect(
      selectBotSlashCommandManifest({ enabled: true, botInfo: undefined })
    ).toBe(staticOpenclaw);
  });

  test('null/undefined channels resolve to null', () => {
    expect(resolveBotManifestShipId(null)).toBeNull();
    expect(resolveBotManifestShipId(undefined)).toBeNull();
  });
});
