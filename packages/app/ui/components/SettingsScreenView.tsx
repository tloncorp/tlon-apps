import { Button, IconType, Pressable, Text } from '@tloncorp/ui';
import { PropsWithChildren, ReactElement } from 'react';
import { Alert } from 'react-native';
import { AlertDialog, ScrollView, View, XStack, YStack, isWeb } from 'tamagui';

import { ListItem } from './ListItem';
import { ScreenHeader } from './ScreenHeader';
import { TlonLogo } from './TlonLogo';

interface Props {
  currentUserId: string;
  hasHostedAuth: boolean;
  onAppInfoPressed?: () => void;
  onNotificationSettingsPressed: () => void;
  onBlockedUsersPressed: () => void;
  onPrivacyPressed: () => void;
  onManageAccountPressed: () => void;
  onThemePressed?: () => void;
  onLogoutPressed?: () => void;
  onSendBugReportPressed?: () => void;
  onExperimentalFeaturesPressed?: () => void;
  dmLink?: string;
  onBackPressed?: () => void;
  focusedRouteName?: string;
}

export function SettingsScreenView(props: Props) {
  const handleLogoutPressed = () => {
    if (isWeb) {
      return;
    } else {
      Alert.alert('Log out from Tlon', 'Are you sure you want to log out?', [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log out now',
          style: 'destructive',
          onPress: props.onLogoutPressed,
        },
      ]);
    }
  };

  return (
    <>
      <ScreenHeader
        title="Settings"
        backAction={props.onBackPressed}
        borderBottom
      />
      <ScrollView>
        <YStack flex={1} padding="$l" gap="$s">
          <SettingsAction
            title="Notification settings"
            leftIcon="Notifications"
            rightIcon={'ChevronRight'}
            onPress={props.onNotificationSettingsPressed}
            isFocused={props.focusedRouteName === 'PushNotificationSettings'}
          />
          <SettingsAction
            title="Blocked users"
            leftIcon="Placeholder"
            rightIcon={'ChevronRight'}
            onPress={props.onBlockedUsersPressed}
            isFocused={props.focusedRouteName === 'BlockedUsers'}
          />
          <SettingsAction
            title="Privacy"
            leftIcon="Lock"
            rightIcon={'ChevronRight'}
            onPress={props.onPrivacyPressed}
            isFocused={props.focusedRouteName === 'PrivacySettings'}
          />
          {props.hasHostedAuth && (
            <SettingsAction
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
              isFocused={props.focusedRouteName === 'ManageAccount'}
            />
          )}
          <SettingsAction
            title="Theme"
            leftIcon="ChannelGalleries"
            rightIcon={'ChevronRight'}
            onPress={props.onThemePressed}
            isFocused={props.focusedRouteName === 'Theme'}
          />
          <SettingsAction
            title="App info"
            leftIcon="Info"
            rightIcon={'ChevronRight'}
            onPress={props.onAppInfoPressed}
            isFocused={props.focusedRouteName === 'AppInfo'}
          />
          <SettingsAction
            title="Report a bug"
            leftIcon="Send"
            rightIcon={'ChevronRight'}
            onPress={props.onSendBugReportPressed}
            isFocused={props.focusedRouteName === 'WompWomp'}
          />
          <SettingsAction
            title="Experimental features"
            leftIcon="Bang"
            rightIcon={'ChevronRight'}
            onPress={props.onExperimentalFeaturesPressed}
            isFocused={props.focusedRouteName === 'FeatureFlags'}
          />
          {isWeb ? (
            <LogoutDialog onConfirm={props.onLogoutPressed ?? (() => {})}>
              <SettingsAction
                title="Log out"
                leftIcon="LogOut"
                onPress={handleLogoutPressed}
              />
            </LogoutDialog>
          ) : (
            <SettingsAction
              title="Log out"
              leftIcon="LogOut"
              onPress={handleLogoutPressed}
            />
          )}
        </YStack>
      </ScrollView>
    </>
  );
}

function SettingsAction({
  leftIcon,
  rightIcon,
  title,
  subtitle,
  onPress,
  isFocused,
}: {
  leftIcon: IconType | ReactElement;
  rightIcon?: IconType | ReactElement;
  title: string;
  onPress?: () => void;
  subtitle?: string;
  isFocused?: boolean;
}) {
  return (
    <Pressable
      borderRadius="$xl"
      onPress={onPress}
      backgroundColor={isFocused ? '$secondaryBackground' : 'transparent'}
    >
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

function LogoutDialog({
  onConfirm,
  children,
}: PropsWithChildren<{ onConfirm: () => void }>) {
  return (
    <AlertDialog>
      <AlertDialog.Trigger asChild>{children}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          key="overlay"
          animation="quick"
          opacity={0.5}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />
        <AlertDialog.Content
          bordered
          elevate
          key="content"
          animation={[
            'quick',
            {
              opacity: {
                overshootClamping: true,
              },
            },
          ]}
          enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
          exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
          x={0}
          scale={1}
          opacity={1}
          y={0}
          borderColor="$border"
        >
          <YStack padding="$l" gap="$l">
            <AlertDialog.Title>
              <Text size="$label/l">Log out from Tlon</Text>
            </AlertDialog.Title>
            <AlertDialog.Description>
              <Text size="$label/m">Are you sure you want to log out?</Text>
            </AlertDialog.Description>
            <XStack gap="$l">
              <AlertDialog.Action>
                <Button minimal>
                  <Button.Text>Cancel</Button.Text>
                </Button>
              </AlertDialog.Action>
              <AlertDialog.Action onPress={onConfirm}>
                <Button minimal>
                  <Button.Text color="$negativeActionText">
                    Log out now
                  </Button.Text>
                </Button>
              </AlertDialog.Action>
            </XStack>
          </YStack>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog>
  );
}
