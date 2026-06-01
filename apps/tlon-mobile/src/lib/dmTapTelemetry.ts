import { preSig } from '@tloncorp/api/lib/urbit';
import { getIdParts } from '@tloncorp/api/urbit';
import type { Notification } from 'expo-notifications';
import { Platform } from 'react-native';

export type DmTapTelemetry = {
  ownerShip: string;
  senderShip: string;
  messageId: string;
  messageSentAtMs: number;
  notificationUid: string | null;
  tappedAtMs: number;
  delayMs: number;
  withinAttributionWindow: boolean;
  attributionSource: 'notification_tap';
  channel: 'tlon';
  platform: 'ios' | 'android';
};

export const DM_TAP_SKEW_TOLERANCE_MS = 5 * 60 * 1000;
export const DM_TAP_WINDOW_MS = 6 * 60 * 60 * 1000;

export type SafeActivityParseResult =
  | { ok: true; event: Record<string, unknown> }
  | { ok: false; error: 'missing' | 'malformed' };

function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function pickPlatformPayload(notification: Notification): unknown {
  if (Platform.OS === 'android') {
    return notification.request.content.data;
  }
  const { content, trigger } = notification.request;
  const isPush = trigger && 'type' in trigger && trigger.type === 'push';
  return isPush ? (trigger as { payload?: unknown }).payload : content.data;
}

export function readRawPayload(
  notification: Notification
): Record<string, unknown> {
  const raw = pickPlatformPayload(notification);
  if (!isNonNullObject(raw)) {
    return {};
  }
  return raw;
}

export function safeParseActivityEvent(
  rawPayload: Record<string, unknown>
): SafeActivityParseResult {
  const raw = rawPayload.activityEventJsonString;
  if (typeof raw !== 'string') {
    return { ok: false, error: 'missing' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'malformed' };
  }
  if (!isNonNullObject(parsed)) {
    return { ok: false, error: 'malformed' };
  }
  const event = (parsed as { event?: unknown }).event;
  if (!isNonNullObject(event)) {
    return { ok: false, error: 'malformed' };
  }
  return { ok: true, event };
}

export function extractDmTapTelemetry(
  parsed: SafeActivityParseResult,
  rawPayload: Record<string, unknown>,
  currentUserId: string,
  nowMs?: number
): DmTapTelemetry | null {
  if (!parsed.ok) return null;
  const ev = parsed.event;
  const dmPost = ev['dm-post'];
  if (!isNonNullObject(dmPost)) return null;
  const key = (dmPost as { key?: unknown }).key;
  if (!isNonNullObject(key)) return null;
  const id = (key as { id?: unknown }).id;
  if (typeof id !== 'string' || id.length === 0) return null;

  let parts: { author: string; sent: number };
  try {
    parts = getIdParts(id);
  } catch {
    return null;
  }
  if (typeof parts.author !== 'string' || parts.author.length === 0) {
    return null;
  }
  if (!Number.isFinite(parts.sent)) {
    return null;
  }

  const messageSentAtMs = parts.sent;
  const senderShip = preSig(parts.author);
  const messageId = id;

  const uidRaw = rawPayload.uid;
  const notificationUid = typeof uidRaw === 'string' ? uidRaw : null;

  const tappedAtMs = nowMs ?? Date.now();
  const delayMs = tappedAtMs - messageSentAtMs;
  const withinAttributionWindow =
    delayMs >= -DM_TAP_SKEW_TOLERANCE_MS && delayMs <= DM_TAP_WINDOW_MS;

  const platform = (Platform.OS === 'android' ? 'android' : 'ios') as
    | 'ios'
    | 'android';

  return {
    ownerShip: currentUserId,
    senderShip,
    messageId,
    messageSentAtMs,
    notificationUid,
    tappedAtMs,
    delayMs,
    withinAttributionWindow,
    attributionSource: 'notification_tap',
    channel: 'tlon',
    platform,
  };
}
