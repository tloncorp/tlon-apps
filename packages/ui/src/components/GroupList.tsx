import * as db from '@tloncorp/shared/dist/db';
import { useCallback } from 'react';

import { ScrollView, YStack } from '../core';
import { GroupListItem } from './GroupListItem';
import { ListItem, ListItemProps } from './ListItem';
import { ListSectionHeader } from './ListSectionHeader';

export function ChatList({
  pinned,
  unpinned,
  onLongPressItem,
  onPressItem,
}: db.CurrentChats & {
  onPressItem?: (chat: db.Chat) => void;
  onLongPressItem?: (chat: db.Chat) => void;
}) {
  return (
    <ScrollView>
      <YStack gap="$s" paddingHorizontal="$l">
        {pinned.length > 0 && (
          <ListSectionHeader key="pinned-header">Pinned</ListSectionHeader>
        )}
        {pinned.map((item) => (
          <ChatListItem
            model={item}
            key={item.id}
            onPress={onPressItem}
            onLongPress={onLongPressItem}
          />
        ))}
        {unpinned.length > 0 && pinned.length > 0 && (
          <ListSectionHeader key={'all-header'}>All</ListSectionHeader>
        )}
        {unpinned.map((item) => (
          <ChatListItem
            model={item}
            key={item.id}
            onPress={onPressItem}
            onLongPress={onLongPressItem}
          />
        ))}
      </YStack>
    </ScrollView>
  );
}

function ChatListItem({
  model,
  onPress,
  onLongPress,
  ...props
}: ListItemProps<db.ChannelSummary>) {
  const handlePress = useCallback(() => {
    onPress?.(model);
  }, [onPress]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(model);
  }, [onLongPress]);

  if (model.group) {
    return (
      <GroupListItem
        onPress={handlePress}
        onLongPress={handleLongPress}
        model={{
          ...model.group,
          unreadCount: model.unread?.count,
          lastPost: model.lastPost,
        }}
        {...props}
      />
    );
  } else if (model.type === 'dm') {
    return (
      <ListItem
        {...props}
        onPress={() => onPress?.(model)}
        onLongPress={() => onLongPress?.(model)}
      >
        <ListItem.Icon
          fallbackText={model.title?.[0]}
          backgroundColor={model.iconImageColor ?? undefined}
          imageUrl={model.iconImage ?? undefined}
        />
        <ListItem.MainContent>
          <ListItem.Title>
            {model.title
              ? model.title
              : model.members?.[0].contact?.nickname
                ? model.members[0].contact.nickname
                : model.members?.[0].contactId}
          </ListItem.Title>
          <ListItem.Subtitle>
            {model.lastPost?.textContent ?? ''}
          </ListItem.Subtitle>
        </ListItem.MainContent>
        <ListItem.EndContent>
          {true ? <ListItem.Time time={model.lastPostAt} /> : null}
          {model.unreadCount && model.unreadCount > 0 ? (
            <ListItem.Count>{model.unread?.count}</ListItem.Count>
          ) : null}
        </ListItem.EndContent>
      </ListItem>
    );
  }

  return (
    <ListItem
      {...props}
      onPress={() => onPress?.(model)}
      onLongPress={() => onLongPress?.(model)}
    >
      <ListItem.Icon
        fallbackText={model.title?.[0]}
        backgroundColor={model.iconImageColor ?? undefined}
        imageUrl={model.iconImage ?? undefined}
      />
      <ListItem.MainContent>
        <ListItem.Title>{model.title}</ListItem.Title>
        <ListItem.Subtitle>
          {model.lastPost?.textContent ?? ''}
        </ListItem.Subtitle>
      </ListItem.MainContent>
      <ListItem.EndContent>
        {true ? <ListItem.Time time={model.lastPostAt} /> : null}
        {model.unreadCount && model.unreadCount > 0 ? (
          <ListItem.Count>{model.unread?.count}</ListItem.Count>
        ) : null}
      </ListItem.EndContent>
    </ListItem>
  );
}
