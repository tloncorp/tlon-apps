import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useMemo } from 'react';

import { SizableText, YGroup } from '../core';
import ChannelListItem from './ChannelListItem';
import { IconType } from './Icon';

export default function ChannelNavSection({
  section,
  channels,
  onSelect,
}: {
  section: db.GroupNavSectionWithRelations;
  channels: db.Channel[];
  onSelect: (channel: any) => void;
}) {
  const sectionChannels = useMemo(
    () =>
      section.channels
        ? section.channels.filter(
            (item) => !!channels.find((c) => c.id === item.channelId)
          )
        : [],
    [section, channels]
  );

  const getChannel = useCallback(
    (channelId: string | null) => {
      return channels.find((c) => c.id === channelId);
    },
    [channels]
  );

  const getChannelIcon = useCallback(
    (channelId: string | null): IconType => {
      const channel = getChannel(channelId);
      switch (channel?.type) {
        case 'chat':
          return 'ChannelTalk';
        case 'notebook':
          return 'ChannelNotebooks';
        case 'gallery':
          return 'ChannelGalleries';
        default:
          return 'ChannelTalk';
      }
    },
    [getChannel]
  );

  return (
    <YGroup.Item key={section.id}>
      <SizableText
        paddingHorizontal="$l"
        paddingVertical="$xl"
        fontSize="$s"
        color="$secondaryText"
      >
        {section.title}
      </SizableText>
      {sectionChannels.map((item) => (
        <ChannelListItem
          key={item.channelId}
          model={getChannel(item.channelId)!}
          icon={getChannelIcon(item.channelId)}
          onPress={onSelect}
        />
      ))}
    </YGroup.Item>
  );
}
