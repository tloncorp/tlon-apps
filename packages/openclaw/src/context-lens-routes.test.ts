import type { IncomingMessage, ServerResponse } from 'node:http';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { describe, expect, it } from 'vitest';

import {
  listRecentContextLensEvents,
  publishContextLensEvent,
} from './context-lens-events.js';
import {
  CONTEXT_LENS_EVENTS_ROUTE,
  CONTEXT_LENS_RECENT_ROUTE,
  CONTEXT_LENS_RUN_ROUTE,
  registerContextLensRoutes,
} from './context-lens-routes.js';
import { setContextLensStore } from './context-lens-store.js';
import { createContextLensRegistry } from './context-lens.js';

const AUTH_TOKEN = 'a-token-of-sufficient-length';

type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => Promise<void> | void;

function setupRoutes(
  contextLens: Record<string, unknown> = {
    enabled: true,
    authToken: AUTH_TOKEN,
    allowedOrigins: ['https://app.tlon.network'],
  }
) {
  const routes = new Map<string, { auth: string; handler: RouteHandler }>();
  const warnings: string[] = [];
  const registered = registerContextLensRoutes({
    config: {
      channels: {
        tlon: {
          ship: '~zod',
          url: 'https://example.com',
          code: 'code-123',
          contextLens,
        },
      },
    } as OpenClawConfig,
    logger: {
      info: () => {},
      warn: (message) => warnings.push(message),
      debug: () => {},
    },
    registerHttpRoute: ({ path, auth, handler }) => {
      routes.set(path, { auth, handler });
    },
  });
  return { routes, registered, warnings };
}

function makeReq(
  opts: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
  } = {}
) {
  const listeners = new Map<string, Array<() => void>>();
  const req = {
    method: opts.method ?? 'GET',
    url: opts.url ?? '/',
    headers: opts.headers ?? {},
    on: (event: string, cb: () => void) => {
      const existing = listeners.get(event) ?? [];
      existing.push(cb);
      listeners.set(event, existing);
    },
  };
  return {
    req: req as unknown as IncomingMessage,
    emit: (event: string) => {
      for (const cb of listeners.get(event) ?? []) {
        cb();
      }
    },
  };
}

function makeRes() {
  const headers = new Map<string, string>();
  const state = { body: '', ended: false, statusCode: 200 };
  const res = {
    get statusCode() {
      return state.statusCode;
    },
    set statusCode(code: number) {
      state.statusCode = code;
    },
    setHeader: (key: string, value: string) => {
      headers.set(key.toLowerCase(), value);
    },
    write: (chunk: string) => {
      state.body += chunk;
      return true;
    },
    end: (chunk?: string) => {
      if (chunk) {
        state.body += chunk;
      }
      state.ended = true;
    },
    on: () => {},
  };
  return { res: res as unknown as ServerResponse, headers, state };
}

function authHeaders(extra: Record<string, string> = {}) {
  return { authorization: `Bearer ${AUTH_TOKEN}`, ...extra };
}

function publishLensEvent(messageId: string) {
  const registry = createContextLensRegistry({ ttlMs: 60_000 });
  const lens = registry.create({ messageId, chatType: 'dm', trigger: 'dm' });
  publishContextLensEvent('created', lens);
  return lens;
}

describe('context lens route registration', () => {
  it('does not register routes when the lens is disabled', () => {
    const { routes, registered } = setupRoutes({ enabled: false });
    expect(registered).toBe(false);
    expect(routes.size).toBe(0);
  });

  it('refuses to register without an auth token (no unauthenticated mode)', () => {
    const { routes, registered, warnings } = setupRoutes({ enabled: true });
    expect(registered).toBe(false);
    expect(routes.size).toBe(0);
    expect(warnings.join('\n')).toContain('authToken');
  });

  it('registers all three routes with self-managed plugin auth', () => {
    const { routes, registered } = setupRoutes();
    expect(registered).toBe(true);
    expect([...routes.keys()].toSorted()).toEqual(
      [
        CONTEXT_LENS_RECENT_ROUTE,
        CONTEXT_LENS_EVENTS_ROUTE,
        CONTEXT_LENS_RUN_ROUTE,
      ].toSorted()
    );
    for (const route of routes.values()) {
      expect(route.auth).toBe('plugin');
    }
  });
});

