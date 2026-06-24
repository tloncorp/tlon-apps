import {
  clearConversationPresence,
  setConversationPresence,
} from '@tloncorp/api';
import { dr, render } from '@urbit/aura';
import * as openclawSdk from 'openclaw/plugin-sdk';
import {
  type DiagnosticEventPayload,
  type RuntimeEnv,
  onDiagnosticEvent,
} from 'openclaw/plugin-sdk';

import { canonicalizeNest, normalizeShip } from '../targets.js';
import { describeError } from '../urbit/errors.js';
import {
  type BotProfile,
  sendChannelPost as defaultSendChannelPost,
  sendDm as defaultSendDm,
} from '../urbit/send.js';
import { markdownToStory } from '../urbit/story.js';

const STALLED_PRESENCE_TIMEOUT_SECS = 5 * 60;
const STALLED_PRESENCE_TIMEOUT = render(
  'dr',
  dr.fromSeconds(BigInt(STALLED_PRESENCE_TIMEOUT_SECS))
);
const DEFAULT_MESSAGE_COOLDOWN_MS = 10 * 60_000;
const INTERRUPT_COMMANDS = ['/stop', 'stop', 'abort', 'interrupt'] as const;

export type TlonStalledSessionTarget =
  | {
      kind: 'dm';
      agentId?: string;
      accountId?: string;
      conversationId: string;
      sessionKey: string;
      ship: string;
      threadId?: string;
    }
  | {
      kind: 'channel';
      agentId?: string;
      accountId?: string;
      conversationId: string;
      sessionKey: string;
      nest: string;
      threadId?: string;
    };

export type TlonStalledSessionDiagnostic = {
  type?: string;
  sessionId?: string;
  sessionKey: string;
  state?: string;
  ageMs?: number;
  queueDepth?: number;
  reason?: string;
  classification?: string;
  activeWorkKind?: string;
  lastProgress?: string;
  lastProgressAgeMs?: number;
  recovery?: string;
};

export type TlonStalledSessionPresenceReporter = {
  publish: (params: {
    conversationId: string;
    diagnostic: TlonStalledSessionDiagnostic;
  }) => Promise<void>;
  clear: (params: { conversationId: string }) => Promise<void>;
};

export type TlonStalledSessionState = {
  conversationBySessionKey: Map<string, string>;
  messageSentAtBySessionKey: Map<string, number>;
};

type SendDm = typeof defaultSendDm;
type SendChannelPost = typeof defaultSendChannelPost;
type LogTransportRecord = Record<string, unknown>;
type LogTransport = (record: LogTransportRecord) => void;
type OptionalLogTransportSdk = {
  registerLogTransport?: (transport: LogTransport) => () => void;
};

type StalledSessionRuntimeDeps = {
  accountId?: string;
  botShipName: string;
  getBotProfile?: () => BotProfile | undefined;
  runtime?: RuntimeEnv;
  presenceReporter?: TlonStalledSessionPresenceReporter;
  sendDm?: SendDm;
  sendChannelPost?: SendChannelPost;
  notifyByMessage?: boolean;
  messageCooldownMs?: number;
  now?: () => number;
  state?: TlonStalledSessionState;
};

export function createTlonStalledSessionState(): TlonStalledSessionState {
  return {
    conversationBySessionKey: new Map(),
    messageSentAtBySessionKey: new Map(),
  };
}

export function createTlonStalledSessionPresenceReporter(): TlonStalledSessionPresenceReporter {
  return {
    publish: async ({ conversationId, diagnostic }) => {
      await setConversationPresence({
        conversationId,
        topic: 'computing',
        disclose: [],
        timeout: STALLED_PRESENCE_TIMEOUT,
        display: {
          text: formatTlonStalledPresenceText(diagnostic),
          blob: JSON.stringify(buildPresenceBlob(diagnostic)),
        },
      });
    },
    clear: async ({ conversationId }) => {
      await clearConversationPresence({
        conversationId,
        topic: 'computing',
      });
    },
  };
}

export function formatTlonStalledPresenceText(
  diagnostic: Pick<TlonStalledSessionDiagnostic, 'ageMs'>
): string {
  const age = formatDuration(diagnostic.ageMs);
  return age
    ? `OpenClaw stalled ${age} - send /stop`
    : 'OpenClaw stalled - send /stop';
}

