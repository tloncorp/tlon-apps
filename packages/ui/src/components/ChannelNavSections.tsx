import * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';

import { SizableText, YStack } from '../core';
import ChannelListItem from './ChannelListItem';
import ChannelNavSection from './ChannelNavSection';

export default function ChannelNavSections({
  group,
  channels,
  onSelect,
  paddingBottom,
}: {
  group: db.Group;
  channels: db.Channel[];
  onSelect: (channel: any) => void;
  paddingBottom?: number;
}) {
  const unGroupedChannels = useMemo(
    () =>
      channels.filter(
        (c) =>
          !group.navSections?.some((s) =>
            s.channels?.some((sc) => sc.channelId === c.id)
          )
      ),
    [channels, group.navSections]
  );

  const hasSomeUnGroupedChannels = useMemo(
    () => unGroupedChannels.length > 0,
    [unGroupedChannels]
  );

  return (
    <YStack paddingBottom={paddingBottom} alignSelf="stretch" gap="$s">
      {group.navSections?.map((section) => (
        <ChannelNavSection
          key={section.id}
          section={section}
          channels={channels}
          onSelect={onSelect}
        />
      ))}
      {hasSomeUnGroupedChannels && (
        <YStack>
          <SizableText
            paddingHorizontal="$l"
            paddingVertical="$xl"
            fontSize="$s"
            color="$secondaryText"
          >
            All Channels
          </SizableText>
          {unGroupedChannels.map((item) => (
            <ChannelListItem key={item.id} model={item} onPress={onSelect} />
          ))}
        </YStack>
      )}
    </YStack>
  );
}
