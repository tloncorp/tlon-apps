// sort-imports-ignore
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import { Button, Icon, Pressable } from '@tloncorp/ui';
import { View, isWeb } from 'tamagui';

import { useGroupTitle } from '../../utils';
import { Badge } from '../Badge';
import { ContactName } from '../ContactNameV2';
import { ListItem, ListItemProps } from './ListItem';
import { getGroupStatus, getPostTypeIcon } from './listItemUtils';
import { ChatOptionsSheet } from '../ChatOptionsSheet';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useChatOptions, useContact } from '../../contexts';

export const GroupListItem = ({
  model,
  onPress,
  onLongPress,
  customSubtitle,
  disableOptions = false,
  ...props
}: { customSubtitle?: string } & ListItemProps<db.Group>) => {
  const [open, setOpen] = useState(false);
  const { setChat } = useChatOptions(disableOptions);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const unreadCount = model.unread?.count ?? 0;
  const notified = model.unread?.notify ?? false;
  const { isPending, label: statusLabel, isErrored } = getGroupStatus(model);
  const hostContact = useContact(model.hostUserId);
  const title = useGroupTitle(model, hostContact);

  const handleHoverIn = useCallback(() => {
    if (isWeb) {
      setIsHovered(true);
    }
  }, []);

  const handleHoverOut = useCallback(() => {
    if (isWeb) {
      setIsHovered(false);
    }
  }, []);

  const triggerButton = useMemo(
    () => (
      <Button
        backgroundColor="transparent"
        borderWidth="unset"
        paddingLeft={0}
        paddingRight="$s"
        marginHorizontal="$-m"
        minimal
        onPress={(e) => {
          e.stopPropagation();
        }}
      >
        <Icon type="Overflow" />
      </Button>
    ),
    []
  );

  useEffect(() => {
    if (isWeb && !isPending && !disableOptions && containerRef.current) {
      const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        setOpen(true);
        setChat({
          type: 'group',
          id: model.id,
        });
      };

      const element = containerRef.current;
      element.addEventListener('contextmenu', handleContextMenu);

      return () => {
        element.removeEventListener('contextmenu', handleContextMenu);
      };
    }
  }, [disableOptions, isPending, model.id, setChat]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setChat(null);
      setIsHovered(false);
    }
  };

  const handlePress = logic.useMutableCallback(() => {
    onPress?.(model);
  });

  const handleLongPress = logic.useMutableCallback(() => {
    onLongPress?.(model);
  });

  const isSingleChannel = model.channels?.length === 1;

  const wayfindingProgress = db.wayfindingProgress.useValue();
  const shouldHighlight = useMemo(() => {
    if (!model.isPersonalGroup) {
      return false;
    }

    const hasCoachMarks =
      !wayfindingProgress?.tappedAddCollection ||
      !wayfindingProgress?.tappedAddNote ||
      !wayfindingProgress?.tappedChatInput;

    return !wayfindingProgress?.viewedPersonalGroup && hasCoachMarks;
  }, [
    model.isPersonalGroup,
    wayfindingProgress?.tappedAddCollection,
    wayfindingProgress?.tappedAddNote,
    wayfindingProgress?.tappedChatInput,
    wayfindingProgress?.viewedPersonalGroup,
  ]);

  return (
    <View ref={containerRef}>
      <Pressable
        borderRadius="$xl"
        onPress={open ? undefined : handlePress}
        onLongPress={isWeb ? undefined : handleLongPress}
        hoverStyle={{ backgroundColor: '$secondaryBackground' }}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
        testID={`GroupListItem-${model.title || 'Untitled group'}`}
      >
        <ListItem
          {...props}
          alignItems={isPending ? 'center' : 'stretch'}
          backgroundColor={shouldHighlight ? '$positiveBackground' : 'unset'}
        >
          <ListItem.GroupIcon model={model} />
          <ListItem.MainContent>
            {isPending && model.hostUserId ? (
              <ListItem.Title numberOfLines={1} ellipsizeMode="tail" flexShrink={1} maxWidth="100%">
                New group by <ContactName contactId={model.hostUserId} mode="auto" maxWidth="70%" />
              </ListItem.Title>
            ) : (
              <ListItem.Title>{title}</ListItem.Title>
            )}
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
                  Hosted by{' '}
                  <ContactName contactId={model.hostUserId} numberOfLines={1} />
                </ListItem.Subtitle>
              </>
            ) : null}
            {model.lastPost ? (
              <ListItem.PostPreview post={model.lastPost} />
            ) : !isPending ? (
              model.isPersonalGroup ? (
                <ListItem.Subtitle>Your personal group</ListItem.Subtitle>
              ) : (
                <ListItem.Subtitle>No posts yet</ListItem.Subtitle>
              )
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
                    opacity={isHovered ? 0 : 1}
                    notified={notified}
                    count={unreadCount}
                    muted={logic.isMuted(model.volumeSettings?.level, 'group')}
                    marginTop={isWeb ? 3 : 'unset'}
                    testID="UnreadCount"
                  />
                </>
              )}
            </ListItem.EndContent>
          )}
        </ListItem>
        {isWeb && !isPending && !disableOptions && (isHovered || open) && (
          <View position="absolute" right={10} top="$2xl">
            <ChatOptionsSheet
              open={open}
              onOpenChange={handleOpenChange}
              chat={{ type: 'group', id: model.id }}
              trigger={triggerButton}
            />
          </View>
        )}
      </Pressable>
    </View>
  );
};
