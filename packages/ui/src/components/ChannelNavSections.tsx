import * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';

import { SizableText, YGroup } from '../core';
import { ChannelListItem } from './ChannelListItem';
import ChannelNavSection from './ChannelNavSection';

export default function ChannelNavSections({
  group,
  channels,
  onSelect,
}: {
  group: db.GroupWithRelations;
  channels: db.Channel[];
  onSelect: (channel: any) => void;
}) {
  const hasSomeUnGroupedChannels = useMemo(
    () =>
      channels.some(
        (c) =>
          !group.navSections.some((s) =>
            s.channels.some((sc) => sc.channelId === c.id)
          )
      ),
    [channels, group.navSections]
  );
  const unGroupedChannels = useMemo(
    () =>
      channels.filter(
        (c) =>
          !group.navSections.some((s) =>
            s.channels.some((sc) => sc.channelId === c.id)
          )
      ),
    [channels, group.navSections]
  );

  return (
    <YGroup alignSelf="stretch" gap="$s">
      {group.navSections.map((section) => (
        <ChannelNavSection
          key={section.id}
          section={section}
          channels={channels}
          onSelect={onSelect}
        />
      ))}
      {hasSomeUnGroupedChannels && (
        <YGroup.Item>
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
        </YGroup.Item>
      )}
    </YGroup>
  );
}
