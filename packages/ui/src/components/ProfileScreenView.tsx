import * as db from '@tloncorp/shared/dist/db';
import { PropsWithChildren } from 'react';
import { Dimensions, ImageBackground } from 'react-native';
import { ScrollView, XStack, getTokens } from 'tamagui';

import { useContact } from '../contexts';
import { View, YStack } from '../core';
import { Avatar } from './Avatar';
import ContactName from './ContactName';
import { IconType } from './Icon';
import { ListItem } from './ListItem';

interface Props {
  currentUserId: string;
}

export function ProfileScreenView(props: Props) {
  const contact = useContact(props.currentUserId);

  return (
    <ScrollView>
      <YStack flex={1} paddingHorizontal="$xl">
        <View marginTop="$l">
          {contact ? (
            <ProfilePreview profile={contact} contactId={props.currentUserId} />
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
        </View>
      </YStack>
    </ScrollView>
  );
}

function ProfilePreview({
  profile,
  contactId,
}: {
  profile: db.Contact;
  contactId: string;
}) {
  const coverSize =
    Dimensions.get('window').width - getTokens().space.$xl.val * 2;
  if (profile.coverImage) {
    return (
      <ProfileCover uri={profile.coverImage}>
        <YStack height={coverSize} width={coverSize} justifyContent="flex-end">
          <ProfileRow contactId={contactId} contact={profile} />
        </YStack>
      </ProfileCover>
    );
  }

  return <ProfileRow dark contactId={contactId} contact={profile} />;
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
      <Avatar size="$5xl" contactId={contactId} contact={contact} />
      <View marginLeft="$l">
        {contact?.nickname ? (
          <YStack>
            <ContactName
              color={color}
              fontWeight="500"
              userId={contactId}
              showAlias
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
  onPress,
}: {
  icon: IconType;
  title: string;
  onPress?: () => void;
}) {
  return (
    <ListItem onPress={onPress}>
      <ListItem.Icon icon={icon} />
      <ListItem.MainContent>
        <ListItem.Title>{title}</ListItem.Title>
      </ListItem.MainContent>
      <ListItem.Icon icon="ChevronRight" />
    </ListItem>
  );
}
