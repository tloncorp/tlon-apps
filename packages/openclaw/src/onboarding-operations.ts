import { sharedSlot } from './shared-state.js';

type TlonCommandRunner = (args: string[]) => Promise<string>;

const commandRunnerSlot = sharedSlot<TlonCommandRunner>(
  'agentOnboarding.commandRunner'
);

/**
 * Install the trusted, argv-based Tlon runner used by onboarding. The
 * coordinator passes an argv array directly to spawn; no model-authored shell
 * string, tokenizer, command substitution, or temporary config file is
 * involved.
 */
export function setOnboardingCommandRunner(
  runner: TlonCommandRunner | null
): void {
  commandRunnerSlot.set(runner);
}

export async function runOnboardingTlonCommand(
  args: string[]
): Promise<string> {
  const runner = commandRunnerSlot.get();
  if (!runner) {
    throw new Error(
      'The deterministic onboarding command runner is unavailable'
    );
  }
  return runner(args);
}

/**
 * Parse the stable, line-oriented output from `tlon notes notes <nest>`.
 * Note ids are monotonic, so the largest id is the durable newest-entry
 * baseline used to detect whether the onboarding write landed.
 */
export function parseOnboardingNotesListing(output: string): string | null {
  const trimmed = output.trim();
  if (trimmed === 'No notes.') {
    return null;
  }

  let newestId: bigint | null = null;
  for (const match of trimmed.matchAll(/^#(\d+)(?:\s|$)/gm)) {
    const id = BigInt(match[1]!);
    if (newestId === null || id > newestId) {
      newestId = id;
    }
  }
  if (newestId === null) {
    throw new Error('Unexpected output from `tlon notes notes`');
  }
  return newestId.toString();
}

/** Read the newest note id through %notes rather than legacy %channels. */
export async function readOnboardingNotebookNewestId(
  notesNest: string
): Promise<string | null> {
  const output = await runOnboardingTlonCommand(['notes', 'notes', notesNest]);
  return parseOnboardingNotesListing(output);
}

export function clearOnboardingOperations(): void {
  commandRunnerSlot.set(null);
}