export function formatTlonStalledPromptText(
  diagnostic: TlonStalledSessionDiagnostic
): string {
  const details: string[] = [];
  if (diagnostic.reason) {
    details.push(`reason=${diagnostic.reason}`);
  }
  if (diagnostic.lastProgress) {
    details.push(`last=${diagnostic.lastProgress}`);
  }
  if (diagnostic.lastProgressAgeMs !== undefined) {
    details.push(
      `lastProgressAge=${formatDuration(diagnostic.lastProgressAgeMs)}`
    );
  }
  if (diagnostic.queueDepth !== undefined) {
    details.push(`queue=${diagnostic.queueDepth}`);
  }

  const base =
    'This OpenClaw run appears stalled. Send `/stop` to interrupt it; ' +
    '`stop`, `abort`, or `interrupt` also work.';
  return details.length > 0 ? `${base}\n\n${details.join('; ')}` : base;
}

export function resolveTlonStalledSessionTarget(
  sessionKey: string | undefined | null
): TlonStalledSessionTarget | null {
  const raw = sessionKey?.trim();
  if (!raw) {
    return null;
  }

  const { baseSessionKey, threadId } = splitThreadSuffix(raw);
  const parts = baseSessionKey.split(':');
  let agentId: string | undefined;
  let offset = 0;
  if (parts[0]?.toLowerCase() === 'agent') {
    if (parts.length < 4) {
      return null;
    }
    agentId = parts[1]?.trim() || undefined;
    if (parts[2]?.toLowerCase() !== 'tlon') {
      return null;
    }
    offset = 3;
  } else if (parts[0]?.toLowerCase() === 'tlon') {
    offset = 1;
  } else {
    return null;
  }

  const rest = parts.slice(offset);
  if (rest.length < 2) {
    return null;
  }

  const first = rest[0]?.toLowerCase();
  const second = rest[1]?.toLowerCase();
  if (isDirectKind(first)) {
    return buildDirectTarget({
      agentId,
      rawShip: rest.slice(1).join(':'),
      sessionKey: raw,
      threadId,
    });
  }
  if (rest.length >= 3 && isDirectKind(second)) {
    return buildDirectTarget({
      accountId: rest[0],
      agentId,
      rawShip: rest.slice(2).join(':'),
      sessionKey: raw,
      threadId,
    });
  }
  if (isChannelKind(first)) {
    return buildChannelTarget({
      agentId,
      rawNest: rest.slice(1).join(':'),
      sessionKey: raw,
      threadId,
    });
  }
  if (rest.length >= 3 && isChannelKind(second)) {
    return buildChannelTarget({
      accountId: rest[0],
      agentId,
      rawNest: rest.slice(2).join(':'),
      sessionKey: raw,
      threadId,
    });
  }

  return null;
}

export function extractTlonStalledSessionDiagnostic(
  event: DiagnosticEventPayload | Record<string, unknown>
): TlonStalledSessionDiagnostic | null {
  const record = asRecord(event);
  if (!record) {
    return null;
  }
  if (!isOpenClawStalledRecord(record)) {
    return null;
  }
  return diagnosticFromRecord(record);
}

export function extractOpenClawIdleSessionKey(
  event: DiagnosticEventPayload | Record<string, unknown>
): string | null {
  const record = asRecord(event);
  if (!record) {
    return null;
  }
  const type = readString(record, 'type')?.toLowerCase();
  const state = readString(record, 'state')?.toLowerCase();
  if (type !== 'session.state' || state !== 'idle') {
    return null;
  }
  return readString(record, 'sessionKey') ?? null;
}

export function parseOpenClawStalledSessionLog(
  input: string | LogTransportRecord
): TlonStalledSessionDiagnostic | null {
  const text =
    typeof input === 'string' ? input : flattenLogTransportRecord(input);
  if (!/(?:stalled|stuck) session:/i.test(text)) {
    return null;
  }
  const fields = parseKeyValueFields(text);
  const sessionKey = normalizeLogField(fields.sessionKey);
  if (!sessionKey) {
    return null;
  }
  const stalled = /stalled session:/i.test(text);
  return {
    type: stalled ? 'session.stalled' : 'session.stuck',
    sessionId: normalizeLogField(fields.sessionId),
    sessionKey,
    state: normalizeLogField(fields.state),
    ageMs: parseDurationMs(fields.ageMs) ?? parseDurationMs(fields.age),
    queueDepth: parseInteger(fields.queueDepth),
    reason: normalizeLogField(fields.reason),
    classification:
      normalizeLogField(fields.classification) ??
      (stalled ? 'stalled_agent_run' : undefined),
    activeWorkKind: normalizeLogField(fields.activeWorkKind),
    lastProgress: normalizeLogField(fields.lastProgress),
    lastProgressAgeMs:
      parseDurationMs(fields.lastProgressAgeMs) ??
      parseDurationMs(fields.lastProgressAge),
    recovery: normalizeLogField(fields.recovery),
  };
}

