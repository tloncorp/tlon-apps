import type * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import { View, isWeb } from 'tamagui';

import useIsWindowNarrow from '../../hooks/useIsWindowNarrow';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { Icon } from '../Icon';
import Pressable from '../Pressable';
import type { ListItemProps } from './ListItem';
import { ListItem } from './ListItem';
import { getGroupStatus, getPostTypeIcon } from './listItemUtils';

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

  const handlePress = logic.useMutableCallback(() => {
    onPress?.(model);
  });

  const handleLongPress = logic.useMutableCallback(() => {
    onLongPress?.(model);
  });

  const isWindowNarrow = useIsWindowNarrow();

  return (
    <View>
      <Pressable
        borderRadius="$xl"
        onPress={handlePress}
        onLongPress={handleLongPress}
      >
        <ListItem
          {...props}
          alignItems={isPending ? 'center' : 'stretch'}
          padding={isWindowNarrow ? '$l' : '$m'}
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
                    marginRight={isWeb ? '$s' : 'unset'}
                  />
                </>
              )}
            </ListItem.EndContent>
          )}
        </ListItem>
      </Pressable>
      {isWeb && !isPending && (
        <View position="absolute" right="$-2xs" top="$2xl" zIndex={1}>
          <Button
            onPress={handleLongPress}
            borderWidth="unset"
            paddingHorizontal={0}
            marginHorizontal="$-m"
            minimal
          >
            <Icon type="Overflow" />
          </Button>
        </View>
      )}
    </View>
  );
};
