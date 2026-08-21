import { hasContextLensActivityCardContent } from '@tloncorp/api/urbit/lens';

import { type ContextLens, RETRYABLE_STATUSES } from './context-lens.js';

function hasNonPlanToolCall(lens: ContextLens): boolean {
  const names = [
    ...lens.tools.called,
    ...lens.tools.runs.map((run) => run.name),
  ].filter(Boolean);
  if (names.length > 0) {
    return names.some((name) => name !== 'update_plan');
  }
  // Older persisted snapshots can retain a count without tool names.
  return lens.tools.callCount > 0;
}

/**
 * Deterministic producer-side card gate. This intentionally never examines
 * assistant prose, plan titles, elapsed time, or provider-generic items.
 */
export function isContextLensCardEligible(lens: ContextLens): boolean {
  return (
    lens.continuation?.kind === 'request_input' ||
    hasContextLensActivityCardContent(lens.activity) ||
    hasNonPlanToolCall(lens) ||
    RETRYABLE_STATUSES.has(lens.status)
  );
}
