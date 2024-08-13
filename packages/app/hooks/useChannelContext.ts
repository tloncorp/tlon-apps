import { isGroupChannelId } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { JSONContent } from '@tloncorp/shared/dist/urbit';
import { GroupPreviewAction } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useCurrentUserId } from '../hooks/useCurrentUser';
import * as featureFlags from '../lib/featureFlags';
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

  // Navigation
  const navigate = useNavigate();

  const navigateToPost = useCallback(
    (post: db.Post) => {
      isGroupChannelId(post.channelId)
        ? navigate(
            '/group/' +
              post.groupId +
              '/channel/' +
              post.channelId +
              '/post/' +
              post.authorId +
              '/' +
              post.id
          )
        : navigate(
            '/dm/' + post.channelId + '/post/' + post.authorId + '/' + post.id
          );
    },
    [navigate]
  );

  const navigateToRef = useCallback(
    (channel: db.Channel, post: db.Post) => {
      if (channel.id === channelId) {
        navigate(
          '/group/' + channel.groupId + '/channel/' + channel.id + '/' + post.id
        );
      } else {
        navigate(
          '/group/' + channel.groupId + '/channel/' + channel.id + '/' + post.id
        );
      }
    },
    [navigate, channelId]
  );

  const navigateToImage = useCallback(
    (post: db.Post, uri?: string) => {
      navigate('/image/' + post.id + '/' + (uri ?? ''));
    },
    [navigate]
  );

  const navigateToSearch = useCallback(() => {
    if (!channelQuery.data) {
      return;
    }
    navigate('/search/' + channelQuery.data.id);
  }, [navigate, channelQuery.data]);

  const performGroupAction = useCallback(
    async (action: GroupPreviewAction, updatedGroup: db.Group) => {
      if (action === 'goTo' && updatedGroup.lastPost?.channelId) {
        const channel = await db.getChannel({
          id: updatedGroup.lastPost.channelId,
        });
        if (channel) {
          navigate('/group/' + channel.groupId + '/channel/' + channel.id);
        }
      }

      if (action === 'joined') {
        navigate('/');
      }
    },
    [navigate]
  );

  // Contacts

  const contactsQuery = store.useContacts();

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
    navigateToPost,
    navigateToImage,
    navigateToRef,
    navigateToSearch,
    currentUserId,
    performGroupAction,
    headerMode: featureFlags.isEnabled('channelSwitcher') ? 'next' : 'default',
  } as const;
};
