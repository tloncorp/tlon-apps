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

export type HomeStackParamList = {
  GroupsList: undefined;
  Channel: {
    group: db.Group;
    channel?: db.Channel;
    selectedPost?: db.PostWithRelations;
  };
  ChannelSearch: {
    channel: db.Channel;
  };
};

export type TabParamList = {
  Groups: NavigatorScreenParams<HomeStackParamList>;
  Messages: NavigatorScreenParams<WebViewStackParamList>;
  Activity: NavigatorScreenParams<WebViewStackParamList>;
  Profile: NavigatorScreenParams<WebViewStackParamList>;
  Discover: NavigatorScreenParams<WebViewStackParamList>;
};

export type TabName = keyof TabParamList;

export type OnboardingStackParamList = {
  Welcome: undefined;
  SignUpEmail: { lure?: string; priorityToken?: string } | undefined;
  EULA:
    | { shipId: string; shipUrl: string; authCookie: string }
    | { email: string; lure: string; priorityToken?: string };
  SignUpPassword: { email: string; lure: string; priorityToken?: string };
  JoinWaitList: { email: string; lure?: string };
  RequestPhoneVerify: { user: User };
  CheckVerify: { user: User };
  ReserveShip: { user: User; signUpExtras?: SignUpExtras };
  SetNickname: { user: User; signUpExtras: SignUpExtras };
  SetNotifications: { user: User; signUpExtras: SignUpExtras };
  SetTelemetry: { user: User; signUpExtras: SignUpExtras };
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
