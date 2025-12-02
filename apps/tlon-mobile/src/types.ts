export type OnboardingStackParamList = {
  InitialStateCheck: undefined;
  Welcome: undefined;
  InventoryCheck: undefined;
  PasteInviteLink: undefined;
  Signup: undefined;
  CheckOTP: {
    otpMethod: 'email' | 'phone';
    mode: 'signup' | 'login';
    email?: string;
    phoneNumber?: string;
  };
  EULA: undefined;
  JoinWaitList: { email?: string };
  UnderMaintenance: undefined;
  RequestPhoneVerify: { mode: 'signup' | 'login' };
  CheckVerify: { phoneNumber: string; mode: 'signup' | 'login' };
  ReserveShip: undefined;
  SetNickname: undefined;
  SetNotifications: undefined;
  AllowNotifications: undefined;
  SetTelemetry: undefined;
  TlonLogin: { initialLoginMethod?: 'email' | 'phone' } | undefined;
  TlonLoginLegacy: undefined;
  ShipLogin: undefined;
  ResetPassword: { email?: string };
  GettingNodeReadyScreen: {
    waitType?: 'Paused' | 'Suspended' | 'Unknown';
    wasLoggedIn?: boolean;
  };
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

export type HostingUser = User;

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
