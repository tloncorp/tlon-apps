import { Icon, IconType, Pressable, useIsWindowNarrow } from '@tloncorp/ui';
import { Fragment, ReactElement, ReactNode } from 'react';
import { Alert } from 'react-native';
import { View, YStack, isWeb } from 'tamagui';

import { useTopLevelDrawerToggleAction } from '../../navigation/useTopLevelDrawerToggle';
import { ContactName } from './ContactNameV2';
import { ListItem } from './ListItem';
import { ScreenHeader } from './ScreenHeader';
import { ScreenScrollView } from './ScreenScrollView';
import { SettingsDivider, SettingsSection } from './SettingsSection';
import { TlonLogo } from './TlonLogo';

interface Props {
  currentUserId: string;
  hasHostedAuth: boolean;
  onProfilePressed?: () => void;
  onProfileLongPressed?: () => void;
  onContactsPressed?: () => void;
  onAppInfoPressed?: () => void;
  onNotificationSettingsPressed: () => void;
  onBlockedUsersPressed: () => void;
  onPrivacyPressed: () => void;
  onManageAccountPressed: () => void;
  onBotSettingsPressed?: () => void;
  onThemePressed?: () => void;
  onLogoutPressed?: () => void;
  onSendBugReportPressed?: () => void;
  onExperimentalFeaturesPressed?: () => void;
  onWebAppPressed?: () => void;
  onBackPressed?: () => void;
  focusedRouteName?: string;
  /**
   * The bot's own rows, rendered above the app rows. Supplied by the feature
   * layer, which owns the bot queries and draft; absent for users without a
   * bot, and on web, where `onBotSettingsPressed` opens the hosted page instead.
   */
  botSections?: ReactNode;
  /** The apply bar for `botSections`, pinned below the scrolling content. */
  bottomBar?: ReactNode;
  botEnabled?: boolean;
  themeLabel?: string;
  notificationsLabel?: string;
}

