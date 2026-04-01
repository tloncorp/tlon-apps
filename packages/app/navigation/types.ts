import type {
  NavigationProp,
  NavigatorScreenParams,
  RouteProp,
} from '@react-navigation/native';

export type RootStackParamList = {
  VerifierStub: undefined;
  Contacts: undefined;
  Empty: undefined;
  ChatList: { previewGroupId: string } | undefined;
  Activity: undefined;
  Settings: undefined;
  DM: {
    channelId: string;
    selectedPostId?: string | null;
    startDraft?: boolean;
  };
  GroupDM: {
    channelId: string;
    selectedPostId?: string | null;
    startDraft?: boolean;
  };
  Channel: {
    channelId: string;
    groupId?: string;
    selectedPostId?: string | null;
    startDraft?: boolean;
  };
  GroupChannels: {
    groupId: string;
  };
  ChannelSearch: {
    channelId: string;
    groupId: string;
  };
  Post: {
    postId: string;
    channelId: string;
    authorId: string;
    groupId?: string;
    selectedPostId?: string | null;
  };
  MediaViewer: {
    mediaType: 'image' | 'video';
    uri?: string;
    posterUri?: string;
  };
  GroupSettings: NavigatorScreenParams<GroupSettingsStackParamList>;
  AppSettings: undefined;
  Theme: undefined;
  FeatureFlags: undefined;
  ManageAccount: undefined;
  BotSettings: undefined;
  BlockedUsers: undefined;
  PrivacySettings: undefined;
  AppInfo: undefined;
  PushNotificationSettings: undefined;
  AddContacts: undefined;
  InviteSystemContacts: undefined;
  InviteUsers: {
    groupId?: string;
  };
  UserProfile: {
    userId: string;
    groupId?: string;
    channelId?: string;
  };
  EditProfile: {
    userId: string;
  };
  Attestation: {
    attestationType: 'twitter' | 'phone';
  };
  WompWomp: undefined;
  ChannelMembers: {
    channelId: string;
  };
  ChannelMeta: {
    channelId: string;
  };
  PostUsingContentConfiguration: {
    postId: string;
    channelId: string;
  };
  ChannelTemplate: {
    channelId: string;
  };
  ChatDetails: {
    chatType: 'group' | 'channel';
    chatId: string;
    groupId?: string;
  };
  ChatVolume: {
    chatType: 'group' | 'channel';
    chatId: string;
    groupId?: string;
  };
};

export type RootStackRouteProp<T extends keyof RootStackParamList> = RouteProp<
  RootStackParamList,
  T
>;

export type GroupSettingsStackRouteProp<
  T extends keyof GroupSettingsStackParamList,
> = RouteProp<GroupSettingsStackParamList, T>;

export type RootStackNavigationProp = NavigationProp<RootStackParamList>;

export type RootDrawerParamList = {
  Home: NavigatorScreenParams<HomeDrawerParamList>;
  Messages: NavigatorScreenParams<HomeDrawerParamList>;
} & Pick<RootStackParamList, 'Activity' | 'Contacts' | 'Settings'>;

// hack: adding the true contacts types causes lots of tsc failures that need
// resolving. Added to support navigating deeply within the contacts drawer
export type ActualRootDrawerParamList = {
  Home: NavigatorScreenParams<HomeDrawerParamList>;
  Messages: NavigatorScreenParams<HomeDrawerParamList>;
  Contacts: NavigatorScreenParams<ProfileDrawerParamList>;
} & Pick<RootStackParamList, 'Activity' | 'Settings'>;

export type CombinedParamList = RootStackParamList & RootDrawerParamList;

export type HomeDrawerParamList = Pick<
  RootStackParamList,
  'ChatList' | 'GroupChannels' | 'InviteUsers'
> & {
  MainContent: undefined;
  Channel:
    | NavigatorScreenParams<ChannelStackParamList>
    | RootStackParamList['Channel'];
  DM: NavigatorScreenParams<ChannelStackParamList> | RootStackParamList['DM'];
  GroupDM:
    | NavigatorScreenParams<ChannelStackParamList>
    | RootStackParamList['GroupDM'];
  ChatDetails: RootStackParamList['ChatDetails'];
  ChatVolume: RootStackParamList['ChatVolume'];
};

export type ProfileDrawerParamList = Pick<
  RootStackParamList,
  'Contacts' | 'AddContacts' | 'UserProfile'
>;

