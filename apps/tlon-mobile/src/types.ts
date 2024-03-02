export type SignUpExtras = {
  nickname?: string;
  notificationToken?: string;
  telemetry?: boolean;
};

type WebViewScreenParams = {
  initialPath: string;
  gotoPath?: string;
};

export type WebViewStackParamList = {
  Webview: WebViewScreenParams;
  ExternalWebView: {
    uri: string;
    headers?: Record<string, string | null>;
    injectedJavaScript?: string;
  };
};

export type TabParamList = {
  Groups: undefined;
  Messages: WebViewScreenParams;
  Activity: WebViewScreenParams;
  Profile: WebViewScreenParams;
  Discover: WebViewScreenParams;
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
