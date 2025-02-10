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
    group,
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
      goBack={() => props.navigation.goBack()}
      goToEditChannel={(channelId) => {
        props.navigation.navigate('EditChannel', { groupId, channelId });
      }}
      group={group}
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
