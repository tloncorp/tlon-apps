import * as api from '@tloncorp/api';
import { desig } from '@tloncorp/api/lib/urbit';
import { useEffect, useMemo } from 'react';

import * as db from '../db';
import * as domain from '../domain';
import * as logic from '../logic';
import { useChannelHasBotPost } from './dbHooks';
import { syncHostingBotAgent } from './hostingActions';

// Returns the curated slash-command manifest for a bot conversation, or null
// when slash commands should not be offered. A channel qualifies when either:
//   - observed: the DM counterpart has sent bot-authored messages here. Bot
//     authorship is self-declared by the sending ship (BotProfile author on the
//     wire) — the same signal that renders the "Bot" tag on messages.
//   - structural: the DM counterpart is a moon of the user's ship (hosted
//     `~pinser-botter-*` bots and self-provisioned bots alike), or the channel
//     is the user's home-group chat. Covers bots that haven't posted yet.
// The manifest is a static list; until bots advertise their own commands, a
// non-Tlon bot gets the default set and simply won't honor commands it doesn't
// implement. The agent is read from the ship-scoped cache (mismatch/null →
// 'openclaw'); a fire-and-forget sync keeps it fresh for hosted users. The
// manifest is never blocked on a live fetch — a network round-trip must not
// gate a UI affordance.
export const useBotSlashCommandManifest = (
  channel?: db.Channel | null
): domain.SlashCommandManifest | null => {
  const currentUserId = api.getCurrentUserId();
  const cachedAgent = db.hostingBotAgent.useValue();

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

  useEffect(() => {
    if (enabled && api.getCurrentUserIsHosted()) {
      void syncHostingBotAgent();
    }
  }, [enabled]);

  return useMemo(() => {
    if (!enabled) {
      return null;
    }
    const agent =
      cachedAgent?.ship === desig(currentUserId)
        ? cachedAgent.agent
        : 'openclaw';
    return domain.getStaticSlashCommandManifest(agent);
  }, [enabled, cachedAgent, currentUserId]);
};
