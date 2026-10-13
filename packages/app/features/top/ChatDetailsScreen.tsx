import { useRoute } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { RootStackParamList, RootStackRouteProp } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import {
  ChatOptionsProvider,
  ForwardGroupSheetProvider,
  InviteUsersSheet,
  useChatOptions,
  useIsWindowNarrow,
} from '../../ui';
import { ChatDetailsView } from './chatDetails';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatDetails'>;

export function ChatDetailsScreen(props: Props) {
  const { chatType, chatId } = props.route.params;

  const { navigation } = useRootNavigation();
  const isWindowNarrow = useIsWindowNarrow();
  const [inviteSheetGroup, setInviteSheetGroup] = useState<string | null>(null);

  const handleInvitePressed = useCallback(
    (groupId: string) => {
      if (isWindowNarrow) {
        // Mobile: Use navigation to screen
        navigation.navigate('InviteUsers', { groupId });
      } else {
        // Desktop: Use sheet
        setInviteSheetGroup(groupId);
      }
    },
    [isWindowNarrow, navigation]
  );

  return (
    <ForwardGroupSheetProvider>
      <ChatOptionsProvider
        key={`${chatType}-${chatId}`}
        initialChat={{
          type: chatType,
          id: chatId,
        }}
        onPressInvite={handleInvitePressed}
        {...useChatSettingsNavigation()}
      >
        <ChatDetailsScreenView />
        {!isWindowNarrow && (
          <InviteUsersSheet
            open={inviteSheetGroup !== null}
            onOpenChange={(open) => {
              if (!open) {
                setInviteSheetGroup(null);
              }
            }}
            groupId={inviteSheetGroup ?? undefined}
            onInviteComplete={() => setInviteSheetGroup(null)}
          />
        )}
      </ChatOptionsProvider>
    </ForwardGroupSheetProvider>
  );
}

function ChatDetailsScreenView() {
  const {
    params: { chatType, chatId },
  } = useRoute<RootStackRouteProp<'ChatDetails'>>();
  const { channel, group } = useChatOptions();
  const {
    onPressGroupMeta: navigateToGroupMeta,
    onPressEditChannelMeta,
    onPressEditChannelPrivacy,
  } = useChatSettingsNavigation();
  const { navigateToGroup, navigateToChannel, navigateBack } =
    useRootNavigation();
  const isWindowNarrow = useIsWindowNarrow();

  const handlePressEdit = useCallback(() => {
    if (chatType === 'group' && group) {
      navigateToGroupMeta(group.id);
    } else if (chatType === 'channel' && channel && channel.groupId) {
      onPressEditChannelMeta(channel.id, channel.groupId, true);
    }
  }, [channel, chatType, group, onPressEditChannelMeta, navigateToGroupMeta]);

  const handleEditChannelPrivacy = useCallback(
    (channelId: string, groupId: string) => {
      onPressEditChannelPrivacy(channelId, groupId, true);
    },
    [onPressEditChannelPrivacy]
  );

  const handleGoBack = useCallback(() => {
    if (isWindowNarrow) {
      navigateBack();
    } else if (chatType === 'group') {
      navigateToGroup(chatId);
    } else if (chatType === 'channel' && channel) {
      navigateToChannel(channel);
    } else {
      navigateBack();
    }
  }, [
    chatType,
    chatId,
    channel,
    navigateToGroup,
    navigateToChannel,
    navigateBack,
    isWindowNarrow,
  ]);

  return (
    <ChatDetailsView
      chatType={chatType}
      onGoBack={handleGoBack}
      onPressEdit={handlePressEdit}
      onEditChannelPrivacy={handleEditChannelPrivacy}
    />
  );
}
