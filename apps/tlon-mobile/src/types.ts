import type { NavigatorScreenParams } from '@react-navigation/native';
import type * as db from '@tloncorp/shared/dist/db';

export type SignUpExtras = {
  nickname?: string;
  notificationToken?: string;
  telemetry?: boolean;
};

type ExternalWebViewScreenParams = {
  uri: string;
  headers?: Record<string, string | null>;
  injectedJavaScript?: string;
};

export type WebViewStackParamList = {
  Webview: undefined;
  ExternalWebView: ExternalWebViewScreenParams;
};

export type RootStackParamList = {
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

export type SettingsStackParamList = {
  Settings: undefined;
  FeatureFlags: undefined;
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  InventoryCheck: undefined;
  SignUpEmail: undefined;
  EULA: undefined;
  SignUpPassword: { email: string };
  InviteLink: undefined;
  JoinWaitList: { email?: string };
  RequestPhoneVerify: { user: User };
  CheckVerify: { user: User };
  ReserveShip: { user: User };
  SetNickname: { user: User };
  SetTelemetry: { user: User };
  TlonLogin: undefined;
  ShipLogin: undefined;
  ResetPassword: { email?: string };
};

export type User = {
  id: string;
  email: string;
  phoneNumber?: string;
  admin: boolean;
  ships: string[];
  requirePhoneNumberVerification: boolean;
  verified: boolean;
};

export type ReservableShip = {
  id: string;
  readyForDistribution: boolean;
};

export type ReservedShip = {
  id: string;
  reservedBy: string;
};

export type BootPhase =
  | 'Pending'
  | 'Ready'
  | 'Suspended'
  | 'UnderMaintenance'
  | 'Halting'
  | 'ExportRunning'
  | 'Unknown';

export type HostedShipStatus = {
  phase: BootPhase;
};
