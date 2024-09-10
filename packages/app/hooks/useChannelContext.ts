import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { JSONContent } from '@tloncorp/shared/dist/urbit';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useCurrentUserId } from '../hooks/useCurrentUser';
import { useFeatureFlag } from '../lib/featureFlags';
import storage from '../lib/storage';

export const useChannelContext = ({
  channelId,
  draftKey,
}: {
  channelId: string;
  draftKey: string;
  uploaderKey: string;
}) => {
  const currentUserId = useCurrentUserId();

  // Calm Settings
  const calmSettingsQuery = store.useCalmSettings({
    userId: currentUserId,
  });

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

  const getDraft = useCallback(async () => {
    try {
      const draft = await storage.load({ key: `draft-${draftKey}` });

      return draft;
    } catch (e) {
      return null;
    }
  }, [draftKey]);

  const storeDraft = useCallback(
    async (draft: JSONContent) => {
      try {
        await storage.save({ key: `draft-${draftKey}`, data: draft });
      } catch (e) {
        return;
      }
    },
    [draftKey]
  );

  const clearDraft = useCallback(async () => {
    try {
      await storage.remove({ key: `draft-${draftKey}` });
    } catch (e) {
      return;
    }
  }, [draftKey]);

  // Contacts

  const contactsQuery = store.useContacts();
  const [isChannelSwitcherEnabled] = useFeatureFlag('channelSwitcher');

  return {
    negotiationStatus,
    getDraft,
    storeDraft,
    clearDraft,
    setEditingPost,
    editingPost,
    editPost,
    contacts: contactsQuery.data ?? null,
    channel: channelQuery.data ?? null,
    group: groupQuery.data ?? null,
    calmSettings: calmSettingsQuery.data ?? null,
    currentUserId,
    headerMode: isChannelSwitcherEnabled ? 'next' : 'default',
  } as const;
};
