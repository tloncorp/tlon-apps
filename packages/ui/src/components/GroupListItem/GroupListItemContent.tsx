import type * as db from '@tloncorp/shared/dist/db';

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
        <ListItem.Time time={model.lastPostAt} />
        {model.unreadCount && model.unreadCount > 0 ? (
          <ListItem.Count>{model.unreadCount}</ListItem.Count>
        ) : null}
      </ListItem.EndContent>
    </ListItem>
  );
}
