import * as api from '@tloncorp/api';
import { desig } from '@tloncorp/api/lib/urbit';
import { useEffect, useMemo } from 'react';

import * as db from '../db';
import * as domain from '../domain';
import * as logic from '../logic';
import { syncHostingBotAgent } from './hostingActions';

// Returns the curated slash-command manifest for the user's bot DM or
// home-group chat channel, or null when slash commands should not be offered.
// Gating is two predicates:
//   - structural: the channel is the user's bot DM or home-group chat channel.
//     Not third-party spoofable (`~pinser-botter-<user>` is a moon of the
//     user's own ship), but a self-hosted naming collision could match, which
//     is why the account predicate is also required.
//   - account: the user is hosted and has the bot enabled — matches the
//     existing bot-UI gating convention.
// The agent is read from the ship-scoped cache (mismatch/null → 'openclaw');
// a fire-and-forget sync keeps it fresh. The manifest is never blocked on a
// live fetch — a network round-trip must not gate a UI affordance.
export const useBotSlashCommandManifest = (
  channel?: db.Channel | null
): domain.SlashCommandManifest | null => {
  const currentUserId = api.getCurrentUserId();
  const hostingBotEnabled = db.hostingBotEnabled.useValue();
  const cachedAgent = db.hostingBotAgent.useValue();

  const isBotChannel = useMemo(() => {
    if (!channel) {
      return false;
    }
    return (
      api.isBotUserIdForUser(channel.contactId, currentUserId) ||
      logic.isBotHomeGroupChatChannel(currentUserId, channel.id)
    );
  }, [channel, currentUserId]);

  const isHostedBotAccount = api.getCurrentUserIsHosted() && hostingBotEnabled;
  const enabled = isBotChannel && isHostedBotAccount;

  useEffect(() => {
    if (enabled) {
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
