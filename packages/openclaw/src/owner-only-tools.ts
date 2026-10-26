/**
 * Owner-only tool policy shared by the before_tool_call gate (index.ts) and
 * the ContextLens owner-tool advertisement (monitor/index.ts).
 *
 * The block reason is the ONLY text the model receives for a vetoed call:
 * OpenClaw core (2026.5.28 through 2026.8.2) returns `blockReason` verbatim as
 * a normal, non-error tool result with no framing. Observers (after_tool_call
 * `event.error`, the owner "silent failure" notice) keep only its first line,
 * capped at 400 / 200 chars — keep it one line and within the cap below.
 */
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';

import { CRON_TOOL_NAMES } from './cron-tool-args-guard.js';
import { MCP_BROKER_TOOL_NAMES } from './mcp-readonly-policy.js';
import { isNonOwnerMediaAllowed } from './non-owner-media.js';
import type { SenderRole } from './session-roles.js';

/**
 * OpenClaw core tools that hand work to another run: a spawned session or the
 * system agent (`openclaw`) has no stored role and would pass this gate, and a
 * sent message drives another session's run. The session listing, history,
 * search, status, wait, and yield tools stay open.
 */
export const DELEGATION_TOOL_NAMES = [
  'sessions_spawn',
  'sessions_send',
  'openclaw',
] as const;

/**
 * OpenClaw core tools that read other sessions' transcripts. Core 2026.9.33
 * defaults session visibility to `all`, which includes the owner's private
 * conversations.
 */
export const SESSION_ACCESS_TOOL_NAMES = [
  'sessions_list',
  'sessions_history',
  'sessions_search',
] as const;

export const OWNER_ONLY_TOOLS: ReadonlySet<string> = new Set([
  'tlon',
  // The scheduler under every name core gives it, so a rename cannot open it
  // to non-owners.
  ...CRON_TOOL_NAMES,
  'read',
  'tlon_agent_choice',
  'tlon_agent_task_plan',
  'tlon_agent_service_setup',
  'set_timezone',
  // MCP tools act on the owner's connected services; owner-only.
  ...MCP_BROKER_TOOL_NAMES,
  ...DELEGATION_TOOL_NAMES,
  // OpenClaw core tools that change the gateway, agent, or credentials the
  // owner set up (createOpenClawTools in core's openclaw-tools bundle).
  'gateway', // reads config, runs update and restart
  'plugins', // installs, enables, and removes plugins
  'secrets', // lists, requests, and deletes stored credentials
  'nodes', // approves device pairing and controls paired devices
  'personal_instructions', // rewrites the agent's USER.md
  'skill_workshop', // stages and revises agent skills
  'sessions', // archives, restores, and stops sessions
  'github_publish', // publishes with the agent's GitHub credentials
  // These expose or act on the owner's devices and private data.
  'presence', // people's devices, IP addresses, and locations
  'terminal', // the owner's open terminals
  'mobile_ui', // the owner's paired phone
  'transcripts', // the owner's meeting captures and notes
  // Local-path readers would hand a non-owner the owner's files.
  'pdf',
  'view_image',
  // Generation tools resolve any bare reference, even an extensionless word,
  // against the workspace (core media-tool-shared.ts).
  'image_generate',
  'video_generate',
  'music_generate',
  ...SESSION_ACCESS_TOOL_NAMES,
]);

/** Longest first line the TLON-6361 owner notice shows untruncated. */
export const OWNER_ONLY_BLOCK_REASON_MAX_CHARS = 200;

const BLOCK_REASON_TAIL =
  'Tell them you cannot do this for them; do not retry for them; do not blame a reload, outage, or missing tool.';

function policyBlockReason(policy: string, tail = BLOCK_REASON_TAIL): string {
  return `Blocked by policy: ${policy} is owner-only; they're not the owner. ${tail}`;
}

export function formatOwnerOnlyToolBlockReason(toolName: string): string {
  return policyBlockReason(`the ${toolName} tool`);
}

export function formatOwnerOnlyDelegationBlockReason(toolName: string): string {
  return policyBlockReason(`delegation via ${toolName}`);
}

