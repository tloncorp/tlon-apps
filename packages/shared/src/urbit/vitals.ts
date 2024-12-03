export interface Connected {
  complete: 'yes';
}

export interface YetToCheck {
  complete: 'no-data';
}

export interface NoDNS {
  complete: 'no-dns';
}

export interface Crash {
  complete: 'crash';
  crash: string[][];
}

export interface NoOurPlanet {
  complete: 'no-our-planet';
  'last-contact': number;
}

export interface NoOurGalaxy {
  complete: 'no-our-galaxy';
  'last-contact': number;
}

export interface NoSponsorHit {
  complete: 'no-sponsor-hit';
  ship: string;
}

export interface NoSponsorMiss {
  complete: 'no-sponsor-miss';
  ship: string;
}

export interface NoTheirGalaxy {
  complete: 'no-their-galaxy';
  'last-contact': number;
}

export type ConnectionCompleteStatusKey =
  | 'yes'
  | 'crash'
  | 'no-data'
  | 'no-dns'
  | 'no-our-planet'
  | 'no-our-galaxy'
  | 'no-sponsor-hit'
  | 'no-sponsor-miss'
  | 'no-their-galaxy';

export interface CompleteStatus {
  complete: ConnectionCompleteStatusKey;
}

export type ConnectionCompleteStatus =
  | Connected
  | YetToCheck
  | Crash
  | NoDNS
  | NoOurPlanet
  | NoOurGalaxy
  | NoSponsorHit
  | NoSponsorMiss
  | NoTheirGalaxy;

export type ConnectionPendingStatusKey =
  | 'setting-up'
  | 'trying-dns'
  | 'trying-local'
  | 'trying-target'
  | 'trying-sponsor';

export type ConnectionPendingStatus =
  | {
      pending: Exclude<ConnectionPendingStatusKey, 'trying-sponsor'>;
    }
  | {
      pending: 'trying-sponsor';
      ship: string;
    };

export type ConnectionStatus =
  | ConnectionCompleteStatus
  | ConnectionPendingStatus;

export interface ConnectionUpdate {
  status: ConnectionStatus;
  timestamp: number;
}

export interface ConnectivityCheckOptions {
  useStale?: boolean;
  enabled?: boolean;
  staleTime?: number;
  waitToDisplay?: number;
}
