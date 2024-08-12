import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GroupChannelsScreen } from '@tloncorp/app/features/top/GroupChannelsScreen';

import type { RootStackParamList } from '../types';

type GroupChannelsScreenControllerProps = NativeStackScreenProps<
  RootStackParamList,
  'GroupChannels'
>;

export function GroupChannelsScreenController({
  navigation,
  route,
}: GroupChannelsScreenControllerProps) {
  const groupParam = route.params.group;

  return (
    <GroupChannelsScreen
      groupParam={groupParam}
      navigateToChannel={(channel) => {
        navigation.navigate('Channel', {
          channel: channel,
        });
      }}
      goBack={() => {
        navigation.goBack();
      }}
    />
  );
}
