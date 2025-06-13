import type * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import { Button, Icon, Pressable, RawText } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, isWeb } from 'tamagui';

import { useChatOptions, useNavigation } from '../../contexts';
import * as utils from '../../utils';
import { capitalize } from '../../utils';
import { Badge } from '../Badge';
import { ChatOptionsSheet } from '../ChatOptionsSheet';
import { ListItem, type ListItemProps } from './ListItem';

export function ChannelListItem({
  model,
  useTypeIcon,
  customSubtitle,
  onPress,
  onLongPress,
  EndContent,
  dimmed,
  disableOptions = false,
  showGroupTitle = false,
  onLayout,
  ...props
}: {
  showGroupTitle?: boolean;
  useTypeIcon?: boolean;
  customSubtitle?: string;
  dimmed?: boolean;
  onLayout?: (e: any) => void;
} & ListItemProps<db.Channel>) {
  const [open, setOpen] = useState(false);
  const { setChat } = useChatOptions(disableOptions);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const unreadCount = model.unread?.count ?? 0;
  const notified = model.unread?.notify ?? false;
  const title = utils.useChannelTitle(model);
  const firstMemberId = model.members?.[0]?.contactId ?? '';
  const memberCount = model.members?.length ?? 0;

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
    if (isWeb && !disableOptions && containerRef.current) {
      const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        setOpen(true);
        setChat({
          type: 'channel',
          id: model.id,
        });
      };

      const element = containerRef.current;
      element.addEventListener('contextmenu', handleContextMenu);

      return () => {
        element.removeEventListener('contextmenu', handleContextMenu);
      };
    }
  }, [disableOptions, setChat, model.id]);

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

  const { subtitle, subtitleIcon } = useMemo(() => {
    if (model.type === 'dm' || model.type === 'groupDm') {
      return {
        subtitle: [
          utils.formatUserId(firstMemberId)?.display,
          memberCount > 2 && `and ${memberCount - 1} others`,
        ]
          .filter((v) => !!v)
          .join(' '),
        subtitleIcon: memberCount > 2 ? 'ChannelMultiDM' : 'ChannelDM',
      } as const;
    } else {
      return {
        subtitle: capitalize(model.type),
        subtitleIcon: utils.getChannelTypeIcon(model.type),
      } as const;
    }
  }, [model, firstMemberId, memberCount]);

  const isFocused = useNavigation().focusedChannelId === model.id;
  const groupTitle = utils.useGroupTitle(model.group);

  return (
    <View ref={containerRef}>
      <Pressable
        borderRadius="$xl"
        onPress={open ? undefined : handlePress}
        onLongPress={isWeb ? undefined : handleLongPress}
        backgroundColor={isFocused ? '$shadow' : undefined}
        hoverStyle={{ backgroundColor: '$secondaryBackground' }}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
      >
        <ListItem
          onLayout={onLayout}
          {...props}
          testID={
            model.type === 'dm' || model.type === 'groupDm'
              ? `ChannelListItem-${model.id}`
              : `ChannelListItem-${model.title}`
          }
        >
          <ListItem.ChannelIcon
            model={model}
            useTypeIcon={useTypeIcon}
            dimmed={dimmed}
          />
          <ListItem.MainContent>
            <ListItem.Title dimmed={dimmed}>{title}</ListItem.Title>
            {customSubtitle ? (
              <ListItem.Subtitle>{customSubtitle}</ListItem.Subtitle>
            ) : showGroupTitle && model.group ? (
              <ListItem.Subtitle>{groupTitle}</ListItem.Subtitle>
            ) : (model.type === 'dm' || model.type === 'groupDm') &&
              utils.hasNickname(model.members?.[0]?.contact) ? (
              <ListItem.SubtitleWithIcon icon={subtitleIcon}>
                {subtitle}
              </ListItem.SubtitleWithIcon>
            ) : null}
            {model.lastPost && !model.isDmInvite && (
              <ListItem.PostPreview
                post={model.lastPost}
                showAuthor={model.type !== 'dm'}
              />
            )}
          </ListItem.MainContent>

          {EndContent ?? (
            <ListItem.EndContent>
              {model.lastPost?.receivedAt ? (
                <ListItem.Time time={model.lastPost.receivedAt} />
              ) : null}

              {model.isDmInvite ? (
                <Badge text="Invite" />
              ) : (
                <ListItem.Count
                  opacity={isHovered ? 0 : 1}
                  notified={notified}
                  count={unreadCount}
                  muted={logic.isMuted(model.volumeSettings?.level, 'channel')}
                  marginTop={isWeb ? 3 : 'unset'}
                />
              )}
            </ListItem.EndContent>
          )}
        </ListItem>
        {isWeb && !disableOptions && (isHovered || open) && (
          <View position="absolute" right={10} top="$2xl">
            <ChatOptionsSheet
              open={open}
              onOpenChange={handleOpenChange}
              chat={{ type: 'channel', id: model.id }}
              trigger={triggerButton}
            />
          </View>
        )}
      </Pressable>
    </View>
  );
}