export function SettingsScreenView(props: Props) {
  const botSettingsFocused =
    props.focusedRouteName === 'BotSettings' ||
    props.focusedRouteName === 'BotMcpSettings' ||
    props.focusedRouteName === 'BotModelSettings' ||
    props.focusedRouteName === 'BotApiKeySettings' ||
    props.focusedRouteName === 'BotShipListSettings' ||
    props.focusedRouteName === 'BotChannelRulesSettings' ||
    props.focusedRouteName === 'BotChannelRuleSettings' ||
    props.focusedRouteName === 'BotPermissionsSettings' ||
    props.focusedRouteName === 'BotIdentitySettings' ||
    props.focusedRouteName === 'BotProviderListSettings';

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

  const isWindowNarrow = useIsWindowNarrow();

  const drawerToggle = useTopLevelDrawerToggleAction();

  // Rows the mockup names come first; the rest of the app's settings continue
  // the same section rather than moving somewhere less reachable.
  const appRows: { key: string; node: ReactNode }[] = [];

  if (props.onProfilePressed) {
    appRows.push({
      key: 'profile',
      node: (
        <ProfileAction
          currentUserId={props.currentUserId}
          onPress={props.onProfilePressed}
          onLongPress={props.onProfileLongPressed}
          isFocused={props.focusedRouteName === 'UserProfile'}
        />
      ),
    });
  }
  if (props.onContactsPressed) {
    appRows.push({
      key: 'contacts',
      node: (
        <SettingsAction
          title="Contacts"
          subtitle="People you know and invite"
          leftIcon="AddPerson"
          rightIcon="ChevronRight"
          onPress={props.onContactsPressed}
          isFocused={props.focusedRouteName === 'Contacts'}
        />
      ),
    });
  }
  appRows.push({
    key: 'notifications',
    node: (
      <SettingsAction
        title="Notifications"
        subtitle={props.notificationsLabel}
        leftIcon="Notifications"
        rightIcon="ChevronRight"
        onPress={props.onNotificationSettingsPressed}
        isFocused={props.focusedRouteName === 'PushNotificationSettings'}
      />
    ),
  });
  appRows.push({
    key: 'appearance',
    node: (
      <SettingsAction
        title="Appearance"
        subtitle={props.themeLabel}
        leftIcon="ChannelGalleries"
        rightIcon="ChevronRight"
        onPress={props.onThemePressed}
        isFocused={props.focusedRouteName === 'Theme'}
      />
    ),
  });
  if (props.hasHostedAuth) {
    appRows.push({
      key: 'manage-account',
      node: (
        <SettingsAction
          title="Manage Tlon account"
          rightIcon="ChevronRight"
          leftIcon={
            <View
              padding="$xl"
              backgroundColor="$secondaryBackground"
              borderRadius={100}
            >
              <TlonLogo width={'$xl'} height={'$xl'} color="$secondaryText" />
            </View>
          }
          onPress={props.onManageAccountPressed}
          isFocused={props.focusedRouteName === 'ManageAccount'}
        />
      ),
    });
  }
  appRows.push({
    key: 'privacy',
    node: (
      <SettingsAction
        title="Privacy"
        leftIcon="Lock"
        rightIcon="ChevronRight"
        onPress={props.onPrivacyPressed}
        isFocused={props.focusedRouteName === 'PrivacySettings'}
      />
    ),
  });
  appRows.push({
    key: 'blocked-users',
    node: (
      <SettingsAction
        title="Blocked users"
        leftIcon="Placeholder"
        rightIcon="ChevronRight"
        onPress={props.onBlockedUsersPressed}
        isFocused={props.focusedRouteName === 'BlockedUsers'}
      />
    ),
  });
  appRows.push({
    key: 'app-info',
    node: (
      <SettingsAction
        title="App info"
        leftIcon="Info"
        rightIcon="ChevronRight"
        onPress={props.onAppInfoPressed}
        isFocused={props.focusedRouteName === 'AppInfo'}
      />
    ),
  });
  if (props.onWebAppPressed) {
    appRows.push({
      key: 'web-app',
      node: (
        <SettingsAction
          title="Tlon Messenger on the Web"
          leftIcon="Link"
          onPress={props.onWebAppPressed}
        />
      ),
    });
  }
  appRows.push({
    key: 'bug-report',
    node: (
      <SettingsAction
        title="Report a bug"
        leftIcon="Send"
        rightIcon="ChevronRight"
        onPress={props.onSendBugReportPressed}
        isFocused={props.focusedRouteName === 'WompWomp'}
      />
    ),
  });
  appRows.push({
    key: 'experimental',
    node: (
      <SettingsAction
        title="Experimental features"
        leftIcon="Bang"
        rightIcon="ChevronRight"
        onPress={props.onExperimentalFeaturesPressed}
        isFocused={props.focusedRouteName === 'FeatureFlags'}
      />
    ),
  });
  if (!isWeb) {
    appRows.push({
      key: 'logout',
      node: (
        <SettingsAction
          title="Log out"
          leftIcon="LogOut"
          onPress={handleLogoutPressed}
        />
      ),
    });
  }

  return (
    <>
      <ScreenHeader
        title="Settings"
        leftActions={drawerToggle ? [drawerToggle] : undefined}
        backAction={props.onBackPressed}
        borderBottom={isWindowNarrow}
        placement="navigation"
      />
      <ScreenScrollView>
        {/* ScreenScrollView restores UIKit's automatic safe-area adjustment,
            which reserves the home indicator on its own; the padding below is
            only this screen's own edge spacing. */}
        <YStack flex={1} padding="$l" gap="$2xl">
          {props.botSections}
          {/* Web can't host the bot's settings inline, so it keeps the single
              row that opens the hosted page. */}
          {props.botEnabled && !props.botSections ? (
            <SettingsSection>
              <SettingsAction
                title="Bot Settings"
                leftIcon="Face"
                rightIcon="ChevronRight"
                onPress={props.onBotSettingsPressed}
                isFocused={botSettingsFocused}
              />
            </SettingsSection>
          ) : null}
          <SettingsSection title="App">
            {appRows.map((row, index) => (
              <Fragment key={row.key}>
                {index > 0 ? <SettingsDivider /> : null}
                {row.node}
              </Fragment>
            ))}
          </SettingsSection>
        </YStack>
      </ScreenScrollView>
      {props.bottomBar}
    </>
  );
}

/**
 * The user's own profile, which moved here when the bottom bar dropped its
 * avatar tab. Long press still opens the status sheet, as it did on that tab.
 */
function ProfileAction({
  currentUserId,
  onPress,
  onLongPress,
  isFocused,
}: {
  currentUserId: string;
  onPress: () => void;
  onLongPress?: () => void;
  isFocused?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      backgroundColor={isFocused ? '$secondaryBackground' : 'transparent'}
      testID="SettingsProfileRow"
    >
      <ListItem>
        <ListItem.ContactIcon size="$3xl" contactId={currentUserId} />
        <ListItem.MainContent>
          <ListItem.Title>Your profile</ListItem.Title>
          <ListItem.Subtitle>
            <ContactName expandLongIds contactId={currentUserId} />
          </ListItem.Subtitle>
        </ListItem.MainContent>
        <ListItem.EndContent>
          <Icon type="ChevronRight" color="$tertiaryText" size="$m" />
        </ListItem.EndContent>
      </ListItem>
    </Pressable>
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
