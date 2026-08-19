import * as api from '@tloncorp/api';
import { useEffect, useMemo } from 'react';

import * as db from '../db';
import * as domain from '../domain';
import * as logic from '../logic';
import { ensureBotInfoSynced } from './contactActions';
import { useChannelHasBotPost, useContact } from './dbHooks';
import { useCurrentSession } from './session';

// The bot's identity claim lives on its own contact record. DMs carry the bot
// ship as contactId; the home-group chat is a group channel with no contactId,
// so it keeps the default list until TLON-6301's membership signal identifies
// the moon member.
export function resolveBotManifestShipId(
  channel?: db.Channel | null
): string | null {
  return channel?.type === 'dm' ? channel.contactId ?? null : null;
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

// First-contact backfill fires only once the contact query has settled without
// a usable claim — never on first-render `undefined` while it is still
// loading, which would cause pointless sync traffic for already-cached claims.
export function shouldBackfillBotInfo(args: {
  enabled: boolean;
  botShipId: string | null;
  contactQuerySettled: boolean;
  hasBotInfo: boolean;
}): boolean {
  return (
    args.enabled &&
    !!args.botShipId &&
    args.contactQuerySettled &&
    !args.hasBotInfo
  );
}

// Returns the slash-command manifest for a bot conversation, or null when
// slash commands should not be offered. A channel qualifies when either:
//   - observed: the DM counterpart has sent bot-authored messages here. Bot
//     authorship is self-declared by the sending ship (BotProfile author on the
//     wire) — the same signal that renders the "Bot" tag on messages.
//   - structural: the DM counterpart is a moon of the user's ship (hosted
//     `~pinser-botter-*` bots and self-provisioned bots alike), or the channel
//     is the user's home-group chat. Covers bots that haven't posted yet.
// Which commands are shown: bots publish an identity claim in their contact
// profile (see domain.parseBotInfo and docs/bot-info.md), and the claimed
// harness selects one of the app's static command lists. An unidentified bot
// gets the OpenClaw list.
export const useBotSlashCommandManifest = (
  channel?: db.Channel | null
): domain.SlashCommandManifest | null => {
  const currentUserId = api.getCurrentUserId();

  const isStructuralBotChannel = useMemo(() => {
    if (!channel) {
      return false;
    }
    return (
      api.isMoonOfUser(channel.contactId, currentUserId) ||
      logic.isBotHomeGroupChatChannel(currentUserId, channel.id)
    );
  }, [channel, currentUserId]);

  const isDm = channel?.type === 'dm';
  const { data: hasBotPosts } = useChannelHasBotPost({
    channelId: isDm && !isStructuralBotChannel ? channel?.id : null,
    authorId: isDm && !isStructuralBotChannel ? channel?.contactId : null,
  });

  const enabled = isStructuralBotChannel || (isDm && hasBotPosts === true);

  const botShipId = resolveBotManifestShipId(channel);
  const { data: contact, isFetched } = useContact({
    id: botShipId ?? '',
    enabled: enabled && !!botShipId,
  });

  const botInfo = useMemo(
    () => domain.parseBotInfo(contact?.botInfo),
    [contact?.botInfo]
  );

  // The backfill reads a row's raw isContact tri-state (true / false /
  // null-or-absent), so it is a dependency: a fresh-start sync can settle the
  // query before the peer row exists, and both the row's later insertion and a
  // null → false transition have to re-trigger the evaluation. Collapsing null
  // and false here would swallow the latter. The sync phase joins them because
  // a never-met bot's *absent* row is only backfillable once contacts sync has
  // settled (see ensureBotInfoSynced) — nothing about the absent row itself
  // changes when that happens, so without this the gate would only ever be
  // re-tested on a remount.
  const hasContactRow = !!contact;
  const contactIsContact = contact?.isContact;
  const syncPhase = useCurrentSession()?.phase;

  useEffect(() => {
    if (
      !shouldBackfillBotInfo({
        enabled,
        botShipId,
        contactQuerySettled: isFetched,
        hasBotInfo: !!botInfo,
      })
    ) {
      return;
    }
    ensureBotInfoSynced(botShipId!);
  }, [
    enabled,
    botShipId,
    isFetched,
    botInfo,
    hasContactRow,
    contactIsContact,
    syncPhase,
  ]);

  return useMemo(
    () =>
      selectBotSlashCommandManifest({
        enabled,
        botInfo: contact?.botInfo,
      }),
    [enabled, contact?.botInfo]
  );
};
