import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ManageChannelsScreenView } from '@tloncorp/ui';

import { GroupSettingsStackParamList } from '../../types';
import { useGroupContext } from './useGroupContext';

type ManageChannelsScreenProps = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'ManageChannels'
>;

export function ManageChannelsScreen(props: ManageChannelsScreenProps) {
  const { groupId } = props.route.params;

  const {
    groupNavSectionsWithChannels,
    moveNavSection,
    moveChannel,
    moveChannelToNavSection,
    createNavSection,
    deleteNavSection,
    updateNavSection,
  } = useGroupContext({ groupId });

  return (
    <ManageChannelsScreenView
      goBack={props.navigation.goBack}
      goToEditChannel={(channelId) => {
        props.navigation.navigate('EditChannel', { groupId, channelId });
      }}
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
