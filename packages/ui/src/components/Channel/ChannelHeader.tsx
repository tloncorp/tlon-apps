import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useMemo, useState } from 'react';

import { Dots, Search } from '../../assets/icons';
import { ActionSheet } from '../ActionSheet';
import { getPostActions } from '../ChatMessage/ChatMessageActions/MessageActions';
import { GenericHeader } from '../GenericHeader';
import { IconButton } from '../IconButton';
import { BaubleHeader } from './BaubleHeader';

export function ChannelHeader({
  title,
  mode = 'default',
  channel,
  currentUserId,
  useGroup,
  pinned,
  group,
  goBack,
  goToSearch,
  showSpinner,
  showSearchButton = true,
  showMenuButton = false,
  post,
  channelType,
  onPressGroupMeta,
  onPressGroupMembers,
  onPressManageChannels,
  onPressInvitesAndPrivacy,
  onPressRoles,
  onPressLeave,
  onTogglePinned,
}: {
  title: string;
  mode?: 'default' | 'next';
  channel: db.Channel;
  group?: db.Group | null;
  currentUserId: string;
  pinned: db.Channel[];
  useGroup: typeof store.useGroup;
  goBack?: () => void;
  goToSearch?: () => void;
  showSpinner?: boolean;
  showSearchButton?: boolean;
  showMenuButton?: boolean;
  post?: db.Post;
  channelType?: db.ChannelType;
  onPressGroupMeta: () => void;
  onPressGroupMembers: () => void;
  onPressManageChannels: () => void;
  onPressInvitesAndPrivacy: () => void;
  onPressRoles: () => void;
  onPressLeave: () => void;
  onTogglePinned: () => void;
}) {
  const [showActionSheet, setShowActionSheet] = useState(false);

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

  if (mode === 'next') {
    return (
      <BaubleHeader
        channel={channel}
        group={group}
        useGroup={useGroup}
        showSpinner={showSpinner}
        currentUserId={currentUserId}
        onPressGroupMeta={onPressGroupMeta}
        onPressGroupMembers={onPressGroupMembers}
        onPressManageChannels={onPressManageChannels}
        onPressInvitesAndPrivacy={onPressInvitesAndPrivacy}
        onPressRoles={onPressRoles}
        onPressLeave={onPressLeave}
        onTogglePinned={onTogglePinned}
        pinned={pinned}
      />
    );
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
          <ActionSheet.Action key={action.id} action={() => ({})}>
            <ActionSheet.ActionTitle>{action.label}</ActionSheet.ActionTitle>
          </ActionSheet.Action>
        ))}
      </ActionSheet>
    </>
  );
}
