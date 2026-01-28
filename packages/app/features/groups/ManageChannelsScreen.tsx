import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback } from 'react';

import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';
import { ManageChannelsScreenView } from '../../ui';

type Props = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'ManageChannels'
>;

export function ManageChannelsScreen(props: Props) {
  const { groupId, fromChatDetails, createdRoleId } = props.route.params;
  const { navigation } = props;

  const {
    group,
    groupNavSectionsWithChannels,
    createNavSection,
    deleteNavSection,
    updateNavSection,
    updateGroupNavigation,
  } = useGroupContext({ groupId });

  const handleGoBack = useCallback(() => {
    if (fromChatDetails) {
      navigation.getParent()?.navigate('ChatDetails', {
        chatType: 'group',
        chatId: groupId,
      });
    } else {
      navigation.goBack();
    }
  }, [navigation, fromChatDetails, groupId]);

  const goToChannelDetails = useCallback(
    (channelId: string) => {
      // Use push() instead of navigate() to ensure ChannelInfo is pushed onto the
      // stack. This guarantees goBack() from ChannelInfo returns to ManageChannels.
      // Using navigate() could potentially replace screens if React Navigation
      // determines they're in the same "group" in certain navigation states.
      navigation.push('ChannelInfo', {
        chatType: 'channel',
        chatId: channelId,
        groupId,
      });
    },
    [navigation, groupId]
  );

  const handleCreateRole = useCallback(() => {
    navigation.navigate('AddRole', {
      groupId,
      fromChatDetails,
      returnScreen: 'ManageChannels',
      returnParams: {
        groupId,
        fromChatDetails,
      },
    });
  }, [navigation, groupId, fromChatDetails]);

  return (
    <ManageChannelsScreenView
      group={group}
      goBack={handleGoBack}
      goToChannelDetails={goToChannelDetails}
      groupNavSectionsWithChannels={groupNavSectionsWithChannels}
      createNavSection={createNavSection}
      deleteNavSection={deleteNavSection}
      updateNavSection={updateNavSection}
      updateGroupNavigation={updateGroupNavigation}
      createdRoleId={createdRoleId}
      onCreateRole={handleCreateRole}
    />
  );
}