export type SettingsDrawerParamList = Pick<
  RootStackParamList,
  | 'AppSettings'
  | 'Theme'
  | 'FeatureFlags'
  | 'ManageAccount'
  | 'BlockedUsers'
  | 'AppInfo'
  | 'PushNotificationSettings'
  | 'WompWomp'
  | 'PrivacySettings'
>;

export type ChannelStackParamList = {
  ChannelRoot: RootStackParamList['Channel'];
  GroupSettings: RootStackParamList['GroupSettings'];
  ChannelSearch: RootStackParamList['ChannelSearch'];
  Post: RootStackParamList['Post'];
  MediaViewer: RootStackParamList['MediaViewer'];
  UserProfile: RootStackParamList['UserProfile'];
  EditProfile: RootStackParamList['EditProfile'];
  ChannelMembers: RootStackParamList['ChannelMembers'];
  ChannelMeta: RootStackParamList['ChannelMeta'];
};

export type DesktopChannelStackParamList = Pick<
  RootStackParamList,
  | 'GroupSettings'
  | 'ChannelSearch'
  | 'Post'
  | 'MediaViewer'
  | 'UserProfile'
  | 'EditProfile'
  | 'ChannelMembers'
  | 'ChannelMeta'
  | 'ChannelTemplate'
  | 'InviteUsers'
> & { ChannelRoot: RootStackParamList['Channel'] };

/**
 * Screens that SelectChannelRoles can navigate back to with selected roles.
 * Using a discriminated union so TypeScript can verify params match the screen.
 */
export type RoleSelectionReturn =
  | {
      returnScreen: 'CreateChannelPermissions';
      returnParams: {
        groupId: string;
        channelTitle: string;
        channelType: 'chat' | 'notebook' | 'gallery';
      };
    }
  | {
      returnScreen: 'EditChannelPrivacy';
      returnParams: {
        channelId: string;
        groupId: string;
        fromChatDetails?: boolean;
      };
    };

export type GroupSettingsStackParamList = {
  // Use 'ChannelInfo' instead of 'ChannelDetails' to avoid navigation conflicts.
  // HomeDrawer also has a 'ChatDetails' screen, and React Navigation can get
  // confused when navigating to a screen name that exists in multiple navigators.
  // The component rendered is ChannelDetailsScreenView, but the route is named
  // 'ChannelInfo' to disambiguate at the navigation layer.
  ChannelInfo: {
    chatType: 'group' | 'channel';
    chatId: string;
    groupId: string;
    fromChatDetails?: boolean;
  };
  EditChannelMeta: {
    channelId: string;
    groupId: string;
    fromChatDetails?: boolean;
    fromChannelInfo?: boolean;
  };
  EditChannelPrivacy: {
    channelId: string;
    groupId: string;
    fromChatDetails?: boolean;
    createdRoleId?: string;
    selectedRoleIds?: string[];
  };
  GroupMeta: {
    groupId: string;
    fromBlankChannel?: boolean;
    fromChatDetails?: boolean;
  };
  GroupMembers: {
    groupId: string;
    fromChatDetails?: boolean;
  };
  ManageChannels: {
    groupId: string;
    fromChatDetails?: boolean;
    createdRoleId?: string;
  };
  Privacy: {
    groupId: string;
    fromChatDetails?: boolean;
  };
  GroupRoles: {
    groupId: string;
    fromChatDetails?: boolean;
  };
  EditRole: {
    groupId: string;
    roleId: string;
    selectedMembers?: string[];
    fromChatDetails?: boolean;
  };
  AddRole: {
    groupId: string;
    selectedMembers?: string[];
    fromChatDetails?: boolean;
    returnScreen?: keyof GroupSettingsStackParamList;
    returnParams?: Record<string, unknown>;
  };
  SelectRoleMembers: {
    groupId: string;
    roleId?: string;
    selectedMembers: string[];
    onSave: (selectedMembers: string[]) => void;
  };
  CreateChannelPermissions: {
    groupId: string;
    channelTitle: string;
    channelType: 'chat' | 'notebook' | 'gallery';
    createdRoleId?: string;
    selectedRoleIds?: string[];
  };
  SelectChannelRoles: {
    groupId: string;
    selectedRoleIds: string[];
    createdRoleId?: string;
  } & RoleSelectionReturn;
  ChatVolume: {
    chatType: 'group' | 'channel';
    chatId: string;
    groupId?: string;
  };
};