export function parseOpenClawIdleSessionLog(
  input: string | LogTransportRecord
): string | null {
  const text =
    typeof input === 'string' ? input : flattenLogTransportRecord(input);
  if (!/session state:/i.test(text)) {
    return null;
  }
  const fields = parseKeyValueFields(text);
  const state = normalizeLogField(fields.state)?.toLowerCase();
  if (state !== 'idle') {
    return null;
  }
  return normalizeLogField(fields.sessionKey) ?? null;
}

export async function handleTlonStalledSessionDiagnostic(
  params: StalledSessionRuntimeDeps & {
    diagnostic: TlonStalledSessionDiagnostic;
  }
): Promise<boolean> {
  const target = resolveTlonStalledSessionTarget(params.diagnostic.sessionKey);
  if (!target) {
    return false;
  }
  if (!targetMatchesAccount(target, params.accountId)) {
    return false;
  }

  const state = params.state ?? createTlonStalledSessionState();
  const presenceReporter =
    params.presenceReporter ?? createTlonStalledSessionPresenceReporter();
  state.conversationBySessionKey.set(
    params.diagnostic.sessionKey,
    target.conversationId
  );

  await safely(params.runtime, 'publish stalled session presence', async () => {
    await presenceReporter.publish({
      conversationId: target.conversationId,
      diagnostic: params.diagnostic,
    });
  });

  if (params.notifyByMessage !== false) {
    await maybeSendStalledPrompt({
      ...params,
      state,
      target,
    });
  }

  return true;
}

export async function clearTlonStalledSessionPresence(
  params: StalledSessionRuntimeDeps & {
    sessionKey: string;
  }
): Promise<boolean> {
  const state = params.state ?? createTlonStalledSessionState();
  const target = resolveTlonStalledSessionTarget(params.sessionKey);
  const conversationId =
    state.conversationBySessionKey.get(params.sessionKey) ??
    (targetMatchesAccount(target, params.accountId)
      ? target?.conversationId
      : undefined);
  if (!conversationId) {
    return false;
  }

  const presenceReporter =
    params.presenceReporter ?? createTlonStalledSessionPresenceReporter();
  await safely(params.runtime, 'clear stalled session presence', async () => {
    await presenceReporter.clear({ conversationId });
  });
  state.conversationBySessionKey.delete(params.sessionKey);
  state.messageSentAtBySessionKey.delete(params.sessionKey);
  return true;
}

export function installTlonStalledSessionPresence(
  params: StalledSessionRuntimeDeps & {
    abortSignal?: AbortSignal;
  }
): () => void {
  const state = params.state ?? createTlonStalledSessionState();
  const runtimeParams = { ...params, state };
  let disposed = false;

  const handleStalledDiagnostic = (
    diagnostic: TlonStalledSessionDiagnostic
  ) => {
    if (disposed) {
      return;
    }
    void handleTlonStalledSessionDiagnostic({
      ...runtimeParams,
      diagnostic,
    });
  };
  const handleIdleSessionKey = (sessionKey: string | null) => {
    if (disposed || !sessionKey) {
      return;
    }
    void clearTlonStalledSessionPresence({
      ...runtimeParams,
      sessionKey,
    });
  };

  const stopDiagnostics = onDiagnosticEvent(
    (event: DiagnosticEventPayload | Record<string, unknown>) => {
      const stalled = extractTlonStalledSessionDiagnostic(event);
      if (stalled) {
        handleStalledDiagnostic(stalled);
        return;
      }
      handleIdleSessionKey(extractOpenClawIdleSessionKey(event));
    }
  );
  const stopLogTransport = registerOptionalLogTransport(
    (record: LogTransportRecord) => {
      const stalled = parseOpenClawStalledSessionLog(record);
      if (stalled) {
        handleStalledDiagnostic(stalled);
        return;
      }
      handleIdleSessionKey(parseOpenClawIdleSessionLog(record));
    }
  );

  const cleanup = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    stopDiagnostics();
    stopLogTransport();
    params.abortSignal?.removeEventListener('abort', cleanup);
  };

  if (params.abortSignal?.aborted) {
    cleanup();
  } else {
    params.abortSignal?.addEventListener('abort', cleanup, { once: true });
  }
  return cleanup;
}

function registerOptionalLogTransport(transport: LogTransport): () => void {
  const register = (openclawSdk as OptionalLogTransportSdk)
    .registerLogTransport;
  return typeof register === 'function' ? register(transport) : () => {};
}

