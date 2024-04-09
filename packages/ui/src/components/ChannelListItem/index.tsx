import type * as db from '@tloncorp/shared/dist/db';
import { ColorProp } from 'tamagui';

import { IconType } from '../..';
import getChannelTitle from '../../hooks/useChannelTitle';
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
} & ListItemProps<db.ChannelWithLastPostAndMembers>) {
  const title = getChannelTitle(model);
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
                  showAlias
                  name={model.lastPost.authorId}
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
        {model.unreadCount && model.unreadCount > 0 ? (
          <ListItem.Count>{model.unreadCount}</ListItem.Count>
        ) : null}
      </ListItem.EndContent>
    </ListItem>
  );
}

function ChannelListItemIcon({
  model,
  useTypeIcon,
}: {
  model: db.ChannelWithLastPostAndMembers;
  useTypeIcon?: boolean;
}) {
  const backgroundColor = model.iconImageColor as ColorProp;
  if (useTypeIcon) {
    const icon = getChannelIcon(model.type);
    return (
      <ListItem.SystemIcon icon={icon} backgroundColor={backgroundColor} />
    );
  } else if (model.type === 'dm') {
    return (
      <ListItem.AvatarIcon
        backgroundColor={'red'}
        contactId={model.members?.[0]?.contactId!}
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
    } else {
      return (
        <ListItem.TextIcon
          fallbackText={getChannelTitle(model)}
          backgroundColor={backgroundColor}
        />
      );
    }
  }
}

const getChannelIcon = (type: db.Channel['type']): IconType => {
  switch (type) {
    case 'dm':
      return 'Face';
    case 'groupDm':
      return 'Face';
    case 'chat':
      return 'ChannelTalk';
    case 'notebook':
      return 'ChannelNotebooks';
    case 'gallery':
      return 'ChannelGalleries';
    default:
      return 'ChannelTalk';
  }
};
