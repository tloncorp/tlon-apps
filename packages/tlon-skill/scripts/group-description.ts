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
  getGroup: (
    groupId: string
  ) => Promise<{ title?: string | null; description?: string | null }>;
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
 * attempt; title and description are compared (the fields a caller
 * actually authors — image fields can be rewritten server-side).
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
      if (
        (stored.description ?? '') === meta.description &&
        (stored.title ?? '') === meta.title
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
    `Group meta write could not be verified: the stored title/description ` +
      `still don't match what was sent after ${writeAttempts} attempts.` +
      (lastError
        ? ` Last write error: ${
            lastError instanceof Error ? lastError.message : String(lastError)
          }`
        : '')
  );
}
