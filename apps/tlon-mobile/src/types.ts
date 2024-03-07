import type { NavigatorScreenParams } from '@react-navigation/native';

export type SignUpExtras = {
  nickname?: string;
  notificationToken?: string;
  telemetry?: boolean;
};

// type WebViewScreenParams = {
//   initialPath: string;
//   gotoPath?: string;
// };

export type WebViewStackParamList = {
  Webview: undefined;
  ExternalWebView: {
    uri: string;
    headers?: Record<string, string | null>;
    injectedJavaScript?: string;
  };
};

export type TabParamList = {
  Groups: NavigatorScreenParams<WebViewStackParamList>;
  Messages: NavigatorScreenParams<WebViewStackParamList>;
  Activity: NavigatorScreenParams<WebViewStackParamList>;
  Profile: NavigatorScreenParams<WebViewStackParamList>;
  Discover: NavigatorScreenParams<WebViewStackParamList>;
};

export type RootStackParamList = {
  TabList: NavigatorScreenParams<TabParamList>;
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
};

declare global {
  // Configures top level navigation typing
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

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
