import { type Interface, createInterface } from 'node:readline';

import type { AcpAdapter } from './adapter.js';
import type { AcpMessage, AcpTransport, AcpUpdateHandler } from './types.js';

/**
 * Runs the ACP client and adapter in the same process. The ship does not need
 * to relay JSON-RPC frames; only product-level messages cross the network.
 */
export class StdioAcpTransport implements AcpTransport {
  private readonly queued = new Map<number, AcpMessage>();
  private handler: AcpUpdateHandler | null = null;
  private onError: ((error: unknown) => void) | null = null;
  private lines: Interface | null = null;
  private nextSequence = 1;
  private opened = false;
  private disconnected = false;
  private terminalError: Error | null = null;

  constructor(private readonly adapter: AcpAdapter) {}

  async open(): Promise<void> {
    if (this.opened) return;
    if (this.disconnected) throw new Error('ACP stdio transport is closed');
    this.opened = true;
    this.lines = createInterface({
      input: this.adapter.stdout,
      crlfDelay: Infinity,
    });
    this.lines.on('line', this.handleLine);
    void this.adapter.exited
      .then((exit) => {
        if (!this.disconnected) {
          this.fail(
            new Error(
              `ACP adapter exited${
                exit.code === null ? '' : ` with code ${exit.code}`
              }${exit.signal ? ` (${exit.signal})` : ''}`
            )
          );
        }
      })
      .catch(this.fail);
  }

  async send(payload: string): Promise<void> {
    if (!this.opened || this.disconnected) {
      throw new Error('ACP stdio transport is not open');
    }
    validateFrame(payload);
    await writeLine(this.adapter.stdin, payload);
  }

  async ack(through: number): Promise<void> {
    for (const sequence of this.queued.keys()) {
      if (sequence <= through) this.queued.delete(sequence);
    }
  }

  async subscribe(
    handler: AcpUpdateHandler,
    onError?: (error: unknown) => void
  ): Promise<() => void> {
    if (this.handler) throw new Error('ACP stdio output is already subscribed');
    this.handler = handler;
    this.onError = onError ?? null;
    if (this.terminalError) {
      queueMicrotask(() => this.onError?.(this.terminalError));
    }
    this.flush();
    return () => {
      this.handler = null;
      this.onError = null;
    };
  }

  async disconnect(): Promise<void> {
    if (this.disconnected) return;
    this.disconnected = true;
    this.lines?.off('line', this.handleLine);
    this.lines?.close();
    this.lines = null;
    this.handler = null;
    this.adapter.stdin.end();
  }

  private readonly handleLine = (payload: string): void => {
    try {
      validateFrame(payload);
      const sequence = this.nextSequence++;
      this.queued.set(sequence, {
        sequence,
        sent: new Date().toISOString(),
        payload,
      });
      this.flush();
    } catch (error) {
      this.onError?.(error);
    }
  };

  private readonly fail = (error: unknown): void => {
    this.terminalError =
      error instanceof Error ? error : new Error(String(error));
    this.onError?.(this.terminalError);
  };

  private flush(): void {
    if (!this.handler || this.queued.size === 0) return;
    this.handler({
      messages: [...this.queued.values()].sort(
        (left, right) => left.sequence - right.sequence
      ),
    });
  }
}

async function writeLine(
  stream: NodeJS.WritableStream,
  line: string
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    stream.write(`${line}\n`, (error?: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export function validateFrame(frame: string): void {
  if (Buffer.byteLength(frame, 'utf8') > 1024 * 1024) {
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
