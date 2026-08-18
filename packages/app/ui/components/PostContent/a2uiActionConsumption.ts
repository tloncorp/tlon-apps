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

  const topics = consumedLocally ? localTopics : durableTopics ?? [];
  return { collapsed: topics.length > 0, topics };
}

/** Recover the labels a send-message SmallChoice persisted in its owner post. */
export function getSmallChoiceMessageSelection(
  component: A2UI.SmallChoice,
  sentMessageText?: string
): string[] {
  const message = sentMessageText?.trim();
  if (!message) return [];

  const prefix =
    component.action.event.name === A2UI.action.sendMessage
      ? component.action.event.context.text.trim()
      : '';
  const selection =
    prefix && message.startsWith(`${prefix} `)
      ? message.slice(prefix.length + 1)
      : message;
  const parts = selection
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const labels = component.options
    .filter((option) => parts.includes(option.label))
    .map((option) => option.label);

  // A manually typed response also consumes this one-shot surface. Preserve
  // that response as the compact completion rather than reopening a disabled
  // picker after navigation.
  return labels.length ? labels : [selection];
}
