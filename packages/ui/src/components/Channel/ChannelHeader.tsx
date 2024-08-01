import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useMemo, useState } from 'react';

import { Dots, Search } from '../../assets/icons';
import { useCurrentUserId } from '../../contexts/appDataContext';
import { ActionSheet } from '../ActionSheet';
import {
  getPostActions,
  handleAction,
} from '../ChatMessage/ChatMessageActions/MessageActions';
import { GenericHeader } from '../GenericHeader';
import { IconButton } from '../IconButton';
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
  channelType,
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
  channelType?: db.ChannelType;
}) {
  const [showActionSheet, setShowActionSheet] = useState(false);
  const currentUserId = useCurrentUserId();

  const postActions = useMemo(() => {
    if (!post || !channelType || !currentUserId) return [];
    return getPostActions({ post, channelType }).filter((action) => {
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
    });
  }, [post, channelType, currentUserId]);

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
        {postActions.map((action) => (
          <ActionSheet.Action
            key={action.id}
            action={() => actionHandler(action.id)}
          >
            <ActionSheet.ActionTitle>{action.label}</ActionSheet.ActionTitle>
          </ActionSheet.Action>
        ))}
      </ActionSheet>
    </>
  );
}
