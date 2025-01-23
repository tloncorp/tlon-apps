export enum AnalyticsEvent {
  InviteShared = 'Invite Link Shared',
  OnboardingSessionRevived = 'Onboarding Session Revived',
  AppInstalled = 'App Installed',
  AppUpdated = 'App Updated',
  AppActive = 'App Active',
  LoggedInBeforeSignup = 'Logged In Without Signing Up',
  FailedSignupOTP = 'Failed to send Signup OTP',
  FailedLoginOTP = 'Failed to send Login OTP',
  ContactAdded = 'Contact Added',
  ContactEdited = 'Contact Edited',
  InvitedUserFailedInventoryCheck = 'Invited User Failed Inventory Check',
  PersonalInvitePressed = 'Personal Invite Shown',
  ChannelTemplateSetup = 'Channel Created from Template',
  ChannelLoadComplete = 'Channel Load Complete',
  SessionInitialized = 'Session Initialized',
  NodeNotRunning = 'Node Not Running',
  NodeUnderMaintenance = 'Node Under Maintenance',
  LoginDebug = 'Login Debug',
  LoginAnomaly = 'Login Anomaly',
  ExpectedHostingError = 'Expected Hosting API Error',
  UnexpectedHostingError = 'Unexpected Hosting API Response',
  NodeWaitReport = 'Node Wait Report',
  InviteError = 'Invite Error',
  InviteDebug = 'Invite Debug',
  InviteButtonShown = 'Invite Button Shown',
  InitializedNewInvite = 'Initialized New Invite',
  DebugLogs = 'Debug Logs',
  AppError = 'App Error',
  AuthFailedToGetCode = 'Failed to get access code',
  AuthForcedLogout = 'Auth Forced Logout',
}
