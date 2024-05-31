import * as db from '@tloncorp/shared/dist/db';
import { PropsWithChildren } from 'react';
import { Alert, Dimensions, ImageBackground } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, XStack, getTokens } from 'tamagui';

import { ContactsProvider, useContact } from '../contexts';
import { View, YStack } from '../core';
import { Avatar } from './Avatar';
import ContactName from './ContactName';
import { DebugInfo } from './DebugInfo';
import { IconType } from './Icon';
import { ListItem } from './ListItem';
import { navHeight } from './NavBar/NavBar';

interface Props {
  currentUserId: string;
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
  const { top, bottom } = useSafeAreaInsets();
  const contact = useContact(props.currentUserId);

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
      <YStack
        flex={1}
        paddingHorizontal="$xl"
        paddingTop={top}
        paddingBottom={navHeight + bottom}
      >
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
          <ProfileAction title="Edit profile" icon="Draw" />
          <ProfileAction title="App Settings" icon="Settings" />
          <ProfileAction title="Connected Accounts" icon="Face" />
          <ProfileAction title="Submit Feedback" icon="Mail" />
          <ProfileAction title="Contact Support" icon="Messages" />
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

function ProfileCover({ uri, children }: PropsWithChildren<{ uri: string }>) {
  return (
    <View borderRadius="$2xl" overflow="hidden">
      <ImageBackground
        source={{ uri, height: 1000, width: 1000 }}
        resizeMode="cover"
      >
        {children}
      </ImageBackground>
    </View>
  );
}

function ProfileRow({
  contactId,
  contact,
  dark,
}: {
  contactId: string;
  contact?: db.Contact;
  dark?: boolean;
}) {
  const color = dark ? '$primaryText' : '$white';
  return (
    <XStack
      padding="$2xl"
      alignItems="center"
      backgroundColor={dark ? '$secondaryBackground' : undefined}
      borderRadius={dark ? '$xl' : undefined}
    >
      <DebugInfo>
        <Avatar size="$5xl" contactId={contactId} contact={contact} />
      </DebugInfo>
      <View marginLeft="$l">
        {contact?.nickname ? (
          <YStack>
            <ContactName
              color={color}
              fontWeight="500"
              userId={contactId}
              showNickname
            />
            <ContactName
              fontFamily="$mono"
              color={color}
              opacity={dark ? 0.5 : 0.7}
              userId={contactId}
            />
          </YStack>
        ) : (
          <ContactName color={color} fontWeight="500" userId={contactId} />
        )}
      </View>
    </XStack>
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
      <ListItem.Icon
        icon={icon}
        backgroundColor="$secondaryBackground"
        rounded
      />
      <ListItem.MainContent>
        <ListItem.Title>{title}</ListItem.Title>
      </ListItem.MainContent>
      {!hideCaret && <ListItem.Icon icon="ChevronRight" />}
    </ListItem>
  );
}
