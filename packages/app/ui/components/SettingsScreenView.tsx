import { useIsWindowNarrow } from '@tloncorp/ui';
import { useMemo } from 'react';
import { Alert } from 'react-native';
import { View, isWeb } from 'tamagui';

import { useContactName } from './ContactNameV2';
import { ScreenHeader } from './ScreenHeader';
import {
  SettingsList,
  useSettingsListHeaderColor,
  type SettingsRowModel,
  type SettingsSectionModel,
} from './SettingsList';

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
   * The bot's own sections, placed after the user's own. Supplied by the
   * feature layer, which owns the bot queries and draft; absent for users
   * without a bot, and on web, where `onBotSettingsPressed` opens the hosted
   * page instead.
   */
  botSections?: SettingsSectionModel[];
  /** The apply bar for `botSections`, pinned below the scrolling content. */
  bottomBar?: React.ReactNode;
  botEnabled?: boolean;
  themeLabel?: string;
  notificationsLabel?: string;
}

const botSettingsRouteNames = new Set([
  'BotSettings',
  'BotMcpSettings',
  'BotModelSettings',
  'BotApiKeySettings',
  'BotShipListSettings',
  'BotChannelRulesSettings',
  'BotChannelRuleSettings',
  'BotPermissionsSettings',
  'BotIdentitySettings',
  'BotProviderListSettings',
  'BotModels',
  'BotConnections',
]);

export function SettingsScreenView(props: Props) {
  const isWindowNarrow = useIsWindowNarrow();
  const headerColor = useSettingsListHeaderColor();
  const profileName = useContactName({
    contactId: props.currentUserId,
    expandLongIds: true,
  });
  const sections = useSettingsSections(props, profileName);

  return (
    <>
      <ScreenHeader
        title="Settings"
        backgroundColor={headerColor}
        backAction={props.onBackPressed}
        borderBottom={isWindowNarrow}
        placement="navigation"
      />
      <View flex={1}>
        <SettingsList sections={sections} />
      </View>
      {props.bottomBar}
    </>
  );
}

/**
 * Settings in untitled groups: you on your own, then your bot with its
 * options, then every other option in one list, with logging out on its own at
 * the end.
 */
