import type * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';

import { Badge } from '../Badge';
import type { ListItemProps } from './ListItem';
import { ListItem } from './ListItem';
import {
  getGroupStatus,
  getPostTypeIcon,
  useBoundHandler,
} from './listItemUtils';

export const GroupListItem = ({
  model,
  onPress,
  onLongPress,
  customSubtitle,
  ...props
}: { customSubtitle?: string } & ListItemProps<db.Group>) => {
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
      <ListItem.GroupIcon model={model} />
      <ListItem.MainContent>
        <ListItem.Title>{title}</ListItem.Title>
        {customSubtitle && (
          <ListItem.Subtitle>{customSubtitle}</ListItem.Subtitle>
        )}
        {model.lastPost && !customSubtitle && (
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
              <ListItem.Count
                count={unreadCount}
                muted={logic.isMuted(model.volumeSettings?.level, 'group')}
              />
            </>
          )}
        </ListItem.EndContent>
      )}
    </ListItem>
  );
};
