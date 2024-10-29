import type { NavigatorScreenParams } from '@react-navigation/native';
import type * as db from '@tloncorp/shared/db';

export type DrawerParamList = {
  Home: undefined;
  Activity: undefined;
  Profile: undefined;
  Channel: {
    channel: db.Channel;
  };
};

export type RootStackParamList = {
  Empty: undefined;
  ChatList: { previewGroup: db.Group } | undefined;
  Activity: undefined;
  Profile: undefined;
  Channel: {
    channel: db.Channel;
    selectedPostId?: string | null;
  };
  FindGroups: undefined;
  ContactHostedGroups: {
    contactId: string;
  };
  CreateGroup: undefined;
  GroupChannels: {
    group: db.Group;
  };
  ChannelSearch: {
    channel: db.Channel;
  };
  Post: {
    post: {
      id: string;
      channelId: string;
      authorId: string;
    };
  };
  ImageViewer: {
    post: db.Post;
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
