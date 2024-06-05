import type * as db from '@tloncorp/shared/dist/db';
import { ColorProp, View } from 'tamagui';

import * as utils from '../../utils';
import { Badge } from '../Badge';
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
                  color="$secondaryText"
                />
                :{' '}
              </>
            ) : null}
            {model.lastPost.textContent ?? ''}
          </ListItem.Subtitle>
        )}
      </ListItem.MainContent>
      {model.isDmInvite ? (
        <ListItem.EndContent justifyContent="center">
          <Badge text="Invite" />
        </ListItem.EndContent>
      ) : (
        <ListItem.EndContent>
          {model.lastPost && <ListItem.Time time={model.lastPost.receivedAt} />}
          {model.unread?.count && model.unread.count > 0 ? (
            <ListItem.Count>{model.unread.count}</ListItem.Count>
          ) : (
            // Add a spacer to keep the layout consistent
            <View height={23} />
          )}
        </ListItem.EndContent>
      )}
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
  } else if (model.type === 'dm') {
    return (
      <View borderRadius="$2xl" overflow="hidden">
        <ListItem.AvatarIcon
          contactId={model.members?.[0]?.contactId ?? model.id}
          contact={model.members?.[0]?.contact}
        />
      </View>
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
