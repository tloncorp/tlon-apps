export type TlonTarget =
  | { kind: "dm"; ship: string }
  | { kind: "channel"; nest: string; hostShip: string; channelName: string };

const SHIP_RE = /^~?[a-z-]+$/i;
const NEST_RE = /^(chat|heap|diary)\/([^/]+)\/([^/]+)$/i;

/**
 * Normalize a ship name to canonical form: lowercase with a leading `~`.
 * Urbit @p phonemes are inherently lowercase — different case can only mean
 * the input was wrong, not that it refers to a different ship. Lowercasing
 * here lets every caller compare ships by exact string equality without
 * worrying about case variants in user input or stored values.
 */
export function normalizeShip(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed.startsWith("~") ? trimmed : `~${trimmed}`;
}

export function parseNest(
  raw: string,
): { nestPrefix: string; hostShip: string; channelName: string } | null {
  const match = NEST_RE.exec(raw.trim());
  if (!match) {
    return null;
  }
  return {
    nestPrefix: match[1].toLowerCase(),
    hostShip: normalizeShip(match[2]),
    channelName: match[3],
  };
}

export function parseChannelNest(raw: string): { hostShip: string; channelName: string } | null {
  const result = parseNest(raw);
  if (!result) {
    return null;
  }
  return { hostShip: result.hostShip, channelName: result.channelName };
}

/**
 * Return the canonical form of a channel nest, or null if it doesn't parse.
 * Lowercases the nest prefix and host ship, normalizes the host to "~ship"
 * form, and preserves channel-name case. Use this whenever a nest is about to
 * be stored or compared against runtime nest values, which always arrive
 * canonical (lowercase prefix and host).
 */
export function canonicalizeNest(raw: string): string | null {
  const parsed = parseNest(raw);
  if (!parsed) {
    return null;
  }
  // Urbit @p ship names are inherently lowercase; lowercase the host so a
  // stored override matches incoming events even if the user typed `~ZOD`.
  // Channel names remain case-sensitive.
  return `${parsed.nestPrefix}/${parsed.hostShip.toLowerCase()}/${parsed.channelName}`;
}

export function parseTlonTarget(raw?: string | null): TlonTarget | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }
  const withoutPrefix = trimmed.replace(/^tlon:/i, "");

  // DM targets: dm/~ship or dm:~ship
  const dmPrefix = withoutPrefix.match(/^dm[/:](.+)$/i);
  if (dmPrefix) {
    return { kind: "dm", ship: normalizeShip(dmPrefix[1]) };
  }

  // Group/room prefix: group:chat/~host/channel or room:~host/channel
  const groupPrefix = withoutPrefix.match(/^(group|room)[/:](.+)$/i);
  if (groupPrefix) {
    const groupTarget = groupPrefix[2].trim();
    const parsedNest = parseNest(groupTarget);
    if (parsedNest) {
      return {
        kind: "channel",
        nest: `${parsedNest.nestPrefix}/${parsedNest.hostShip}/${parsedNest.channelName}`,
        hostShip: parsedNest.hostShip,
        channelName: parsedNest.channelName,
      };
    }
    // Legacy format: group:~host/channel (defaults to chat)
    const parts = groupTarget.split("/");
    if (parts.length === 2) {
      const hostShip = normalizeShip(parts[0]);
      const channelName = parts[1];
      return {
        kind: "channel",
        nest: `chat/${hostShip}/${channelName}`,
        hostShip,
        channelName,
      };
    }
    return null;
  }

  // Direct nest format: chat/~host/channel, heap/~host/channel, diary/~host/channel
  const parsedNest = parseNest(withoutPrefix);
  if (parsedNest) {
    return {
      kind: "channel",
      nest: `${parsedNest.nestPrefix}/${parsedNest.hostShip}/${parsedNest.channelName}`,
      hostShip: parsedNest.hostShip,
      channelName: parsedNest.channelName,
    };
  }

  // Bare ship name: treat as DM
  if (SHIP_RE.test(withoutPrefix)) {
    return { kind: "dm", ship: normalizeShip(withoutPrefix) };
  }

  return null;
}

export function formatTargetHint(): string {
  return "dm/~ship | ~ship | chat/~host/channel | heap/~host/channel | diary/~host/channel";
}
