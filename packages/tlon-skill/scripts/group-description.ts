/**
 * Guard rails for group description writes.
 *
 * A group's description doubles as machine-readable agent config (a JSON
 * array of `tlon-group-agent-config` entries — see `parseGroupAgentConfig`
 * in @tloncorp/api). Two failure modes have been observed live, both from
 * the same root: the writer is a model driving a shell.
 *
 * 1. Hand-escaped JSON: the config passed inline as a shell argument lost
 *    its inner quote escapes, storing a description that *looks* like
 *    config but doesn't parse — which un-recognizes the group's agent
 *    everywhere (the app's chrome lock never releases, the plugin never
 *    posts its closing cards) while the writer believes it succeeded.
 * 2. Misreported writes: the meta poke path can throw a timeout for a
 *    write that actually landed — or drop one silently — and the model
 *    trusts whichever story it was told.
 *
 * So: a config-shaped description must parse before it is sent, and every
 * meta write is verified by reading the stored value back.
 */

export const AGENT_CONFIG_ENTRY_TYPE = 'tlon-group-agent-config';

const REMEDIATION =
  'Build the config programmatically (JSON.stringify an object — never ' +
  'hand-escape quotes) and pass it with --description-stdin so shell ' +
  'quoting cannot mangle it.';

/**
 * The reason a config-shaped description must be refused, or null when it
 * is acceptable. Prose descriptions (anything not starting with `[`) pass
 * untouched — this guards the machine format, not human text.
 */
export function configDescriptionError(description: string): string | null {
  const trimmed = description.trim();
  if (!trimmed.startsWith('[')) {
    return null;
  }
  let entries: unknown;
  try {
    entries = JSON.parse(trimmed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const position = /position (\d+)/.exec(message)?.[1];
    const context = position
      ? ` Near: …${trimmed.slice(
          Math.max(0, Number(position) - 40),
          Number(position) + 40
        )}…`
      : '';
    return (
      `Description starts with "[" but is not valid JSON (${message}).` +
      `${context} A config-shaped description must parse exactly — the app ` +
      `treats an unparseable one as "no config" and stops recognizing this ` +
      `group's agent. ${REMEDIATION}`
    );
  }
  if (!Array.isArray(entries)) {
    return (
      'Description starts with "[" but did not parse to an array. The ' +
      'config format is a JSON array of entries. ' +
      REMEDIATION
    );
  }
  for (const entry of entries) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      (entry as { type?: unknown }).type !== AGENT_CONFIG_ENTRY_TYPE
    ) {
      continue;
    }
    const config = entry as {
      version?: unknown;
      agents?: unknown;
      jobs?: unknown;
    };
    if (config.version !== 1) {
      return (
        `Config entry has version ${JSON.stringify(config.version)}; the ` +
        `app only recognizes version 1 (as a number). An unrecognized ` +
        `entry un-recognizes this group's agent.`
      );
    }
    if (
      !Array.isArray(config.agents) ||
      config.agents.length === 0 ||
      !config.agents.every((agent) => typeof agent === 'string')
    ) {
      return (
        'Config entry needs a non-empty "agents" array of ship names — ' +
        "that is how the app learns which ship is this group's agent."
      );
    }
    if (config.jobs !== undefined && !Array.isArray(config.jobs)) {
      return 'Config entry "jobs" must be an array when present.';
    }
  }
  return null;
}

export type VerifiedMetaWriteDeps = {
  updateGroupMeta: (params: {
    groupId: string;
    meta: {
      title: string;
      description: string;
      image: string;
      cover: string;
    };
  }) => Promise<unknown>;
  getGroup: (groupId: string) => Promise<{
    title?: string | null;
    description?: string | null;
    iconImage?: string | null;
    iconImageColor?: string | null;
    coverImage?: string | null;
    coverImageColor?: string | null;
  }>;
  sleep: (ms: number) => Promise<void>;
  warn: (message: string) => void;
};

/**
 * Write group meta and verify the stored values actually match what was
 * sent, retrying the poke when they don't.
 *
 * The write path has been seen to throw a timeout for a poke that landed —
 * a read-back turns that into a verified success instead of a false
 * failure the writer routes around. And a poke that reports success but
 * never materializes turns into a retried write instead of a silent gap.
 * Throws only when the stored meta still doesn't match after every
 * attempt. Every field is compared, artwork included: an icon-only write
 * changes neither title nor description, so checking just those two passed
 * it on the first poll no matter what happened to the image.
 */
export async function verifiedGroupMetaWrite(
  deps: VerifiedMetaWriteDeps,
  groupId: string,
  meta: { title: string; description: string; image: string; cover: string },
  options: {
    writeAttempts?: number;
    verifyPolls?: number;
    pollMs?: number;
  } = {}
): Promise<void> {
  const writeAttempts = options.writeAttempts ?? 3;
  const verifyPolls = options.verifyPolls ?? 5;
  const pollMs = options.pollMs ?? 1500;

  let lastError: unknown;
  for (let attempt = 1; attempt <= writeAttempts; attempt++) {
    try {
      await deps.updateGroupMeta({ groupId, meta });
      lastError = undefined;
    } catch (error) {
      // Don't trust the failure any more than a success: verify below.
      lastError = error;
      deps.warn(
        `Group meta write reported an error (attempt ${attempt}); ` +
          `verifying whether it landed anyway: ${
            error instanceof Error ? error.message : String(error)
          }`
      );
    }
    for (let poll = 0; poll < verifyPolls; poll++) {
      await deps.sleep(pollMs);
      let stored;
      try {
        stored = await deps.getGroup(groupId);
      } catch {
        continue;
      }
      // Visuals are compared too, not just the text. `meta` already carries
      // the existing artwork forward when the caller didn't touch it, so an
      // unchanged icon matches for free — but an icon-only write (the
      // onboarding artwork step) used to verify against title and
      // description alone, which of course already matched, and reported
      // "stored values verified" on the very first poll for an image that
      // never landed. The one caller who most needs the truth here is the
      // one changing nothing else.
      const storedImage = stored.iconImage ?? stored.iconImageColor ?? '';
      const storedCover = stored.coverImage ?? stored.coverImageColor ?? '';
      if (
        (stored.description ?? '') === meta.description &&
        (stored.title ?? '') === meta.title &&
        storedImage === meta.image &&
        storedCover === meta.cover
      ) {
        if (lastError) {
          deps.warn(
            'The write that reported an error did land — stored meta verified.'
          );
        }
        return;
      }
    }
  }
  throw new Error(
    `Group meta write could not be verified: the stored meta (title, ` +
      `description, icon, cover) still doesn't match what was sent after ` +
      `${writeAttempts} attempts.` +
      (lastError
        ? ` Last write error: ${
            lastError instanceof Error ? lastError.message : String(lastError)
          }`
        : '')
  );
}
