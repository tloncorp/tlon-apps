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
    channelsWithoutNavSection,
    groupNavSectionsWithChannels,
    moveNavSection,
    createChannel,
    updateChannel,
    deleteChannel,
    addChannelToNavSection,
    moveChannel,
    moveChannelToNavSection,
    createNavSection,
    deleteNavSection,
    updateNavSection,
  } = useGroupContext({ groupId });

  return (
    <ManageChannelsScreenView
      goBack={props.navigation.goBack}
      groupNavSectionsWithChannels={groupNavSectionsWithChannels}
      channelsWithoutNavSection={channelsWithoutNavSection}
      moveNavSection={moveNavSection}
      createChannel={createChannel}
      updateChannel={updateChannel}
      deleteChannel={deleteChannel}
      addChannelToNavSection={addChannelToNavSection}
      moveChannelWithinNavSection={moveChannel}
      moveChannelToNavSection={moveChannelToNavSection}
      createNavSection={createNavSection}
      deleteNavSection={deleteNavSection}
      updateNavSection={updateNavSection}
    />
  );
}
