import { Urbit } from '@tloncorp/api';

import {
  type InboundTlonMessage,
  type RoutingPolicy,
  normalizeShip,
} from './messages.js';

export type TlonMessageBusOptions = {
  url: string;
  ship: string;
  code: string;
  routing: RoutingPolicy;
};

export type BusRequest = InboundTlonMessage & { sequence: number };

export class TlonMessageBus {
  private urbit: Urbit | null = null;
  private subscription: number | null = null;
  private handler: ((message: BusRequest) => Promise<void>) | null = null;
  private readonly active = new Set<number>();

  constructor(private readonly options: TlonMessageBusOptions) {}

  async start(handler: (message: BusRequest) => Promise<void>): Promise<void> {
    if (this.urbit) throw new Error('Tlon messenger is already started');
    this.handler = handler;
    const ship = this.options.ship.startsWith('~')
      ? this.options.ship
      : `~${this.options.ship}`;
    this.urbit = await Urbit.authenticate({
      ship,
      url: this.options.url,
      code: this.options.code,
    });
    await this.urbit.poke({
      app: 'acp',
      mark: 'acp-action-1',
      json: {
        configure: {
          owner: withSigil(this.options.routing.ownerShip),
          'allowed-dms': [...(this.options.routing.allowedDmShips ?? [])].map(
            withSigil
          ),
          'allowed-channel-ships': [
            ...(this.options.routing.allowedChannelShips ?? []),
          ].map(withSigil),
          channels: [...(this.options.routing.channels ?? [])],
          'require-channel-mention':
            this.options.routing.requireChannelMention !== false,
          'owner-listen': this.options.routing.ownerListen !== false,
        },
      },
    });
    this.subscription = await this.urbit.subscribe({
      app: 'acp',
      path: '/worker',
      event: (event: unknown) => this.handleUpdate(event),
      err: (error: unknown) => this.report(error),
    });
  }

  async reply(sequence: number, text: string): Promise<void> {
    if (!text.trim()) throw new Error('Agent returned an empty response');
    const urbit = this.requireUrbit();
    await urbit.poke({
      app: 'acp',
      mark: 'acp-action-1',
      json: { reply: { sequence, text } },
    });
  }

  async stop(): Promise<void> {
    const urbit = this.urbit;
    this.urbit = null;
    this.handler = null;
    if (!urbit) return;
    if (this.subscription !== null) {
      await urbit.unsubscribe(this.subscription);
      this.subscription = null;
    }
    await urbit.delete();
  }

  private handleUpdate(value: unknown): void {
    const update = record(value);
    if (Array.isArray(update.requests)) {
      for (const value of update.requests) {
        const request = parseBusRequest(value);
        if (!request || this.active.has(request.sequence)) continue;
        this.active.add(request.sequence);
        void this.handler?.(request).catch((error: unknown) => {
          this.active.delete(request.sequence);
          this.report(error);
        });
      }
      return;
    }
    const completed = record(update.completed);
    if (Number.isSafeInteger(completed.sequence)) {
      this.active.delete(completed.sequence as number);
      return;
    }
    const failed = record(update.failed);
    if (Number.isSafeInteger(failed.sequence)) {
      this.active.delete(failed.sequence as number);
      this.report(
        new Error(
          typeof failed.reason === 'string'
            ? failed.reason
            : 'Messenger rejected reply'
        )
      );
    }
  }

  private report(error: unknown): void {
    console.error(
      `[tlon-acp] Tlon message bus error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  private requireUrbit(): Urbit {
    if (!this.urbit) throw new Error('Tlon messenger is not started');
    return this.urbit;
  }
}

export function parseBusRequest(value: unknown): BusRequest | null {
  const request = record(value);
  if (
    !Number.isSafeInteger(request.sequence) ||
    typeof request.sender !== 'string' ||
    typeof request['message-id'] !== 'string' ||
    typeof request.text !== 'string'
  ) {
    return null;
  }
  const conversation = record(request.conversation);
  const sender = normalizeShip(request.sender);
  if (typeof conversation.dm === 'string') {
    const partner = normalizeShip(conversation.dm);
    return {
      sequence: request.sequence as number,
      key: `dm:${partner}`,
      kind: 'dm',
      target: `~${partner}`,
      sender,
      messageId: request['message-id'],
      text: request.text,
    };
  }
  if (typeof conversation.channel === 'string') {
    return {
      sequence: request.sequence as number,
      key: `channel:${conversation.channel}`,
      kind: 'channel',
      target: conversation.channel,
      sender,
      messageId: request['message-id'],
      text: request.text,
    };
  }
  return null;
}

function withSigil(value: string): string {
  const ship = normalizeShip(value);
  return ship ? `~${ship}` : '';
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
