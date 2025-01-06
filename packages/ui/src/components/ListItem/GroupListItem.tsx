// sort-imports-ignore
import type * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import { Popover, View, isWeb } from 'tamagui';

import { useGroupTitle } from '../../utils';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { ContactName } from '../ContactNameV2';
import { Icon } from '../Icon';
import Pressable from '../Pressable';
import { ListItem, ListItemProps } from './ListItem';
import { getGroupStatus, getPostTypeIcon } from './listItemUtils';
import ActionList from '../ActionList';

export const GroupListItem = ({
  model,
  onPress,
  onLongPress,
  customSubtitle,
  ...props
}: { customSubtitle?: string } & ListItemProps<db.Group>) => {
  const unreadCount = model.unread?.count ?? 0;
  const title = useGroupTitle(model);
  const { isPending, label: statusLabel, isErrored } = getGroupStatus(model);

  const handlePress = logic.useMutableCallback(() => {
    onPress?.(model);
  });

  const handleLongPress = logic.useMutableCallback(() => {
    onLongPress?.(model);
  });

  const isSingleChannel = model.channels?.length === 1;

  return (
    <View>
      <Pressable
        borderRadius="$xl"
        onPress={handlePress}
        onLongPress={handleLongPress}
      >
        <ListItem {...props} alignItems={isPending ? 'center' : 'stretch'}>
          <ListItem.GroupIcon model={model} />
          <ListItem.MainContent>
            <ListItem.Title>{title}</ListItem.Title>
            {customSubtitle ? (
              <ListItem.Subtitle>{customSubtitle}</ListItem.Subtitle>
            ) : isSingleChannel ? (
              <ListItem.SubtitleWithIcon icon="ChannelMultiDM">
                Group
              </ListItem.SubtitleWithIcon>
            ) : model.lastPost ? (
              <ListItem.SubtitleWithIcon
                icon={getPostTypeIcon(model.lastPost.type)}
              >
                {(model.channels?.length ?? 0) > 1
                  ? model.channels?.[0]?.title
                  : 'Group'}
              </ListItem.SubtitleWithIcon>
            ) : isPending && model.hostUserId ? (
              <>
                <ListItem.SubtitleWithIcon icon="Mail">
                  Group invitation
                </ListItem.SubtitleWithIcon>
                <ListItem.Subtitle>
                  Hosted by <ContactName contactId={model.hostUserId} />
                </ListItem.Subtitle>
              </>
            ) : null}
            {model.lastPost ? (
              <ListItem.PostPreview post={model.lastPost} />
            ) : !isPending ? (
              <ListItem.Subtitle>No posts yet</ListItem.Subtitle>
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
                    marginRight={isWeb ? '$s' : 'unset'}
                  />
                </>
              )}
            </ListItem.EndContent>
          )}
        </ListItem>
      </Pressable>
      {isWeb && !isPending && (
        // <Button
        //   position="absolute"
        //   right="$-2xs"
        //   top={22}
        //   zIndex={1}
        //   borderWidth="unset"
        //   paddingHorizontal={0}
        //   marginHorizontal="$-m"
        //   minimal
        // >
        //   <Icon type="Overflow" />
        // </Button>
        <Popover.Trigger asChild>
          <Button
            position="absolute"
            right="$-2xs"
            top={22}
            zIndex={1}
            borderWidth="unset"
            paddingHorizontal={0}
            marginHorizontal="$-m"
            minimal
          >
            <Icon type="Overflow" />
          </Button>
        </Popover.Trigger>
      )}
    </View>
  );
};
