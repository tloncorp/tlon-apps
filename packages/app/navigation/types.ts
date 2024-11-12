import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  ChatList: { previewGroupId: string } | undefined;
  Activity: undefined;
  Profile: undefined;
  Channel: {
    channelId: string;
    groupId?: string;
    selectedPostId?: string | null;
    startDraft?: boolean;
  };
  FindGroups: undefined;
  ContactHostedGroups: {
    contactId: string;
  };
  CreateGroup: undefined;
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
  };
  ImageViewer: {
    uri?: string;
  };
  GroupSettings: NavigatorScreenParams<GroupSettingsStackParamList>;
  AppSettings: undefined;
  FeatureFlags: undefined;
  ManageAccount: undefined;
  BlockedUsers: undefined;
  AppInfo: undefined;
  PushNotificationSettings: undefined;
  UserProfile: {
    userId: string;
  };
  EditProfile: undefined;
  WompWomp: undefined;
  ChannelMembers: {
    channelId: string;
  };
  ChannelMeta: {
    channelId: string;
  };
};

export type RootDrawerParamList = {
  Home: NavigatorScreenParams<HomeDrawerParamList>;
} & Pick<RootStackParamList, 'Activity' | 'Profile'>;

export type HomeDrawerParamList = Pick<
  RootStackParamList,
  'ChatList' | 'GroupChannels' | 'Channel'
> & {
  MainContent: undefined;
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
