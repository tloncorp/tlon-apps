import { getClientGeneration } from './session';

let generation = getClientGeneration();
const intents = new Map<string, symbol>();
const observedRemovals = new Map<string, symbol>();

function currentIntent(id: string) {
  if (generation !== getClientGeneration()) {
    generation = getClientGeneration();
    intents.clear();
    observedRemovals.clear();
  }
  return intents.get(id);
}

export function recordContactIntent(id: string) {
  currentIntent(id);
  intents.set(id, Symbol());
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
