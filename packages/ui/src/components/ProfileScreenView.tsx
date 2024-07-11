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
  onAppSettingsPressed?: () => void;
  onLogoutPressed: () => void;
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
        onPress: props.onLogoutPressed,
      },
    ]);
  };

  return (
    <ScrollView>
      <YStack flex={1} paddingHorizontal="$xl" paddingTop={top}>
        <View marginTop="$l">
          {contact ? (
            <ProfileDisplayWidget
              contact={contact}
              contactId={props.currentUserId}
            />
          ) : (
            <View backgroundColor="$secondaryBackground" borderRadius="$m">
              <ProfileRow dark contactId={props.currentUserId} />
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
}: {
  contact: db.Contact;
  contactId: string;
}) {
  const coverSize =
    Dimensions.get('window').width - getTokens().space.$xl.val * 2;
  if (contact.coverImage) {
    return (
      <ProfileCover uri={contact.coverImage}>
        <YStack height={coverSize} width={coverSize} justifyContent="flex-end">
          <ProfileRow contactId={contactId} contact={contact} />
        </YStack>
      </ProfileCover>
    );
  }

  return <ProfileRow dark contactId={contactId} contact={contact} />;
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
