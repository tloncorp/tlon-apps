import * as api from '@tloncorp/api';
import { useMemo } from 'react';

import * as db from '../db';
import * as domain from '../domain';
import { useChannelHasBotPost, useContact } from './dbHooks';

// Which group-channel member is the user's bot, per the membership signal:
// a joined (not merely invited) member that is a moon of the user. Returns
// the member's ship — lowercase, sigged, the exact key the contact lookup
// uses — iff exactly one member qualifies. Zero or several both resolve to
// null: several owned moons would each answer a bare command, so no command
// has a recipient and the popup is suppressed until disambiguation exists.
export function resolveGroupChannelBotShipId(args: {
  channel?: db.Channel | null;
  // DB relations are optional/nullable; keep the helper structural so tests
  // don't have to build full rows.
  groupMembers?: { contactId: string; status?: string | null }[] | null;
  currentUserId: string;
}): string | null {
  if (args.channel?.type !== 'chat') {
    return null;
  }
  const candidates = (args.groupMembers ?? []).filter(
    (member) =>
      member.status !== 'invited' &&
      api.isMoonOfUser(member.contactId, args.currentUserId)
  );
  if (candidates.length !== 1) {
    return null;
  }
  // isMoonOfUser lowercases only while checking, and preSig alone does not
  // lowercase, so both steps are needed for the exact-equality contact lookup.
  return api.preSig(candidates[0].contactId.toLowerCase());
}

// The bot's identity claim lives on its own contact record. DMs carry the bot
// ship as contactId; a group chat channel resolves the single qualifying moon
// member (resolveGroupChannelBotShipId), or null when there is none — in
// which case selection stays on the default list.
export function resolveBotManifestShipId(
  channel?: db.Channel | null,
  groupBotShipId?: string | null
): string | null {
  if (channel?.type === 'dm') {
    return channel.contactId ?? null;
  }
  if (channel?.type === 'chat') {
    return groupBotShipId ?? null;
  }
  return null;
}

// The claimed harness picks the list; an absent, malformed, or unrecognized
// claim gets the OpenClaw list (getStaticSlashCommandManifest's fallback).
export function selectBotSlashCommandManifest(args: {
  enabled: boolean;
  botInfo?: string | null;
}): domain.SlashCommandManifest | null {
  if (!args.enabled) {
    return null;
  }
  return domain.getStaticSlashCommandManifest(
    domain.parseBotInfo(args.botInfo)?.harness
  );
}

// Returns the slash-command manifest for a bot conversation, or null when
// slash commands should not be offered. A channel qualifies when either:
//   - observed: the DM counterpart has sent bot-authored messages here. Bot
//     authorship is self-declared by the sending ship (BotProfile author on the
//     wire) — the same signal that renders the "Bot" tag on messages.
//   - structural: the DM counterpart is a moon of the user's ship (hosted
//     `~pinser-botter-*` bots and self-provisioned bots alike), or the group
//     chat channel's member list contains exactly one joined moon of the
//     user's ship. Covers bots that haven't posted yet. Several qualifying
//     moons suppress the popup (a bare command would have no single
//     recipient); the home-group chat qualifies through the same membership
//     signal.
// Which commands are shown: bots publish an identity claim in their contact
// profile (see domain.parseBotInfo and docs/bot-info.md), and the claimed
// harness selects one of the app's static command lists. An unidentified bot
// gets the OpenClaw list.
export const useBotSlashCommandManifest = (
  channel: db.Channel | null | undefined,
  // Required (not optional) so TypeScript forces the call site to thread the
  // group through; the value itself stays nullable.
  group: db.Group | null | undefined
): domain.SlashCommandManifest | null => {
  const currentUserId = api.getCurrentUserId();

  const groupBotShipId = useMemo(
    () =>
      resolveGroupChannelBotShipId({
        channel,
        groupMembers: group?.members,
        currentUserId,
      }),
    [channel, group?.members, currentUserId]
  );

  const isStructuralBotChannel = useMemo(() => {
    if (!channel) {
      return false;
    }
    return (
      api.isMoonOfUser(channel.contactId, currentUserId) || !!groupBotShipId
    );
  }, [channel, currentUserId, groupBotShipId]);

  const isDm = channel?.type === 'dm';
  const { data: hasBotPosts } = useChannelHasBotPost({
    channelId: isDm && !isStructuralBotChannel ? channel?.id : null,
    authorId: isDm && !isStructuralBotChannel ? channel?.contactId : null,
  });

  const enabled = isStructuralBotChannel || (isDm && hasBotPosts === true);

  const botShipId = resolveBotManifestShipId(channel, groupBotShipId);
  const { data: contact } = useContact({
    id: botShipId ?? '',
    enabled: enabled && !!botShipId,
  });

  return useMemo(
    () =>
      selectBotSlashCommandManifest({
        enabled,
        botInfo: contact?.botInfo,
      }),
    [enabled, contact?.botInfo]
  );
};
