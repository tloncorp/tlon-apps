import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';
import * as ub from '@tloncorp/shared/urbit';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { RootStackParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import {
  ChatOptionsProvider,
  Form,
  ScreenHeader,
  View,
  useChatOptions,
} from '../../ui';

export function ChatVolumeScreen(
  props: NativeStackScreenProps<RootStackParamList, 'ChatVolume'>
) {
  const { chatType, chatId } = props.route.params;

  return (
    <ChatOptionsProvider
      initialChat={{
        type: chatType,
        id: chatId,
      }}
      {...useChatSettingsNavigation()}
    >
      <ChatVolumeScreenView chatType={chatType} />
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

function ChatVolumeScreenView({ chatType }: { chatType: 'group' | 'channel' }) {
  const { navigateBack } = useRootNavigation();
  const { updateVolume, group, channel } = useChatOptions();

  const { data: currentChannelVolume } = store.useChannelVolumeLevel(
    channel?.id ?? ''
  );
  const { data: currentGroupVolume } = store.useGroupVolumeLevel(
    group?.id ?? ''
  );

  const currentVolumeLevel =
    chatType === 'channel' ? currentChannelVolume : currentGroupVolume;

  return (
    <View backgroundColor={'$secondaryBackground'} flex={1}>
      <ScreenHeader title="Notifications" backAction={navigateBack} />
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
