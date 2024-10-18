import { useCallback } from 'react';

import {
  ChannelContentConfiguration,
  CollectionRendererId,
  DraftInputId,
  PostContentRendererId,
} from '../api/channelContentConfig';
import { assembleNewChannelIdAndName } from '../db/modelBuilders';
import * as db from '../db/types';
import { createChannel } from '../store/channelActions';
import { useAllChannels } from '../store/dbHooks';

export function useCreateChannel({
  group,
  currentUserId,
  disabled = false,
}: {
  group?: db.Group | null;
  currentUserId: string;
  disabled?: boolean;
}) {
  const { data: existingChannels } = useAllChannels({
    enabled: !disabled,
  });

  return useCallback(
    async ({
      title,
      description,
      channelType,
      contentConfiguration,
    }: {
      title: string;
      description?: string;
      channelType: Omit<db.ChannelType, 'dm' | 'groupDm'>;
      contentConfiguration?: ChannelContentConfiguration;
    }) => {
      const { name, id } = assembleNewChannelIdAndName({
        title,
        channelType,
        existingChannels: existingChannels ?? [],
        currentUserId,
      });

      if (group) {
        await createChannel({
          groupId: group.id,
          name,
          channelId: id,
          title,
          description,
          channelType: channelType === 'custom' ? 'chat' : channelType,
          contentConfiguration:
            contentConfiguration ??
            channelContentConfigurationForChannelType(channelType),
        });
      }
    },
    [group, currentUserId, existingChannels]
  );
}

/**
 * Creates a `ChannelContentConfiguration` matching our built-in legacy
 * channel types. With this configuration in place, we can treat these channels
 * as we would any other custom channel, and avoid switching on `channel.type`
 * in client code.
 */
function channelContentConfigurationForChannelType(
  channelType: Omit<db.Channel['type'], 'dm' | 'groupDm'>
): ChannelContentConfiguration {
  switch (channelType) {
    case 'chat':
      return {
        draftInput: DraftInputId.chat,
        defaultPostContentRenderer: PostContentRendererId.chat,
        defaultPostCollectionRenderer: CollectionRendererId.chat,
      };
    case 'notebook':
      return {
        draftInput: DraftInputId.notebook,
        defaultPostContentRenderer: PostContentRendererId.notebook,
        defaultPostCollectionRenderer: CollectionRendererId.notebook,
      };
    case 'gallery':
      return {
        draftInput: DraftInputId.gallery,
        defaultPostContentRenderer: PostContentRendererId.gallery,
        defaultPostCollectionRenderer: CollectionRendererId.gallery,
      };
  }

  throw new Error('Unknown channel type');
}