async function maybeSendStalledPrompt(
  params: StalledSessionRuntimeDeps & {
    diagnostic: TlonStalledSessionDiagnostic;
    state: TlonStalledSessionState;
    target: TlonStalledSessionTarget;
  }
): Promise<void> {
  const cooldownMs = Math.max(
    0,
    params.messageCooldownMs ?? DEFAULT_MESSAGE_COOLDOWN_MS
  );
  const now = params.now?.() ?? Date.now();
  const lastSentAt =
    params.state.messageSentAtBySessionKey.get(params.diagnostic.sessionKey) ??
    0;
  if (lastSentAt > 0 && now - lastSentAt < cooldownMs) {
    return;
  }
  params.state.messageSentAtBySessionKey.set(params.diagnostic.sessionKey, now);

  const text = formatTlonStalledPromptText(params.diagnostic);
  const botProfile = params.getBotProfile?.();
  const sendDm = params.sendDm ?? defaultSendDm;
  const sendChannelPost = params.sendChannelPost ?? defaultSendChannelPost;

  await safely(params.runtime, 'send stalled session prompt', async () => {
    if (params.target.kind === 'dm') {
      await sendDm({
        botProfile,
        fromShip: params.botShipName,
        replyToId: params.target.threadId,
        text,
        toShip: params.target.ship,
      });
      return;
    }

    await sendChannelPost({
      botProfile,
      fromShip: params.botShipName,
      nest: params.target.nest,
      replyToId: params.target.threadId,
      story: markdownToStory(text),
    });
  });
}

function buildPresenceBlob(diagnostic: TlonStalledSessionDiagnostic) {
  return compactObject({
    thinking: true,
    stalled: true,
    prompt: 'Send /stop to interrupt this run.',
    suggestedCommand: '/stop',
    interruptCommands: [...INTERRUPT_COMMANDS],
    sessionId: diagnostic.sessionId,
    sessionKey: diagnostic.sessionKey,
    state: diagnostic.state,
    ageMs: diagnostic.ageMs,
    queueDepth: diagnostic.queueDepth,
    reason: diagnostic.reason,
    classification: diagnostic.classification,
    activeWorkKind: diagnostic.activeWorkKind,
    lastProgress: diagnostic.lastProgress,
    lastProgressAgeMs: diagnostic.lastProgressAgeMs,
    recovery: diagnostic.recovery,
  });
}

function diagnosticFromRecord(
  record: Record<string, unknown>
): TlonStalledSessionDiagnostic | null {
  const sessionKey = readString(record, 'sessionKey');
  if (!sessionKey) {
    return null;
  }
  return {
    type: readString(record, 'type'),
    sessionId: readString(record, 'sessionId'),
    sessionKey,
    state: readString(record, 'state'),
    ageMs:
      readNumber(record, 'ageMs') ?? parseDurationMs(readString(record, 'age')),
    queueDepth: readNumber(record, 'queueDepth'),
    reason: readString(record, 'reason'),
    classification: readString(record, 'classification'),
    activeWorkKind: readString(record, 'activeWorkKind'),
    lastProgress: readString(record, 'lastProgress'),
    lastProgressAgeMs:
      readNumber(record, 'lastProgressAgeMs') ??
      parseDurationMs(readString(record, 'lastProgressAge')),
    recovery: readString(record, 'recovery'),
  };
}

function isOpenClawStalledRecord(record: Record<string, unknown>): boolean {
  const type = readString(record, 'type')?.toLowerCase();
  const classification = readString(record, 'classification')?.toLowerCase();
  if (classification === 'stalled_agent_run') {
    return true;
  }
  if (type === 'session.stalled' || type === 'session.stuck') {
    return true;
  }
  return Boolean(type?.includes('session') && type.includes('stall'));
}

function buildDirectTarget(params: {
  accountId?: string;
  agentId?: string;
  rawShip: string;
  sessionKey: string;
  threadId?: string;
}): TlonStalledSessionTarget | null {
  const rawShip = params.rawShip.trim();
  if (!rawShip || rawShip.toLowerCase() === 'unknown') {
    return null;
  }
  const ship = normalizeShip(rawShip);
  return {
    kind: 'dm',
    accountId: params.accountId,
    agentId: params.agentId,
    conversationId: ship,
    sessionKey: params.sessionKey,
    ship,
    threadId: params.threadId,
  };
}

function buildChannelTarget(params: {
  accountId?: string;
  agentId?: string;
  rawNest: string;
  sessionKey: string;
  threadId?: string;
}): TlonStalledSessionTarget | null {
  const nest = canonicalizeStalledNest(params.rawNest);
  if (!nest) {
    return null;
  }
  return {
    kind: 'channel',
    accountId: params.accountId,
    agentId: params.agentId,
    conversationId: nest,
    sessionKey: params.sessionKey,
    nest,
    threadId: params.threadId,
  };
}

