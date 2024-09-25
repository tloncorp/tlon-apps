import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useMemo, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, YStack } from 'tamagui';

import { Badge } from '../Badge';
import { GroupListItem, ListItem, ListItemProps } from '../ListItem';
import { Text } from '../TextV2';

export function ViewUserGroupsWidget({
  userId,
  onSelectGroup,
  onScrollChange,
}: {
  userId: string;
  onSelectGroup: (group: db.Group) => void;
  onScrollChange?: (scrolling: boolean) => void;
}) {
  const { data, isError, isLoading } = store.useGroupsHostedBy(userId);

  const scrollPosition = useRef(0);
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollPosition.current = event.nativeEvent.contentOffset.y;
    },
    []
  );
  const onTouchStart = useCallback(() => {
    if (scrollPosition.current > 0) {
      onScrollChange?.(true);
    }
  }, [onScrollChange]);

  const onTouchEnd = useCallback(
    () => onScrollChange?.(false),
    [onScrollChange]
  );

  const insets = useSafeAreaInsets();

  return (
    <View flex={1}>
      {
        <>
          <ScrollView
            onScroll={handleScroll}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            contentContainerStyle={{
              gap: '$s',
              paddingTop: '$l',
              paddingHorizontal: '$l',
              paddingBottom: insets.bottom,
            }}
          >
            {isLoading ? (
              <PlaceholderMessage text="Loading groups..." />
            ) : isError ? (
              <PlaceholderMessage text="Failed to load groups" />
            ) : data && data.length > 0 ? (
              data?.map((group) => (
                <GroupPreviewListItem
                  key={group.id}
                  model={group}
                  onPress={onSelectGroup}
                />
              ))
            ) : (
              <PlaceholderMessage text="No groups found" />
            )}
          </ScrollView>
        </>
      }
    </View>
  );
}

function PlaceholderMessage({ text }: { text: string }) {
  return (
    <YStack marginTop="$xl" justifyContent="center" alignItems="center">
      <Text size="$label/m" color="$tertiaryText">
        {text}
      </Text>
    </YStack>
  );
}

function GroupPreviewListItem({ model, onPress }: ListItemProps<db.Group>) {
  const badgeText = useMemo(() => {
    if (model.currentUserIsMember) {
      return 'Joined';
    }
    return model.privacy === 'private' ? 'Private' : '';
  }, [model.currentUserIsMember, model.privacy]);

  return (
    <GroupListItem
      model={model}
      onPress={onPress}
      EndContent={
        badgeText ? (
          <ListItem.EndContent justifyContent="center">
            <Badge text={badgeText} type="neutral" />
          </ListItem.EndContent>
        ) : undefined
      }
    />
  );
}
