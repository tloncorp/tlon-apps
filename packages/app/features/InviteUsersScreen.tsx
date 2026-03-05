import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import * as store from '@tloncorp/shared';
import { Button, LoadingSpinner } from '@tloncorp/ui';
import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, YStack, getTokenValue } from 'tamagui';

import { useInviteGroupMembers } from '../hooks/useInviteUsers';
import { RootStackParamList } from '../navigation/types';
import {
  ContactBook,
  NavigationProvider,
  PaddedBlock,
  ScreenHeader,
  useStore,
} from '../ui';
import { InviteFriendsToTlonButton } from '../ui/components/InviteFriendsToTlonButton';

type InviteUsersScreenRouteProp = RouteProp<RootStackParamList, 'InviteUsers'>;

export function InviteUsersScreen() {
  const navigation = useNavigation();
  const route = useRoute<InviteUsersScreenRouteProp>();
  const { groupId } = route.params ?? {};
  const { bottom } = useSafeAreaInsets();
  const appStore = useStore();
  const { data: group } = appStore.useGroup({ id: groupId ?? '' });
  const disabledIds = store.useGroupsNegotiationClashes();

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const { loading, invitees, setInvitees, handleInvite, buttonText } =
    useInviteGroupMembers(groupId ?? '', handleGoBack);

  if (!group || !groupId) {
    return (
      <NavigationProvider>
        <YStack flex={1} justifyContent="center" alignItems="center">
          <LoadingSpinner />
        </YStack>
      </NavigationProvider>
    );
  }

  return (
    <NavigationProvider>
      <View flex={1} backgroundColor="$background">
        <ScreenHeader title="Invite People" backAction={handleGoBack} />

        <YStack flex={1} paddingHorizontal={getTokenValue('$l')}>
          <PaddedBlock>
            <InviteFriendsToTlonButton group={group} />
          </PaddedBlock>

          <YStack flex={1}>
            <ContactBook
              multiSelect
              searchable
              searchPlaceholder="Filter by nickname, @p"
              onSelectedChange={setInvitees}
              disabledIds={disabledIds}
              disabledReason="App version mismatch"
            />
          </YStack>

          <PaddedBlock paddingBottom={bottom}>
            <Button
              preset="primary"
              onPress={handleInvite}
              disabled={invitees.length === 0 || loading}
              label={loading ? 'Inviting...' : buttonText}
              centered
            />
          </PaddedBlock>
        </YStack>
      </View>
    </NavigationProvider>
  );
}
