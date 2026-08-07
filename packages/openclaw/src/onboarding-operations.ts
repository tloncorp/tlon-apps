import { sharedSlot } from './shared-state.js';

export type OnboardingDraft = {
  nest: string;
  title: string;
  markdown: string;
};

export type OnboardingDraftResult = {
  ok: boolean;
  message: string;
};

type TlonCommandRunner = (args: string[]) => Promise<string>;
type DraftHandler = (draft: OnboardingDraft) => Promise<OnboardingDraftResult>;

export type OnboardingResearchWakeResult =
  | { enqueued: false; wakeRequested: false }
  | { enqueued: true; wakeRequested: true }
  | { enqueued: true; wakeRequested: false; wakeError: unknown };

const commandRunnerSlot = sharedSlot<TlonCommandRunner>(
  'agentOnboarding.commandRunner'
);
const draftHandlers = new Map<string, DraftHandler>();
const researchSessionForNest = new Map<string, string>();
const researchSessions = new Set<string>();

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

/**
 * Queue the model-owned research turn and wake its session immediately.
 * A failed wake leaves the durable system event queued, so the caller must
 * retain its draft handler for the next heartbeat instead of disarming it.
 */
export function enqueueAndWakeOnboardingResearch(
  enqueue: () => boolean,
  wake: () => void
): OnboardingResearchWakeResult {
  if (!enqueue()) {
    return { enqueued: false, wakeRequested: false };
  }
  try {
    wake();
    return { enqueued: true, wakeRequested: true };
  } catch (wakeError) {
    return { enqueued: true, wakeRequested: false, wakeError };
  }
}

/**
 * The model gets one narrow escape hatch during onboarding: submit prose for
 * a notebook the coordinator is already waiting on. The monitor owns the
 * handler and therefore the group/nest/state checks as well as every side
 * effect that follows.
 */
export function registerOnboardingDraftHandler(
  nest: string,
  handler: DraftHandler
): () => void {
  draftHandlers.set(nest, handler);
  return () => {
    if (draftHandlers.get(nest) === handler) {
      draftHandlers.delete(nest);
    }
  };
}

export function armOnboardingResearchSession(
  nest: string,
  sessionKey: string
): void {
  const previous = researchSessionForNest.get(nest);
  if (previous) {
    researchSessions.delete(previous);
  }
  researchSessionForNest.set(nest, sessionKey);
  researchSessions.add(sessionKey);
}

export function isOnboardingResearchSession(
  sessionKey: string | null | undefined
): boolean {
  return Boolean(sessionKey && researchSessions.has(sessionKey));
}

export function disarmOnboardingResearchForNest(nest: string): void {
  const sessionKey = researchSessionForNest.get(nest);
  if (sessionKey) {
    researchSessions.delete(sessionKey);
    researchSessionForNest.delete(nest);
  }
}

export function disarmOnboardingResearchSession(
  sessionKey: string | null | undefined
): void {
  if (!sessionKey) {
    return;
  }
  researchSessions.delete(sessionKey);
  for (const [nest, candidate] of researchSessionForNest) {
    if (candidate === sessionKey) {
      researchSessionForNest.delete(nest);
    }
  }
}

export async function submitOnboardingDraft(
  draft: OnboardingDraft
): Promise<OnboardingDraftResult> {
  const handler = draftHandlers.get(draft.nest);
  if (!handler) {
    return {
      ok: false,
      message:
        'No onboarding draft is pending for that channel. Do not retry or create a notebook yourself.',
    };
  }
  return handler(draft);
}

export function clearOnboardingOperations(): void {
  commandRunnerSlot.set(null);
  draftHandlers.clear();
  researchSessionForNest.clear();
  researchSessions.clear();
}
