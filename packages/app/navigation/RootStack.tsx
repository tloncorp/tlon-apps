import { useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getChannelType } from '@tloncorp/api/urbit';
import { useMemo } from 'react';
import { Platform, StatusBar } from 'react-native';

import { InviteUsersScreen } from '../features/InviteUsersScreen';
import { BrowserCredentialHandoffProvider } from '../features/browser/BrowserCredentialHandoffProvider';
import { BrowserCredentialHandoffScreen } from '../features/browser/BrowserCredentialHandoffScreen';
import { ChannelMembersScreen } from '../features/channels/ChannelMembersScreen';
import { ChannelMetaScreen } from '../features/channels/ChannelMetaScreen';
import { ChannelTemplateScreen } from '../features/channels/ChannelTemplateScreen';
import { AddContactsScreen } from '../features/contacts/AddContactsScreen';
import { InviteSystemContactsScreen } from '../features/contacts/InviteSystemContactsScreen';
import { ContextLensRunScreen } from '../features/lens/ContextLensRunScreen';
import { ContextLensRunsScreen } from '../features/lens/ContextLensRunsScreen';
import { AttestationScreen } from '../features/profile/AttestationScreen';
import { ScheduledTaskEditorScreen } from '../features/automations/ScheduledTaskEditorScreen';
import { ScheduledTasksScreen } from '../features/automations/ScheduledTasksScreen';
import { AppInfoScreen } from '../features/settings/AppInfoScreen';
import { BlockedUsersScreen } from '../features/settings/BlockedUsersScreen';
import { BotApiKeySettingsScreen } from '../features/settings/BotApiKeySettingsScreen';
import { BotChannelRuleSettingsScreen } from '../features/settings/BotChannelRuleSettingsScreen';
import { BotChannelRulesScreen } from '../features/settings/BotChannelRulesScreen';
import { BotMcpSettingsScreen } from '../features/settings/BotMcpSettingsScreen';
import { BotModelSettingsScreen } from '../features/settings/BotModelSettingsScreen';
import {
  BotConnectionsScreen,
  BotModelsScreen,
} from '../features/settings/BotSettingsAreaScreens';
import { BotOpenAISubscriptionScreen } from '../features/settings/BotOpenAISubscriptionScreen';
import { BotIdentitySettingsScreen } from '../features/settings/BotIdentitySettingsScreen';
import { BotPermissionsSettingsScreen } from '../features/settings/BotPermissionsSettingsScreen';
import { BotProviderListSettingsScreen } from '../features/settings/BotProviderListSettingsScreen';
import { BotSettingsScreen } from '../features/settings/BotSettingsScreen';
import { BotShipListSettingsScreen } from '../features/settings/BotShipListSettingsScreen';
import { EditProfileScreen } from '../features/settings/EditProfileScreen';
import { FeatureFlagScreen } from '../features/settings/FeatureFlagScreen';
import { ManageAccountScreen } from '../features/settings/ManageAccountScreen';
import { PrivacySettingsScreen } from '../features/settings/PrivacyScreen';
import { PushNotificationSettingsScreen } from '../features/settings/PushNotificationSettingsScreen';
import { ThemeScreen } from '../features/settings/ThemeScreen';
import { UserBugReportScreen } from '../features/settings/UserBugReportScreen';
import ChannelScreen from '../features/top/ChannelScreen';
import ChannelSearchScreen from '../features/top/ChannelSearchScreen';
import { ChatDetailsScreen } from '../features/top/ChatDetailsScreen';
import { ChatVolumeScreen } from '../features/top/ChatVolumeScreen';
import ContactsScreen from '../features/top/ContactsScreen';
import { GroupChannelsScreen } from '../features/top/GroupChannelsScreen';
import MediaViewerScreen from '../features/top/MediaViewerScreen';
import { BucketFileScreen } from '../features/top/BucketFileScreen';
import { BucketFolderScreen } from '../features/top/BucketFolderScreen';
import { NotesDetailScreen } from '../features/top/NotesDetailScreen';
import { NotesFolderScreen } from '../features/top/NotesFolderScreen';
import { NotesSearchScreen } from '../features/top/NotesSearchScreen';
import PostScreen from '../features/top/PostScreen';
import { UserProfileScreen } from '../features/top/UserProfileScreen';
import { useIsDarkMode } from '../hooks/useDarkMode';
import { useAgentGroupOnboardingStartupRoute } from '../hooks/useAgentGroupOnboardingLock';
import { useTheme } from '../ui';
import { supportsLiquidGlass } from '../ui/components/GlassSurface';
import { GroupSettingsStack } from './GroupSettingsStack';
import { OnboardingStartupScreen } from './OnboardingStartupScreen';
import { TopLevelNavigator } from './TopLevelNavigator';
import {
  channelTypeUsesNativeHeader,
  getNativeHeaderScrollOptions,
  nativeHeaderPresentationOptions,
} from './nativeHeaderOptions';
import type { RootStackParamList } from './types';
import { mediaViewerScreenOptions } from './utils';

