import { useEffect, useMemo, useState } from 'react';

import type { Post } from '../db';
import { isDmChannelId, isGroupDmChannelId } from '../logic';
import * as dbHooks from './dbHooks';
import { SyncPriority, syncGroup } from './sync';
import { useNegotiate, useNegotiateMulti } from './useNegotiation';
import { usePostDraftCallbacks } from './usePostDraftCallbacks';

export const useChannelContext = ({
  channelId,
  draftKey,
}: {
  channelId: string;
  draftKey: string;
}) => {
  const channelQuery = dbHooks.useChannel({
    id: channelId,
  });

  const groupQuery = dbHooks.useGroup({
    id: channelQuery.data?.groupId ?? '',
  });

  useEffect(() => {
    if (channelQuery.data?.groupId) {
      syncGroup(channelQuery.data?.groupId, {
        priority: SyncPriority.Low,
      });
    }
  }, [channelQuery.data?.groupId]);

  // Post editing
  const [editingPost, setEditingPost] = useState<Post>();

  // Version negotiation
  const isDM = isDmChannelId(channelId);
  const isGroupDm = isGroupDmChannelId(channelId);

  const channelHost = useMemo(
    () => (isDM ? channelId : channelId.split('/')[1]),
    [channelId, isDM]
  );

  const app = isDM || isGroupDm ? 'chat' : 'channels';
  const agent = isDM || isGroupDm ? 'chat' : 'channels-server';
  const negotiationStatus = useNegotiate(channelHost, app, agent);
  const multiNegotiationStatus = useNegotiateMulti(
    channelQuery.data
      ? (channelQuery.data.members || []).map((m) => m.contactId)
      : [],
    app,
    agent
  );

  // Draft
  const { getDraft, storeDraft, clearDraft } = usePostDraftCallbacks({
    draftKey,
  });

  return {
    negotiationStatus: isGroupDm ? multiNegotiationStatus : negotiationStatus,
    getDraft,
    storeDraft,
    clearDraft,
    setEditingPost,
    editingPost,
    channel: channelQuery.data ?? null,
    group: groupQuery.data ?? null,
    groupIsLoading: groupQuery.isLoading,
    groupError: groupQuery.error,
  } as const;
};
