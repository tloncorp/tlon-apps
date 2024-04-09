import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useMemo } from 'react';

import { SizableText, YGroup, YStack } from '../core';
import ChannelListItem from './ChannelListItem';
import { IconType } from './Icon';

export default function ChannelNavSection({
  section,
  channels,
  onSelect,
}: {
  section: db.GroupNavSectionWithRelations;
  channels: db.ChannelWithLastPost[];
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

  return (
    <YStack key={section.id}>
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
          useTypeIcon={true}
          onPress={onSelect}
        />
      ))}
    </YStack>
  );
}
