import type * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import { Pressable } from '@tloncorp/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, isWeb } from 'tamagui';

import { useNavigation } from '../../contexts';
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
  onLayout,
  ...props
}: {
  useTypeIcon?: boolean;
  customSubtitle?: string;
  dimmed?: boolean;
  onLayout?: (e: any) => void;
} & ListItemProps<db.Channel>) {
  const [open, setOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<number | null>(
    null
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const unreadCount = model.unread?.count ?? 0;
  const notified = model.unread?.notify ?? false;
  const title = utils.useChannelTitle(model);
  const firstMemberId = model.members?.[0]?.contactId ?? '';
  const memberCount = model.members?.length ?? 0;

  useEffect(() => {
    if (isWeb && !disableOptions && containerRef.current) {
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
  }, [disableOptions]);

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

  return (
    <View ref={containerRef}>
      <Pressable
        borderRadius="$xl"
        onPress={handlePress}
        onLongPress={isWeb ? undefined : handleLongPress}
        backgroundColor={isFocused ? '$shadow' : undefined}
        hoverStyle={{ backgroundColor: '$secondaryBackground' }}
      >
        <ListItem onLayout={onLayout} {...props}>
          <ListItem.ChannelIcon
            model={model}
            useTypeIcon={useTypeIcon}
            dimmed={dimmed}
          />
          <ListItem.MainContent>
            <ListItem.Title dimmed={dimmed}>{title}</ListItem.Title>
            {customSubtitle ? (
              <ListItem.Subtitle>{customSubtitle}</ListItem.Subtitle>
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
                  notified={notified}
                  count={unreadCount}
                  muted={logic.isMuted(model.volumeSettings?.level, 'channel')}
                  marginTop={isWeb ? 3 : 'unset'}
                />
              )}
            </ListItem.EndContent>
          )}
        </ListItem>
      </Pressable>
      {isWeb && !disableOptions && (
        <ChatOptionsSheet
          open={open}
          onOpenChange={handleOpenChange}
          chat={{ type: 'channel', id: model.id }}
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
}
