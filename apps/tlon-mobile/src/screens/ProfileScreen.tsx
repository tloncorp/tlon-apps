import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import * as store from '@tloncorp/shared/dist/store';
import { ProfileScreenView, View } from '@tloncorp/ui';

import { useCurrentUserId } from '../hooks/useCurrentUser';
import { TabParamList } from '../types';

type Props = BottomTabScreenProps<TabParamList, 'Profile'>;

export default function ProfileScreen(props: Props) {
  const currentUserId = useCurrentUserId();
  const { data: contacts } = store.useContacts();

  return (
    <View backgroundColor="$background" flex={1}>
      <ProfileScreenView
        contacts={contacts ?? []}
        currentUserId={currentUserId}
      />
    </View>
  );
}
