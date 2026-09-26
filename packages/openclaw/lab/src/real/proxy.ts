import http from 'node:http';
import type { ChatToolCall } from '../openrouter.js';

// A pass-through proxy between the sandbox bot and OpenRouter. It records
// every model request exactly as OpenClaw sent it, plus the reply, so a real
// run's tool calls, cost and prompts can be read back and compared with the
// fast lab's. It also says when the bot is idle: no request in flight.

const UPSTREAM = 'https://openrouter.ai';

export type ModelExchange = {
  tag: string;
  startedAt: string;
  endedAt?: string;
  path: string;
  status?: number;
  request: Record<string, unknown>;
  response?: {
    content: string;
    toolCalls: ChatToolCall[];
    finishReason?: string;
    usage?: Record<string, unknown>;
  };
  error?: string;
};

type Accumulated = {
  content: string;
  toolCalls: ChatToolCall[];
  finishReason?: string;
  usage?: Record<string, unknown>;
};

type Delta = {
  choices?: {
    delta?: {
      content?: string | null;
      tool_calls?: {
        index?: number;
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
    message?: { content?: string | null; tool_calls?: ChatToolCall[] };
    finish_reason?: string | null;
  }[];
  usage?: Record<string, unknown>;
};

function absorb(into: Accumulated, chunk: Delta) {
  for (const choice of chunk.choices ?? []) {
    if (choice.message) {
      into.content += choice.message.content ?? '';
      into.toolCalls.push(...(choice.message.tool_calls ?? []));
    }
    if (choice.delta?.content) into.content += choice.delta.content;
    for (const call of choice.delta?.tool_calls ?? []) {
      const index = call.index ?? into.toolCalls.length;
      const slot = (into.toolCalls[index] ??= {
        id: '',
        type: 'function',
        function: { name: '', arguments: '' },
      });
      if (call.id) slot.id = call.id;
      if (call.function?.name) slot.function.name += call.function.name;
      if (call.function?.arguments)
        slot.function.arguments += call.function.arguments;
    }
    if (choice.finish_reason) into.finishReason = choice.finish_reason;
  }
  if (chunk.usage) into.usage = chunk.usage;
}

export class ModelProxy {
  private server?: http.Server;
  private exchanges: ModelExchange[] = [];
  private tag = 'idle';
  private inFlight = 0;
  private lastActivity = Date.now();

  constructor(readonly port: number) {}

  /** Label the requests that follow, e.g. with the run they belong to. */
  setTag(tag: string) {
    this.tag = tag;
  }

  /** Every exchange recorded under `tag`, oldest first. */
  take(tag: string) {
    const taken = this.exchanges.filter((exchange) => exchange.tag === tag);
    this.exchanges = this.exchanges.filter((exchange) => exchange.tag !== tag);
    return taken;
  }

  peek(tag: string) {
    return this.exchanges.filter((exchange) => exchange.tag === tag);
  }

  /** True when nothing is in flight and nothing happened for `quietMs`. */
  idle(quietMs: number) {
    return this.inFlight === 0 && Date.now() - this.lastActivity >= quietMs;
  }

  get busy() {
    return this.inFlight > 0;
  }

  async start() {
    this.server = http.createServer((request, response) => {
      this.forward(request, response).catch((error: unknown) => {
        if (!response.headersSent) response.writeHead(502);
        response.end(String(error));
      });
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      // Docker Desktop reaches host loopback through host.docker.internal.
      this.server!.listen(this.port, '127.0.0.1', () => resolve());
    });
  }

  async stop() {
    await new Promise<void>((resolve) =>
      this.server ? this.server.close(() => resolve()) : resolve()
    );
  }

  private async forward(
    request: http.IncomingMessage,
    response: http.ServerResponse
  ) {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    let body: Record<string, unknown> = {};
    try {
      body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      // Not JSON; forwarded untouched below.
    }
    const isChat = (request.url ?? '').endsWith('/chat/completions');
    const exchange: ModelExchange = {
      tag: this.tag,
      startedAt: new Date().toISOString(),
      path: request.url ?? '',
      request: body,
    };
    if (isChat) this.exchanges.push(exchange);
    // Ask OpenRouter to report cost; it changes nothing the model sees.
    const outgoing =
      isChat && raw
        ? JSON.stringify({ ...body, usage: { include: true } })
        : raw;
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.headers)) {
      if (
        typeof value === 'string' &&
        !['host', 'content-length', 'accept-encoding', 'connection'].includes(
          key
        )
      ) {
        headers[key] = value;
      }
    }
    headers['accept-encoding'] = 'identity';
    this.inFlight++;
    this.lastActivity = Date.now();
    try {
      const upstream = await fetch(`${UPSTREAM}${request.url}`, {
        method: request.method,
        headers,
        body: request.method === 'GET' ? undefined : outgoing,
      });
      exchange.status = upstream.status;
      const responseHeaders: Record<string, string> = {};
      upstream.headers.forEach((value, key) => {
        if (!['content-encoding', 'content-length'].includes(key))
          responseHeaders[key] = value;
      });
      response.writeHead(upstream.status, responseHeaders);
      const accumulated: Accumulated = { content: '', toolCalls: [] };
      const streaming = (upstream.headers.get('content-type') ?? '').includes(
        'text/event-stream'
      );
      let buffered = '';
      let text = '';
      if (upstream.body) {
        const decoder = new TextDecoder();
        for await (const piece of upstream.body) {
          response.write(piece);
          this.lastActivity = Date.now();
          const decoded = decoder.decode(piece as Uint8Array, { stream: true });
          if (!streaming) {
            text += decoded;
            continue;
          }
          buffered += decoded;
          const lines = buffered.split('\n');
          buffered = lines.pop() ?? '';
          for (const line of lines) {
            const data = line.startsWith('data:') ? line.slice(5).trim() : '';
            if (!data || data === '[DONE]') continue;
            try {
              absorb(accumulated, JSON.parse(data) as Delta);
            } catch {
              // A comment or keep-alive line.
            }
          }
        }
      }
      response.end();
      if (!streaming && text) {
        try {
          absorb(accumulated, JSON.parse(text) as Delta);
        } catch {
          exchange.error = text.slice(0, 2000);
        }
      }
      exchange.response = {
        ...accumulated,
        toolCalls: accumulated.toolCalls.filter(Boolean),
      };
    } catch (error) {
      exchange.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      exchange.endedAt = new Date().toISOString();
      this.inFlight--;
      this.lastActivity = Date.now();
    }
  }
}

/** Dollar cost OpenRouter reported for the exchanges. */
export function exchangeCost(exchanges: ModelExchange[]) {
  return exchanges.reduce(
    (sum, exchange) => sum + Number(exchange.response?.usage?.cost ?? 0),
    0
  );
}
