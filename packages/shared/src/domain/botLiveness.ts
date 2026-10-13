import { isBotContact } from './botIdentity';
import { utf8ByteLength } from './slashCommands';

export type BotLivenessState = 'online' | 'offline';
export const BOT_LIVENESS_MAX_RAW_BYTES = 128;

/** Parse a raw `bot-liveness` claim. Returns null for anything not exactly
 *  `{"v":1,"state":"online"|"offline"}` (unknown object fields are ignored). */
export function parseBotLiveness(raw: unknown): BotLivenessState | null {
  if (typeof raw !== 'string') {
    return null;
  }
  if (utf8ByteLength(raw) > BOT_LIVENESS_MAX_RAW_BYTES) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const claim = parsed as Record<string, unknown>;
  if (claim.v !== 1) {
    return null;
  }
  if (claim.state !== 'online' && claim.state !== 'offline') {
    return null;
  }
  return claim.state;
}

/** Liveness for a contact row, or null when it is not a bot or has no valid claim. */
export function botLivenessOf(
  contact:
    | {
        id?: string | null;
        botInfo?: string | null;
        botLiveness?: string | null;
      }
    | null
    | undefined
): BotLivenessState | null {
  if (!contact || !isBotContact({ id: contact.id, botInfo: contact.botInfo })) {
    return null;
  }
  return parseBotLiveness(contact.botLiveness);
}
