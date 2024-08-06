import * as db from '@tloncorp/shared/dist/db';
import { useFeatureFlag } from 'posthog-react-native';
import { Alert, Dimensions, Share, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, SizableText, getTokens } from 'tamagui';
import { Stack, View, YStack } from 'tamagui';

import { AppDataContextProvider, useContact } from '../contexts';
import { IconType } from './Icon';
import { ListItem } from './ListItem';
import ProfileCover from './ProfileCover';
import ProfileRow from './ProfileRow';

interface Props {
  currentUserId: string;
  onAppSettingsPressed?: () => void;
  onEditProfilePressed?: () => void;
  onViewProfile?: () => void;
  onLogoutPressed: () => void;
  onSendBugReportPressed?: () => void;
  dmLink?: string;
}

export function ProfileScreenView({
  contacts,
  ...rest
}: Props & { contacts: db.Contact[] }) {
  return (
    <AppDataContextProvider
      currentUserId={rest.currentUserId}
      contacts={contacts ?? []}
    >
      <Wrapped {...rest} />
    </AppDataContextProvider>
  );
}

export function Wrapped(props: Props) {
  const { top } = useSafeAreaInsets();
  const contact = useContact(props.currentUserId);
  const showDmLure = useFeatureFlag('share-dm-lure');

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

  const onShare = async () => {
    try {
      await Share.share(
        {
          message:
            'I’m inviting you to Tlon, the only communication tool you can trust.',
          url: props.dmLink,
          title: 'Join me on Tlon',
        },
        {
          subject: 'Join me on Tlon',
        }
      );
    } catch (error) {
      console.error(error.message);
    }
  };

  return (
    <ScrollView>
      <YStack flex={1} paddingHorizontal="$xl" paddingTop={top}>
        <View marginTop="$l">
          <View onPress={props.onViewProfile}>
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
          <View position="absolute" top="$l" right="$l">
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={props.onEditProfilePressed}
            >
              <Stack
                padding="$m"
                paddingHorizontal="$l"
                opacity={0.6}
                backgroundColor="$darkOverlay"
                borderRadius="$l"
              >
                <SizableText fontWeight="500" color="$white">
                  Edit
                </SizableText>
              </Stack>
            </TouchableOpacity>
          </View>
        </View>
        <View marginTop="$xl">
          {showDmLure && props.dmLink !== '' && (
            <ProfileAction
              title="Share app with friends"
              icon="Send"
              tint
              onPress={() => {
                onShare();
              }}
            />
          )}
          <ProfileAction
            title="App Settings"
            icon="Settings"
            onPress={props.onAppSettingsPressed}
          />
          <ProfileAction
            title="Report a bug"
            icon="Send"
            onPress={props.onSendBugReportPressed}
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
  tint?: boolean;
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