const Root = createNativeStackNavigator<RootStackParamList>();
// Static options keep the RootStack-owned header mounted before native
// transitions begin. Unmigrated routes retain the content-owned default.
const nativeHeaderScreenOptions = {
  headerShown: Platform.OS !== 'web',
} as const;
// For screens that draw nothing until their data loads: native stack titles
// an untitled header with the route name.
const untitledNativeHeaderScreenOptions = {
  ...nativeHeaderScreenOptions,
  title: '',
} as const;

export function RootStack() {
  return (
    <BrowserCredentialHandoffProvider>
      <RootStackContent />
    </BrowserCredentialHandoffProvider>
  );
}

function RootStackContent() {
  const isDarkMode = useIsDarkMode();

  // Android status bar has a solid color by default, so we clear it
  useFocusEffect(() => {
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('transparent');
      StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
    }
  });

  const theme = useTheme();
  // A conversation's header turns transparent once it mounts (the scroll
  // options ChannelHeader installs). Starting that way keeps the content frame
  // from resizing under a conversation that is still loading.
  const conversationHeaderScreenOptions = useMemo(
    () => ({
      ...untitledNativeHeaderScreenOptions,
      ...getNativeHeaderScrollOptions({
        platform: Platform.OS,
        platformVersion: Platform.Version,
        liquidGlassAvailable: supportsLiquidGlass(),
        bottomEdgeEffect: 'soft',
      }),
    }),
    []
  );
  const onboardingStartup = useAgentGroupOnboardingStartupRoute();

  if (onboardingStartup.isLoading) return null;

  return (
    <Root.Navigator
      initialRouteName={
        onboardingStartup.route ? 'OnboardingStartup' : 'MainTabs'
      }
      screenOptions={{
        ...nativeHeaderPresentationOptions,
        headerBackVisible: false,
        headerShown: false,
        contentStyle: { backgroundColor: theme.background?.val },
      }}
    >
      {onboardingStartup.route ? (
        <Root.Screen
          name="OnboardingStartup"
          component={OnboardingStartupScreen}
          initialParams={onboardingStartup.route}
          options={{ animation: 'none', gestureEnabled: false }}
        />
      ) : null}
      {/* top level sections */}
      <Root.Screen
        name="MainTabs"
        component={TopLevelNavigator}
        options={{
          ...nativeHeaderScreenOptions,
          // The header is up before any section has installed its own title
          // (the bot DM draws nothing until its channel loads), and native
          // stack titles an untitled header with the route name.
          title: '',
          animation: 'none',
          gestureEnabled: false,
        }}
      />
      <Root.Screen
        name="Contacts"
        component={ContactsScreen}
        options={nativeHeaderScreenOptions}
      />

      {/* individual screens */}
      <Root.Screen
        name="BrowserCredentialHandoff"
        component={BrowserCredentialHandoffScreen}
        options={{ presentation: 'modal' }}
      />
      <Root.Screen name="AddContacts" component={AddContactsScreen} />
      <Root.Screen name="GroupSettings" component={GroupSettingsStack} />
      <Root.Screen<'Channel'>
        name="Channel"
        component={ChannelScreen}
        options={({ route }) => {
          const type = getChannelType(route.params.channelId);
          return {
            ...(type === 'notes'
              ? untitledNativeHeaderScreenOptions
              : channelTypeUsesNativeHeader(type)
                ? conversationHeaderScreenOptions
                : null),
            animation: route.params.disableTransition ? 'none' : 'default',
          };
        }}
      />
      <Root.Screen
        name="DM"
        component={ChannelScreen}
        options={conversationHeaderScreenOptions}
      />
      <Root.Screen
        name="GroupDM"
        component={ChannelScreen}
        options={conversationHeaderScreenOptions}
      />
      <Root.Screen name="ChannelSearch" component={ChannelSearchScreen} />
      <Root.Screen
        name="ContextLensRuns"
        component={ContextLensRunsScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="ContextLensRun"
        component={ContextLensRunScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen name="Post" component={PostScreen} />
      <Root.Screen
        name="NotesDetail"
        component={NotesDetailScreen}
        options={untitledNativeHeaderScreenOptions}
      />
      <Root.Screen
        name="NotesFolder"
        component={NotesFolderScreen}
        options={untitledNativeHeaderScreenOptions}
      />
      <Root.Screen name="NotesSearch" component={NotesSearchScreen} />
      <Root.Screen name="BucketFolder" component={BucketFolderScreen} />
      <Root.Screen name="BucketFile" component={BucketFileScreen} />
      <Root.Screen
        name="GroupChannels"
        component={GroupChannelsScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="MediaViewer"
        component={MediaViewerScreen}
        options={mediaViewerScreenOptions}
      />
      <Root.Screen
        name="ChatDetails"
        component={ChatDetailsScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen name="ChatVolume" component={ChatVolumeScreen} />
      <Root.Screen
        name="ManageAccount"
        component={ManageAccountScreen}
        options={{ gestureEnabled: false }}
      />
      <Root.Screen
        name="BotSettings"
        component={BotSettingsScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="BotMcpSettings"
        component={BotMcpSettingsScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="BotModelSettings"
        component={BotModelSettingsScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="BotApiKeySettings"
        component={BotApiKeySettingsScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="BotOpenAISubscription"
        component={BotOpenAISubscriptionScreen}
        options={{ ...nativeHeaderScreenOptions, gestureEnabled: false }}
      />
      <Root.Screen
        name="BotShipListSettings"
        component={BotShipListSettingsScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="BotChannelRulesSettings"
        component={BotChannelRulesScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="BotChannelRuleSettings"
        component={BotChannelRuleSettingsScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="BotPermissionsSettings"
        component={BotPermissionsSettingsScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="BotIdentitySettings"
        component={BotIdentitySettingsScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="BotProviderListSettings"
        component={BotProviderListSettingsScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="BotModels"
        component={BotModelsScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="BotConnections"
        component={BotConnectionsScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="BlockedUsers"
        component={BlockedUsersScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="Theme"
        component={ThemeScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="AppInfo"
        component={AppInfoScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="FeatureFlags"
        component={FeatureFlagScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="PushNotificationSettings"
        component={PushNotificationSettingsScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="ScheduledTasks"
        component={ScheduledTasksScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="ScheduledTaskEditor"
        component={ScheduledTaskEditorScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen name="Attestation" component={AttestationScreen} />
      <Root.Screen name="EditProfile" component={EditProfileScreen} />
      <Root.Screen
        name="WompWomp"
        component={UserBugReportScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="PrivacySettings"
        component={PrivacySettingsScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen
        name="ChannelMembers"
        component={ChannelMembersScreen}
        options={nativeHeaderScreenOptions}
      />
      <Root.Screen name="ChannelMeta" component={ChannelMetaScreen} />
      <Root.Screen name="ChannelTemplate" component={ChannelTemplateScreen} />
      <Root.Screen
        name="InviteSystemContacts"
        component={InviteSystemContactsScreen}
      />
      <Root.Screen name="InviteUsers" component={InviteUsersScreen} />
    </Root.Navigator>
  );
}
