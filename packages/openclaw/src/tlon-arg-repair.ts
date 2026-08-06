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
 * So the tool does what the model meant: an argument that *is* a command
 * substitution over a file — `$(cat <path>)` or `$(< <path>)` — is
 * replaced with that file's contents, and a `--description` value that
 * still looks mangled (config-shaped but unparseable, or an unexpanded
 * `$(`) is refused with instructions the model can act on, before the CLI
 * writes anything.
 */

const SUBSTITUTION_PATTERN = /^\$\(\s*(?:cat\s+|<\s*)([^)]+?)\s*\)$/;

/** Bounds a substituted file read; group configs run a few KB. */
const MAX_SUBSTITUTION_BYTES = 256 * 1024;

export type TlonArgRepairDeps = {
  readFile: (path: string) => string;
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
  const expandedPaths: string[] = [];
  const out: string[] = [];
  for (const arg of mergeSplitSubstitutions(args)) {
    const substitution = SUBSTITUTION_PATTERN.exec(arg);
    if (!substitution) {
      out.push(arg);
      continue;
    }
    const path = substitution[1]!;
    let contents: string;
    try {
      contents = deps.readFile(path);
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
      try {
        JSON.parse(description.trim());
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
    }
  }

  return { ok: true, args: out, expandedPaths };
}
