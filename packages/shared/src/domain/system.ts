export interface NotifPerms {
  initialized: boolean;
  hasPermission: boolean;
  canAskPermission: boolean;
  requestPermissions: () => Promise<void>;
  openSettings: () => void;
}

export interface NagState {
  lastDismissed: number;
  dismissCount: number;
  eliminated: boolean;
  firstEligibleTime: number;
}
