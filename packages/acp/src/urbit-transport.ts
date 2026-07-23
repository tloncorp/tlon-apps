import { Urbit } from '@tloncorp/api';

import {
  type AcpPeer,
  type AcpTransport,
  type AcpUpdateHandler,
  parseAcpUpdate,
} from './types.js';

export type UrbitAcpTransportOptions = {
  url: string;
  ship: string;
  code: string;
  connection: string;
};

export class UrbitAcpTransport implements AcpTransport {
  private urbit: Urbit | null = null;

  constructor(private readonly options: UrbitAcpTransportOptions) {
    if (!/^[a-z0-9][a-z0-9-]{0,127}$/.test(options.connection)) {
      throw new Error(
        'ACP connection must be 1-128 lowercase letters, digits, or hyphens'
      );
    }
  }

  async connect(): Promise<void> {
    if (this.urbit) {
      return;
    }
    this.urbit = await Urbit.authenticate({
      ship: this.options.ship.startsWith('~')
        ? this.options.ship
        : `~${this.options.ship}`,
      url: this.options.url,
      code: this.options.code,
    });
  }

  async open(): Promise<void> {
    const urbit = this.requireUrbit();
    await urbit.poke({
      app: 'acp',
      mark: 'acp-action-1',
      json: { open: { connection: this.options.connection } },
    });
  }

  async send(target: AcpPeer, payload: string): Promise<void> {
    const urbit = this.requireUrbit();
    await urbit.poke({
      app: 'acp',
      mark: 'acp-action-1',
      json: {
        send: {
          connection: this.options.connection,
          target,
          payload,
        },
      },
    });
  }

  async ack(target: AcpPeer, through: number): Promise<void> {
    const urbit = this.requireUrbit();
    await urbit.poke({
      app: 'acp',
      mark: 'acp-action-1',
      json: {
        ack: {
          connection: this.options.connection,
          target,
          through,
        },
      },
    });
  }

  async subscribe(
    target: AcpPeer,
    handler: AcpUpdateHandler,
    onError?: (error: unknown) => void
  ): Promise<() => Promise<void>> {
    const urbit = this.requireUrbit();
    const subscription = await urbit.subscribe({
      app: 'acp',
      path: `/v1/${this.options.connection}/${target}`,
      event: (value: unknown) => {
        try {
          handler(parseAcpUpdate(value));
        } catch (error) {
          onError?.(error);
        }
      },
      err: onError,
    });
    return async () => await urbit.unsubscribe(subscription);
  }

  async disconnect(): Promise<void> {
    const urbit = this.urbit;
    this.urbit = null;
    if (urbit) {
      await urbit.delete();
    }
  }

  private requireUrbit(): Urbit {
    if (!this.urbit) {
      throw new Error('Urbit ACP transport is not connected');
    }
    return this.urbit;
  }
}
