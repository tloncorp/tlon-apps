import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ManageChannelsScreenView } from '@tloncorp/ui';

import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'ManageChannels'
>;

export function ManageChannelsScreen(props: Props) {
  const { groupId } = props.route.params;

  const {
    groupNavSectionsWithChannels,
    moveNavSection,
    moveChannel,
    moveChannelToNavSection,
    createChannel,
    createNavSection,
    deleteNavSection,
    updateNavSection,
  } = useGroupContext({ groupId });

  return (
    <ManageChannelsScreenView
      goBack={() => props.navigation.goBack()}
      goToEditChannel={(channelId) => {
        props.navigation.navigate('EditChannel', { groupId, channelId });
      }}
      groupNavSectionsWithChannels={groupNavSectionsWithChannels}
      moveNavSection={moveNavSection}
      moveChannelWithinNavSection={moveChannel}
      moveChannelToNavSection={moveChannelToNavSection}
      createChannel={createChannel}
      createNavSection={createNavSection}
      deleteNavSection={deleteNavSection}
      updateNavSection={updateNavSection}
    />
  );
}