export const SESSION_ACCESS_BLOCK_REASON = policyBlockReason('session access');

export const LOCAL_FILE_BLOCK_REASON = policyBlockReason(
  'local file references',
  'Retry without the file path, or tell them you cannot use it; do not blame a reload or outage.'
);

export const MESSAGE_MEDIA_BLOCK_REASON = policyBlockReason(
  'local and internal media',
  'Send text or a public https URL, or tell them you cannot attach it; do not blame a reload or outage.'
);

const MESSAGE_OPTION_NAME_MAX_CHARS = 20;

/**
 * Reason for a non-media `message` option outside the non-owner allowlist.
 * The key is model-chosen: sanitized and capped so the reason stays one line
 * within the owner-notice cap.
 */
export function formatMessageOptionBlockReason(key: string): string {
  const safe = key.replace(/[^\w.-]/g, '?');
  const name =
    safe.length > MESSAGE_OPTION_NAME_MAX_CHARS
      ? `${safe.slice(0, MESSAGE_OPTION_NAME_MAX_CHARS)}…`
      : safe;
  return policyBlockReason(
    `the ${name} message option`,
    'Send text or https media; only sends, replies, edits, deletes, reactions and reads are open here.'
  );
}

const MAX_PARAM_DEPTH = 16;

// Shapes core or the Tlon uploader resolves on the gateway's own disk:
// file: URLs, home (`~` alone or `~/`), absolute, `./`/`../` relative,
// drive-letter, and backslash/UNC paths.
const LOCAL_PATH_SHAPE =
  /^(?:file:|~(?=$|[\\/])|\/|\.{1,2}[\\/]|[A-Za-z]:[\\/]|\\)/i;
// Bare relative references also count: an `@` reference, a file extension,
// or a separator in a single token. A separator inside free text with spaces
// ("1/2 cup") does not.
const SEPARATED_TOKEN = /^\S*[\\/]\S*$/;
const FILE_EXTENSION =
  /\.(?:png|jpe?g|gif|webp|bmp|tiff?|svg|heic|heif|avif|ico|mp3|wav|m4a|aac|ogg|oga|opus|flac|mp4|m4v|mov|webm|mkv|avi|pdf|md|markdown|txt|log|json|jsonl|ya?ml|toml|ini|env|csv|tsv|xml|html?|css|js|mjs|cjs|ts|tsx|py|sh|sql|db|sqlite|zip|tar|t?gz|bz2|xz|7z|rar|docx?|xlsx?|pptx?|odt|rtf|key|pem|crt|p12)$/i;
const REMOTE_MEDIA = /^(?:https?:|data:)/i;
// Exemptions bound to the key that carries them: a MIME type only under a
// MIME key, a Tlon address (`~ship`, `dm/~ship`, `chat/~host/name`,
// `~ship/<post id>`) only under an addressing key.
const MIME_TYPE_KEYS = new Set(['mimeType', 'contentType']);
const MIME_TYPE =
  /^(?:application|audio|font|image|message|model|multipart|text|video)\/[\w.+-]+$/i;
const TLON_ADDRESS_KEYS = new Set([
  'to',
  'target',
  'targets',
  'channel',
  'channelId',
  'chatId',
  'nest',
  'whom',
  'postId',
  'messageId',
  'message_id',
  'replyTo',
  'threadId',
  'parentId',
]);
const TLON_ADDRESS =
  /^(?:tlon:)?(?:(?:dm|group|room)[/:])?(?:(?:chat|heap|diary|notes)\/)?~[a-z-]+(?:\/[\w.~-]+)?$/i;

function looksLikeLocalFile(raw: string, key: string | undefined): boolean {
  // The Tlon uploader strips a `MEDIA:` prefix before resolving.
  const value = raw.trim().replace(/^MEDIA\s*:\s*/i, '');
  if (
    !value ||
    REMOTE_MEDIA.test(value) ||
    (key !== undefined && MIME_TYPE_KEYS.has(key) && MIME_TYPE.test(value)) ||
    (key !== undefined &&
      TLON_ADDRESS_KEYS.has(key) &&
      TLON_ADDRESS.test(value))
  ) {
    return false;
  }
  return (
    LOCAL_PATH_SHAPE.test(value) ||
    SEPARATED_TOKEN.test(value) ||
    value.startsWith('@') ||
    FILE_EXTENSION.test(value)
  );
}

