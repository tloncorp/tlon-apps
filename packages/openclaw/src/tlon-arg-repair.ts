/**
 * Argument repair for the `tlon` tool, sitting between the model's command
 * string and the CLI spawn.
 *
 * The tool takes a command *string* and tokenizes it with
 * `shellSplitCommand` — no shell ever runs. Models don't know that: they
 * write shell idioms, and two setup-breaking classes have been observed
 * live on the pool. A hand-escaped inline JSON argument lost its quoting
 * to the tokenizer and stored a truncated group description; and
 * `--description "$(cat /tmp/config.json)"` stored the *literal text*
 * `$(cat /tmp/config.json)` as the description, because nothing expanded
 * it. Both leave the group's agent config unreadable — the app treats the
 * group as unconfigured, its setup chrome never unlocks, and the setup
 * stalls silently.
 *
 * So the tool does what the model meant: a `--description` value that *is*
 * a command substitution over a file — `$(cat <path>)` or `$(< <path>)` —
 * is replaced with that file's contents, and one that still looks mangled
 * (config-shaped but unparseable, or an unexpanded `$(`) is refused with
 * instructions the model can act on, before the CLI writes anything.
 *
 * The expansion is deliberately narrow: only the `--description` value,
 * and only files named like `/tmp/<name>.json` (checked again after
 * symlinks resolve). A general expansion would be an arbitrary file read
 * the tool otherwise never performs — a prompt-injected message steering
 * the bot toward `--description "$(cat <secrets>)"` would exfiltrate
 * local credentials into a group. The setup directive dictates a path
 * inside the allowed shape, so the sanctioned use always qualifies.
 */

const SUBSTITUTION_PATTERN = /^\$\(\s*(?:cat\s+|<\s*)([^)]+?)\s*\)$/;

/**
 * The only files the tool will substitute: flat JSON files in /tmp.
 *
 * `/private/tmp` is the same directory, spelled the way macOS resolves it —
 * /tmp is a symlink to private/tmp there, so the post-symlink check turned
 * the very path the setup directive dictates into an "outside /tmp" error,
 * and every compliant config write failed on a macOS-hosted bot. Allowing
 * it widens nothing: it names the same files by their canonical path.
 */
const ALLOWED_SUBSTITUTION_PATH =
  /^(?:\/private)?\/tmp\/[A-Za-z0-9._-]+\.json$/;

/** Bounds a substituted file read; group configs run a few KB. */
const MAX_SUBSTITUTION_BYTES = 256 * 1024;

export type TlonArgRepairDeps = {
  readFile: (path: string) => string;
  /** Resolves symlinks so the post-resolution path can be re-checked. */
  realpath?: (path: string) => string;
};

export type TlonArgRepairResult =
  | { ok: true; args: string[]; expandedPaths: string[] }
  | { ok: false; error: string };

/**
 * Merge the unquoted form of a substitution that the tokenizer split into
 * two words (`$(cat` + `/tmp/x.json)`) back into one argument, so the
 * expansion below sees it whole.
 */
function mergeSplitSubstitutions(args: string[]): string[] {
  const merged: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const current = args[i]!;
    const next = args[i + 1];
    if (
      (current === '$(cat' || current === '$(<') &&
      next !== undefined &&
      next.endsWith(')')
    ) {
      merged.push(`${current} ${next}`);
      i++;
      continue;
    }
    merged.push(current);
  }
  return merged;
}

function looksLikeConfigDescription(value: string): boolean {
  return value.trim().startsWith('[');
}

/**
 * Expand file substitutions and refuse mangled description writes. Returns
 * the repaired argv, or an error message for the model — actionable and
 * specific, since it lands verbatim in the tool result.
 */
