export type ChannelStatus =
  | 'initial'
  | 'opening'
  | 'active'
  | 'reconnecting'
  | 'reconnected'
  | 'errored';

export interface StatusUpdateEvent {
  status: ChannelStatus;
  context?: {
    message?: string;
    requestStatus?: string;
  };
}

export interface FactEvent {
  id: number;
  time: number;
  data: any;
}

export interface SubscriptionEvent {
  id: number;
  app?: string;
  path?: string;
  status: 'open' | 'close';
}

export interface ErrorEvent {
  time: number;
  msg: string;
  error: any;
}

export type IdUpdateEvent = Partial<{
  current: number;
  lastHeard: number;
  lastAcknowledged: number;
}>;

export interface ResetEvent {
  uid: string;
}

export interface InitEvent extends ResetEvent {
  subscriptions: Omit<SubscriptionEvent, 'status'>[];
}

export interface ChannelReapedEvent {
  time: number;
}

export type UrbitHttpApiEvent = {
  subscription: SubscriptionEvent;
  'status-update': StatusUpdateEvent;
  'id-update': IdUpdateEvent;
  fact: FactEvent;
  error: ErrorEvent;
  reset: ResetEvent;
  'seamless-reset': ResetEvent;
  'channel-reaped': ChannelReapedEvent;
  init: InitEvent;
};

/**
 * The listener each event expects. Callers that forward `on` behind their own
 * generic need this rather than `UrbitHttpApiEvent`: an unresolved
 * `(data: UrbitHttpApiEvent[T]) => void` does not match the emitter's map.
 */
export type UrbitHttpApiEventMap = {
  [E in keyof UrbitHttpApiEvent]: (event: UrbitHttpApiEvent[E]) => void;
};

export type UrbitHttpApiEventType =
  | 'subscription'
  | 'status-update'
  | 'id-update'
  | 'fact'
  | 'error'
  | 'reset'
  | 'seamless-reset'
  | 'channel-reaped'
  | 'init';