/**
 * Tools whose `query` is free search text sent to a remote provider. Core's
 * `WebSearchSchema` (src/agents/tools/web-search.ts, identical at v2026.9.33
 * and v2026.9.34) takes `query`, `count`, `country`, `language`,
 * `freshness`, `date_after`, `date_before`, `search_lang`, `ui_lang`,
 * `domain_filter` and `max_tokens`: text, numbers and a domain list, no file
 * or path input, and the tool never reads the gateway's disk. Only `query` is
 * exempt from the local-file check; every other key still goes through it.
 */
const QUERY_ONLY_TOOLS: ReadonlySet<string> = new Set(['web_search']);

/**
 * Whether any string in a call's params, at any depth, could name a file on
 * the gateway's disk. Tool-agnostic so a media field under any name or alias,
 * in any tool, fails closed; a false positive costs one retry without it.
 */
export function paramsReferenceLocalFile(params: unknown): boolean {
  const visit = (
    node: unknown,
    key: string | undefined,
    depth: number
  ): boolean => {
    // Fail closed past the depth cap.
    if (depth > MAX_PARAM_DEPTH) return true;
    if (typeof node === 'string') return looksLikeLocalFile(node, key);
    if (Array.isArray(node)) {
      return node.some((item) => visit(item, key, depth + 1));
    }
    if (node && typeof node === 'object') {
      return Object.entries(node).some(([childKey, child]) =>
        visit(child, childKey, depth + 1)
      );
    }
    return false;
  };
  return visit(params, undefined, 0);
}

// The only `message` params a non-owner may send: text send/reply/edit/
// delete, reactions, read pagination, and remote media on a send (core
// 2026.9.33 message schema plus the `to`/`messageThreadId`/`topLevel` routing
// and `SendMessage` body aliases core reads). Everything else (path and
// structured attachments, buffers, filenames, presentation, polls, gateway
// options, account switching) is owner-only.
const MESSAGE_BODY_KEYS = [
  'message',
  'text',
  'content',
  'caption',
  'SendMessage',
] as const;
// The URL-typed media keys core's send reads (message-action-params.ts);
// `path`, `filePath`, `fileUrl`, `image`, `attachments`, and `buffer` stay
// owner-only. Core hydrates media itself on `reply` and other plugin actions,
// and Tlon only sends media on `send`.
const REMOTE_MEDIA_KEYS: ReadonlySet<string> = new Set([
  'media',
  'mediaUrl',
  'mediaUrls',
]);
export const NON_OWNER_MESSAGE_KEYS: ReadonlySet<string> = new Set([
  'action',
  'channel',
  'target',
  'targets',
  'to',
  'channelId',
  'chatId',
  'threadId',
  'messageThreadId',
  'topLevel',
  'replyTo',
  'messageId',
  'message_id',
  'parentId',
  ...MESSAGE_BODY_KEYS,
  'emoji',
  'remove',
  'targetAuthor',
  'targetAuthorUuid',
  'limit',
  'pageSize',
  'pageToken',
  'before',
  'after',
  'around',
  'fromMe',
  'includeArchived',
  'trackToolCalls',
  'track_tool_calls',
  // Delivery controls core tells the model to send on text and react flows.
  'final',
  'silent',
]);

