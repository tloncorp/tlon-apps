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
    group,
    currentUserIsAdmin,
    groupChannels,
    channelsWithoutNavSection,
    groupNavSectionsWithChannels,
    groupNavSections,
    setGroupMetadata,
    setGroupPrivacy,
    createChannel,
    deleteChannel,
    createNavSection,
    deleteNavSection,
    updateNavSection,
  } = useGroupContext({ groupId });

  return (
    <ManageChannelsScreenView
      goBack={props.navigation.goBack}
      groupNavSectionsWithChannels={groupNavSectionsWithChannels}
      channelsWithoutNavSection={channelsWithoutNavSection}
    />
  );
}
