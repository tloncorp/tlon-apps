import type * as db from '@tloncorp/shared/dist/db';

import { useCalm } from '../../contexts/calm';
import { getBackgroundColor } from '../../utils/colorUtils';
import { Badge } from '../Badge';
import type { ListItemProps } from './ListItem';
import { ListItem } from './ListItem';
import {
  getGroupStatus,
  getPostTypeIcon,
  isMuted,
  useBoundHandler,
} from './listItemUtils';

export const GroupListItem = ({
  model,
  onPress,
  onLongPress,
  ...props
}: ListItemProps<db.Group>) => {
  const unreadCount = model.unread?.count ?? 0;
  const { disableAvatars } = useCalm();
  // Fallback color for calm mode or unset colors
  const colors = { backgroundColor: '$secondaryBackground' };
  const title = model.title ?? model.id;
  const iconFallbackText = model.title?.[0] ?? model.id[0];
  const { isPending, label: statusLabel, isErrored } = getGroupStatus(model);

  return (
    <ListItem
      {...props}
      alignItems={isPending ? 'center' : 'stretch'}
      onPress={useBoundHandler(model, onPress)}
      onLongPress={useBoundHandler(model, onLongPress)}
    >
      <ListItem.Icon
        opacity={isMuted(model) ? 0.2 : 1}
        fallbackText={iconFallbackText}
        backgroundColor={getBackgroundColor({
          disableAvatars,
          colors,
          model,
        })}
        imageUrl={
          !disableAvatars && model.iconImage ? model.iconImage : undefined
        }
      />
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

      <ListItem.EndContent>
        {statusLabel ? (
          <Badge text={statusLabel} type={isErrored ? 'warning' : 'positive'} />
        ) : (
          <>
            <ListItem.Time time={model.lastPostAt} />
            <ListItem.Count count={unreadCount} muted={isMuted(model)} />
          </>
        )}
      </ListItem.EndContent>
    </ListItem>
  );
};
