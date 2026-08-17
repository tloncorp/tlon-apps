import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';

import {
  type ContextLensEvent,
  findRecentContextLensById,
  listRecentContextLensEvents,
  subscribeToContextLensEvents,
} from './context-lens-events.js';
import { getContextLensStore } from './context-lens-store.js';
import {
  type TlonContextLensConfig,
  isMonolithicTlonDeployment,
  listTlonAccountIds,
  resolveTlonAccount,
} from './types.js';

export const CONTEXT_LENS_RECENT_ROUTE = '/tlon/context-lens/recent';
export const CONTEXT_LENS_EVENTS_ROUTE = '/tlon/context-lens/events';
export const CONTEXT_LENS_RUN_ROUTE = '/tlon/context-lens/run';

const SSE_KEEPALIVE_MS = 20_000;
const SSE_REPLAY_LIMIT = 25;
const LOCALHOST_ORIGIN_RE =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

type ContextLensRouteApi = {
  config: OpenClawConfig;
  logger: {
    info: (message: string) => void;
    warn: (message: string) => void;
    debug?: (message: string) => void;
  };
  registerHttpRoute: (params: {
    path: string;
    auth: 'gateway' | 'plugin';
    replaceExisting?: boolean;
    handler: (
      req: IncomingMessage,
      res: ServerResponse
    ) => Promise<void> | void;
  }) => void;
};

function setCorsHeaders(
  req: IncomingMessage,
  res: ServerResponse,
  allowedOrigins: string[]
) {
  const origin =
    typeof req.headers?.origin === 'string' ? req.headers.origin : '';
  if (
    origin &&
    (LOCALHOST_ORIGIN_RE.test(origin) || allowedOrigins.includes(origin))
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Last-Event-ID'
  );
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function timingSafeTokenMatch(provided: string, expected: string): boolean {
  // Hash both sides so comparison time is independent of token length.
  const providedDigest = crypto.createHash('sha256').update(provided).digest();
  const expectedDigest = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(providedDigest, expectedDigest);
}

export function readBearerToken(req: IncomingMessage): string | null {
  const header = req.headers?.authorization;
  if (typeof header !== 'string') {
    return null;
  }
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * Shared preamble for every lens route: CORS, OPTIONS preflight, GET-only,
 * Bearer auth. Returns true when the request may proceed; otherwise the
 * response has already been written.
 *
 * Routes register with `auth: "plugin"` (gateway core does not authenticate
 * those), so this gate is the only thing between the network and lens data —
 * never register a lens route without it.
 */
type RouteAccount = {
  accountId: string;
  lensConfig: TlonContextLensConfig & { authToken: string };
};

function gateRequest(
  req: IncomingMessage,
  res: ServerResponse,
  accounts: RouteAccount[]
): RouteAccount | null {
  const allowedOrigins = [
    ...new Set(
      accounts.flatMap((account) => account.lensConfig.allowedOrigins)
    ),
  ];
  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res, allowedOrigins);
    res.statusCode = 204;
    res.end();
    return null;
  }
  if (req.method !== 'GET') {
    setCorsHeaders(req, res, allowedOrigins);
    writeJson(res, 405, { error: 'method_not_allowed' });
    return null;
  }
  const provided = readBearerToken(req);
  const matches = provided
    ? accounts.filter((account) =>
        timingSafeTokenMatch(provided, account.lensConfig.authToken)
      )
    : [];
  if (matches.length !== 1) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="tlon-context-lens"');
    writeJson(res, 401, { error: 'unauthorized' });
    return null;
  }
  setCorsHeaders(req, res, matches[0].lensConfig.allowedOrigins);
  return matches[0];
}

