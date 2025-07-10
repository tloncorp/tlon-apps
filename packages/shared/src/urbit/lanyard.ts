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

export interface QueryResponseEvent {
  query: { result: { valid: boolean; live: boolean } };
}

export interface WhoseBulkResponseEvent {
  query: {
    nonce: string;
    result:
      | {
          'next-salt': string;
          results: Record<string, string | null>;
        }
      | 'rate limited';
  };
}

export interface RecordId {
  provider: string;
  type: 'urbit' | 'phone' | 'twitter' | 'dummy';
  value: string;
}

export const CONTACT_TWITTER_ATTEST_KEY: string = 'lanyard-twitter-0-sign';
export const CONTACT_PHONE_ATTEST_KEY: string = 'lanyard-phone-0-sign';
