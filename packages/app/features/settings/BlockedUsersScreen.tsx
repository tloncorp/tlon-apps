import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { BlockedContactsWidget, ScreenHeader, View } from '@tloncorp/ui';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { useCurrentUserId } from '../../hooks/useCurrentUser';

export function BlockedUsersScreen({ onGoBack }: { onGoBack: () => void }) {
  const currentUserId = useCurrentUserId();
  const { data: calm } = store.useCalmSettings({ userId: currentUserId });
  const { data: blockedContacts } = store.useBlockedContacts();

  const onBlockedContactPress = useCallback(
    (contact: db.Contact) => {
      Alert.alert(
        `${calm?.disableNicknames && contact.nickname ? contact.nickname : contact.id}`,
        `Are you sure you want to unblock this user?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Unblock',
            onPress: () => store.unblockUser(contact.id),
          },
        ]
      );
    },
    [calm?.disableNicknames]
  );

  return (
    <View flex={1}>
      <ScreenHeader>
        <ScreenHeader.BackButton onPress={onGoBack} />
        <ScreenHeader.Title>Blocked Users</ScreenHeader.Title>
      </ScreenHeader>
      <View flex={1} paddingHorizontal="$xl">
        <BlockedContactsWidget
          blockedContacts={blockedContacts ?? []}
          onBlockedContactPress={onBlockedContactPress}
        />
      </View>
    </View>
  );
}
