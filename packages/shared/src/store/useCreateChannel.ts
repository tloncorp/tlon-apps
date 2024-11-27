import { useCallback } from 'react';

import { assembleNewChannelIdAndName } from '../db/modelBuilders';
import * as db from '../db/types';
import { createChannel } from '../store/channelActions';
import { useAllChannels } from '../store/dbHooks';
import {
  ChannelContentConfiguration,
  CollectionRendererId,
  DraftInputId,
  PostContentRendererId,
} from '../types/ChannelContentConfiguration';

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
          channelType,
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
        draftInput: { id: DraftInputId.chat },
        defaultPostContentRenderer: { id: PostContentRendererId.chat },
        defaultPostCollectionRenderer: { id: CollectionRendererId.chat },
      };
    case 'notebook':
      return {
        draftInput: { id: DraftInputId.notebook },
        defaultPostContentRenderer: { id: PostContentRendererId.notebook },
        defaultPostCollectionRenderer: { id: CollectionRendererId.notebook },
      };
    case 'gallery':
      return {
        draftInput: { id: DraftInputId.gallery },
        defaultPostContentRenderer: { id: PostContentRendererId.gallery },
        defaultPostCollectionRenderer: { id: CollectionRendererId.gallery },
      };
  }

  throw new Error('Unknown channel type');
}
