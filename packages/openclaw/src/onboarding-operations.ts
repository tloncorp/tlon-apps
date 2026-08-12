import { sharedMap } from './shared-state.js';

type OnboardingCommandOptions = { abortSignal?: AbortSignal };
type TlonCommandRunner = (
  args: string[],
  options?: OnboardingCommandOptions
) => Promise<string>;

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
  args: string[],
  options?: OnboardingCommandOptions
): Promise<string> {
  const runner =
    commandRunners.get(normalizeShip(ship)) ??
    commandRunners.get(DEFAULT_RUNNER);
  if (!runner) {
    throw new Error(
      'The deterministic onboarding command runner is unavailable'
    );
  }
  return runner(args, options);
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

  const ids = parseOnboardingNoteIds(output);
  if (ids.length === 0) {
    throw new Error('Unexpected output from `tlon notes notes`');
  }
  return ids[0]!;
}

/** Note ids in newest-first order from the stable notes listing. */
export function parseOnboardingNoteIds(output: string): string[] {
  const trimmed = output.trim();
  if (trimmed === 'No notes.') {
    return [];
  }
  return [...trimmed.matchAll(/^#(\d+)(?:\s|$)/gm)]
    .map((match) => match[1]!)
    .sort((a, b) => (BigInt(a) > BigInt(b) ? -1 : 1));
}

/** Read the newest note id through %notes rather than legacy %channels. */
export async function readOnboardingNotebookNewestId(
  runnerShip: string,
  notesNest: string
): Promise<string | null> {
  const output = await runOnboardingTlonCommand(runnerShip, [
    'notes',
    'notes',
    notesNest,
  ]);
  return parseOnboardingNotesListing(output);
}

export async function listOnboardingNotebookNoteIds(
  runnerShip: string,
  notesNest: string
): Promise<string[]> {
  const output = await runOnboardingTlonCommand(runnerShip, [
    'notes',
    'notes',
    notesNest,
  ]);
  const ids = parseOnboardingNoteIds(output);
  if (ids.length === 0 && output.trim() !== 'No notes.') {
    throw new Error('Unexpected output from `tlon notes notes`');
  }
  return ids;
}

export async function readOnboardingNotebookNote(
  runnerShip: string,
  notesNest: string,
  noteId: string
): Promise<string> {
  return runOnboardingTlonCommand(runnerShip, [
    'notes',
    'note',
    notesNest,
    noteId,
  ]);
}

export function clearOnboardingOperations(): void {
  commandRunners.clear();
}
