import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useMemo, useState } from 'react';

import { Dots, Search } from '../../assets/icons';
import { useCurrentUserId } from '../../contexts/appDataContext';
import { ActionGroup, ActionSheet } from '../ActionSheetV2';
import {
  getPostActions,
  handleAction,
} from '../ChatMessage/ChatMessageActions/MessageActions';
import { GenericHeader } from '../GenericHeader';
import { IconButton } from '../IconButton';
import { ListItem } from '../ListItem';
import { BaubleHeader } from './BaubleHeader';

export function ChannelHeader({
  title,
  mode = 'default',
  channel,
  group,
  goBack,
  goToSearch,
  showSpinner,
  showSearchButton = true,
  showMenuButton = false,
  post,
  setEditingPost,
}: {
  title: string;
  mode?: 'default' | 'next';
  channel: db.Channel;
  group?: db.Group | null;
  goBack?: () => void;
  goToSearch?: () => void;
  showSpinner?: boolean;
  showSearchButton?: boolean;
  showMenuButton?: boolean;
  post?: db.Post;
  setEditingPost?: (post: db.Post) => void;
}) {
  const [showActionSheet, setShowActionSheet] = useState(false);
  const currentUserId = useCurrentUserId();

  const actionHandler = useCallback(
    (actionId: string) => {
      if (!post || !setEditingPost) return;

      handleAction({
        id: actionId,
        post,
        userId: currentUserId,
        channel,
        dismiss: () => setShowActionSheet(false),
        addAttachment: () => {},
        onEdit: () => setEditingPost(post),
      });
    },
    [post, currentUserId, channel, setEditingPost]
  );

  const actionGroups: ActionGroup[] = useMemo(() => {
    if (!post || !channel.type || !currentUserId) return [];
    return [
      {
        accent: 'neutral',
        actions: getPostActions({ post, channelType: channel.type })
          .filter((action) => {
            switch (action.id) {
              case 'startThread':
                // if undelivered or already in a thread, don't show reply
                return false;
              case 'edit':
                // only show edit for current user's posts
                return post.authorId === currentUserId;
              // TODO: delete case should only be shown for admins or the author
              default:
                return true;
            }
          })
          .map((item) => ({
            title: item.label,
            action: () => actionHandler(item.id),
          })),
      },
    ];
  }, [post, channel, currentUserId, actionHandler]);

  if (mode === 'next') {
    return <BaubleHeader channel={channel} group={group} />;
  }

  return (
    <>
      <GenericHeader
        title={title}
        goBack={goBack}
        showSpinner={showSpinner}
        rightContent={
          <>
            {showSearchButton && (
              <IconButton onPress={goToSearch}>
                <Search />
              </IconButton>
            )}
            {showMenuButton && (
              <IconButton onPress={() => setShowActionSheet(true)}>
                <Dots />
              </IconButton>
            )}
          </>
        }
      />
      <ActionSheet
        open={showActionSheet}
        onOpenChange={setShowActionSheet}
        snapPointsMode="percent"
        snapPoints={[60]}
      >
        <ActionSheet.Header>
          {channel && <ListItem.ChannelIcon model={channel} />}
          <ListItem.MainContent>
            <ListItem.Title>{title}</ListItem.Title>
          </ListItem.MainContent>
        </ActionSheet.Header>
        <ActionSheet.ScrollView>
          {actionGroups.map((group, i) => {
            return (
              <ActionSheet.ActionGroup key={i} accent={group.accent}>
                {group.actions.map((action, index) => (
                  <ActionSheet.Action key={index} action={action} />
                ))}
              </ActionSheet.ActionGroup>
            );
          })}
        </ActionSheet.ScrollView>
      </ActionSheet>
    </>
  );
}
