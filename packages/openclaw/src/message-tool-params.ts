const POLL_PARAM_PREFIX = /^poll_?/i;

/**
 * OpenAI-compatible strict tool calling can materialize defaults for every
 * property in OpenClaw's shared message schema. In particular,
 * `pollDurationHours: 1` makes a normal send look like an accidental poll to
 * core's pre-dispatch guard. Poll creation is a distinct `action="poll"`, so
 * poll-prefixed fields are never meaningful on a Tlon send and are safe to
 * neutralize before core validates the action.
 *
 * OpenClaw applies hook results as shallow overrides (`{ ...original,
 * ...override }`). Assigning `undefined` is therefore intentional: omitting or
 * deleting a key from this returned object would leave the original default in
 * place after that merge.
 */
export function sanitizeTlonMessageSendParams(
  toolName: string,
  params: Record<string, unknown>,
  currentChannelId?: string
): Record<string, unknown> {
  const explicitChannel =
    typeof params.channel === 'string' && params.channel.trim()
      ? params.channel.trim().toLowerCase()
      : undefined;
  const resolvedChannel =
    explicitChannel ?? currentChannelId?.trim().toLowerCase();
  if (
    toolName !== 'message' ||
    params.action !== 'send' ||
    resolvedChannel !== 'tlon'
  ) {
    return params;
  }

  const pollKeys = Object.keys(params).filter((key) =>
    POLL_PARAM_PREFIX.test(key)
  );
  if (pollKeys.length === 0) {
    return params;
  }

  const sanitized = { ...params };
  for (const key of pollKeys) {
    sanitized[key] = undefined;
  }
  return sanitized;
}
