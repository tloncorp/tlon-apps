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
  Profile: undefined;
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
  AppInfo: undefined;
  PushNotificationSettings: undefined;
  AddContacts: undefined;
  UserProfile: {
    userId: string;
  };
  EditProfile: {
    userId: string;
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
} & Pick<RootStackParamList, 'Activity' | 'Contacts'>;

export type CombinedParamList = RootStackParamList & RootDrawerParamList;

export type HomeDrawerParamList = Pick<
  RootStackParamList,
  'ChatList' | 'GroupChannels'
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
> & { ChannelRoot: RootStackParamList['Channel'] };

export type GroupSettingsStackParamList = {
  EditChannel: {
    channelId: string;
    groupId: string;
  };
  GroupMeta: {
    groupId: string;
  };
  GroupMembers: {
    groupId: string;
  };
  ManageChannels: {
    groupId: string;
  };
  Privacy: {
    groupId: string;
  };
  GroupRoles: {
    groupId: string;
  };
};
