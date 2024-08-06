import type * as db from '@tloncorp/shared/dist/db';

import { Badge } from '../Badge';
import type { ListItemProps } from './ListItem';
import { ListItem } from './ListItem';
import { isMuted } from './isMuted';
import {
  getGroupStatus,
  getPostTypeIcon,
  useBoundHandler,
} from './listItemUtils';

export const GroupListItem = ({
  model,
  onPress,
  onLongPress,
  ...props
}: ListItemProps<db.Group>) => {
  const unreadCount = model.unread?.count ?? 0;
  const title = model.title ?? model.id;
  const { isPending, label: statusLabel, isErrored } = getGroupStatus(model);

  return (
    <ListItem
      {...props}
      alignItems={isPending ? 'center' : 'stretch'}
      onPress={useBoundHandler(model, onPress)}
      onLongPress={useBoundHandler(model, onLongPress)}
    >
      <ListItem.GroupIcon model={model} opacity={isMuted(model) ? 0.2 : 1} />
      <ListItem.MainContent>
        <ListItem.Title color={isMuted(model) ? '$tertiaryText' : undefined}>
          {title}
        </ListItem.Title>
        {model.lastPost && (
          <ListItem.SubtitleWithIcon
            icon={getPostTypeIcon(model.lastPost.type)}
          >
            {model.lastChannel}
          </ListItem.SubtitleWithIcon>
        )}
        {!isPending && model.lastPost ? (
          <ListItem.PostPreview post={model.lastPost} />
        ) : null}
      </ListItem.MainContent>

      {props.EndContent ?? (
        <ListItem.EndContent>
          {statusLabel ? (
            <Badge
              text={statusLabel}
              type={isErrored ? 'warning' : 'positive'}
            />
          ) : (
            <>
              <ListItem.Time time={model.lastPostAt} />
              <ListItem.Count count={unreadCount} muted={isMuted(model)} />
            </>
          )}
        </ListItem.EndContent>
      )}
    </ListItem>
  );
};
