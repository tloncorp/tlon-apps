// negotation status in human terms:
// match: both parties on the same version
// clash: mismatched versions
// await: awaiting response from other party
// unmet: have not yet attempted to negotiate

export type NegotiationStatus = 'match' | 'clash' | 'await' | 'unmet';

// should be ship/agent
export type MatchingKey = string;

export type MatchingResponse = Record<MatchingKey, NegotiationStatus>;

export interface MatchingEvent {
  gill: MatchingKey;
  match: boolean;
}
