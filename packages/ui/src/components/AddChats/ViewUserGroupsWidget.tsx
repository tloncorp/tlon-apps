import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
} from 'react-native';

import { SizableText, View, XStack, YStack } from '../../core';
import ContactName from '../ContactName';
import { ListItem, ListItemProps } from '../ListItem';
import { LoadingSpinner } from '../LoadingSpinner';

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

  return (
    <View flex={1}>
      {isLoading ? (
        <YStack marginTop="$xl" justifyContent="center" alignItems="center">
          <LoadingSpinner />
          <SizableText marginTop="$xl" color="$secondaryText">
            Loading groups hosted by{' '}
            <ContactName showNickname fontWeight="500" userId={userId} />
          </SizableText>
        </YStack>
      ) : isError ? (
        <YStack marginTop="$xl" justifyContent="center" alignItems="center">
          <SizableText color="$negativeActionText">
            Error loading groups hosted by{' '}
            <ContactName
              color="$negativeActionText"
              showNickname
              fontWeight="500"
              userId={userId}
            />
          </SizableText>
        </YStack>
      ) : (
        <>
          <XStack justifyContent="center" marginBottom="$xl">
            <SizableText>
              Groups hosted by{' '}
              <ContactName showNickname fontWeight="500" userId={userId} />
            </SizableText>
          </XStack>
          <ScrollView
            onScroll={handleScroll}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {data && data.length > 0 ? (
              data?.map((group) => (
                <GroupPreviewListItem
                  key={group.id}
                  model={group}
                  onPress={() => onSelectGroup(group)}
                />
              ))
            ) : (
              <SizableText color="$secondaryText" textAlign="center">
                <ContactName userId={userId} showNickname /> hosts no groups
              </SizableText>
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

function GroupPreviewListItem({ model, onPress }: ListItemProps<db.Group>) {
  return (
    <ListItem onPress={() => onPress?.(model)}>
      <ListItem.Icon
        fallbackText={model.title?.[0]}
        backgroundColor={model.iconImageColor ?? undefined}
        imageUrl={model.iconImage ?? undefined}
      />
      <ListItem.MainContent>
        <ListItem.Title>{model.title}</ListItem.Title>
      </ListItem.MainContent>
    </ListItem>
  );
}
