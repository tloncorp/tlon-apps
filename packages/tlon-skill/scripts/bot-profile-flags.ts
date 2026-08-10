// The `--bot` author flag shared by `posts send|reply` and `dms send|reply`.
//
// A message whose author is an object (`{ship, nickname, avatar}`) rather than a
// bare ship string is what makes clients render the "Bot" tag, so the flag is
// strictly opt-in: the CLI is also driven by humans, whose posts must keep
// their bare-ship author. The nickname/avatar fields ride along as nulls —
// recipients resolve bot display names through contact sync, so the CLI does
// not accept per-message profile values.
export const BOT_PROFILE_OPTION_FLAGS = ['bot'] as const;

export interface BotAuthorProfile {
  nickname: string | null;
  avatar: string | null;
}

export type ParsedBotProfileFlags =
  | { ok: true; botProfile?: BotAuthorProfile }
  | { ok: false };

// Index of the bot flag, or -1. Callers fold this into their message-boundary
// scan so the flag never lands in the message text.
export function botProfileFlagIndex(args: string[]): number {
  return args.indexOf('--bot');
}

// `--bot` authors as a bot with a null profile. A usage error is returned for
// `--bot=…` — the flag takes no value, so that is a mistyped flag rather than
// message text, and refusing it beats silently posting it as content.
export function parseBotProfileFlags(args: string[]): ParsedBotProfileFlags {
  if (args.some((arg) => arg.startsWith('--bot='))) {
    return { ok: false };
  }
  if (!args.includes('--bot')) {
    return { ok: true };
  }
  return { ok: true, botProfile: { nickname: null, avatar: null } };
}
