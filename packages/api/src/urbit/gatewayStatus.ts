export interface GatewayStatusConfigure {
  configure: {
    owner: string;
    'active-window': string;
    'offline-reply-cooldown': string;
  };
}

export interface GatewayStatusStart {
  'gateway-start': {
    'boot-id': string;
    'lease-until': string;
  };
}

export interface GatewayStatusHeartbeat {
  'gateway-heartbeat': {
    'boot-id': string;
    'lease-until': string;
  };
}

export interface GatewayStatusStop {
  'gateway-stop': {
    reason: string;
  };
}

export type GatewayStatusAction =
  | GatewayStatusConfigure
  | GatewayStatusStart
  | GatewayStatusHeartbeat
  | GatewayStatusStop;
