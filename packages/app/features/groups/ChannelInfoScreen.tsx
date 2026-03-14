import { useNavigation } from '@react-navigation/native';
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useCallback } from 'react';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { GroupSettingsStackParamList } from '../../navigation/types';
import {
  ChatOptionsProvider,
  ForwardGroupSheetProvider,
} from '../../ui';
import { buildSelectChannelRolesParams } from './roleSelectionNavigation';
import { ChannelDetailsScreenView } from '../top/ChannelDetailsScreen';

type Props = NativeStackScreenProps<GroupSettingsStackParamList, 'ChannelInfo'>;

export function ChannelInfoScreen(props: Props) {
  const {
    chatType,
    chatId,
    groupId,
    selectedRoleIds,
    createdRoleId,
    createdRoleTitle,
  } = props.route.params;
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

  const handleSelectRoles = useCallback(
    (channelId: string, gId: string, currentReaders: string[]) => {
      navigation.navigate(
        'SelectChannelRoles',
        buildSelectChannelRolesParams({
          groupId: gId,
          selectedRoleIds: currentReaders,
          returnScreen: 'ChannelInfo',
          returnParams: {
            chatType,
            chatId,
            groupId: gId,
          },
        })
      );
    },
    [navigation, chatType, chatId]
  );

  const handlePressRole = useCallback(
    (gId: string, roleId: string) => {
      navigation.navigate('EditRole', {
        groupId: gId,
        roleId,
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
          onSelectRoles={handleSelectRoles}
          onPressRole={handlePressRole}
          onAfterDeleteChannel={handleAfterDeleteChannel}
          selectedRoleIds={selectedRoleIds}
          createdRoleId={createdRoleId}
          createdRoleTitle={createdRoleTitle}
        />
      </ChatOptionsProvider>
    </ForwardGroupSheetProvider>
  );
}