// `message` params that carry or shape an attachment, from core 2026.9.33:
// the message schema (src/agents/tools/message-tool-schema.ts: media,
// filename, buffer, contentType, mimeType, attachments, voice-note and
// document flags, sticker and event-cover inputs) and the attachment sources
// and send flags read by src/infra/outbound/message-action-send.ts
// (media/mediaUrl/path/filePath/fileUrl/image, mediaUrls, audioAsVoice,
// asVideoNote) and message-action-params.ts. Core's param readers also accept
// each camelCase key's snake_case spelling (readSnakeCaseParamRaw), so both
// are listed. A body's `MEDIA:` directives are judged by core's own parser in
// the before_tool_call hook (core-message-media.ts), the single authority
// there. The REMOTE_MEDIA_KEYS among them are judged by the non-owner media
// rule instead; their snake_case spellings stay blocked.
const MESSAGE_MEDIA_CAMEL_KEYS = [
  'attachments',
  'media',
  'mediaUrl',
  'mediaUrls',
  'filePath',
  'fileUrl',
  'path',
  'file',
  'buffer',
  'filename',
  'mimeType',
  'contentType',
  'asVoice',
  'audioAsVoice',
  'asVideoNote',
  'voiceText',
  'voiceProvider',
  'voiceId',
  'gifPlayback',
  'forceDocument',
  'asDocument',
  'image',
  'fileId',
  'stickerId',
] as const;
const MESSAGE_MEDIA_KEYS: ReadonlySet<string> = new Set(
  MESSAGE_MEDIA_CAMEL_KEYS.flatMap((key) => [
    key,
    key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
  ])
);

function isScalar(value: unknown): boolean {
  return (
    value === null ||
    ['string', 'number', 'boolean', 'undefined'].includes(typeof value)
  );
}

/** The values under a `message` call's URL media keys. */
export function messageMediaKeyRefs(
  params: Record<string, unknown> | undefined
): unknown[] {
  return Object.entries(params ?? {})
    .filter(([key, value]) => REMOTE_MEDIA_KEYS.has(key) && value !== undefined)
    .flatMap(([, value]) => (Array.isArray(value) ? value : [value]));
}

function remoteMediaAllowed(
  params: Record<string, unknown>,
  cfg: OpenClawConfig | undefined
): boolean {
  if (params.action !== undefined && params.action !== 'send') return false;
  // How many is the hook's call: it counts what core would fetch.
  return messageMediaKeyRefs(params).every(
    (ref) => typeof ref === 'string' && isNonOwnerMediaAllowed(ref, { cfg })
  );
}

/**
 * Why a non-owner `message` call's arguments are owner-only, if they are.
 * Media a non-owner may not send (a remote media key failing the rule, any
 * other media key, or a non-scalar value under an allowed key) gets the media
 * reason (it wins over any other key); any other key outside the allowlist
 * gets a reason naming it. The body is checked separately against what core
 * would resolve from it (core-message-media.ts).
 */
function messageArgumentsReason(
  params: Record<string, unknown> | undefined,
  cfg: OpenClawConfig | undefined
): string | undefined {
  const entries = Object.entries(params ?? {});
  const carriesMedia = entries.some(([key, value]) => {
    if (REMOTE_MEDIA_KEYS.has(key)) {
      return !remoteMediaAllowed(params ?? {}, cfg);
    }
    if (!NON_OWNER_MESSAGE_KEYS.has(key)) return MESSAGE_MEDIA_KEYS.has(key);
    if (key === 'targets' && Array.isArray(value)) {
      return !value.every((item) => typeof item === 'string');
    }
    return !isScalar(value);
  });
  if (carriesMedia) return MESSAGE_MEDIA_BLOCK_REASON;
  const option = entries.find(
    ([key]) => !NON_OWNER_MESSAGE_KEYS.has(key) && !REMOTE_MEDIA_KEYS.has(key)
  );
  return option ? formatMessageOptionBlockReason(option[0]) : undefined;
}

// `session_status` reads (`sessionKey`) and patches (`model`) any visible
// session; only the current session's plain status stays open.
const OPEN_SESSION_STATUS_KEYS = new Set(['changesSince']);

function sessionStatusLeavesCurrentSession(
  params?: Record<string, unknown>
): boolean {
  return Object.entries(params ?? {}).some(
    ([key, value]) => value !== undefined && !OPEN_SESSION_STATUS_KEYS.has(key)
  );
}

export type OwnerOnlyToolDecision = {
  /** The call is owner-only: an owner-only tool, or owner-only arguments. */
  ownerOnly: boolean;
  /**
   * Which rule made it owner-only (present iff `ownerOnly`): `'tool'` for
   * the tool itself (set membership, the hosted browser, another session's
   * status), `'arguments'` for an otherwise open tool's arguments.
   */
  gate?: 'tool' | 'arguments';
  /** Veto the call: owner-only and the session role is a non-owner user. */
  blocked: boolean;
  /** Model-facing reason; present iff `blocked`. */
  reason?: string;
};

