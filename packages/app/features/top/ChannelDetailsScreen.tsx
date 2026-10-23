import { useCallback } from 'react';

import { useRootNavigation } from '../../navigation/utils';
import { useChatOptions, useIsWindowNarrow } from '../../ui';
import { ChatDetailsView } from './chatDetails';

/** A channel's info, as opened from a group's channel list. */
export function ChannelDetailsScreenView({
  onGoBack,
  onEditChannelMeta,
  onEditChannelPrivacy,
  onAfterDeleteChannel,
}: {
  onGoBack?: () => void;
  onEditChannelMeta: (channelId: string, groupId: string) => void;
  onEditChannelPrivacy: (channelId: string, groupId: string) => void;
  onAfterDeleteChannel?: () => void;
}) {
  const { channel } = useChatOptions();
  const { navigateToChannel, navigateBack } = useRootNavigation();
  const isWindowNarrow = useIsWindowNarrow();

  const handlePressEdit = useCallback(() => {
    if (channel && channel.groupId) {
      onEditChannelMeta(channel.id, channel.groupId);
    }
  }, [channel, onEditChannelMeta]);

  const handleGoBack = useCallback(() => {
    if (onGoBack) {
      onGoBack();
      return;
    }
    if (isWindowNarrow) {
      navigateBack();
    } else if (channel) {
      navigateToChannel(channel);
    } else {
      navigateBack();
    }
  }, [onGoBack, channel, navigateToChannel, navigateBack, isWindowNarrow]);

  return (
    <ChatDetailsView
      chatType="channel"
      onGoBack={handleGoBack}
      onPressEdit={handlePressEdit}
      onEditChannelPrivacy={onEditChannelPrivacy}
      onAfterDeleteChannel={onAfterDeleteChannel}
    />
  );
}
