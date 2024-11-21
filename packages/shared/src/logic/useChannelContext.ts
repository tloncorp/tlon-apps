import { useCallback, useEffect, useMemo, useState } from 'react';

import * as db from '../db';
import { useStorageUnsafelyUnwrapped } from '../storage';
import * as store from '../store';
import * as urbit from '../urbit';
import { JSONContent } from '../urbit';

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
  const storage = useStorageUnsafelyUnwrapped();

  // Model context
  const channelQuery = store.useChannelWithRelations({
    id: channelId,
  });
  const groupQuery = store.useGroup({
    id: channelQuery.data?.groupId ?? '',
  });

  useEffect(() => {
    if (channelQuery.data?.groupId) {
      store.syncGroup(channelQuery.data?.groupId, {
        priority: store.SyncPriority.Low,
      });
    }
  }, [channelQuery.data?.groupId]);

  // Post editing
  const [editingPost, setEditingPost] = useState<db.Post>();

  const editPost = useCallback(
    async (
      post: db.Post,
      content: urbit.Story,
      parentId?: string,
      metadata?: db.PostMetadata
    ) => {
      if (!channelQuery.data) {
        return;
      }

      store.editPost({
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

  const negotiationStatus = store.useNegotiate(
    channelHost,
    'channels',
    'channels-server'
  );

  // Draft

  type GalleryDraftType = 'caption' | 'text';

  const getDraft = useCallback(
    async (draftType?: GalleryDraftType) => {
      try {
        const draft = await storage.load({
          key: `draft-${draftKey}${draftType ? `-${draftType}` : ''}`,
        });
        return draft;
      } catch (e) {
        return null;
      }
    },
    [storage, draftKey]
  );

  const storeDraft = useCallback(
    async (draft: JSONContent, draftType?: GalleryDraftType) => {
      try {
        await storage.save({
          key: `draft-${draftKey}${draftType ? `-${draftType}` : ''}`,
          data: draft,
        });
      } catch (e) {
        return;
      }
    },
    [storage, draftKey]
  );

  const clearDraft = useCallback(
    async (draftType?: GalleryDraftType) => {
      try {
        await storage.remove({
          key: `draft-${draftKey}${draftType ? `-${draftType}` : ''}`,
        });
      } catch (e) {
        return;
      }
    },
    [storage, draftKey]
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
