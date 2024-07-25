import * as db from '@tloncorp/shared/dist/db';
import { useMemo, useState } from 'react';

import { Add, Dots, Search } from '../../assets/icons';
import { useCurrentUserId } from '../../contexts/appDataContext';
import { ActionSheet } from '../ActionSheet';
import { getPostActions } from '../ChatMessage/ChatMessageActions/MessageActions';
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
  channelType,
  onAddPress,
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
  channelType?: db.ChannelType;
  onAddPress?: () => void;
}) {
  const [showActionSheet, setShowActionSheet] = useState(false);
  const currentUserId = useCurrentUserId();
  const postActions = useMemo(() => {
    if (!post || !channelType || !currentUserId) return [];
    return getPostActions({ post, channelType }).filter((action) => {
      switch (action.id) {
        case 'startThread':
          return false;
        case 'edit':
          return post.authorId === currentUserId;
        default:
          return true;
      }
    });
  }, [post, channelType, currentUserId]);

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
            {onAddPress && (
              <IconButton onPress={onAddPress}>
                <Add />
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
