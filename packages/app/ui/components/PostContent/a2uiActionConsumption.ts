import { A2UI } from '@tloncorp/shared/logic';

/**
 * Only actions that submit an owner response are one-shot. Navigation and
 * other client-local actions remain available after they complete.
 */
export function isConsumableA2UIAction(action: A2UI.ButtonAction): boolean {
  return (
    action.event.name === A2UI.action.sendMessage ||
    action.event.name === A2UI.action.provisionAgent
  );
}

export function getSmallChoiceCompletionPresentation({
  actionConsumed,
  consumedLocally,
  durableTopics,
  localTopics,
}: {
  actionConsumed: boolean;
  consumedLocally: boolean;
  durableTopics?: string[];
  localTopics: string[];
}): { collapsed: boolean; topics: string[] } {
  if (!actionConsumed) {
    return { collapsed: false, topics: [] };
  }

  const topics = consumedLocally ? localTopics : (durableTopics ?? []);
  return { collapsed: topics.length > 0, topics };
}
