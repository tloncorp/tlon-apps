// Bot-author flags shared by `posts send|reply` and `dms send|reply`.
//
// A message whose author is an object (`{ship, nickname, avatar}`) rather than a
// bare ship string is what makes clients render the "Bot" tag, so these flags
// are strictly opt-in: the CLI is also driven by humans, whose posts must keep
// their bare-ship author.
export const BOT_PROFILE_OPTION_FLAGS = [
  'bot',
  'bot-nickname',
  'bot-avatar',
] as const;

const BOT_PROFILE_VALUE_FLAGS = ['bot-nickname', 'bot-avatar'] as const;

export interface BotAuthorProfile {
  nickname: string | null;
  avatar: string | null;
}

export type ParsedBotProfileFlags =
  | { ok: true; botProfile?: BotAuthorProfile }
  | { ok: false };

// Value flags take `--flag <value>` or `--flag=<value>`, matching `--image` and
// the global credential flags.
function valueFlagIndex(args: string[], flag: string): number {
  const token = `--${flag}`;
  return args.findIndex((arg) => arg === token || arg.startsWith(`${token}=`));
}

// Index of the first bot flag in any accepted form, or -1. Callers fold this
// into their message-boundary scan so a flag never lands in the message text.
export function botProfileFlagIndex(args: string[]): number {
  const indexes = [
    args.indexOf('--bot'),
    ...BOT_PROFILE_VALUE_FLAGS.map((flag) => valueFlagIndex(args, flag)),
  ].filter((idx) => idx !== -1);
  return indexes.length > 0 ? Math.min(...indexes) : -1;
}

// Value of a flag known to be present at `idx`, or undefined when malformed.
// The inline form carries its value verbatim — that is how an option-looking
// value (`--bot-nickname=--weird`) reaches the API intact; the separated form
// cannot represent one, so a `--`-prefixed token there is a usage error.
function valueFlagValue(args: string[], idx: number): string | undefined {
  const arg = args[idx];
  const separator = arg.indexOf('=');
  if (separator !== -1) {
    return arg.slice(separator + 1) || undefined;
  }
  const value = args[idx + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

// `--bot` authors as a bot with no profile; `--bot-nickname`/`--bot-avatar` each
// imply `--bot`. A value-carrying flag with a missing or malformed value is a
// usage error — callers map `{ok: false}` onto their own error idiom.
export function parseBotProfileFlags(args: string[]): ParsedBotProfileFlags {
  // `--bot` takes no value, so `--bot=…` is a mistyped flag rather than message
  // text; refusing it beats silently posting it as content.
  if (args.some((arg) => arg.startsWith('--bot='))) {
    return { ok: false };
  }

  const nicknameIdx = valueFlagIndex(args, 'bot-nickname');
  const avatarIdx = valueFlagIndex(args, 'bot-avatar');
  if (!args.includes('--bot') && nicknameIdx === -1 && avatarIdx === -1) {
    return { ok: true };
  }

  const nickname =
    nicknameIdx === -1 ? null : valueFlagValue(args, nicknameIdx);
  const avatar = avatarIdx === -1 ? null : valueFlagValue(args, avatarIdx);
  if (
    (nicknameIdx !== -1 && nickname === undefined) ||
    (avatarIdx !== -1 && avatar === undefined)
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    botProfile: { nickname: nickname ?? null, avatar: avatar ?? null },
  };
}
