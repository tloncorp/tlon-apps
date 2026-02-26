// Core client + session state
export * from './urbit';
export * from './hostingAuthState';

// Feature APIs
export * from './initApi';
export * from './groupsApi';
export * from './channelsApi';
export * from './postsApi';
export * from './chatApi';
export * from './contactsApi';
export * from './activityApi';
export * from './settingsApi';
export * from './storageApi';
export * from './vitalsApi';
export * from './inviteApi';
export * from './lanyardApi';
export * from './metagrabApi';
export * from './changesApi';
export * from './landscapeApi';

// Temporary: keep these as explicit re-exports to reduce cycle-related
// initialization issues. Revert to barrel-style export after API/storage
// boundaries are further decoupled.
export {
  HostingError,
  addUserToWaitlist,
  allocateReservedShip,
  assignShipToUser,
  bootShip,
  checkIfAccountDeleted,
  checkPhoneVerify,
  clearShipRevivalStatus,
  getHostingAvailability,
  getHostingHeartBeat,
  getHostingUser,
  getNodeStatus,
  getReservableShips,
  getShip,
  getShipAccessCode,
  inviteShipWithLure,
  logInHostingUser,
  requestLoginOtp,
  requestPasswordReset,
  requestPhoneVerify,
  requestSignupOtp,
  reserveShip,
  resendEmailVerification,
  resumeShip,
  signUpHostingUser,
  verifyEmailDigits,
} from './hostingApi';
export type { HostingHeartBeatCode } from './hostingApi';

// Supporting types + utilities
export * from './upload';
export * from './apiUtils';
export * from './systemContactsApi';
