import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { createDevLogger } from '@tloncorp/shared';
import { Button, LoadingSpinner } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, YStack, getTokenValue } from 'tamagui';

import { RootStackParamList } from '../navigation/types';
import {
  ContactBook,
  NavigationProvider,
  PaddedBlock,
  ScreenHeader,
  useStore,
} from '../ui';
import { InviteFriendsToTlonButton } from '../ui/components/InviteFriendsToTlonButton';

const logger = createDevLogger('InviteUsersScreen', false);

type InviteUsersScreenRouteProp = RouteProp<RootStackParamList, 'InviteUsers'>;

export function InviteUsersScreen() {
  const navigation = useNavigation();
  const route = useRoute<InviteUsersScreenRouteProp>();
  const { groupId } = route.params;
  const { bottom } = useSafeAreaInsets();
  const store = useStore();
  const { data: group } = store.useGroup({ id: groupId });
  const [loading, setLoading] = useState(false);
  const [invitees, setInvitees] = useState<string[]>([]);

  const handleInviteGroupMembers = useCallback(async () => {
    if (!group) return;

    setLoading(true);
    try {
      await store.inviteGroupMembers({
        groupId: group.id,
        contactIds: invitees,
      });
      setLoading(false);
      navigation.goBack();
    } catch (error) {
      logger.trackError('Error inviting group members', {
        errorMessage: error.message,
        errorStack: error.stack,
      });
    } finally {
      setLoading(false);
    }
  }, [invitees, group, navigation, store]);

  const buttonText = useMemo(() => {
    if (invitees.length === 0) {
      return `Select people to invite`;
    }

    return `Invite ${invitees.length} and continue`;
  }, [invitees]);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  if (!group) {
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
              onPress={handleInviteGroupMembers}
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
