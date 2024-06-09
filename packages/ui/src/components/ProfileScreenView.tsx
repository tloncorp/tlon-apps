import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import * as ub from '@tloncorp/shared/dist/urbit';
import { PropsWithChildren, useCallback, useState } from 'react';
import { Dimensions, ImageBackground } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, SizableText, XStack, getTokens } from 'tamagui';

import { ContactsProvider, useContact } from '../contexts';
import { View, YStack } from '../core';
import { Avatar } from './Avatar';
import ContactName from './ContactName';
import { DebugInfo } from './DebugInfo';
import { Icon, IconType } from './Icon';
import { ListItem } from './ListItem';
import { LoadingSpinner } from './LoadingSpinner';

interface Props {
  currentUserId: string;
  debugMessage: string;
  onAppSettingsPressed?: () => void;
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

type NotificationState = { open: boolean; setting: 1 | 2 | 3 };

export function Wrapped(props: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const defaultNotificationLevel = store.useDefaultNotificationLevel();
  const { top } = useSafeAreaInsets();
  const contact = useContact(props.currentUserId);
  const [notifState, setNotifState] = useState<NotificationState>({
    open: false,
    setting: 1,
  });

  const setLevel = useCallback(
    async (level: ub.NotificationLevel) => {
      if (level === defaultNotificationLevel) return;
      setLoading(level);
      await store.setDefaultNotificationLevel(level);
      setLoading(null);
    },
    [defaultNotificationLevel]
  );

  const LevelIndicator = useCallback(
    (props: { level: ub.NotificationLevel }) => {
      if (loading === props.level) {
        return <LoadingSpinner />;
      }

      if (defaultNotificationLevel === props.level) {
        return (
          <View
            height="$2xl"
            width="$2xl"
            justifyContent="center"
            alignItems="center"
          >
            <Icon type="Checkmark" />
          </View>
        );
      }

      return (
        <View
          borderRadius="$4xl"
          borderWidth={1}
          borderColor="$secondaryBorder"
          height="$2xl"
          width="$2xl"
        />
      );
    },
    [defaultNotificationLevel, loading]
  );

  // TODO: implement real UI once designs are ready
  return (
    <ScrollView>
      <YStack
        flex={1}
        paddingHorizontal="$xl"
        paddingTop={top}
        // paddingBottom={navHeight + bottom}
      >
        {!notifState.open && (
          <>
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
              <ProfileAction title="Edit profile" icon="Draw" />
              <ProfileAction
                title="App Settings"
                icon="Settings"
                onPress={props.onAppSettingsPressed}
              />
              <ProfileAction
                title="Push Notifications"
                icon="Notifications"
                onPress={() =>
                  setNotifState((prev) => ({ ...prev, open: true }))
                }
              />
              <ProfileAction title="Connected Accounts" icon="Face" />
              <ProfileAction title="Submit Feedback" icon="Mail" />
              <ProfileAction title="Contact Support" icon="Messages" />
            </View>
          </>
        )}
        {notifState.open && (
          <View marginTop="$4xl">
            <XStack alignItems="center">
              <Icon
                type="ChevronLeft"
                onPress={() => setNotifState({ open: false, setting: 1 })}
              />
              <SizableText size="$l" fontWeight="500">
                Push Notification Settings
              </SizableText>
            </XStack>

            <SizableText marginLeft="$m" marginTop="$xl" size="$m">
              Configure what kinds of messages will send you notifications.
            </SizableText>

            <YStack marginLeft="$m" marginTop="$3xl">
              <XStack onPress={() => setLevel('loud')}>
                <LevelIndicator level="loud" />
                <SizableText marginLeft="$l">All group activity</SizableText>
              </XStack>

              <XStack marginTop="$xl" onPress={() => setLevel('medium')}>
                <LevelIndicator level="medium" />
                <YStack marginLeft="$l">
                  <SizableText>Mentions and replies only</SizableText>
                  <SizableText
                    width="80%"
                    marginTop="$m"
                    size="$s"
                    color="$secondaryText"
                  >
                    Direct messages will still notify unless you mute them.
                  </SizableText>
                </YStack>
              </XStack>

              <XStack marginTop="$xl" onPress={() => setLevel('soft')}>
                <LevelIndicator level="soft" />
                <SizableText marginLeft="$l">Nothing</SizableText>
              </XStack>
            </YStack>
          </View>
        )}
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
  debugMessage,
}: {
  contactId: string;
  contact?: db.Contact;
  dark?: boolean;
  debugMessage: string;
}) {
  const color = dark ? '$primaryText' : '$white';
  return (
    <XStack
      padding="$2xl"
      alignItems="center"
      backgroundColor={dark ? '$secondaryBackground' : undefined}
      borderRadius={dark ? '$xl' : undefined}
    >
      <DebugInfo debugMessage={debugMessage}>
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
  onPress,
}: {
  icon: IconType;
  title: string;
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
      <ListItem.Icon icon="ChevronRight" />
    </ListItem>
  );
}
