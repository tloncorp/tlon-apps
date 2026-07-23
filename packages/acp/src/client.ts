import { EventEmitter } from 'node:events';

import type { AcpMessage, AcpTransport, AcpUpdate } from './types.js';

export type JsonRpcId = number | string;

export type JsonRpcObject = Record<string, unknown> & {
  jsonrpc: '2.0';
};

export type AcpClientEvents = {
  notification: [frame: JsonRpcObject];
  error: [error: Error];
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

export type AcpClientOptions = {
  name?: string;
  title?: string;
  version?: string;
  requestTimeoutMs?: number;
  permissionPolicy?: 'deny' | 'allow-once';
};

export class AcpClient extends EventEmitter<AcpClientEvents> {
  private readonly pendingRequests = new Map<JsonRpcId, PendingRequest>();
  private readonly queued = new Map<number, AcpMessage>();
  private nextRequestId = Date.now();
  private lastAcked = 0;
  private drainPromise: Promise<void> | null = null;
  private unsubscribe: (() => void | Promise<void>) | null = null;
  private started = false;
  private stopped = false;

  constructor(
    private readonly transport: AcpTransport,
    private readonly options: AcpClientOptions = {}
  ) {
    super();
  }

  async start(): Promise<Record<string, unknown>> {
    if (this.started) {
      throw new Error('ACP client has already started');
    }
    this.started = true;
    try {
      await this.transport.open();
      this.unsubscribe = await this.transport.subscribe(
        'client',
        this.handleUpdate,
        this.fail
      );
      return asRecord(
        await this.request('initialize', {
          protocolVersion: 1,
          clientCapabilities: {},
          clientInfo: {
            name: this.options.name ?? 'tlon-acp',
            title: this.options.title ?? 'Tlon ACP',
            version: this.options.version ?? '0.0.1',
          },
        })
      );
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async request(method: string, params: unknown): Promise<unknown> {
    this.requireRunning();
    const id = this.nextRequestId++;
    const response = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`ACP request timed out: ${method}`));
      }, this.options.requestTimeoutMs ?? 120_000);
      this.pendingRequests.set(id, { resolve, reject, timeout });
    });

    try {
      await this.send({ jsonrpc: '2.0', id, method, params });
    } catch (error) {
      const pending = this.pendingRequests.get(id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(id);
      }
      throw error;
    }
    return await response;
  }

  async notify(method: string, params: unknown): Promise<void> {
    this.requireRunning();
    await this.send({ jsonrpc: '2.0', method, params });
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    await this.unsubscribe?.();
    this.unsubscribe = null;
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('ACP client stopped'));
    }
    this.pendingRequests.clear();
    await this.transport.disconnect();
  }

  private readonly handleUpdate = (update: AcpUpdate): void => {
    if ('connection' in update) {
      if (!update.open) {
        this.fail(
          new Error(
            `ACP connection ${update.connection} closed: ${
              update.reason ?? 'no reason'
            }`
          )
        );
      }
      return;
    }
    for (const message of update.messages) {
      if (message.sequence > this.lastAcked) {
        this.queued.set(message.sequence, message);
      }
    }
    if (!this.drainPromise) {
      this.drainPromise = this.drain()
        .catch(this.fail)
        .finally(() => {
          this.drainPromise = null;
          if (this.queued.size > 0 && !this.stopped) {
            this.handleUpdate({ messages: [] });
          }
        });
    }
  };

  private async drain(): Promise<void> {
    while (this.queued.size > 0 && !this.stopped) {
      const message = [...this.queued.values()].sort(
        (a, b) => a.sequence - b.sequence
      )[0];
      this.queued.delete(message.sequence);
      if (message.sequence <= this.lastAcked) continue;
      await this.handleFrame(parseFrame(message.payload));
      await this.transport.ack('client', message.sequence);
      this.lastAcked = message.sequence;
    }
  }

  private async handleFrame(frame: JsonRpcObject): Promise<void> {
    if ('id' in frame && ('result' in frame || 'error' in frame)) {
      const id = frame.id;
      if (typeof id !== 'number' && typeof id !== 'string') return;
      const pending = this.pendingRequests.get(id);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(id);
      if ('error' in frame) {
        pending.reject(new Error(`ACP error: ${JSON.stringify(frame.error)}`));
      } else {
        pending.resolve(frame.result);
      }
      return;
    }

    if ('method' in frame && typeof frame.method === 'string') {
      if ('id' in frame) {
        await this.handleAgentRequest(frame);
      } else {
        this.emit('notification', frame);
      }
    }
  }

  private async handleAgentRequest(frame: JsonRpcObject): Promise<void> {
    const id = frame.id;
    if (typeof id !== 'number' && typeof id !== 'string') return;
    if (frame.method === 'session/request_permission') {
      const options = asRecord(frame.params).options;
      const choices = Array.isArray(options) ? options.map(asRecord) : [];
      const desiredKind =
        this.options.permissionPolicy === 'allow-once'
          ? 'allow_once'
          : 'reject_once';
      const selected = choices.find((choice) => choice.kind === desiredKind);
      if (typeof selected?.optionId === 'string') {
        await this.send({
          jsonrpc: '2.0',
          id,
          result: {
            outcome: { outcome: 'selected', optionId: selected.optionId },
          },
        });
        return;
      }
      await this.send({
        jsonrpc: '2.0',
        id,
        result: { outcome: { outcome: 'cancelled' } },
      });
      return;
    }

    await this.send({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Unsupported client method` },
    });
  }

  private async send(frame: JsonRpcObject): Promise<void> {
    await this.transport.send('agent', JSON.stringify(frame));
  }

  private requireRunning(): void {
    if (!this.started || this.stopped) {
      throw new Error('ACP client is not running');
    }
  }

  private readonly fail = (error: unknown): void => {
    const normalized =
      error instanceof Error ? error : new Error(String(error));
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(normalized);
    }
    this.pendingRequests.clear();
    this.emit('error', normalized);
  };
}

function parseFrame(payload: string): JsonRpcObject {
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch (error) {
    throw new Error(`Invalid ACP JSON-RPC frame: ${String(error)}`);
  }
  const frame = asRecord(value);
  if (frame.jsonrpc !== '2.0') {
    throw new Error('ACP frame does not declare JSON-RPC 2.0');
  }
  return frame as JsonRpcObject;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}
