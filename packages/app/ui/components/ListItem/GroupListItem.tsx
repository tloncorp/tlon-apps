// sort-imports-ignore
import type * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import { View, isWeb } from 'tamagui';

import { useGroupTitle } from '../../utils';
import { Badge } from '../Badge';
import { ContactName } from '../ContactNameV2';
import { Pressable } from '@tloncorp/ui';
import { ListItem, ListItemProps } from './ListItem';
import { getGroupStatus, getPostTypeIcon } from './listItemUtils';
import { ChatOptionsSheet } from '../ChatOptionsSheet';
import { useState, useRef, useEffect } from 'react';

export const GroupListItem = ({
  model,
  onPress,
  onLongPress,
  customSubtitle,
  disableOptions = false,
  ...props
}: { customSubtitle?: string } & ListItemProps<db.Group>) => {
  const [open, setOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<number | null>(
    null
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const unreadCount = model.unread?.count ?? 0;
  const notified = model.unread?.notify ?? false;
  const title = useGroupTitle(model);
  const { isPending, label: statusLabel, isErrored } = getGroupStatus(model);

  useEffect(() => {
    if (isWeb && !isPending && !disableOptions && containerRef.current) {
      const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        setContextMenuPosition(e.clientX);
        setOpen(true);
      };

      const element = containerRef.current;
      element.addEventListener('contextmenu', handleContextMenu);

      return () => {
        element.removeEventListener('contextmenu', handleContextMenu);
      };
    }
  }, [disableOptions, isPending]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setContextMenuPosition(null);
    }
  };

  const handlePress = logic.useMutableCallback(() => {
    onPress?.(model);
  });

  const handleLongPress = logic.useMutableCallback(() => {
    onLongPress?.(model);
  });

  const isSingleChannel = model.channels?.length === 1;

  return (
    <View ref={containerRef}>
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
                    notified={notified}
                    count={unreadCount}
                    muted={logic.isMuted(model.volumeSettings?.level, 'group')}
                    marginTop={isWeb ? 3 : 'unset'}
                  />
                </>
              )}
            </ListItem.EndContent>
          )}
        </ListItem>
      </Pressable>
      {isWeb && !isPending && !disableOptions && (
        <ChatOptionsSheet
          open={open}
          onOpenChange={handleOpenChange}
          chat={{ type: 'group', id: model.id }}
          trigger={
            contextMenuPosition && (
              <View
                position="absolute"
                left={contextMenuPosition}
                width={1}
                height={1}
                opacity={0}
                pointerEvents="none"
              />
            )
          }
        />
      )}
    </View>
  );
};
