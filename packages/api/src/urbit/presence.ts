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
  symbol: string | null;
  text: string | null;
  blob: string | null;
}

export interface PresenceEntry {
  timing: PresenceTiming;
  display: PresenceDisplay;
}

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

export type PresenceAction =
  | { set: PresenceActionSet }
  | { clear: PresenceKey }
  | { nuke: string };

export type PresenceResponse =
  | { init: PresencePlaces }
  | { here: PresenceUpdateSet }
  | { gone: PresenceKey };