describe('context lens route auth gate', () => {
  it('rejects requests without a bearer token', async () => {
    const { routes } = setupRoutes();
    const { req } = makeReq();
    const { res, headers, state } = makeRes();

    await routes.get(CONTEXT_LENS_RECENT_ROUTE)?.handler(req, res);

    expect(state.statusCode).toBe(401);
    expect(headers.get('www-authenticate')).toContain('tlon-context-lens');
    expect(JSON.parse(state.body)).toEqual({ error: 'unauthorized' });
  });

  it('rejects requests with the wrong bearer token', async () => {
    const { routes } = setupRoutes();
    const { req } = makeReq({
      headers: { authorization: 'Bearer not-the-right-token-at-all' },
    });
    const { res, state } = makeRes();

    await routes.get(CONTEXT_LENS_RECENT_ROUTE)?.handler(req, res);

    expect(state.statusCode).toBe(401);
  });

  it('accepts the configured bearer token', async () => {
    const { routes } = setupRoutes();
    const { req } = makeReq({ headers: authHeaders() });
    const { res, state } = makeRes();

    await routes.get(CONTEXT_LENS_RECENT_ROUTE)?.handler(req, res);

    expect(state.statusCode).toBe(200);
    expect(JSON.parse(state.body)).toHaveProperty('events');
  });

  it('lets OPTIONS preflights through unauthenticated', async () => {
    const { routes } = setupRoutes();
    const { req } = makeReq({ method: 'OPTIONS' });
    const { res, headers, state } = makeRes();

    await routes.get(CONTEXT_LENS_RECENT_ROUTE)?.handler(req, res);

    expect(state.statusCode).toBe(204);
    expect(state.ended).toBe(true);
    expect(headers.get('access-control-allow-headers')).toContain(
      'Authorization'
    );
  });

  it('rejects non-GET methods', async () => {
    const { routes } = setupRoutes();
    const { req } = makeReq({ method: 'POST', headers: authHeaders() });
    const { res, state } = makeRes();

    await routes.get(CONTEXT_LENS_RECENT_ROUTE)?.handler(req, res);

    expect(state.statusCode).toBe(405);
  });

  it('echoes localhost and allowlisted origins, ignores others', async () => {
    const { routes } = setupRoutes();
    const handler = routes.get(CONTEXT_LENS_RECENT_ROUTE)?.handler;

    for (const [origin, allowed] of [
      ['http://localhost:3000', true],
      ['https://app.tlon.network', true],
      ['https://evil.example.com', false],
    ] as const) {
      const { req } = makeReq({ headers: authHeaders({ origin }) });
      const { res, headers } = makeRes();
      await handler?.(req, res);
      expect(headers.get('access-control-allow-origin')).toBe(
        allowed ? origin : undefined
      );
    }
  });
});

