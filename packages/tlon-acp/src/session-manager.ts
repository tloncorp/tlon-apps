import type { JsonRpcObject } from '@tloncorp/acp';

import type { InboundTlonMessage } from './routing.js';
import type { SessionStore } from './session-store.js';
import { asRecord } from './story.js';

export interface ProtocolClient {
  request(method: string, params: unknown): Promise<unknown>;
  on(event: 'notification', listener: (frame: JsonRpcObject) => void): unknown;
  off(event: 'notification', listener: (frame: JsonRpcObject) => void): unknown;
}

export type SessionManagerOptions = {
  cwd: string;
  store: SessionStore;
  agentCapabilities?: Record<string, unknown>;
  mcpServers?: unknown[];
  toolInstructions?: string;
};

export class AcpSessionManager {
  private readonly sessions = new Map<string, string>();
  private readonly activeSessions = new Set<string>();
  private readonly turns = new Map<string, Promise<void>>();
  private readonly chunks = new Map<string, string[]>();
  private started = false;

  constructor(
    private readonly client: ProtocolClient,
    private readonly options: SessionManagerOptions
  ) {}

  async start(): Promise<void> {
    if (this.started) return;
    const stored = await this.options.store.load();
    for (const [key, sessionId] of Object.entries(stored)) {
      this.sessions.set(key, sessionId);
    }
    this.client.on('notification', this.handleNotification);
    this.started = true;
  }

  stop(): void {
    if (!this.started) return;
    this.client.off('notification', this.handleNotification);
    this.started = false;
  }

  prompt(message: InboundTlonMessage): Promise<string> {
    if (!this.started) throw new Error('ACP session manager is not started');
    const previous = this.turns.get(message.key) ?? Promise.resolve();
    let resolve!: (value: string) => void;
    let reject!: (reason: unknown) => void;
    const result = new Promise<string>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const turn = previous
      .catch(() => undefined)
      .then(async () => {
        try {
          resolve(await this.runPrompt(message));
        } catch (error) {
          reject(error);
        }
      })
      .finally(() => {
        if (this.turns.get(message.key) === turn) {
          this.turns.delete(message.key);
        }
      });
    this.turns.set(message.key, turn);
    return result;
  }

  private async runPrompt(message: InboundTlonMessage): Promise<string> {
    const sessionId = await this.getSession(message.key);
    this.chunks.set(sessionId, []);
    try {
      await this.client.request('session/prompt', {
        sessionId,
        prompt: [
          {
            type: 'text',
            text:
              `A Tlon user ~${message.sender} sent this message in ` +
              `${message.kind === 'dm' ? 'a direct message' : message.target}. ` +
              `Reply with only the response to send back to Tlon.` +
              (this.options.toolInstructions
                ? ` ${this.options.toolInstructions}`
                : '') +
              `\n\n${message.text}`,
          },
        ],
      });
      return (this.chunks.get(sessionId) ?? []).join('').trim();
    } finally {
      this.chunks.delete(sessionId);
    }
  }

  private async getSession(key: string): Promise<string> {
    const existing = this.sessions.get(key);
    if (existing) {
      if (this.activeSessions.has(existing)) return existing;
      try {
        let restored = false;
        if (supports(this.options.agentCapabilities, 'resumeSession')) {
          await this.client.request('session/resume', {
            sessionId: existing,
            cwd: this.options.cwd,
            mcpServers: this.options.mcpServers ?? [],
          });
          restored = true;
        } else if (supports(this.options.agentCapabilities, 'loadSession')) {
          await this.client.request('session/load', {
            sessionId: existing,
            cwd: this.options.cwd,
            mcpServers: this.options.mcpServers ?? [],
          });
          restored = true;
        }
        if (!restored) throw new Error('Agent cannot restore sessions');
        this.activeSessions.add(existing);
        return existing;
      } catch {
        this.sessions.delete(key);
        this.activeSessions.delete(existing);
      }
    }
    const response = asRecord(
      await this.client.request('session/new', {
        cwd: this.options.cwd,
        mcpServers: this.options.mcpServers ?? [],
      })
    );
    if (typeof response.sessionId !== 'string' || !response.sessionId) {
      throw new Error('ACP agent returned no sessionId');
    }
    this.sessions.set(key, response.sessionId);
    this.activeSessions.add(response.sessionId);
    await this.options.store.save(Object.fromEntries(this.sessions));
    return response.sessionId;
  }

  private readonly handleNotification = (frame: JsonRpcObject): void => {
    if (frame.method !== 'session/update') return;
    const params = asRecord(frame.params);
    const sessionId =
      typeof params.sessionId === 'string' ? params.sessionId : '';
    const update = asRecord(params.update);
    if (update.sessionUpdate !== 'agent_message_chunk') return;
    const content = asRecord(update.content);
    if (content.type !== 'text' || typeof content.text !== 'string') return;
    this.chunks.get(sessionId)?.push(content.text);
  };
}

function supports(
  capabilities: Record<string, unknown> | undefined,
  capability: string
): boolean {
  const session = asRecord(capabilities?.sessionCapabilities);
  return Boolean(session[capability]);
}
