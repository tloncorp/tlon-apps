import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import * as store from '@tloncorp/shared/dist/store';
import { ProfileScreenView, View } from '@tloncorp/ui/src';

import { useCurrentUserId } from '../hooks/useCurrentUser';
import { TabParamList } from '../types';

type Props = BottomTabScreenProps<TabParamList, 'Profile'>;

export default function ProfileScreen(props: Props) {
  const currentUserId = useCurrentUserId();
  const { data: profile } = store.useContact({ id: currentUserId });

  return (
    <View backgroundColor="$background" flex={1}>
      <ProfileScreenView
        profile={profile ?? null}
        currentUserId={currentUserId}
      />
    </View>
  );
}
