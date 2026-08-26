import { effectiveLensStatus } from '../Channel/ContextLens/format';
import {
  type ContextLensEvent,
  isContextLensEventActive,
} from '../Channel/ContextLens/types';
import { hasStructuredAgentChatWait } from './activitySemantics';

export type AgentChatRunOutcome =
  | 'completed'
  | 'finishing'
  | 'incomplete'
  | 'waiting'
  | 'failed';

function planHasIncompleteWork(event: ContextLensEvent) {
  return (event.lens.activity?.plan?.steps ?? []).some(
    (step) => step.status !== 'completed'
  );
}

/** A delivered reply can pause a larger plan without completing its work. */
export function agentChatRunOutcome(
  event: ContextLensEvent
): AgentChatRunOutcome {
  const status = effectiveLensStatus(event.lens);
  if (
    event.phase === 'final-reply-delivered' &&
    isContextLensEventActive(event)
  ) {
    return hasStructuredAgentChatWait(event) ? 'waiting' : 'finishing';
  }
  if (status !== 'completed') return 'failed';
  if (hasStructuredAgentChatWait(event)) {
    return 'waiting';
  }
  return planHasIncompleteWork(event) ? 'incomplete' : 'completed';
}
