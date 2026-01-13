export type User = {
  id: string;
  email: string;
  phoneNumber?: string;
  admin: boolean;
  ships: string[];
  requirePhoneNumberVerification: boolean;
  phoneNumberVerifiedAt?: string;
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

export type AssignmentResponse = {
  ship: {
    ship: ReservedShip;
    status: HostedShipStatus;
  };
  code?: string;
  personalLureToken?: string;
};

export type BootPhase =
  | 'Pending'
  | 'Ready'
  | 'Suspended'
  | 'UnderMaintenance'
  | 'Halting'
  | 'ExportRunning'
  | 'Unknown';

export type HostedShipInfo = {
  booting: boolean;
  manualUpdateNeeded?: boolean;
  showWayfinding?: boolean;
  id: string;
};

export type HostedShipStatus = {
  phase: BootPhase;
};

export type HostedShipResponse = {
  ship: HostedShipInfo;
  status?: HostedShipStatus;
};

export enum HostedNodeStatus {
  Running = 'Running',
  Paused = 'Paused',
  Suspended = 'Suspended',
  UnderMaintenance = 'UnderMaintenance',
  Unknown = 'Unknown',
}

export function nodeUrlIsHosted(url: string) {
  return url.endsWith('tlon.network') || url.endsWith('.test.tlon.systems');
}
