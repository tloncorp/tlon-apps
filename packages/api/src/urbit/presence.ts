// These types model the raw shapes used by the Urbit presence app. The client
// layer normalizes them into app-specific ids, but this module stays close to
// the wire protocol so pokes/scries/subscriptions can be typed directly.
export type PresenceTopic = 'typing' | 'computing' | 'other';

export interface PresenceKey {
  context: string;
  ship: string;
  topic: PresenceTopic;
}

export interface PresenceTiming {
  since: string;
  timeout: string | null;
}

export interface PresenceDisplay {
  icon: string | null;
  text: string | null;
  blob: string | null;
}

export interface PresenceActionDisplay {
  icon: string | null;
  text: string | null;
  blob: string | null;
}

export interface PresenceEntry {
  timing: PresenceTiming;
  display: PresenceDisplay;
}

// `/v1/init` returns presence as a nested tree keyed by context, then topic,
// then ship. The client flattens this into individual statuses.
export type PresencePeople = Record<string, PresenceEntry>;
export type PresenceTopics = Partial<Record<PresenceTopic, PresencePeople>>;
export type PresencePlaces = Record<string, PresenceTopics>;

export interface PresenceActionSet {
  disclose: string[];
  key: PresenceKey;
  timeout: string | null;
  display: PresenceActionDisplay;
}

export interface PresenceUpdateSet {
  key: PresenceKey;
  timing: PresenceTiming;
  display: PresenceDisplay;
}

// The presence app supports three mutations: set/update one status, clear one
// status, or nuke an entire context.
export type PresenceAction =
  | { set: PresenceActionSet }
  | { clear: PresenceKey }
  | { nuke: string };

// Subscription events mirror the same three cases: a full init snapshot, one
// status appearing/updating, or one status disappearing.
export type PresenceResponse =
  | { init: PresencePlaces }
  | { here: PresenceUpdateSet }
  | { gone: PresenceKey };
