import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
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
  const store = useStore();
  const { data: group } = store.useGroup({ id: groupId ?? '' });

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
            />
          </YStack>

          <PaddedBlock paddingBottom={bottom}>
            <Button
              hero
              onPress={handleInvite}
              disabled={invitees.length === 0 || loading}
              gap="$xl"
            >
              <Button.Text width="auto">
                {loading ? 'Inviting...' : buttonText}
              </Button.Text>
            </Button>
          </PaddedBlock>
        </YStack>
      </View>
    </NavigationProvider>
  );
}
