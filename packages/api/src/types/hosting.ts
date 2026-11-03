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

export type TlawnBrowserService = 'steel' | 'kernel';

export interface TlawnBrowserServiceInfo {
  /** The stored selection, applied on the bot's next restart. */
  browserService: TlawnBrowserService;
  /**
   * The route the bot's MCP desk currently points at, read live from the ship.
   * Differs from `browserService` when the last restart fell back; null when
   * the ship could not be read (bot down, sidecar unreachable).
   */
  active: TlawnBrowserService | null;
  supported: boolean;
}

export interface TlawnTokenUsageTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
}

/**
 * The bot's token usage for the current UTC month, as OpenClaw recorded it.
 * It counts every credential the bot ran on, Tlon's and the user's own alike,
 * so it is not usage against a Tlon allowance.
 */
export interface TlawnTokenUsage {
  updatedAt: number;
  /** Inclusive UTC dates, YYYY-MM-DD. */
  startDate: string;
  endDate: string;
  keyAttribution: 'unavailable';
  totals: TlawnTokenUsageTotals;
  byProvider: Array<TlawnTokenUsageTotals & { provider?: string }>;
  /** Anything but `fresh`: some sessions' latest usage is not counted yet. */
  cacheStatus?: { status: 'fresh' | 'partial' | 'stale' | 'refreshing' };
}

export interface TlawnProviderConfigInfo {
  keys: Record<string, string>;
  models: TlawnModelEntry[];
  defaultKeys: Record<string, { key: string; id?: string }>;
  /** The models hosting runs behind Basic. Older hosting omits it. */
  defaultModels?: { primaryModel: string; fallbackModels: string[] };
  browserService?: TlawnBrowserService;
}

export interface TlawnModelEntry {
  provider: string;
  model: string;
  zdr?: boolean;
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
  zdr?: boolean;
  fallbacks?: TlawnModelEntry[];
}

export interface TlawnProviderModel {
  id: string;
  name?: string;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  [key: string]: unknown;
}

export interface TlawnOpenRouterZdrEndpoint {
  modelId: string;
  endpointName?: string;
  providerName: string;
  supportsImplicitCaching?: boolean;
  promptPrice?: string;
  completionPrice?: string;
}

export type TlawnLLMAuthProvider = 'openai' | 'anthropic' | 'xai';

export type TlawnLLMAuthFlowStatus =
  | 'awaiting_browser'
  | 'awaiting_token'
  | 'authenticating'
  | 'complete'
  | 'error';

export interface TlawnLLMAuthFlow {
  id: string;
  provider: TlawnLLMAuthProvider;
  status: TlawnLLMAuthFlowStatus;
  expiresAt: number;
  verificationUrl?: string;
  userCode?: string;
  error?: string;
}

export interface TlawnLLMAuthFlowResponse {
  flow: TlawnLLMAuthFlow;
}

export interface TlawnLLMAuthProviderStatus {
  provider: string;
  displayName?: string;
  status: 'ok' | 'static' | 'expiring' | 'expired' | 'missing' | string;
  reason?: string;
  expiry?: {
    at: number;
    remainingMs: number;
    label: string;
  };
}

export interface TlawnSubscriptionModel {
  id: string;
  name?: string;
}

export interface TlawnLLMAuthStatus {
  ts: number;
  providers: TlawnLLMAuthProviderStatus[];
  subscriptionModels?: Partial<
    Record<TlawnLLMAuthProvider, TlawnSubscriptionModel[]>
  >;
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
  // `allowedShips` is optional: a restricted rule that omits it inherits
  // `defaultAuthorizedShips` on the backend, so the field is absent (not `[]`)
  // when a channel follows the defaults.
  channelRules: Record<string, { mode: string; allowedShips?: string[] }>;
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
  logoUrl?: string;
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
