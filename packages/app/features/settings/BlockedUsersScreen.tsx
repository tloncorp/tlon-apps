import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { isWeb } from 'tamagui';

import { RootStackParamList } from '../../navigation/types';
import { useCalm } from '../../ui';
import {
  type SettingsSectionModel,
  SettingsListScreenView,
} from '../../ui/components/SettingsList';
import { formatUserId } from '../../ui/utils/user';

type Props = NativeStackScreenProps<RootStackParamList, 'BlockedUsers'>;

export function BlockedUsersScreen(props: Props) {
  const { data: blockedContacts } = store.useBlockedContacts();

  const onBlockedContactPress = useCallback((contact: db.Contact) => {
    // For the confirmation dialog, we use nickname if available, otherwise formatted userId
    const displayName =
      contact.nickname || formatUserId(contact.id)?.display || contact.id;
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

  const { disableNicknames } = useCalm();
  const sections = useMemo<SettingsSectionModel[]>(() => {
    const contacts = blockedContacts ?? [];
    if (contacts.length === 0) {
      return [
        {
          key: 'blocked',
          rows: [{ key: 'empty', title: 'No blocked users' }],
        },
      ];
    }
    return [
      {
        key: 'blocked',
        footer: 'Tap someone to unblock them.',
        rows: contacts.map((contact) => {
          const userId = formatUserId(contact.id)?.display ?? contact.id;
          const nickname = disableNicknames ? null : contact.nickname;
          return {
            key: contact.id,
            title: nickname || userId,
            subtitle: nickname ? userId : undefined,
            leading: { kind: 'contact', contactId: contact.id },
            value: 'Unblock',
            accessory: 'none',
            onPress: () => onBlockedContactPress(contact),
          };
        }),
      },
    ];
  }, [blockedContacts, disableNicknames, onBlockedContactPress]);

  return (
    <SettingsListScreenView
      title="Blocked users"
      sections={sections}
      onBackPressed={() => props.navigation.goBack()}
    />
  );
}
