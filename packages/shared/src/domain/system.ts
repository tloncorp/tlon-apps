export interface NotifPerms {
  hasPermission: boolean;
  canAskPermission: boolean;
  requestPermissions: () => Promise<void>;
  openSettings: () => void;
}
