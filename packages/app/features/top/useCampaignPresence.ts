import * as db from '@tloncorp/shared/db';
import { useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import useAppStatus from '../../hooks/useAppStatus';
import { publishCampaignView } from './campaignPresence';

export function useCampaignPresence(
  conversationId: string,
  groupId: string | undefined,
  focused: boolean
) {
  const agents = db.agentGroupAgents.useValue();
  const bot = groupId
    ? agents[groupId]
    : Object.values(agents).find((ship) => ship === conversationId);
  const appStatus = useAppStatus();
  useEffect(() => {
    if (!bot || !focused || appStatus !== 'active') return;
    const stop = publishCampaignView({
      conversationId,
      bot,
      token: uuid(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      // Presence is best-effort; the bot also uses recent messages and active runs.
      reportError: () => {},
    });
    return () => {
      void stop();
    };
  }, [appStatus, bot, conversationId, focused]);
}
