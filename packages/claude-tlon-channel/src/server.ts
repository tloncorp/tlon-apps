#!/usr/bin/env node
/**
 * MCP channel server: attaches a local Claude Code session to Tlon
 * channels, threads, and DMs, logged in as the bot ship.
 *
 * - Inbound: subscribes to the ship's %channels and %chat firehoses over
 *   SSE; messages inside attached scopes are pushed into the session as
 *   `notifications/claude/channel` events (Claude Code v2.1.80+,
 *   started with `claude --channels ...`).
 * - Outbound: `tlon_send` shells out to the tlon CLI (@tloncorp/tlon-skill).
 * - Coexistence: attached scopes are claimed in the ship's settings-store
 *   (`externalClaims`) so an OpenClaw gateway running as the same ship
 *   ignores them — see packages/openclaw.
 *
 * All logging goes to stderr; stdout is the MCP stdio transport.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ClaimManager } from './claims.js';
import { TlonCli } from './cli.js';
import { loadConfig, normalizeShip } from './config.js';
import { EyreClient } from './eyre.js';
import { type InboundMessage, parseChannelsEvent, parseChatEvent } from './inbound.js';
import { type Scope, matchScope, parseScope, scopeKey } from './scopes.js';

const log = (message: string) => console.error(message);

const INSTRUCTIONS = `You are attached to Tlon (Urbit messenger) as the bot ship. Inbound
messages from attached scopes arrive as channel events with meta fields:
scope, kind (dm | club | channel), target, messageId, parentId (set when the
message is a thread reply), author, and sent.

To reply, call tlon_send. Reply in the same place the message came from:
- DM / group DM: target = the meta.target value
- channel message: target = the nest; pass parentId to reply in a thread.
  If meta.parentId is set, the conversation is a thread — pass that parentId
  so your reply lands in the same thread.

Use tlon_read to pull recent history for context before replying when you
have not seen the conversation yet. Manage which conversations you follow
with tlon_attach / tlon_detach; scopes:
  ~ship                        one-to-one DM
  0v...                        group DM (club)
  chat/~host/slug              whole channel
  chat/~host/slug/<post-id>    single thread

You are speaking as the bot's identity. Keep replies conversational and
channel-appropriate; do not paste large tool output or file contents into
chat unless asked.`;

type Attachment = { scope: Scope; raw: string };

async function main(): Promise<void> {
  const cfg = loadConfig();
  const eyre = new EyreClient(cfg.url, cfg.ship, cfg.code, log);
  const cli = new TlonCli(cfg);
  const claims = new ClaimManager(
    eyre,
    cfg.claimHolder,
    cfg.claimTtlMs,
    cfg.writeClaims,
    log
  );

  const attachments = new Map<string, Attachment>();
  const seenMessageIds = new Set<string>();

  const server = new Server(
    { name: 'tlon', version: '0.1.0' },
    {
      capabilities: {
        experimental: { 'claude/channel': {} },
        tools: {},
      },
      instructions: INSTRUCTIONS,
    }
  );

  const notifyInbound = (message: InboundMessage, scope: Scope) => {
    // Dedupe across SSE reconnect replays.
    const dedupeKey = `${message.whom ?? message.nest}/${message.id}`;
    if (seenMessageIds.has(dedupeKey)) {
      return;
    }
    seenMessageIds.add(dedupeKey);
    if (seenMessageIds.size > 2000) {
      for (const key of seenMessageIds) {
        seenMessageIds.delete(key);
        if (seenMessageIds.size <= 1000) {
          break;
        }
      }
    }

    const target = message.whom ?? message.nest ?? '';
    server
      .notification({
        method: 'notifications/claude/channel',
        params: {
          content: `${message.author}: ${message.text}`,
          // meta values must all be strings (Record<string, string>);
          // non-identifier keys and non-string values are dropped by the host.
          meta: {
            scope: scopeKey(scope),
            kind: message.kind,
            target,
            messageId: message.id,
            ...(message.parentId ? { parentId: message.parentId } : {}),
            author: message.author,
            sent: new Date(message.sent).toISOString(),
          },
        },
      })
      .catch((err) => log(`[tlon] Notification failed: ${String(err)}`));
  };

  const debug = process.env.TLON_DEBUG === '1';

  const handleInbound = (message: InboundMessage | null) => {
    if (!message || !message.text) {
      return;
    }
    if (normalizeShip(message.author) === cfg.ship) {
      if (debug) {
        log(`[tlon] Ignoring own message in ${message.whom ?? message.nest}`);
      }
      return; // our own sends (including this session's)
    }
    const scope = matchScope(
      [...attachments.values()].map((a) => a.scope),
      {
        whom: message.whom,
        nest: message.nest,
        parentId: message.parentId,
      }
    );
    if (scope) {
      log(
        `[tlon] Inbound from ${message.author} in ${scopeKey(scope)} → channel event`
      );
      notifyInbound(message, scope);
    } else if (debug) {
      log(
        `[tlon] Inbound from ${message.author} matched no attached scope ` +
          `(whom=${message.whom ?? '-'} nest=${message.nest ?? '-'} parent=${message.parentId ?? '-'}); ` +
          `attached: ${[...attachments.keys()].join(', ') || '(none)'}`
      );
    }
  };

  const attach = async (raw: string): Promise<string> => {
    const scope = parseScope(raw);
    if (!scope) {
      throw new Error(
        `Invalid scope: "${raw}". Expected ~ship, 0v club id, chat/~host/slug, or chat/~host/slug/<post-id>.`
      );
    }
    const key = scopeKey(scope);
    if (attachments.has(key)) {
      return `Already attached to ${key}.`;
    }
    attachments.set(key, { scope, raw });
    try {
      await claims.claim(key);
    } catch (err) {
      log(`[tlon] Claim write failed for ${key}: ${String(err)}`);
      return `Attached to ${key}, but failed to write the settings-store claim (a co-resident OpenClaw bot may also respond): ${String(err)}`;
    }
    return `Attached to ${key}. New messages there will arrive as channel events.`;
  };

  const detach = async (raw: string): Promise<string> => {
    const scope = parseScope(raw);
    const key = scope ? scopeKey(scope) : raw.trim();
    if (!attachments.delete(key)) {
      return `Not attached to ${key}.`;
    }
    await claims
      .release(key)
      .catch((err) => log(`[tlon] Claim release failed: ${String(err)}`));
    return `Detached from ${key}.`;
  };

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'tlon_attach',
        description:
          'Attach to a Tlon scope so its new messages arrive as channel events. Scopes: ~ship (DM), 0v... (group DM), chat/~host/slug (channel), chat/~host/slug/<post-id> (thread).',
        inputSchema: {
          type: 'object',
          properties: {
            scope: { type: 'string', description: 'Scope to attach to' },
          },
          required: ['scope'],
        },
      },
      {
        name: 'tlon_detach',
        description: 'Detach from a previously attached Tlon scope.',
        inputSchema: {
          type: 'object',
          properties: {
            scope: { type: 'string', description: 'Scope to detach from' },
          },
          required: ['scope'],
        },
      },
      {
        name: 'tlon_attachments',
        description: 'List currently attached Tlon scopes.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'tlon_send',
        description:
          'Send a message to Tlon as the bot. target: channel nest, ~ship DM, or 0v group DM. Pass parentId to reply in a thread.',
        inputSchema: {
          type: 'object',
          properties: {
            target: {
              type: 'string',
              description: 'chat/~host/slug, ~ship, or 0v club id',
            },
            text: { type: 'string', description: 'Message text (markdown)' },
            parentId: {
              type: 'string',
              description: 'Top-level post id to reply under (thread reply)',
            },
          },
          required: ['target', 'text'],
        },
      },
      {
        name: 'tlon_read',
        description:
          'Read recent Tlon history for context. target: channel nest or ~ship/0v DM. Pass postId to fetch one post with its thread replies.',
        inputSchema: {
          type: 'object',
          properties: {
            target: { type: 'string' },
            limit: { type: 'number', description: 'Max messages (default 20)' },
            postId: {
              type: 'string',
              description: 'Fetch this post and its replies instead of history',
            },
          },
          required: ['target'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    const text = async (): Promise<string> => {
      switch (request.params.name) {
        case 'tlon_attach':
          return attach(String(args.scope ?? ''));
        case 'tlon_detach':
          return detach(String(args.scope ?? ''));
        case 'tlon_attachments': {
          const keys = [...attachments.keys()];
          return keys.length === 0
            ? 'No attached scopes.'
            : `Attached scopes:\n${keys.map((k) => `- ${k}`).join('\n')}`;
        }
        case 'tlon_send': {
          const target = String(args.target ?? '');
          const body = String(args.text ?? '');
          const parentId = args.parentId ? String(args.parentId) : undefined;
          const result = parentId
            ? await cli.reply(target, parentId, body)
            : await cli.send(target, body);
          return result || 'Sent.';
        }
        case 'tlon_read': {
          const target = String(args.target ?? '');
          const limit = Number(args.limit ?? 20) || 20;
          if (args.postId) {
            return cli.readThread(target, String(args.postId));
          }
          if (target.startsWith('~') || target.startsWith('0v')) {
            return cli.readDm(target, limit);
          }
          return cli.readChannel(target, limit);
        }
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    };
    try {
      return { content: [{ type: 'text', text: await text() }] };
    } catch (err) {
      return {
        content: [{ type: 'text', text: String(err) }],
        isError: true,
      };
    }
  });

  // --- Startup ---
  await eyre.login();
  await eyre.subscribe('channels', '/v4', (data) =>
    handleInbound(parseChannelsEvent(data))
  );
  await eyre.subscribe('chat', '/v4', (data) =>
    handleInbound(parseChatEvent(data))
  );
  void eyre.runEventStream();

  for (const raw of cfg.initialScopes) {
    await attach(raw).then(log, (err) => log(String(err)));
  }

  const shutdown = async () => {
    log('[tlon] Shutting down; releasing claims');
    await claims.releaseAll().catch(() => {});
    await eyre.close().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log(`[tlon] MCP channel server ready as ${cfg.ship} (${cfg.url})`);
}

main().catch((err) => {
  console.error(`[tlon] Fatal: ${String(err)}`);
  process.exit(1);
});
