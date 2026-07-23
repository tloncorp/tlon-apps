export type InboundTlonMessage = {
  key: string;
  kind: 'dm' | 'channel';
  target: string;
  sender: string;
  messageId: string;
  text: string;
};

export type RoutingPolicy = {
  ownerShip: string;
  allowedDmShips?: Iterable<string>;
  allowedChannelShips?: Iterable<string>;
  channels?: Iterable<string>;
  requireChannelMention?: boolean;
  ownerListen?: boolean;
};

export function normalizeShip(value: string): string {
  return value.trim().toLowerCase().replace(/^~/, '');
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
