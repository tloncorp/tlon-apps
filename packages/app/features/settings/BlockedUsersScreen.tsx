import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { isWeb } from 'tamagui';

import { RootStackParamList } from '../../navigation/types';
import {
  BlockedContactsWidget,
  ScreenHeader,
  View,
  useIsWindowNarrow,
} from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'BlockedUsers'>;

export function BlockedUsersScreen(props: Props) {
  const { data: calm } = store.useCalmSettings();
  const { data: blockedContacts } = store.useBlockedContacts();
  const isNarrow = useIsWindowNarrow();

  const handleUnblockUser = useCallback(async (contact: db.Contact) => {
    await store.unblockUser(contact.id);
    store.queryClient.invalidateQueries({
      queryKey: ['blockedContacts'],
    });
    store.queryClient.invalidateQueries({
      queryKey: [['contact', contact.id]],
    });
  }, []);

  const onBlockedContactPress = useCallback(
    (contact: db.Contact) => {
      const displayName =
        calm?.disableNicknames && contact.nickname
          ? contact.nickname
          : contact.id;

      if (isWeb) {
        const confirmed = window.confirm(
          `Are you sure you want to unblock ${displayName}?`
        );
        if (confirmed) {
          handleUnblockUser(contact);
        }
      } else {
        Alert.alert(
          displayName,
          `Are you sure you want to unblock this user?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Unblock',
              onPress: () => handleUnblockUser(contact),
            },
          ]
        );
      }
    },
    [calm?.disableNicknames, handleUnblockUser]
  );

  return (
    <View flex={1} backgroundColor="$background">
      <ScreenHeader
        backAction={isNarrow ? () => props.navigation.goBack() : undefined}
        title="Blocked users"
      />
      <View
        flex={1}
        width="100%"
        maxWidth={600}
        marginHorizontal="auto"
        paddingHorizontal="$xl"
      >
        <BlockedContactsWidget
          blockedContacts={blockedContacts ?? []}
          onBlockedContactPress={onBlockedContactPress}
        />
      </View>
    </View>
  );
}
