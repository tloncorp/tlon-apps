export type User = {
  id: string;
  email: string;
  phoneNumber?: string;
  admin: boolean;
  ships: string[];
  requirePhoneNumberVerification: boolean;
  phoneNumberVerifiedAt?: string;
  verified: boolean;
  botEnabled?: boolean;
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
  homeGroupLureToken?: string;
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
  personalLureToken?: string;
  homeGroupLureToken?: string;
  botReady?: boolean;
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

export type HostingHeartBeatCode = 'expired' | 'ok' | 'unknown';

export interface TlawnProviderConfigInfo {
  keys: Record<string, string>;
  models: TlawnModelEntry[];
  defaultKeys: Record<string, { key: string; id?: string }>;
}

export interface TlawnModelEntry {
  provider: string;
  model: string;
  primary?: boolean;
  channels?: string[];
}

export interface TlawnChannelModelOverride {
  provider: string;
  model: string;
  channels: string[];
}

export interface TlawnChannelModelsUpdate {
  models: TlawnChannelModelOverride[];
}

export interface TlawnPrimaryModelUpdate {
  provider: string;
  model: string;
  fallbacks?: TlawnModelEntry[];
}

export interface TlawnProviderModel {
  id: string;
  [key: string]: unknown;
}

export interface TlawnBotInfo {
  enabled: boolean;
  provider?: string;
  model?: string;
  moon?: string;
}

export interface TlawnConfig {
  dmAllowlist: string[];
  defaultAuthorizedShips: string[];
  channelRules: Record<string, { mode: string; allowedShips: string[] }>;
  groupChannels: string[];
  groupInviteAllowlist: string[];
  autoAcceptDmInvites: boolean;
  autoDiscoverChannels: boolean;
}

export interface TlawnChatConfigUpdate {
  config: Partial<TlawnConfig>;
  channelModels?: TlawnChannelModelsUpdate;
}

export interface TlawnChatConfigInfo {
  config: TlawnConfig;
  providerConfig: TlawnProviderConfigInfo;
}

export interface TlawnChannelGroupEntry {
  title?: string;
  channels: Record<string, string>;
}

/** host ship -> group name -> group entry */
export type TlawnChannelGroups = Record<
  string,
  Record<string, TlawnChannelGroupEntry>
>;

export interface TlawnOAuthGrant {
  connected: boolean;
  expired: boolean;
  expiresAt: string | null;
  hasRefreshToken: boolean;
  provider: string;
  scopes: string;
  tokenType: string;
}

export interface TlawnOAuthStatus {
  available: boolean;
  grants: TlawnOAuthGrant[];
}

export type TlawnOAuthProviderKind = 'standard' | 'mcp_remote';

export type TlawnOAuthUpstream =
  | {
      mode: 'proxy';
      name: string;
      url: string;
    }
  | {
      mode: 'openapi';
      name: string;
      schemaUrl: string;
    };

export interface TlawnOAuthProvider {
  authUrl?: string;
  displayName: string;
  id: string;
  kind: TlawnOAuthProviderKind;
  revokeUrl?: string;
  scopes: string;
  suggestedUpstream: TlawnOAuthUpstream;
  template: string;
  tokenUrl?: string;
}

export interface TlawnOAuthStartRequest {
  providerId: string;
  finalRedirectUrl: string;
}

export interface TlawnOAuthStartResponse {
  authUrl: string;
}

export function nodeUrlIsHosted(url: string) {
  return url.endsWith('tlon.network') || url.endsWith('.test.tlon.systems');
}
