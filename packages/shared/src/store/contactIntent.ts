import { getClientGeneration } from './session';

let generation = getClientGeneration();
type ContactDecision = 'add' | 'remove' | 'decline';
const intents = new Map<
  string,
  { decision?: ContactDecision; pending?: boolean }
>();
const observedRemovals = new Map<string, symbol>();

function resetForSession() {
  if (generation !== getClientGeneration()) {
    generation = getClientGeneration();
    intents.clear();
    observedRemovals.clear();
  }
}

function currentIntent(id: string) {
  resetForSession();
  return intents.get(id);
}

export function recordContactIntent(id: string) {
  currentIntent(id);
  intents.set(id, {});
}

export function observeContactRemoval(id: string) {
  currentIntent(id);
  observedRemovals.set(id, Symbol());
}

export function captureContactIntent(
  id: string,
  { includeObservedRemovals = false } = {}
) {
  const session = getClientGeneration();
  const intent = currentIntent(id);
  const observedRemoval = observedRemovals.get(id);
  return () =>
    getClientGeneration() === session &&
    currentIntent(id) === intent &&
    (!includeObservedRemovals || observedRemovals.get(id) === observedRemoval);
}

// One queue preserves server processing order for explicit choices. The token
// belongs to the click, not the time the queued callback happens to run.
let decisions: Promise<unknown> = Promise.resolve();

export function queueContactDecision<T>(
  id: string,
  decision: ContactDecision,
  action: (isCurrent: () => boolean) => Promise<T>
): Promise<T | undefined> {
  const previous = currentIntent(id);
  if (previous?.pending && previous.decision === decision)
    return Promise.resolve(undefined);
  recordContactIntent(id);
  const intent = currentIntent(id)!;
  intent.decision = decision;
  intent.pending = true;
  const isCurrent = captureContactIntent(id);
  const result = decisions.then(() =>
    isCurrent() ? action(isCurrent) : undefined
  );
  const finish = () => {
    intent.pending = false;
  };
  result.then(finish, finish);
  decisions = result.catch(() => undefined);
  return result;
}

export function captureContactSnapshot() {
  resetForSession();
  const session = getClientGeneration();
  const snapshot = new Map(intents);
  const pending = new Set(
    [...snapshot].filter(([, intent]) => intent.pending).map(([id]) => id)
  );
  return (id: string) =>
    getClientGeneration() === session &&
    !pending.has(id) &&
    currentIntent(id) === snapshot.get(id);
}
