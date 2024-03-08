export type ChannelStatus =
  | 'initial'
  | 'opening'
  | 'active'
  | 'reconnecting'
  | 'reconnected'
  | 'errored';

export interface StatusUpdateEvent {
  status: ChannelStatus;
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

export type UrbitHttpApiEvent = {
  subscription: SubscriptionEvent;
  'status-update': StatusUpdateEvent;
  'id-update': IdUpdateEvent;
  fact: FactEvent;
  error: ErrorEvent;
  reset: ResetEvent;
  'seamless-reset': ResetEvent;
  init: InitEvent;
};

export type UrbitHttpApiEventType =
  | 'subscription'
  | 'status-update'
  | 'id-update'
  | 'fact'
  | 'error'
  | 'reset'
  | 'seamless-reset'
  | 'init';
