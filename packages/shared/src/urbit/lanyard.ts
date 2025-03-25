export interface RecordStatusEvent {
  status?: {
    type: 'twitter' | 'phone';
    value: string;

    status: 'pending' | 'waiting' | 'verified' | 'gone';
    why: string;
  };
}

export interface RecordConfigEvent {
  config?: {
    config: {
      discoverable: 'hidden' | 'public' | 'verified';
    };
    provider: string;
    type: string;
    value: string;
  };
}

export interface RecordId {
  provider: string;
  type: 'urbit' | 'phone' | 'twitter' | 'dummy';
  value: string;
}
