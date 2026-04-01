import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';
import * as ub from '@tloncorp/api/urbit';
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

export function ChatVolumeScreen(props: Props) {
  const { chatType, chatId, groupId } = props.route.params;
  const chatSettings = useChatSettingsNavigation();

  return (
    <ChatOptionsProvider
      initialChat={{
        type: chatType,
        id: chatId,
      }}
      {...chatSettings}
    >
      <ChatVolumeScreenView chatType={chatType} chatId={chatId} groupId={groupId} />
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
  groupId,
}: {
  chatType: 'group' | 'channel';
  chatId: string;
  groupId?: string;
}) {
  const navigation = useNavigation();
  const { navigateToChatDetails } = useRootNavigation();
  const { updateVolume, group, channel } = useChatOptions();
  const isWindowNarrow = useIsWindowNarrow();

  const { data: currentChannelVolume } = store.useChannelVolumeLevel(
    channel?.id ?? ''
  );
  const { data: currentGroupVolume } = store.useGroupVolumeLevel(
    group?.id ?? ''
  );

  const currentVolumeLevel =
    chatType === 'channel' ? currentChannelVolume : currentGroupVolume;

  const handleGoBack = useCallback(() => {
    // On mobile, just go back. On desktop, navigate explicitly since
    // HomeDrawer is a drawer navigator where goBack() doesn't work as expected.
    if (isWindowNarrow || !chatId) {
      navigation.goBack();
    } else {
      navigateToChatDetails({ type: chatType, id: chatId, groupId });
    }
  }, [navigateToChatDetails, navigation, chatType, chatId, groupId, isWindowNarrow]);

  return (
    <View backgroundColor={'$secondaryBackground'} flex={1}>
      <ScreenHeader
        title="Notifications"
        subtitle={
          chatType === 'channel'
            ? `${group?.title}: ${channel?.title}`
            : group?.title
        }
        showSubtitle={
          (chatType === 'channel' && !!channel?.title && !!group?.title) ||
          (chatType === 'group' && !!group?.title)
        }
        backgroundColor="$secondaryBackground"
        backAction={handleGoBack}
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
