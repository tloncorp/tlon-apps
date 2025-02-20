// sort-imports-ignore
import type * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import { View, isWeb } from 'tamagui';

import { useGroupTitle } from '../../utils';
import { Badge } from '../Badge';
import { Button } from '@tloncorp/ui';
import { ContactName } from '../ContactNameV2';
import { Icon } from '@tloncorp/ui';
import Pressable from '@tloncorp/ui';
import { ListItem, ListItemProps } from './ListItem';
import { getGroupStatus, getPostTypeIcon } from './listItemUtils';
import { ChatOptionsSheet } from '../ChatOptionsSheet';
import { useState } from 'react';
import useIsWindowNarrow from '@tloncorp/ui';

export const GroupListItem = ({
  model,
  onPress,
  onLongPress,
  customSubtitle,
  disableOptions = false,
  ...props
}: { customSubtitle?: string } & ListItemProps<db.Group>) => {
  const [open, setOpen] = useState(false);
  const unreadCount = model.unread?.count ?? 0;
  const title = useGroupTitle(model);
  const { isPending, label: statusLabel, isErrored } = getGroupStatus(model);
  const isWindowNarrow = useIsWindowNarrow();

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
      {isWeb && !isPending && !disableOptions && (
        <View position="absolute" right="$-2xs" top="$2xl" zIndex={1}>
          {isWindowNarrow ? (
            <Button
              onPress={handleLongPress}
              borderWidth="unset"
              paddingHorizontal={0}
              marginHorizontal="$-m"
              minimal
            >
              <Icon type="Overflow" />
            </Button>
          ) : (
            <ChatOptionsSheet
              open={open}
              onOpenChange={setOpen}
              chat={{ type: 'group', id: model.id }}
              trigger={
                <Button
                  backgroundColor="transparent"
                  borderWidth="unset"
                  paddingHorizontal={0}
                  marginHorizontal="$-m"
                  minimal
                >
                  <Icon type="Overflow" />
                </Button>
              }
            />
          )}
        </View>
      )}
    </View>
  );
};
