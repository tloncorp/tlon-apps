import * as db from '@tloncorp/shared/db';
import { useCallback, useMemo } from 'react';
import { SizableText, YStack, getVariableValue, useTheme } from 'tamagui';

import { ChannelListItem } from './ListItem';

export default function ChannelNavSection({
  section,
  channels,
  onSelect,
  onLongPress,
}: {
  section: db.GroupNavSection;
  channels: db.Channel[];
  onSelect: (channel: any) => void;
  onLongPress?: (channel: any) => void;
}) {
  const sectionChannels = useMemo(
    () =>
      section.channels
        ? section.channels
            .filter((item) => !!channels.find((c) => c.id === item.channelId))
            .sort((a, b) => {
              const aChannelIndex =
                section.channels?.find((c) => c.channelId === a.channelId)
                  ?.channelIndex ?? 0;
              const bChannelIndex =
                section.channels?.find((c) => c.channelId === b.channelId)
                  ?.channelIndex ?? 0;

              return aChannelIndex - bChannelIndex;
            })
        : [],
    [section, channels]
  );

  const getChannel = useCallback(
    (channelId?: string | null) => {
      return channels.find((c) => c.id === channelId);
    },
    [channels]
  );

  const listSectionTitleColor = getVariableValue(useTheme().secondaryText);

  return (
    <YStack key={section.id}>
      <SizableText
        paddingHorizontal="$l"
        paddingVertical="$xl"
        fontSize="$s"
        color={listSectionTitleColor}
      >
        {section.title}
      </SizableText>
      {sectionChannels.map((item) => (
        <ChannelListItem
          key={item.channelId}
          model={getChannel(item.channelId)!}
          useTypeIcon={true}
          onPress={onSelect}
          onLongPress={onLongPress}
        />
      ))}
    </YStack>
  );
}