type OwnerOnlyRule = { reason: string; gate: 'tool' | 'arguments' };

function toolRuleReason(
  toolName: string,
  params?: Record<string, unknown>
): string | undefined {
  if (OWNER_ONLY_TOOLS.has(toolName)) {
    if ((DELEGATION_TOOL_NAMES as readonly string[]).includes(toolName)) {
      return formatOwnerOnlyDelegationBlockReason(toolName);
    }
    if ((SESSION_ACCESS_TOOL_NAMES as readonly string[]).includes(toolName)) {
      return SESSION_ACCESS_BLOCK_REASON;
    }
  }
  // The hosted browser shares the owner's sessions and saved accounts.
  // Protect all browser operations, including reading an authenticated page.
  if (
    toolName === 'mcp__call' &&
    typeof params?.name === 'string' &&
    params.name.startsWith('browser_')
  ) {
    return formatOwnerOnlyToolBlockReason('browser');
  }
  if (OWNER_ONLY_TOOLS.has(toolName)) {
    return formatOwnerOnlyToolBlockReason(toolName);
  }
  if (
    toolName === 'session_status' &&
    sessionStatusLeavesCurrentSession(params)
  ) {
    return SESSION_ACCESS_BLOCK_REASON;
  }
  return undefined;
}

function argumentRuleReason(
  toolName: string,
  params: Record<string, unknown> | undefined,
  cfg: OpenClawConfig | undefined
): string | undefined {
  if (toolName === 'message') {
    const messageReason = messageArgumentsReason(params, cfg);
    if (messageReason) return messageReason;
    // Addressing and pagination values still get the local-file check; the
    // body is free text and media keys passed the rule above.
    const addressing = Object.entries(params ?? {}).filter(
      ([key]) =>
        !(MESSAGE_BODY_KEYS as readonly string[]).includes(key) &&
        !REMOTE_MEDIA_KEYS.has(key)
    );
    return paramsReferenceLocalFile(Object.fromEntries(addressing))
      ? LOCAL_FILE_BLOCK_REASON
      : undefined;
  }
  // Argument-gated for every other tool: no local file references, except
  // in a search tool's free-text query.
  const checked = QUERY_ONLY_TOOLS.has(toolName)
    ? Object.fromEntries(
        Object.entries(params ?? {}).filter(([key]) => key !== 'query')
      )
    : params;
  return paramsReferenceLocalFile(checked)
    ? LOCAL_FILE_BLOCK_REASON
    : undefined;
}

function ownerOnlyRule(
  toolName: string,
  params: Record<string, unknown> | undefined,
  cfg: OpenClawConfig | undefined
): OwnerOnlyRule | undefined {
  const toolReason = toolRuleReason(toolName, params);
  if (toolReason) return { reason: toolReason, gate: 'tool' };
  const argumentReason = argumentRuleReason(toolName, params, cfg);
  return argumentReason
    ? { reason: argumentReason, gate: 'arguments' }
    : undefined;
}

/**
 * `cfg` is the live config, which the non-owner media rule reads for the
 * ship hosts; without it a non-owner `message` call's media is blocked.
 */
export function resolveOwnerOnlyToolBlock(
  toolName: string,
  role: SenderRole | undefined,
  params?: Record<string, unknown>,
  cfg?: OpenClawConfig
): OwnerOnlyToolDecision {
  const rule = ownerOnlyRule(toolName, params, cfg);
  if (!rule) return { ownerOnly: false, blocked: false };
  // Only an explicit non-owner ('user') role blocks. Owner sessions and
  // internal sessions (heartbeat, cron, subagents — no stored role) pass;
  // a passing `tlon` call still runs as the bot unless the turn is
  // owner-directed (turn-identity.ts).
  const blocked = role === 'user';
  return blocked
    ? { ownerOnly: true, gate: rule.gate, blocked, reason: rule.reason }
    : { ownerOnly: true, gate: rule.gate, blocked };
}
