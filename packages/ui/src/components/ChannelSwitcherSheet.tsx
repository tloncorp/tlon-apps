import * as client from '@tloncorp/shared/dist/client';
import { YGroup } from 'tamagui';

import { SizableText, View } from '../core';
import { ChannelListItem } from './ChannelListItem';
import { Sheet } from './Sheet';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: client.Group;
  channels: client.Channel[];
  onSelect: (channel: client.Channel) => void;
}

export function ChannelSwitcherSheet({
  open,
  onOpenChange,
  group,
  channels,
  onSelect,
}: Props) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      modal
      dismissOnSnapToBottom
      snapPointsMode="fit"
      // TODO: Figure out why typescript is complaining about the animation prop
      // @ts-ignore - animation prop is not recognized
      animation="quick"
    >
      <Sheet.Overlay
        // TODO: Figure out why typescript is complaining about the animation prop
        // @ts-ignore - animation prop is not recognized
        animation="quick"
      />
      <Sheet.Frame>
        <Sheet.Handle paddingTop="$xl" />
        <View
          gap="$xl"
          paddingHorizontal="$xl"
          paddingTop="$xl"
          paddingBottom="$4xl"
        >
          <SizableText
            fontSize="$l"
            fontWeight="500"
            color="$primaryText"
            paddingHorizontal="$l"
          >
            {group?.title}
          </SizableText>
          <YGroup alignSelf="stretch" gap="$s">
            <YGroup.Item>
              <SizableText
                paddingHorizontal="$l"
                paddingVertical="$xl"
                fontSize="$s"
                color="$secondaryText"
              >
                All Channels
              </SizableText>
              {channels.map((item) => (
                <ChannelListItem
                  key={item.id}
                  model={item}
                  onPress={onSelect}
                />
              ))}
            </YGroup.Item>
          </YGroup>
        </View>
      </Sheet.Frame>
    </Sheet>
  );
}
