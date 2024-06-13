import * as db from '@tloncorp/shared/dist/db';
import { useEffect, useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ContactsProvider } from '../contexts';
import { SizableText, Text, XStack } from '../core';
import ChannelNavSections from './ChannelNavSections';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: db.Group;
  channels: db.Channel[];
  contacts: db.Contact[];
  onSelect: (channel: db.Channel) => void;
  sortBy: 'recency' | 'arranged';
  setSortBy: (sortBy: 'recency' | 'arranged') => void;
}

export function ChannelSwitcherSheet({
  open,
  onOpenChange,
  group,
  channels,
  onSelect,
  contacts,
  sortBy,
  setSortBy,
}: Props) {
  const [hasOpened, setHasOpened] = useState(open);
  // const [sortBy, setSortBy] = useState<'recency' | 'arranged'>('recency');
  const { bottom } = useSafeAreaInsets();

  useEffect(() => {
    setHasOpened(open);
  }, [open]);
  return (
    <ContactsProvider contacts={contacts}>
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
                fontWeight="500"
                color="$primaryText"
                paddingHorizontal="$l"
              >
                {group?.title}
              </SizableText>
              <TouchableOpacity
                onPress={() => {
                  const newSortBy =
                    sortBy === 'recency' ? 'arranged' : 'recency';
                  setSortBy(newSortBy);
                }}
              >
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
    </ContactsProvider>
  );
}
