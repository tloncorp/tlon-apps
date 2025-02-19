export interface NotifPerms {
  initialized: boolean;
  hasPermission: boolean;
  canAskPermission: boolean;
  requestPermissions: () => Promise<void>;
  openSettings: () => void;
}