function writeSseEvent(res: ServerResponse, event: ContextLensEvent) {
  res.write(`id: ${event.seq}\n`);
  res.write('event: context-lens\n');
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function closeSseResponse(res: ServerResponse) {
  try {
    res.end?.();
  } catch {
    // Ignore cleanup failures from already-closed responses.
  }
}

function readRouteQuery(req: IncomingMessage, key: string): string {
  const rawUrl = typeof req.url === 'string' ? req.url : '';
  const parsed = new URL(rawUrl, 'http://localhost');
  return parsed.searchParams.get(key)?.trim() ?? '';
}

function readLastEventId(req: IncomingMessage): number | null {
  const header = req.headers?.['last-event-id'];
  const raw = Array.isArray(header) ? header[0] : header;
  if (typeof raw !== 'string') {
    return null;
  }
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function registerContextLensRoutes(api: ContextLensRouteApi): boolean {
  const enabledAccounts = listTlonAccountIds(api.config)
    .map((accountId) => ({
      accountId,
      lensConfig: resolveTlonAccount(api.config, accountId).contextLens,
    }))
    .filter((account) => account.lensConfig.enabled);
  if (enabledAccounts.length === 0) {
    api.logger.debug?.('[tlon] Context lens disabled; routes not registered');
    return false;
  }
  const routeAccounts: RouteAccount[] = enabledAccounts.flatMap((account) =>
    account.lensConfig.authToken
      ? [
          {
            accountId: account.accountId,
            lensConfig: {
              ...account.lensConfig,
              authToken: account.lensConfig.authToken,
            },
          },
        ]
      : []
  );
  if (routeAccounts.length === 0) {
    api.logger.warn(
      '[tlon] Context lens enabled but channels.tlon.contextLens.authToken is not set; ' +
        'routes not registered (no unauthenticated mode)'
    );
    return false;
  }

  api.registerHttpRoute({
    path: CONTEXT_LENS_RECENT_ROUTE,
    auth: 'plugin',
    replaceExisting: true,
    handler: async (req, res) => {
      const routeAccount = gateRequest(req, res, routeAccounts);
      if (!routeAccount) {
        return;
      }
      writeJson(res, 200, {
        events: listRecentContextLensEvents(routeAccount.accountId),
      });
    },
  });

  api.registerHttpRoute({
    path: CONTEXT_LENS_EVENTS_ROUTE,
    auth: 'plugin',
    replaceExisting: true,
    handler: async (req, res) => {
      const routeAccount = gateRequest(req, res, routeAccounts);
      if (!routeAccount) {
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');

      let closed = false;
      let unsubscribe = () => {};
      let keepalive: ReturnType<typeof setInterval> | null = null;
      const cleanup = () => {
        if (closed) {
          return;
        }
        closed = true;
        unsubscribe();
        if (keepalive) {
          clearInterval(keepalive);
          keepalive = null;
        }
      };
      const sendOrClose = (event: ContextLensEvent) => {
        if (closed) {
          return;
        }
        try {
          writeSseEvent(res, event);
        } catch (error) {
          api.logger.warn(
            `[tlon] Context Lens SSE write failed: ${String(error)}`
          );
          cleanup();
          closeSseResponse(res);
        }
      };

      try {
        res.write(': connected\n\n');
      } catch (error) {
        api.logger.warn(
          `[tlon] Context Lens SSE handshake failed: ${String(error)}`
        );
        cleanup();
        closeSseResponse(res);
        return;
      }

      const lastEventId = readLastEventId(req);
      const recent = listRecentContextLensEvents(routeAccount.accountId);
      const replay =
        lastEventId === null
          ? recent.slice(-SSE_REPLAY_LIMIT)
          : recent.filter((event) => event.seq > lastEventId);
      // Guard against duplicates if an event is ever published between the
      // snapshot above and the live subscription below (seqs are monotonic).
      let maxSentSeq = lastEventId ?? -1;
      for (const event of replay) {
        sendOrClose(event);
        maxSentSeq = Math.max(maxSentSeq, event.seq);
      }
      if (closed) {
        return;
      }

      unsubscribe = subscribeToContextLensEvents((event) => {
        if (event.seq <= maxSentSeq) {
          return;
        }
        maxSentSeq = event.seq;
        sendOrClose(event);
      }, routeAccount.accountId);
      keepalive = setInterval(() => {
        if (closed) {
          return;
        }
        try {
          res.write(`: keepalive ${Date.now()}\n\n`);
        } catch (error) {
          api.logger.warn(
            `[tlon] Context Lens SSE keepalive failed: ${String(error)}`
          );
          cleanup();
          closeSseResponse(res);
        }
      }, SSE_KEEPALIVE_MS);
      keepalive.unref?.();

      req.on?.('close', cleanup);
      req.on?.('aborted', cleanup);
      res.on?.('close', cleanup);
    },
  });

  api.registerHttpRoute({
    path: CONTEXT_LENS_RUN_ROUTE,
    auth: 'plugin',
    replaceExisting: true,
    handler: async (req, res) => {
      const routeAccount = gateRequest(req, res, routeAccounts);
      if (!routeAccount) {
        return;
      }
      const lensId = readRouteQuery(req, 'lensId');
      if (!lensId) {
        writeJson(res, 400, { error: 'missing_lensId' });
        return;
      }
      // Live events first, then the durable store so runs survive restarts.
      const stored = getContextLensStore(routeAccount.accountId)?.get(lensId);
      const lens =
        findRecentContextLensById(lensId, routeAccount.accountId) ??
        (stored?.accountId === routeAccount.accountId ||
        (!stored?.accountId && !isMonolithicTlonDeployment(api.config))
          ? stored
          : null);
      if (!lens) {
        writeJson(res, 404, { error: 'not_found' });
        return;
      }
      writeJson(res, 200, { lens });
    },
  });

  api.logger.info('[tlon] Context lens routes registered (auth: bearer token)');
  return true;
}
