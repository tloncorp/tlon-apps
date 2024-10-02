import * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';
import { SizableText, YStack } from 'tamagui';

import ChannelNavSection from './ChannelNavSection';
import { ChannelListItem } from './ListItem';

export default function ChannelNavSections({
  group,
  channels,
  onSelect,
  sortBy,
  paddingBottom,
  onLongPress,
}: {
  group: db.Group;
  channels: db.Channel[];
  onSelect: (channel: any) => void;
  sortBy: 'recency' | 'arranged';
  paddingBottom?: number;
  onLongPress?: (channel: any) => void;
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

  const channelsSortedByRecency = useMemo(
    () =>
      channels && sortBy === 'recency'
        ? [...channels].sort((a, b) => {
            const aLastPostAt = a.lastPostAt || 0;
            const bLastPostAt = b.lastPostAt || 0;

            return bLastPostAt - aLastPostAt;
          })
        : [],
    [channels, sortBy]
  );

  const sectionHasChannels = useMemo(
    () => unGroupedChannels.length > 0,
    [unGroupedChannels]
  );

  if (sortBy === 'recency') {
    return (
      <YStack paddingBottom={paddingBottom} alignSelf="stretch" gap="$s">
        {channelsSortedByRecency.map((item) => (
          <ChannelListItem
            key={item.id}
            model={item}
            onPress={onSelect}
            useTypeIcon={true}
            onLongPress={onLongPress}
          />
        ))}
      </YStack>
    );
  }

  return (
    <YStack paddingBottom={paddingBottom} alignSelf="stretch" gap="$s">
      {group.navSections?.map((section) => {
        const sectionChannels = channels.filter((c) =>
          section.channels?.some((sc) => sc.channelId === c.id)
        );

        if (sectionChannels.length === 0) {
          return null;
        }

        return (
          <ChannelNavSection
            key={section.id}
            section={section}
            channels={sectionChannels}
            onSelect={onSelect}
          />
        );
      })}
      {sectionHasChannels && (
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
            <ChannelListItem
              key={item.id}
              model={item}
              onPress={onSelect}
              onLongPress={onLongPress}
              useTypeIcon={true}
            />
          ))}
        </YStack>
      )}
    </YStack>
  );
}
