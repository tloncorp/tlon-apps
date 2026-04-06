import { useNavigation } from '@react-navigation/native';
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useCallback } from 'react';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { GroupSettingsStackParamList } from '../../navigation/types';
import { ChatOptionsProvider, ForwardGroupSheetProvider } from '../../ui';
import { ChannelDetailsScreenView } from '../top/ChannelDetailsScreen';

type Props = NativeStackScreenProps<GroupSettingsStackParamList, 'ChannelInfo'>;

export function ChannelInfoScreen(props: Props) {
  const { chatType, chatId, groupId } = props.route.params;
  const navigation =
    useNavigation<
      NativeStackNavigationProp<GroupSettingsStackParamList, 'ChannelInfo'>
    >();

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleEditChannelMeta = useCallback(
    (channelId: string, gId: string) => {
      navigation.navigate('EditChannelMeta', {
        channelId,
        groupId: gId,
        fromChannelInfo: true,
      });
    },
    [navigation]
  );

  const handleEditChannelPrivacy = useCallback(
    (channelId: string, gId: string) => {
      navigation.navigate('EditChannelPrivacy', {
        channelId,
        groupId: gId,
      });
    },
    [navigation]
  );

  const handleAfterDeleteChannel = useCallback(() => {
    navigation.navigate('ManageChannels', { groupId });
  }, [navigation, groupId]);

  return (
    <ForwardGroupSheetProvider>
      <ChatOptionsProvider
        key={`${chatType}-${chatId}`}
        initialChat={{ type: chatType, id: chatId }}
        {...useChatSettingsNavigation()}
      >
        <ChannelDetailsScreenView
          onGoBack={handleGoBack}
          onEditChannelMeta={handleEditChannelMeta}
          onEditChannelPrivacy={handleEditChannelPrivacy}
          onAfterDeleteChannel={handleAfterDeleteChannel}
        />
      </ChatOptionsProvider>
    </ForwardGroupSheetProvider>
  );
}
