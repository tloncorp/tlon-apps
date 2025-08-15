import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { isWeb } from 'tamagui';

import { RootStackParamList } from '../../navigation/types';
import { getDisplayName } from '../../ui';
import {
  BlockedContactsWidget,
  ScreenHeader,
  View,
  useIsWindowNarrow,
} from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'BlockedUsers'>;

export function BlockedUsersScreen(props: Props) {
  const { data: blockedContacts } = store.useBlockedContacts();
  const isNarrow = useIsWindowNarrow();

  const onBlockedContactPress = useCallback((contact: db.Contact) => {
    const displayName = getDisplayName(contact);
    const message = store.getConfirmationMessage(false); // Always unblocking from this screen

    if (isWeb) {
      const confirmed = window.confirm(
        `Are you sure you want to unblock ${displayName}?`
      );
      if (confirmed) {
        store.handleBlockingAction(contact.id, true);
      }
    } else {
      Alert.alert(displayName, message, [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Unblock',
          onPress: () => store.handleBlockingAction(contact.id, true),
        },
      ]);
    }
  }, []);

  return (
    <View flex={1} backgroundColor="$background">
      <ScreenHeader
        backAction={isNarrow ? () => props.navigation.goBack() : undefined}
        title="Blocked users"
        useHorizontalTitleLayout={!isNarrow}
        borderBottom
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
