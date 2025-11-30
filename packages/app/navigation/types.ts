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
  };
  ImageViewer: {
    uri?: string;
  };
  GroupSettings: NavigatorScreenParams<GroupSettingsStackParamList>;
  AppSettings: undefined;
  Theme: undefined;
  FeatureFlags: undefined;
  ManageAccount: undefined;
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
  };
  ChatVolume: {
    chatType: 'group' | 'channel';
    chatId: string;
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
  ImageViewer: RootStackParamList['ImageViewer'];
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
  | 'ImageViewer'
  | 'UserProfile'
  | 'EditProfile'
  | 'ChannelMembers'
  | 'ChannelMeta'
  | 'ChannelTemplate'
  | 'InviteUsers'
> & { ChannelRoot: RootStackParamList['Channel'] };

export type GroupSettingsStackParamList = {
  EditChannel: {
    channelId: string;
    groupId: string;
    fromChatDetails?: boolean;
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
  };
  SelectRoleMembers: {
    groupId: string;
    roleId?: string;
    selectedMembers: string[];
    onSave: (selectedMembers: string[]) => void;
    fromChatDetails?: boolean;
  };
  ChatVolume: {
    chatType: 'group' | 'channel';
    chatId: string;
    fromChatDetails?: boolean;
  };
};
