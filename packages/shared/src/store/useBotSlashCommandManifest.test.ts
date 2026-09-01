import { describe, expect, test } from 'vitest';

import * as db from '../db';
import { getStaticSlashCommandManifest } from '../domain';
import {
  resolveBotManifestShipId,
  resolveGroupChannelBotShipId,
  selectBotSlashCommandManifest,
} from './useBotSlashCommandManifest';

const staticOpenclaw = getStaticSlashCommandManifest('openclaw');
const staticHermes = getStaticSlashCommandManifest('hermes');
const claim = (harness: string) =>
  JSON.stringify({ v: 1, harness, version: '0.1.0' });

const USER = '~sampel-palnet';
const MOON = '~dirmec-dolbes-sampel-palnet';
const OTHER_MOON = '~wicdet-datsyp-sampel-palnet';

const dmChannel = (contactId: string | null) =>
  ({ type: 'dm', contactId, id: contactId ?? '' }) as db.Channel;
const chatChannel = (id = 'chat/~zod/general') =>
  ({ type: 'chat', contactId: null, id }) as db.Channel;
const groupDmChannel = () =>
  ({ type: 'groupDm', contactId: null, id: '0v1abc' }) as db.Channel;

const member = (contactId: string, status?: 'invited' | 'joined') => ({
  contactId,
  status,
});

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

describe('resolveGroupChannelBotShipId', () => {
  test('finds the moon member, sigged/unsigged and mixed-case input', () => {
    const args = { channel: chatChannel(), currentUserId: USER };
    expect(
      resolveGroupChannelBotShipId({
        ...args,
        groupMembers: [member('~zod'), member(MOON)],
      })
    ).toBe(MOON);
    expect(
      resolveGroupChannelBotShipId({
        ...args,
        groupMembers: [member(MOON.replace('~', ''))],
      })
    ).toBe(MOON);
    expect(
      resolveGroupChannelBotShipId({
        ...args,
        groupMembers: [member('~DirmeC-DolbeS-SampeL-PalneT')],
      })
    ).toBe(MOON);
  });

  test('filters members that are only invited', () => {
    expect(
      resolveGroupChannelBotShipId({
        channel: chatChannel(),
        groupMembers: [member(MOON, 'invited')],
        currentUserId: USER,
      })
    ).toBeNull();
    expect(
      resolveGroupChannelBotShipId({
        channel: chatChannel(),
        groupMembers: [member(MOON, 'joined')],
        currentUserId: USER,
      })
    ).toBe(MOON);
  });

  test('rejects non-moon members', () => {
    const args = { channel: chatChannel(), currentUserId: USER };
    // Unrelated planet.
    expect(
      resolveGroupChannelBotShipId({
        ...args,
        groupMembers: [member('~finned-palmer')],
      })
    ).toBeNull();
    // Another ship's moon.
    expect(
      resolveGroupChannelBotShipId({
        ...args,
        groupMembers: [member('~dirmec-dolbes-finned-palmer')],
      })
    ).toBeNull();
    // Comet whose name textually ends with the planet name.
    expect(
      resolveGroupChannelBotShipId({
        ...args,
        groupMembers: [
          member('~racmus-mollen-fallyt-linpex--watres-sibbur-sampel-palnet'),
        ],
      })
    ).toBeNull();
  });

  test('returns null for non-chat channels and missing members', () => {
    const members = [member(MOON)];
    expect(
      resolveGroupChannelBotShipId({
        channel: dmChannel(MOON),
        groupMembers: members,
        currentUserId: USER,
      })
    ).toBeNull();
    expect(
      resolveGroupChannelBotShipId({
        channel: groupDmChannel(),
        groupMembers: members,
        currentUserId: USER,
      })
    ).toBeNull();
    expect(
      resolveGroupChannelBotShipId({
        channel: null,
        groupMembers: members,
        currentUserId: USER,
      })
    ).toBeNull();
    expect(
      resolveGroupChannelBotShipId({
        channel: chatChannel(),
        groupMembers: null,
        currentUserId: USER,
      })
    ).toBeNull();
    expect(
      resolveGroupChannelBotShipId({
        channel: chatChannel(),
        groupMembers: undefined,
        currentUserId: USER,
      })
    ).toBeNull();
    expect(
      resolveGroupChannelBotShipId({
        channel: chatChannel(),
        groupMembers: [],
        currentUserId: USER,
      })
    ).toBeNull();
  });

  test('suppresses when more than one moon qualifies', () => {
    expect(
      resolveGroupChannelBotShipId({
        channel: chatChannel(),
        groupMembers: [member(MOON), member(OTHER_MOON)],
        currentUserId: USER,
      })
    ).toBeNull();
    // An invited second moon does not count: exactly one joined moon remains.
    expect(
      resolveGroupChannelBotShipId({
        channel: chatChannel(),
        groupMembers: [member(MOON), member(OTHER_MOON, 'invited')],
        currentUserId: USER,
      })
    ).toBe(MOON);
  });
});

describe('resolveBotManifestShipId', () => {
  test('DM channels resolve to the counterpart ship', () => {
    expect(resolveBotManifestShipId(dmChannel('~bot'))).toBe('~bot');
  });

  test('chat channels resolve to the group bot ship when one exists', () => {
    expect(resolveBotManifestShipId(chatChannel(), MOON)).toBe(MOON);
  });

  test('chat channels without a qualifying moon resolve to null', () => {
    expect(resolveBotManifestShipId(chatChannel())).toBeNull();
    expect(resolveBotManifestShipId(chatChannel(), null)).toBeNull();
    // No ship to look up, so selection stays on the default list.
    expect(
      selectBotSlashCommandManifest({ enabled: true, botInfo: undefined })
    ).toBe(staticOpenclaw);
  });

  test('group DMs resolve to null', () => {
    expect(resolveBotManifestShipId(groupDmChannel(), MOON)).toBeNull();
  });

  test('null/undefined channels resolve to null', () => {
    expect(resolveBotManifestShipId(null)).toBeNull();
    expect(resolveBotManifestShipId(undefined)).toBeNull();
  });
});
