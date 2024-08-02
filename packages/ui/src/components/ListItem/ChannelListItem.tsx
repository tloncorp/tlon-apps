import type * as db from '@tloncorp/shared/dist/db';

import * as utils from '../../utils';
import { Badge } from '../Badge';
import { ListItem, type ListItemProps } from './ListItem';
import { isMuted } from './isMuted';
import { useBoundHandler } from './listItemUtils';

export function ChannelListItem({
  model,
  useTypeIcon,
  onPress,
  onLongPress,
  ...props
}: {
  useTypeIcon?: boolean;
} & ListItemProps<db.Channel>) {
  const unreadCount = model.unread?.count ?? 0;
  const title = utils.getChannelTitle(model);

  const multiLine = () => {
    if (model.lastPost && model.lastPost.textContent) {
      return model.lastPost.textContent.length > 32 ? true : false;
    }
    return false;
  };

  return (
    <ListItem
      {...props}
      onPress={useBoundHandler(model, onPress)}
      onLongPress={useBoundHandler(model, onLongPress)}
    >
      <ListItem.ChannelIcon
        model={model}
        size="$4.5xl"
        useTypeIcon={useTypeIcon}
        opacity={isMuted(model) ? 0.2 : 1}
      />
      <ListItem.MainContent>
        <ListItem.Title color={isMuted(model) ? '$tertiaryText' : undefined}>
          {title}
        </ListItem.Title>
        {model.lastPost && (
          <ListItem.PostPreview
            post={model.lastPost}
            multiline={multiLine()}
            showAuthor={model.type !== 'dm'}
          />
        )}
      </ListItem.MainContent>

      <ListItem.EndContent alignTop={multiLine()}>
        {model.lastPost?.receivedAt ? (
          <ListItem.Time time={model.lastPost.receivedAt} />
        ) : null}

        {model.isDmInvite ? (
          <Badge text="Invite" />
        ) : (
          <ListItem.Count count={unreadCount} muted={isMuted(model)} />
        )}
      </ListItem.EndContent>
    </ListItem>
  );
}
