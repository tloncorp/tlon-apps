import { type Story, Urbit, configureClient, sendPost } from '@tloncorp/api';

import type { InboundTlonMessage } from './routing.js';
import { TlonRouter } from './routing.js';
import { plainStory } from './story.js';

export type TlonMessengerOptions = {
  url: string;
  ship: string;
  code: string;
  router: TlonRouter;
};

export class TlonMessenger {
  private urbit: Urbit | null = null;
  private readonly subscriptions: number[] = [];
  private handler: ((message: InboundTlonMessage) => Promise<void>) | null =
    null;

  constructor(private readonly options: TlonMessengerOptions) {}

  async start(
    handler: (message: InboundTlonMessage) => Promise<void>
  ): Promise<void> {
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
    await configureClient({
      shipName: ship,
      shipUrl: this.options.url,
      client: this.urbit,
    });
    this.subscriptions.push(
      await this.urbit.subscribe({
        app: 'channels',
        path: '/v4',
        event: (event: unknown) =>
          this.dispatch(this.options.router.parseChannel(event)),
        err: (error: unknown) => this.report(error),
      }),
      await this.urbit.subscribe({
        app: 'chat',
        path: '/v4',
        event: (event: unknown) =>
          this.dispatch(this.options.router.parseChat(event)),
        err: (error: unknown) => this.report(error),
      })
    );
  }

  async send(message: InboundTlonMessage, text: string): Promise<void> {
    if (!text.trim()) return;
    await sendPost({
      channelId: message.target,
      authorId: this.options.ship,
      sentAt: Date.now(),
      content: plainStory(text) as unknown as Story,
    });
  }

  async stop(): Promise<void> {
    const urbit = this.urbit;
    this.urbit = null;
    this.handler = null;
    if (!urbit) return;
    await Promise.allSettled(
      this.subscriptions.splice(0).map((id) => urbit.unsubscribe(id))
    );
    await urbit.delete();
  }

  private dispatch(message: InboundTlonMessage | null): void {
    if (!message || !this.handler) return;
    void this.handler(message).catch((error: unknown) => this.report(error));
  }

  private report(error: unknown): void {
    console.error(
      `[tlon-acp] Tlon messaging error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
