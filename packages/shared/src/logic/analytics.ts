export enum AnalyticsEvent {
  InviteShared = 'Invite Link Shared',
  OnboardingSessionRevived = 'Onboarding Session Revived',
  AppInstalled = 'App Installed',
  AppUpdated = 'App Updated',
  AppActive = 'App Active',
  LoggedInBeforeSignup = 'Logged In Without Signing Up',
  FailedSignupOTP = 'Failed to send Signup OTP',
  FailedLoginOTP = 'Failed to send Login OTP',
  InvitedUserFailedInventoryCheck = 'Invited User Failed Inventory Check',
}
