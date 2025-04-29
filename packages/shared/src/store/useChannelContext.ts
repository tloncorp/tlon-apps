import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Post, PostMetadata } from '../db';
import { isDmChannelId } from '../logic';
import type { Story } from '../urbit';
import * as dbHooks from './dbHooks';
import * as postActions from './postActions';
import { SyncPriority, syncGroup } from './sync';
import { useNegotiate } from './useNegotiation';
import { usePostDraftCallbacks } from './usePostDraftCallbacks';

export const useChannelContext = ({
  channelId,
  draftKey,
  isChannelSwitcherEnabled,
}: {
  channelId: string;
  draftKey: string;

  // need to populate this from feature flags :(
  isChannelSwitcherEnabled: boolean;
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

  const editPost = useCallback(
    async (
      post: Post,
      content: Story,
      parentId?: string,
      metadata?: PostMetadata
    ) => {
      if (!channelQuery.data) {
        return;
      }

      postActions.editPost({
        post,
        content,
        parentId,
        metadata,
      });
      setEditingPost(undefined);
    },
    [channelQuery.data]
  );

  // Version negotiation
  const isDM = isDmChannelId(channelId);
  const channelHost = useMemo(
    () => (isDM ? channelId : channelId.split('/')[1]),
    [channelId, isDM]
  );

  const negotiationStatus = useNegotiate(
    channelHost,
    isDM ? 'chat' : 'channels',
    isDM ? 'chat' : 'channels-server'
  );

  // Draft
  const { getDraft, storeDraft, clearDraft } = usePostDraftCallbacks({
    draftKey,
  });

  return {
    negotiationStatus,
    getDraft,
    storeDraft,
    clearDraft,
    setEditingPost,
    editingPost,
    editPost,
    channel: channelQuery.data ?? null,
    group: groupQuery.data ?? null,
    headerMode: isChannelSwitcherEnabled ? 'next' : 'default',
  } as const;
};