export function repairTlonCommandArgs(
  args: string[],
  deps: TlonArgRepairDeps
): TlonArgRepairResult {
  // Nothing ever feeds this CLI's stdin: the tool spawns it with an open
  // pipe that is never written or closed, so a `--stdin` read blocks for
  // its full 30-second timeout and then fails — the note or description
  // simply never lands. Refuse in zero milliseconds with the flag that
  // does work instead.
  if (args.some((arg) => arg === '--stdin' || arg === '--description-stdin')) {
    return {
      ok: false,
      error:
        `Error: this tool spawns the CLI with no stdin, so --stdin can ` +
        `never receive input — it would block for 30s and fail. Write the ` +
        `content to a file and pass it instead: --markdown <file> for ` +
        `notes, or --description "$(cat /tmp/<name>.json)" for a group ` +
        `description.`,
    };
  }
  const expandedPaths: string[] = [];
  const merged = mergeSplitSubstitutions(args);
  const out: string[] = [];
  for (let i = 0; i < merged.length; i++) {
    const arg = merged[i]!;
    const substitution = SUBSTITUTION_PATTERN.exec(arg);
    if (!substitution) {
      out.push(arg);
      continue;
    }
    // Only the --description value is ever expanded — see the module doc.
    if (merged[i - 1] !== '--description') {
      return {
        ok: false,
        error:
          `Error: this tool runs no shell and only expands $(cat <file>) ` +
          `as the value of --description. Pass other arguments literally.`,
      };
    }
    const path = substitution[1]!;
    let resolved = path;
    if (ALLOWED_SUBSTITUTION_PATH.test(path) && deps.realpath) {
      try {
        resolved = deps.realpath(path);
      } catch {
        // A path that doesn't resolve fails the read below with a clearer
        // message; fall through with the literal path.
      }
    }
    if (
      !ALLOWED_SUBSTITUTION_PATH.test(path) ||
      !ALLOWED_SUBSTITUTION_PATH.test(resolved)
    ) {
      return {
        ok: false,
        error:
          `Error: $(cat ...) substitution only reads flat JSON files in ` +
          `/tmp (like /tmp/tlon-group-config.json); ${path} is outside ` +
          `that. Write the config JSON to such a file and re-run the ` +
          `command.`,
      };
    }
    let contents: string;
    try {
      contents = deps.readFile(resolved);
    } catch (error) {
      return {
        ok: false,
        error:
          `Error: this tool runs no shell, so $(cat ...) is expanded by ` +
          `the tool itself — and reading ${path} failed (${
            error instanceof Error ? error.message : String(error)
          }). Write the content to that file first, then re-run the same ` +
          `command.`,
      };
    }
    if (contents.length > MAX_SUBSTITUTION_BYTES) {
      return {
        ok: false,
        error: `Error: ${path} is too large to substitute into an argument (${contents.length} bytes).`,
      };
    }
    // A trailing newline is file-formatting, not content — `$(...)` in a
    // real shell strips it too.
    out.push(contents.replace(/\n+$/, ''));
    expandedPaths.push(path);
  }

  const descriptionIdx = out.indexOf('--description');
  const description = descriptionIdx >= 0 ? out[descriptionIdx + 1] : undefined;
  if (description !== undefined) {
    if (description.includes('$(')) {
      return {
        ok: false,
        error:
          `Error: the --description value still contains an unexpanded ` +
          `"$(". This tool runs no shell; the only substitution it ` +
          `performs is an argument that is exactly $(cat <file>). Put the ` +
          `JSON in a file and pass --description "$(cat <file>)".`,
      };
    }
    if (looksLikeConfigDescription(description)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(description.trim());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          ok: false,
          error:
            `Error: the --description value starts with "[" but is not ` +
            `valid JSON (${message}). A config-shaped description must ` +
            `parse exactly — the app treats an unparseable one as "no ` +
            `config" and stops recognizing this group's agent. Never ` +
            `hand-escape JSON into the command string: JSON.stringify the ` +
            `config into a file and pass --description "$(cat <file>)" — ` +
            `this tool expands that itself.`,
        };
      }
      const malformed = malformedConfigEntryError(parsed);
      if (malformed) {
        return { ok: false, error: malformed };
      }
    }
  }

  return { ok: true, args: out, expandedPaths };
}

/**
 * Reject entries that *claim* to be agent config but would be
 * unrecognizable to the app. Scoped to entries carrying the type — an
 * arbitrary JSON-array description that never claims it is left alone, and
 * a bare-typed marker with no jobs is the client's own pre-setup write.
 */
function malformedConfigEntryError(parsed: unknown): string | null {
  if (!Array.isArray(parsed)) {
    return null;
  }
  for (const entry of parsed) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      (entry as { type?: unknown }).type !== 'tlon-group-agent-config'
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
        `Error: a tlon-group-agent-config entry has version ` +
        `${JSON.stringify(config.version)}; the app only recognizes ` +
        `version 1 (as a number), and an unrecognized entry makes it stop ` +
        `treating this group's agent as configured.`
      );
    }
    if (
      !Array.isArray(config.agents) ||
      config.agents.length === 0 ||
      !config.agents.every((agent) => typeof agent === 'string')
    ) {
      return (
        `Error: a tlon-group-agent-config entry needs a non-empty ` +
        `"agents" array of ship names — that is how the app learns which ` +
        `ship is this group's agent.`
      );
    }
    // A single job object rather than an array reads as zero jobs to the
    // client, so the group looks configured-but-jobless: the chrome stays
    // locked and nothing flags it, because the entry itself is well-formed.
    if (config.jobs !== undefined && !Array.isArray(config.jobs)) {
      return (
        `Error: a tlon-group-agent-config entry has "jobs" as ` +
        `${JSON.stringify(typeof config.jobs)} rather than an array. The ` +
        `app reads a non-array as no jobs at all, so the setup would look ` +
        `unfinished forever — wrap the job in an array.`
      );
    }
  }
  return null;
}
