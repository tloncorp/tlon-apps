import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '@tloncorp/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupSettingsStackParamList } from '../../types';
import { useGroupContext } from './useGroupContext';

type ManageChannelsScreenProps = NativeStackScreenProps<
  GroupSettingsStackParamList,
  'ManageChannels'
>;

export function ManageChannelsScreen(props: ManageChannelsScreenProps) {
  const {
    group: { id },
  } = props.route.params;

  const {
    group,
    currentUserIsAdmin,
    groupChannels,
    groupNavSectionsWithChannels,
    setGroupMetadata,
    setGroupPrivacy,
    createChannel,
    deleteChannel,
    createNavSection,
    deleteNavSection,
    updateNavSection,
  } = useGroupContext({ groupId: id });

  return (
    <SafeAreaView>
      <Text>ManageChannels</Text>
    </SafeAreaView>
  );
}
