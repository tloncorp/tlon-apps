import { sharedMap } from './shared-state.js';

type TlonCommandRunner = (args: string[]) => Promise<string>;

const commandRunners = sharedMap<string, TlonCommandRunner>(
  'agentOnboarding.commandRunners'
);
const DEFAULT_RUNNER = '*';

const normalizeShip = (ship: string): string => {
  const trimmed = ship.trim().toLowerCase();
  if (trimmed === DEFAULT_RUNNER) {
    return DEFAULT_RUNNER;
  }
  return trimmed.startsWith('~') ? trimmed : `~${trimmed}`;
};

/**
 * Install the trusted, argv-based Tlon runner used by onboarding. The
 * coordinator passes an argv array directly to spawn; no model-authored shell
 * string, tokenizer, command substitution, or temporary config file is
 * involved.
 */
export function setOnboardingCommandRunner(
  ship: string,
  runner: TlonCommandRunner | null
): void {
  const key = normalizeShip(ship);
  if (runner) {
    commandRunners.set(key, runner);
  } else {
    commandRunners.delete(key);
  }
}

export async function runOnboardingTlonCommand(
  ship: string,
  args: string[]
): Promise<string> {
  const runner =
    commandRunners.get(normalizeShip(ship)) ??
    commandRunners.get(DEFAULT_RUNNER);
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
  const host = notesNest.split('/')[1];
  if (!host) {
    throw new Error(`The onboarding notebook nest has no host: ${notesNest}`);
  }
  const output = await runOnboardingTlonCommand(host, [
    'notes',
    'notes',
    notesNest,
  ]);
  return parseOnboardingNotesListing(output);
}

export function clearOnboardingOperations(): void {
  commandRunners.clear();
}
