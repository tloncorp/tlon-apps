import { EventEmitter } from 'node:events';
import { createInterface } from 'node:readline';

import type { AcpAdapter, AdapterExit } from './adapter.js';
import type {
  AcpMessage,
  AcpTransport,
  AcpUpdate,
  AcpUpdateHandler,
} from './types.js';

const MAX_FRAME_BYTES = 1024 * 1024;

export type AcpPumpEvents = {
  error: [error: Error];
  frameToAgent: [sequence: number];
  frameToClient: [];
};

export class AcpPump extends EventEmitter<AcpPumpEvents> {
  private readonly pending = new Map<number, AcpMessage>();
  private drainPromise: Promise<void> | null = null;
  private outputPromise: Promise<void> = Promise.resolve();
  private unsubscribe: (() => void | Promise<void>) | null = null;
  private stopPromise: Promise<void> | null = null;
  private stopped = false;
  private lastAcked = 0;

  constructor(
    private readonly transport: AcpTransport,
    private readonly adapter: AcpAdapter
  ) {
    super();
  }

  async run(): Promise<AdapterExit> {
    try {
      await this.transport.open();
      this.readAdapterOutput();
      this.unsubscribe = await this.transport.subscribe(
        'agent',
        this.handleUpdate,
        this.fail
      );
      const exit = await this.adapter.exited;
      await this.outputPromise;
      return exit;
    } finally {
      await this.stop(false);
    }
  }

  stop(stopAdapter = true): Promise<void> {
    if (!this.stopPromise) {
      this.stopPromise = this.performStop(stopAdapter);
    }
    return this.stopPromise;
  }

  private async performStop(stopAdapter: boolean): Promise<void> {
    this.stopped = true;
    await this.unsubscribe?.();
    this.unsubscribe = null;
    if (stopAdapter) {
      this.adapter.stop();
    }
    this.adapter.stdin.end();
    await this.transport.disconnect();
  }

  private readonly handleUpdate: AcpUpdateHandler = (update) => {
    try {
      this.acceptUpdate(update);
    } catch (error) {
      this.fail(error);
    }
  };

  private acceptUpdate(update: AcpUpdate): void {
    if ('connection' in update) {
      if (!update.open) {
        throw new Error(
          `ACP connection ${update.connection} closed: ${update.reason ?? 'no reason'}`
        );
      }
      return;
    }

    for (const message of update.messages) {
      if (message.sequence > this.lastAcked) {
        this.pending.set(message.sequence, message);
      }
    }
    if (!this.drainPromise) {
      this.drainPromise = this.drainInbound()
        .catch(this.fail)
        .finally(() => {
          this.drainPromise = null;
          if (this.pending.size > 0 && !this.stopped) {
            this.handleUpdate({ messages: [] });
          }
        });
    }
  }

  private async drainInbound(): Promise<void> {
    while (this.pending.size > 0 && !this.stopped) {
      const next = [...this.pending.values()].sort(
        (a, b) => a.sequence - b.sequence
      )[0];
      this.pending.delete(next.sequence);
      if (next.sequence <= this.lastAcked) {
        continue;
      }
      validateFrame(next.payload);
      await writeLine(this.adapter.stdin, next.payload);
      await this.transport.ack('agent', next.sequence);
      this.lastAcked = Math.max(this.lastAcked, next.sequence);
      this.emit('frameToAgent', next.sequence);
    }
  }

  private readAdapterOutput(): void {
    const lines = createInterface({
      input: this.adapter.stdout,
      crlfDelay: Infinity,
    });
    lines.on('line', (line) => {
      this.outputPromise = this.outputPromise
        .then(async () => {
          validateFrame(line);
          await this.transport.send('client', line);
          this.emit('frameToClient');
        })
        .catch((error: unknown) => {
          this.fail(error);
        });
    });
  }

  private readonly fail = (error: unknown): void => {
    const normalized =
      error instanceof Error ? error : new Error(String(error));
    this.pending.clear();
    this.emit('error', normalized);
    this.adapter.stop();
  };
}

export function validateFrame(frame: string): void {
  if (Buffer.byteLength(frame, 'utf8') > MAX_FRAME_BYTES) {
    throw new Error('ACP frame exceeds the 1 MiB transport limit');
  }
  let value: unknown;
  try {
    value = JSON.parse(frame);
  } catch (error) {
    throw new Error(`ACP frame is not valid JSON: ${String(error)}`);
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('ACP frame must be a JSON-RPC object');
  }
}

async function writeLine(stream: NodeJS.WritableStream, line: string) {
  await new Promise<void>((resolve, reject) => {
    stream.write(`${line}\n`, (error?: Error | null) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
