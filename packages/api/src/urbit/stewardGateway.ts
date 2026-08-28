/**
 * Wire types for the %steward agent's gateway module (harness liveness +
 * offline auto-reply). See desk/sur/steward/gateway.hoon and docs/steward.md.
 */

/**
 * The core %steward-action-1 configure: sets the shared owner ship used by
 * every module. The gateway module's own %configure carries only timing.
 */
export interface StewardConfigure {
  configure: {
    owner: string;
  };
}

export interface StewardGatewayConfigure {
  configure: {
    'active-window': string;
    'offline-reply-cooldown': string;
  };
}

export interface StewardGatewayStart {
  'gateway-start': {
    'boot-id': string;
    'lease-until': string;
  };
}

export interface StewardGatewayHeartbeat {
  'gateway-heartbeat': {
    'boot-id': string;
    'lease-until': string;
  };
}

export interface StewardGatewayStop {
  'gateway-stop': {
    'boot-id': string;
    reason: string;
  };
}

export type StewardGatewayAction =
  | StewardGatewayConfigure
  | StewardGatewayStart
  | StewardGatewayHeartbeat
  | StewardGatewayStop;
