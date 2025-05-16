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
  const { groupId, fromChatDetails } = props.route.params;
  const { navigation } = props;

  const {
    group,
    groupNavSectionsWithChannels,
    moveNavSection,
    moveChannel,
    moveChannelToNavSection,
    createNavSection,
    deleteNavSection,
    updateNavSection,
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

  const goToEditChannel = useCallback(
    (channelId: string) => {
      navigation.navigate('EditChannel', {
        groupId,
        channelId,
        fromChatDetails,
      });
    },
    [navigation, groupId, fromChatDetails]
  );

  return (
    <ManageChannelsScreenView
      group={group}
      goBack={handleGoBack}
      goToEditChannel={goToEditChannel}
      groupNavSectionsWithChannels={groupNavSectionsWithChannels}
      moveNavSection={moveNavSection}
      moveChannelWithinNavSection={moveChannel}
      moveChannelToNavSection={moveChannelToNavSection}
      createNavSection={createNavSection}
      deleteNavSection={deleteNavSection}
      updateNavSection={updateNavSection}
    />
  );
}
