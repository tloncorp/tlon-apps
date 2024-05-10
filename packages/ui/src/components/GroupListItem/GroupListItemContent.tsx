import type * as db from '@tloncorp/shared/dist/db';

import { SizableText, Stack, Text } from '../../core';
import ContactName from '../ContactName';
import { ListItem, type ListItemProps } from '../ListItem';

export default function GroupListItemContent({
  model,
  onPress,
  onLongPress,
  ...props
}: ListItemProps<db.Group>) {
  return (
    <ListItem
      {...props}
      alignItems={model.inviteStatus !== 'joined' ? 'center' : 'stretch'}
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
        {model.lastPost && (
          <ListItem.Subtitle>
            <ContactName
              userId={model.lastPost.authorId}
              showNickname
              color={'$secondaryText'}
              size={'$s'}
            />
            : {model.lastPost?.textContent ?? ''}
          </ListItem.Subtitle>
        )}
      </ListItem.MainContent>
      <ListItem.EndContent>
        {model.inviteStatus === 'invited' ||
        model.inviteStatus === 'joining' ? (
          <Stack
            backgroundColor="$secondaryBackground"
            paddingVertical="$xs"
            paddingHorizontal="$l"
            borderRadius="$xl"
          >
            <SizableText size="$s" color="$secondaryText">
              {model.inviteStatus === 'joining' ? 'Joining...' : 'Invited'}
            </SizableText>
          </Stack>
        ) : (
          <>
            <ListItem.Time time={model.lastPostAt} />
            {model.unreadCount && model.unreadCount > 0 ? (
              <ListItem.Count>{model.unreadCount}</ListItem.Count>
            ) : null}
          </>
        )}
      </ListItem.EndContent>
    </ListItem>
  );
}
