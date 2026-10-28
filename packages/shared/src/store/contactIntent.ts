import { getClientGeneration } from './session';

let generation = getClientGeneration();
const intents = new Map<string, symbol>();

function currentIntent(id: string) {
  if (generation !== getClientGeneration()) {
    generation = getClientGeneration();
    intents.clear();
  }
  return intents.get(id);
}

export function recordContactIntent(id: string) {
  currentIntent(id);
  intents.set(id, Symbol());
}

export function captureContactIntent(id: string) {
  const session = getClientGeneration();
  const intent = currentIntent(id);
  return () =>
    getClientGeneration() === session && currentIntent(id) === intent;
}
