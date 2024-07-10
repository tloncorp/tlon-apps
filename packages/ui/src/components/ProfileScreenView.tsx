import * as db from '@tloncorp/shared/dist/db';
import { Alert, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, getTokens } from 'tamagui';

import { ContactsProvider, useContact } from '../contexts';
import { View, YStack } from '../core';
import { IconType } from './Icon';
import { ListItem } from './ListItem';
import ProfileCover from './ProfileCover';
import ProfileRow from './ProfileRow';

interface Props {
  currentUserId: string;
  debugMessage: string;
  onAppSettingsPressed?: () => void;
  onManageAccountPressed?: () => void;
  onBlockedUsersPressed?: () => void;
  handleLogout: () => void;
}

export function ProfileScreenView({
  contacts,
  ...rest
}: Props & { contacts: db.Contact[] }) {
  return (
    <ContactsProvider contacts={contacts ?? []}>
      <Wrapped {...rest} />
    </ContactsProvider>
  );
}

export function Wrapped(props: Props) {
  const { top } = useSafeAreaInsets();
  const contact = useContact(props.currentUserId);

  // TODO: Add logout back in when we figure out TLON-2098.
  const onLogoutPress = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Log out',
        onPress: props.handleLogout,
      },
    ]);
  };

  return (
    <ScrollView>
      <YStack flex={1} paddingHorizontal="$xl" paddingTop={top}>
        <View marginTop="$l">
          {contact ? (
            <ProfileDisplayWidget
              debugMessage={props.debugMessage}
              contact={contact}
              contactId={props.currentUserId}
            />
          ) : (
            <View backgroundColor="$secondaryBackground" borderRadius="$m">
              <ProfileRow
                debugMessage={props.debugMessage}
                dark
                contactId={props.currentUserId}
              />
            </View>
          )}
        </View>
        <View marginTop="$xl">
          <ProfileAction
            title="App Settings"
            icon="Settings"
            onPress={props.onAppSettingsPressed}
          />
          <ProfileAction
            title="Log Out"
            icon="LogOut"
            hideCaret
            onPress={onLogoutPress}
          />
        </View>
      </YStack>
    </ScrollView>
  );
}

export function ProfileDisplayWidget({
  contact,
  contactId,
  debugMessage,
}: {
  contact: db.Contact;
  contactId: string;
  debugMessage: string;
}) {
  const coverSize =
    Dimensions.get('window').width - getTokens().space.$xl.val * 2;
  if (contact.coverImage) {
    return (
      <ProfileCover uri={contact.coverImage}>
        <YStack height={coverSize} width={coverSize} justifyContent="flex-end">
          <ProfileRow
            debugMessage={debugMessage}
            contactId={contactId}
            contact={contact}
          />
        </YStack>
      </ProfileCover>
    );
  }

  return (
    <ProfileRow
      debugMessage={debugMessage}
      dark
      contactId={contactId}
      contact={contact}
    />
  );
}

function ProfileAction({
  icon,
  title,
  hideCaret,
  onPress,
}: {
  icon: IconType;
  title: string;
  hideCaret?: boolean;
  onPress?: () => void;
}) {
  return (
    <ListItem onPress={onPress}>
      <ListItem.SystemIcon icon={icon} rounded />
      <ListItem.MainContent>
        <ListItem.Title>{title}</ListItem.Title>
      </ListItem.MainContent>
      {!hideCaret && (
        <ListItem.SystemIcon
          icon="ChevronRight"
          backgroundColor={'transparent'}
        />
      )}
    </ListItem>
  );
}
