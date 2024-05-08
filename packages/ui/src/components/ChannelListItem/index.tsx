import type * as db from '@tloncorp/shared/dist/db';
import { ColorProp } from 'tamagui';

import * as utils from '../../utils';
import ContactName from '../ContactName';
import { ListItem, type ListItemProps } from '../ListItem';

export default function ChannelListItem({
  model,
  useTypeIcon,
  onPress,
  onLongPress,
  ...props
}: {
  useTypeIcon?: boolean;
} & ListItemProps<db.Channel>) {
  const title = utils.getChannelTitle(model);

  return (
    <ListItem
      {...props}
      onPress={() => onPress?.(model)}
      onLongPress={() => onLongPress?.(model)}
    >
      <ChannelListItemIcon model={model} useTypeIcon={useTypeIcon} />
      <ListItem.MainContent>
        <ListItem.Title>{title}</ListItem.Title>
        {model.lastPost && (
          <ListItem.Subtitle>
            {model.type !== 'dm' ? (
              <>
                <ContactName
                  showNickname
                  userId={model.lastPost.authorId}
                  size="$s"
                />
                :{' '}
              </>
            ) : null}
            {model.lastPost.textContent ?? ''}
          </ListItem.Subtitle>
        )}
      </ListItem.MainContent>
      <ListItem.EndContent position="relative" top={3}>
        {model.lastPost && <ListItem.Time time={model.lastPost.receivedAt} />}
        {model.unread?.count && model.unread.count > 0 ? (
          <ListItem.Count>{model.unread.count}</ListItem.Count>
        ) : null}
      </ListItem.EndContent>
    </ListItem>
  );
}

function ChannelListItemIcon({
  model,
  useTypeIcon,
}: {
  model: db.Channel;
  useTypeIcon?: boolean;
}) {
  const backgroundColor = model.iconImageColor as ColorProp;
  if (useTypeIcon) {
    const icon = utils.getChannelTypeIcon(model.type);
    return (
      <ListItem.SystemIcon
        icon={icon}
        backgroundColor={'$secondaryBackground'}
      />
    );
  } else if (model.type === 'dm' && model.members?.[0]?.contactId) {
    return (
      <ListItem.AvatarIcon
        backgroundColor={'red'}
        contactId={model.members?.[0]?.contactId}
        contact={model.members?.[0]?.contact}
      />
    );
  } else {
    if (model.iconImage) {
      return (
        <ListItem.ImageIcon
          imageUrl={model.iconImage}
          backgroundColor={backgroundColor}
        />
      );
    } else if (hasGroup(model) && model.group.iconImage) {
      return (
        <ListItem.ImageIcon
          imageUrl={model.group.iconImage}
          backgroundColor={backgroundColor}
        />
      );
    } else {
      return (
        <ListItem.TextIcon
          fallbackText={utils.getChannelTitle(model)}
          backgroundColor={backgroundColor}
        />
      );
    }
  }
}

function hasGroup(
  channel: db.Channel
): channel is db.Channel & { group: db.Group } {
  return 'group' in channel && !!channel.group;
}
