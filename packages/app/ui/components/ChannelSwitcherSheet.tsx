import * as db from '@tloncorp/shared/db';
import { Icon } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import { Sheet } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SizableText, Text, XStack } from 'tamagui';

import { useChatOptions } from '../contexts';
import { useGroupTitle } from '../utils';
import ChannelNavSections from './ChannelNavSections';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: db.Group;
  channels: db.Channel[];
  onSelect: (channel: db.Channel) => void;
}

export function ChannelSwitcherSheet({
  open,
  onOpenChange,
  group,
  channels,
  onSelect,
}: Props) {
  const [hasOpened, setHasOpened] = useState(open);
  const chatOptions = useChatOptions();
  const sortBy = db.channelSortPreference.useValue();
  const { bottom } = useSafeAreaInsets();

  useEffect(() => {
    setHasOpened(open);
  }, [open]);

  const handleSortByToggled = useCallback(() => {
    const newSortBy = sortBy === 'recency' ? 'arranged' : 'recency';
    db.channelSortPreference.setValue(newSortBy);
  }, [sortBy]);

  const handlePressSettings = useCallback(() => {
    onOpenChange(false);
    chatOptions.open(group.id, 'group');
  }, [chatOptions, group.id, onOpenChange]);

  const title = useGroupTitle(group);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      modal
      dismissOnSnapToBottom
      snapPointsMode="percent"
      snapPoints={[90]}
      animation="quick"
    >
      <Sheet.Overlay animation="quick" />
      <Sheet.Frame>
        <Sheet.Handle paddingTop="$xl" />
        <Sheet.ScrollView gap="$xl" paddingHorizontal="$xl" paddingTop="$xl">
          <XStack alignItems="center" justifyContent="space-between">
            <SizableText
              fontSize="$l"
              fontWeight="$xl"
              color="$primaryText"
              paddingHorizontal="$l"
            >
              {title}
            </SizableText>
            <TouchableOpacity onPress={handleSortByToggled}>
              <XStack
                alignItems="center"
                justifyContent="flex-end"
                paddingVertical="$s"
                gap="$s"
              >
                <Icon type="Filter" />
                <Text>
                  Sorted by {sortBy === 'recency' ? 'recency' : 'arranged'}
                </Text>
              </XStack>
            </TouchableOpacity>
            <Pressable onPress={handlePressSettings}>
              <Icon type="Settings" />
            </Pressable>
          </XStack>
          {hasOpened && (
            <ChannelNavSections
              group={group}
              channels={channels}
              onSelect={onSelect}
              paddingBottom={bottom}
              sortBy={sortBy}
            />
          )}
        </Sheet.ScrollView>
      </Sheet.Frame>
    </Sheet>
  );
}