describe('context lens run route', () => {
  it('requires a lensId query parameter', async () => {
    const { routes } = setupRoutes();
    const { req } = makeReq({
      url: CONTEXT_LENS_RUN_ROUTE,
      headers: authHeaders(),
    });
    const { res, state } = makeRes();

    await routes.get(CONTEXT_LENS_RUN_ROUTE)?.handler(req, res);

    expect(state.statusCode).toBe(400);
  });

  it('returns 404 for unknown lensIds', async () => {
    const { routes } = setupRoutes();
    const { req } = makeReq({
      url: `${CONTEXT_LENS_RUN_ROUTE}?lensId=does-not-exist`,
      headers: authHeaders(),
    });
    const { res, state } = makeRes();

    await routes.get(CONTEXT_LENS_RUN_ROUTE)?.handler(req, res);

    expect(state.statusCode).toBe(404);
  });

  it('falls back to the durable store when the event buffer misses', async () => {
    const registry = createContextLensRegistry({ ttlMs: 60_000 });
    const stored = registry.create({
      messageId: 'from-disk',
      chatType: 'dm',
      trigger: 'dm',
    });
    setContextLensStore({
      filePath: '/tmp/unused',
      save: () => {},
      size: () => 1,
      get: (lensId) => (lensId === stored.lensId ? stored : null),
      list: () => [stored],
    });
    try {
      const { routes } = setupRoutes();
      const { req } = makeReq({
        url: `${CONTEXT_LENS_RUN_ROUTE}?lensId=${stored.lensId}`,
        headers: authHeaders(),
      });
      const { res, state } = makeRes();

      await routes.get(CONTEXT_LENS_RUN_ROUTE)?.handler(req, res);

      expect(state.statusCode).toBe(200);
      expect(JSON.parse(state.body).lens).toMatchObject({
        lensId: stored.lensId,
        messageId: 'from-disk',
      });
    } finally {
      setContextLensStore(null);
    }
  });

  it('resolves lensIds from the recent event buffer', async () => {
    const lens = publishLensEvent('run-route-hit');
    const { routes } = setupRoutes();
    const { req } = makeReq({
      url: `${CONTEXT_LENS_RUN_ROUTE}?lensId=${lens.lensId}`,
      headers: authHeaders(),
    });
    const { res, state } = makeRes();

    await routes.get(CONTEXT_LENS_RUN_ROUTE)?.handler(req, res);

    expect(state.statusCode).toBe(200);
    expect(JSON.parse(state.body).lens).toMatchObject({
      lensId: lens.lensId,
      messageId: 'run-route-hit',
    });
  });
});

describe('context lens SSE route', () => {
  it('replays recent events on connect and streams SSE frames', async () => {
    const lens = publishLensEvent('sse-replay-default');
    const { routes } = setupRoutes();
    const { req, emit } = makeReq({ headers: authHeaders() });
    const { res, headers, state } = makeRes();

    await routes.get(CONTEXT_LENS_EVENTS_ROUTE)?.handler(req, res);

    expect(headers.get('content-type')).toContain('text/event-stream');
    expect(state.body).toContain(': connected');
    expect(state.body).toContain(lens.lensId);

    emit('close');
  });

  it('replays only events after Last-Event-ID on reconnect', async () => {
    const earlier = publishLensEvent('sse-replay-earlier');
    const later = publishLensEvent('sse-replay-later');
    const earlierSeq = listRecentContextLensEvents().find(
      (event) => event.lens.lensId === earlier.lensId
    )?.seq;
    expect(earlierSeq).toBeTypeOf('number');

    const { routes } = setupRoutes();
    const { req, emit } = makeReq({
      headers: authHeaders({ 'last-event-id': String(earlierSeq) }),
    });
    const { res, state } = makeRes();

    await routes.get(CONTEXT_LENS_EVENTS_ROUTE)?.handler(req, res);

    expect(state.body).toContain(later.lensId);
    expect(state.body).not.toContain(earlier.lensId);

    emit('close');
  });

  it('delivers events published after the subscription starts', async () => {
    const { routes } = setupRoutes();
    const { req, emit } = makeReq({ headers: authHeaders() });
    const { res, state } = makeRes();

    await routes.get(CONTEXT_LENS_EVENTS_ROUTE)?.handler(req, res);
    const live = publishLensEvent('sse-live-event');

    expect(state.body).toContain(live.lensId);

    emit('close');
    const afterClose = publishLensEvent('sse-after-close');
    expect(state.body).not.toContain(afterClose.lensId);
  });
});
