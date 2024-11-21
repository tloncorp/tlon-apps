import { useFeatureFlag } from 'posthog-react-native';
import { ReactElement } from 'react';
import { Alert, Share } from 'react-native';
import { ScrollView, View, YStack } from 'tamagui';

import { ContactAvatar } from './Avatar';
import { IconType } from './Icon';
import { ListItem } from './ListItem';
import Pressable from './Pressable';
import { ScreenHeader } from './ScreenHeader';
import { TlonLogo } from './TlonLogo';

interface Props {
  currentUserId: string;
  hasHostedAuth: boolean;
  onProfilePressed?: () => void;
  onAppInfoPressed?: () => void;
  onNotificationSettingsPressed: () => void;
  onBlockedUsersPressed: () => void;
  onManageAccountPressed: () => void;
  onLogoutPressed?: () => void;
  onSendBugReportPressed?: () => void;
  onExperimentalFeaturesPressed?: () => void;
  dmLink?: string;
  contactsTabEnabled?: boolean;
  onBackPressed?: () => void;
}

export function ProfileScreenView(props: Props) {
  const showDmLure = useFeatureFlag('share-dm-lure');

  // TODO: Add logout back in when we figure out TLON-2098.
  const handleLogoutPressed = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Log out',
        style: 'destructive',
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
    <>
      <ScreenHeader
        title="Settings"
        backAction={props.contactsTabEnabled ? props.onBackPressed : undefined}
      />
      <ScrollView>
        <YStack flex={1} padding="$l" gap="$s">
          {props.contactsTabEnabled ? null : (
            <ProfileAction
              leftIcon={<ContactAvatar contactId={props.currentUserId} />}
              title="Profile"
              subtitle={props.currentUserId}
              onPress={props.onProfilePressed}
              rightIcon={'ChevronRight'}
            />
          )}
          {showDmLure && props.dmLink !== '' && (
            <ProfileAction
              title="Share app with friends"
              leftIcon="Send"
              rightIcon={'ChevronRight'}
              onPress={onShare}
            />
          )}
          <ProfileAction
            title="Notification settings"
            leftIcon="Notifications"
            rightIcon={'ChevronRight'}
            onPress={props.onNotificationSettingsPressed}
          />
          <ProfileAction
            title="Blocked users"
            leftIcon="Placeholder"
            rightIcon={'ChevronRight'}
            onPress={props.onBlockedUsersPressed}
          />
          {props.hasHostedAuth && (
            <ProfileAction
              title="Manage Tlon account"
              rightIcon={'ChevronRight'}
              leftIcon={
                <View
                  padding="$xl"
                  backgroundColor="$secondaryBackground"
                  borderRadius={100}
                >
                  <TlonLogo
                    width={'$xl'}
                    height={'$xl'}
                    color="$secondaryText"
                  />
                </View>
              }
              onPress={props.onManageAccountPressed}
            />
          )}
          <ProfileAction
            title="App info"
            leftIcon="Info"
            rightIcon={'ChevronRight'}
            onPress={props.onAppInfoPressed}
          />
          <ProfileAction
            title="Report a bug"
            leftIcon="Send"
            rightIcon={'ChevronRight'}
            onPress={props.onSendBugReportPressed}
          />
          <ProfileAction
            title="Experimental features"
            leftIcon="Bang"
            rightIcon={'ChevronRight'}
            onPress={props.onExperimentalFeaturesPressed}
          />
          <ProfileAction
            title="Log out"
            leftIcon="LogOut"
            onPress={handleLogoutPressed}
          />
        </YStack>
      </ScrollView>
    </>
  );
}

function ProfileAction({
  leftIcon,
  rightIcon,
  title,
  subtitle,
  onPress,
}: {
  leftIcon: IconType | ReactElement;
  rightIcon?: IconType | ReactElement;
  title: string;
  onPress?: () => void;
  subtitle?: string;
}) {
  return (
    <Pressable borderRadius="$xl" onPress={onPress}>
      <ListItem>
        {typeof leftIcon === 'string' ? (
          <ListItem.SystemIcon icon={leftIcon} rounded />
        ) : (
          leftIcon
        )}
        <ListItem.MainContent>
          <ListItem.Title>{title}</ListItem.Title>
          {subtitle && <ListItem.Subtitle>{subtitle}</ListItem.Subtitle>}
        </ListItem.MainContent>
        {rightIcon ? (
          typeof rightIcon === 'string' ? (
            <ListItem.SystemIcon
              icon={rightIcon}
              backgroundColor={'transparent'}
            />
          ) : (
            rightIcon
          )
        ) : null}
      </ListItem>
    </Pressable>
  );
}