function useSettingsSections(
  props: Props,
  profileName: string | undefined
): SettingsSectionModel[] {
  const {
    focusedRouteName,
    onLogoutPressed,
    botSections,
    botEnabled,
    onBotSettingsPressed,
  } = props;

  return useMemo(() => {
    const handleLogoutPressed = () => {
      Alert.alert('Log out from Tlon', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out now',
          style: 'destructive',
          onPress: onLogoutPressed,
        },
      ]);
    };

    const profileRows: SettingsRowModel[] = [];
    if (props.onProfilePressed) {
      profileRows.push({
        key: 'profile',
        // Your name leads, the way the account row does in platform settings.
        title: profileName || 'Your profile',
        subtitle: profileName ? 'Your profile' : undefined,
        leading: { kind: 'contact', contactId: props.currentUserId },
        prominent: true,
        onPress: props.onProfilePressed,
        contextActions: props.onProfileLongPressed
          ? [
              {
                key: 'status',
                title: 'Set status',
                onPress: props.onProfileLongPressed,
              },
            ]
          : undefined,
        isFocused: focusedRouteName === 'UserProfile',
        testID: 'SettingsProfileRow',
      });
    }
    const accountRows: SettingsRowModel[] = [];
    if (props.onContactsPressed) {
      accountRows.push({
        key: 'contacts',
        title: 'Contacts',
        leading: { kind: 'icon', icon: 'Contacts' },
        onPress: props.onContactsPressed,
        isFocused: focusedRouteName === 'Contacts',
      });
    }
    if (props.hasHostedAuth) {
      accountRows.push({
        key: 'manage-account',
        title: 'Manage Tlon account',
        leading: { kind: 'icon', icon: 'Tlon' },
        onPress: props.onManageAccountPressed,
        isFocused: focusedRouteName === 'ManageAccount',
      });
    }

    // Web and a lapsed hosting session can't host the bot's settings inline,
    // so they keep the single row that opens them elsewhere.
    const botLinkRows: SettingsRowModel[] =
      botEnabled && !botSections
        ? [
            {
              key: 'bot-settings',
              title: 'Bot Settings',
              leading: { kind: 'icon', icon: 'Face' },
              onPress: onBotSettingsPressed,
              isFocused:
                focusedRouteName !== undefined &&
                botSettingsRouteNames.has(focusedRouteName),
            },
          ]
        : [];

    const preferenceRows: SettingsRowModel[] = [
      {
        key: 'notifications',
        title: 'Notifications',
        value: props.notificationsLabel,
        leading: { kind: 'icon', icon: 'Notifications' },
        onPress: props.onNotificationSettingsPressed,
        isFocused: focusedRouteName === 'PushNotificationSettings',
      },
      {
        key: 'appearance',
        title: 'Appearance',
        value: props.themeLabel,
        leading: { kind: 'icon', icon: 'ChannelGalleries' },
        onPress: props.onThemePressed,
        isFocused: focusedRouteName === 'Theme',
      },
      {
        key: 'privacy',
        title: 'Privacy',
        leading: { kind: 'icon', icon: 'Lock' },
        onPress: props.onPrivacyPressed,
        isFocused: focusedRouteName === 'PrivacySettings',
      },
      {
        key: 'blocked-users',
        title: 'Blocked users',
        leading: { kind: 'icon', icon: 'Placeholder' },
        onPress: props.onBlockedUsersPressed,
        isFocused: focusedRouteName === 'BlockedUsers',
      },
    ];

    const aboutRows: SettingsRowModel[] = [
      {
        key: 'app-info',
        title: 'App info',
        leading: { kind: 'icon', icon: 'Info' },
        onPress: props.onAppInfoPressed,
        isFocused: focusedRouteName === 'AppInfo',
      },
      {
        key: 'bug-report',
        title: 'Report a bug',
        leading: { kind: 'icon', icon: 'Send' },
        onPress: props.onSendBugReportPressed,
        isFocused: focusedRouteName === 'WompWomp',
      },
      {
        key: 'experimental',
        title: 'Experimental features',
        leading: { kind: 'icon', icon: 'Bang' },
        onPress: props.onExperimentalFeaturesPressed,
        isFocused: focusedRouteName === 'FeatureFlags',
      },
    ];
    if (props.onWebAppPressed) {
      aboutRows.push({
        key: 'web-app',
        title: 'Tlon Messenger on the Web',
        leading: { kind: 'icon', icon: 'Link' },
        accessory: 'external',
        onPress: props.onWebAppPressed,
      });
    }

    const sections: SettingsSectionModel[] = [
      { key: 'profile', rows: profileRows },
      ...(botSections ?? []),
      { key: 'bot-link', rows: botLinkRows },
      {
        key: 'options',
        rows: [...accountRows, ...preferenceRows, ...aboutRows],
      },
    ];
    if (!isWeb) {
      sections.push({
        key: 'logout',
        rows: [
          {
            key: 'logout',
            title: 'Log out',
            destructive: true,
            onPress: handleLogoutPressed,
          },
        ],
      });
    }

    return sections.filter((section) => section.rows.length > 0);
  }, [
    botEnabled,
    botSections,
    focusedRouteName,
    onBotSettingsPressed,
    onLogoutPressed,
    profileName,
    props.currentUserId,
    props.hasHostedAuth,
    props.notificationsLabel,
    props.onAppInfoPressed,
    props.onBlockedUsersPressed,
    props.onContactsPressed,
    props.onExperimentalFeaturesPressed,
    props.onManageAccountPressed,
    props.onNotificationSettingsPressed,
    props.onPrivacyPressed,
    props.onProfileLongPressed,
    props.onProfilePressed,
    props.onSendBugReportPressed,
    props.onThemePressed,
    props.onWebAppPressed,
    props.themeLabel,
  ]);
}