function canonicalizeStalledNest(rawNest: string): string | null {
  const trimmed = rawNest.trim();
  if (!trimmed || trimmed.toLowerCase() === 'unknown') {
    return null;
  }
  const canonical = canonicalizeNest(trimmed);
  if (canonical) {
    return canonical;
  }
  const legacyParts = trimmed.split('/');
  if (legacyParts.length === 2) {
    return canonicalizeNest(`chat/${legacyParts[0]}/${legacyParts[1]}`);
  }
  return null;
}

function splitThreadSuffix(sessionKey: string): {
  baseSessionKey: string;
  threadId?: string;
} {
  const normalized = sessionKey.toLowerCase();
  const markers = [':thread:', ':topic:'];
  let markerIndex = -1;
  let marker = '';
  for (const candidate of markers) {
    const index = normalized.lastIndexOf(candidate);
    if (index > markerIndex) {
      markerIndex = index;
      marker = candidate;
    }
  }
  if (markerIndex <= 0) {
    return { baseSessionKey: sessionKey };
  }
  const threadId = sessionKey.slice(markerIndex + marker.length).trim();
  if (!threadId) {
    return { baseSessionKey: sessionKey };
  }
  return {
    baseSessionKey: sessionKey.slice(0, markerIndex),
    threadId,
  };
}

function isDirectKind(value: string | undefined): boolean {
  return value === 'direct' || value === 'dm';
}

function isChannelKind(value: string | undefined): boolean {
  return value === 'group' || value === 'channel';
}

function targetMatchesAccount(
  target: TlonStalledSessionTarget | null,
  accountId: string | undefined
): target is TlonStalledSessionTarget {
  if (!target) {
    return false;
  }
  const targetAccountId = target.accountId?.trim();
  const currentAccountId = accountId?.trim();
  return (
    !targetAccountId ||
    !currentAccountId ||
    targetAccountId === currentAccountId
  );
}

function parseKeyValueFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const pairRe = /([A-Za-z][A-Za-z0-9_]*)=("[^"]*"|'[^']*'|\S+)/g;
  for (const match of text.matchAll(pairRe)) {
    const key = match[1];
    const rawValue = match[2] ?? '';
    fields[key] = stripQuotes(rawValue);
  }
  return fields;
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function normalizeLogField(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.toLowerCase() === 'unknown') {
    return undefined;
  }
  return trimmed;
}

function flattenLogTransportRecord(record: LogTransportRecord): string {
  const parts: string[] = [];
  collectLogStrings(record, parts, new Set());
  return parts.join(' ');
}

function collectLogStrings(
  value: unknown,
  parts: string[],
  seen: Set<object>
): void {
  if (typeof value === 'string') {
    parts.push(value);
    return;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    parts.push(String(value));
    return;
  }
  if (!value || typeof value !== 'object') {
    return;
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);
  if (value instanceof Date) {
    parts.push(value.toISOString());
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectLogStrings(item, parts, seen);
    }
    return;
  }
  for (const item of Object.values(value)) {
    collectLogStrings(item, parts, seen);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function readString(
  record: Record<string, unknown>,
  key: string
): string | undefined {
  const value = record[key];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

function readNumber(
  record: Record<string, unknown>,
  key: string
): number | undefined {
  const value = record[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function parseDurationMs(
  value: string | number | undefined
): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) {
    return undefined;
  }
  const match = /^([0-9]+(?:\.[0-9]+)?)(ms|s|m|h)?$/.exec(trimmed);
  if (!match) {
    return undefined;
  }
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) {
    return undefined;
  }
  switch (match[2]) {
    case 'h':
      return Math.round(amount * 60 * 60 * 1000);
    case 'm':
      return Math.round(amount * 60 * 1000);
    case 's':
      return Math.round(amount * 1000);
    case 'ms':
    case undefined:
      return Math.round(amount);
    default:
      return undefined;
  }
}

function parseInteger(value: string | undefined): number | undefined {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatDuration(ms: number | undefined): string | null {
  if (ms === undefined || !Number.isFinite(ms)) {
    return null;
  }
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function compactObject(
  input: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null && value !== '') {
      out[key] = value;
    }
  }
  return out;
}

async function safely(
  runtime: RuntimeEnv | undefined,
  action: string,
  fn: () => Promise<void>
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    runtime?.error?.(`[tlon] Failed to ${action}: ${describeError(error)}`);
  }
}
