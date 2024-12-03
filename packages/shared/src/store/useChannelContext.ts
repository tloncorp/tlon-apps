import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Post, PostMetadata } from '../db';
import * as kv from '../db/keyValue';
import type { JSONContent, Story } from '../urbit';
import * as dbHooks from './dbHooks';
import * as postActions from './postActions';
import { SyncPriority, syncGroup } from './sync';
import { useNegotiate } from './useNegotiation';

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
  const channelHost = useMemo(() => channelId.split('/')[1], [channelId]);

  const negotiationStatus = useNegotiate(
    channelHost,
    'channels',
    'channels-server'
  );

  // Draft

  type GalleryDraftType = 'caption' | 'text';

  const getDraft = useCallback(
    async (draftType?: GalleryDraftType) => {
      try {
        return await kv
          .postDraft({ key: draftKey, type: draftType })
          .getValue();
      } catch (e) {
        return null;
      }
    },
    [draftKey]
  );

  const storeDraft = useCallback(
    async (draft: JSONContent, draftType?: GalleryDraftType) => {
      try {
        await kv.postDraft({ key: draftKey, type: draftType }).setValue(draft);
      } catch (e) {
        return;
      }
    },
    [draftKey]
  );

  const clearDraft = useCallback(
    async (draftType?: GalleryDraftType) => {
      try {
        await kv.postDraft({ key: draftKey, type: draftType }).resetValue();
      } catch (e) {
        return;
      }
    },
    [draftKey]
  );

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
