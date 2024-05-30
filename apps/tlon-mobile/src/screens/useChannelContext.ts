import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { sync } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { JSONContent } from '@tloncorp/shared/dist/urbit';
import { GroupPreviewAction } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useCurrentUserId } from '../hooks/useCurrentUser';
import { useImageUpload } from '../hooks/useImageUpload';
import storage from '../lib/storage';
import { HomeStackParamList } from '../types';

export const useChannelContext = ({
  channelId,
  draftKey,
  uploaderKey,
}: {
  channelId: string;
  draftKey: string;
  uploaderKey: string;
}) => {
  // Uploader
  const uploadInfo = useImageUpload({
    uploaderKey: uploaderKey,
  });

  const currentUserId = useCurrentUserId();

  // Calm Settings
  const calmSettingsQuery = store.useCalmSettings({
    userId: currentUserId,
  });

  // Model context
  const channelQuery = store.useChannelWithLastPostAndMembers({
    id: channelId,
  });
  const groupQuery = store.useGroup({
    id: channelQuery.data?.groupId ?? '',
  });

  useEffect(() => {
    if (channelQuery.data?.groupId) {
      sync.syncGroup(channelQuery.data?.groupId);
    }
  }, [channelQuery.data?.groupId]);

  // Post editing
  const [editingPost, setEditingPost] = useState<db.Post>();

  const editPost = useCallback(
    async (post: db.Post, content: urbit.Story) => {
      if (!channelQuery.data) {
        return;
      }

      store.editPost({
        post,
        content,
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

  const navigation =
    useNavigation<
      NativeStackNavigationProp<HomeStackParamList, 'Channel' | 'Post'>
    >();

  const navigateToPost = useCallback(
    (post: db.Post) => {
      navigation.push('Post', { post });
    },
    [navigation]
  );

  const navigateToRef = useCallback(
    (channel: db.Channel, post: db.Post) => {
      if (channel.id === channelId) {
        navigation.navigate('Channel', { channel, selectedPost: post });
      } else {
        navigation.replace('Channel', { channel, selectedPost: post });
      }
    },
    [navigation, channelId]
  );

  const navigateToImage = useCallback(
    (post: db.Post, uri?: string) => {
      // @ts-expect-error TODO: fix typing for nested stack navigation
      navigation.navigate('ImageViewer', { post, uri });
    },
    [navigation]
  );

  const navigateToSearch = useCallback(() => {
    if (!channelQuery.data) {
      return;
    }
    navigation.push('ChannelSearch', {
      channel: channelQuery.data ?? null,
    });
  }, [navigation, channelQuery.data]);

  const performGroupAction = useCallback(
    async (action: GroupPreviewAction, updatedGroup: db.Group) => {
      if (action === 'goTo' && updatedGroup.lastPost?.channelId) {
        const channel = await db.getChannel({
          id: updatedGroup.lastPost.channelId,
        });
        if (channel) {
          navigation.navigate('Channel', { channel });
        }
      }

      if (action === 'joined') {
        navigation.navigate('ChatList');
      }
    },
    [navigation]
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
    uploadInfo,
    currentUserId,
    performGroupAction,
  };
};
