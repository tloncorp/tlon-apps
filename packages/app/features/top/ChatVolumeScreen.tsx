import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';
import * as ub from '@tloncorp/shared/urbit';
import { useCallback } from 'react';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import {
  GroupSettingsStackParamList,
  RootStackParamList,
} from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import {
  ChatOptionsProvider,
  Form,
  ScreenHeader,
  View,
  useChatOptions,
  useIsWindowNarrow,
} from '../../ui';

// Account for both root and group settings navigation stacks
type RootStackProps = NativeStackScreenProps<RootStackParamList, 'ChatVolume'>;
type GroupSettingsProps = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'ChatVolume'
>;
type Props = RootStackProps | GroupSettingsProps;

// Check if we're in group settings stack
function isGroupSettingsProps(props: Props): props is GroupSettingsProps {
  return 'fromChatDetails' in props.route.params;
}

export function ChatVolumeScreen(props: Props) {
  const { chatType, chatId } = props.route.params;
  const chatSettings = useChatSettingsNavigation();

  return (
    <ChatOptionsProvider
      initialChat={{
        type: chatType,
        id: chatId,
      }}
      {...chatSettings}
    >
      <ChatVolumeScreenView
        chatType={chatType}
        chatId={chatId}
        fromChatDetails={
          isGroupSettingsProps(props)
            ? props.route.params.fromChatDetails
            : false
        }
      />
    </ChatOptionsProvider>
  );
}

export const volumeOptions: {
  title: string;
  value: ub.NotificationLevel;
}[] = [
  {
    title: 'All activity',
    value: 'loud',
  },
  {
    title: 'Posts, mentions, and replies',
    value: 'medium',
  },
  {
    title: 'Mentions and replies',
    value: 'soft',
  },
  {
    title: 'Nothing',
    value: 'hush',
  },
];

function ChatVolumeScreenView({
  chatType,
  chatId,
  fromChatDetails,
}: {
  chatType: 'group' | 'channel';
  chatId: string;
  fromChatDetails?: boolean;
}) {
  const navigation = useNavigation();
  const { navigateToChatDetails } = useRootNavigation();
  const { updateVolume, group, channel } = useChatOptions();

  const { data: currentChannelVolume } = store.useChannelVolumeLevel(
    channel?.id ?? ''
  );
  const { data: currentGroupVolume } = store.useGroupVolumeLevel(
    group?.id ?? ''
  );

  const currentVolumeLevel =
    chatType === 'channel' ? currentChannelVolume : currentGroupVolume;

  const handleBackNavigation = useCallback(() => {
    if (fromChatDetails && group?.id) {
      navigateToChatDetails({ type: 'group', id: group.id });
    } else if (chatType === 'group' && chatId) {
      navigateToChatDetails({ type: chatType, id: chatId });
    } else {
      navigation.goBack();
    }
  }, [
    navigateToChatDetails,
    group,
    fromChatDetails,
    navigation,
    chatType,
    chatId,
  ]);

  const isWindowNarrow = useIsWindowNarrow();

  return (
    <View backgroundColor={'$secondaryBackground'} flex={1}>
      <ScreenHeader
        title="Notifications"
        backAction={handleBackNavigation}
        useHorizontalTitleLayout={!isWindowNarrow}
      />
      <Form.FormFrame backgroundType="secondary">
        <Form.RadioInput
          options={volumeOptions}
          value={currentVolumeLevel}
          onChange={updateVolume}
        />
      </Form.FormFrame>
    </View>
  );
}
