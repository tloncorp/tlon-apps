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

/**
 * A later owner message only consumes the action that produced that exact
 * text. Treating every send-message action as consumed makes a remounted
 * Choice select its first option regardless of what the owner chose.
 */
export function isA2UISendMessageActionConsumed(
  action: A2UI.ButtonAction,
  sentMessageText?: string
): boolean {
  return (
    action.event.name === A2UI.action.sendMessage &&
    action.event.context.text.trim().length > 0 &&
    action.event.context.text.trim() === sentMessageText?.trim()
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
}): { completed: boolean; topics: string[] } {
  if (!actionConsumed) {
    return { completed: false, topics: [] };
  }

  const topics = consumedLocally ? localTopics : (durableTopics ?? []);
  return { completed: true, topics };
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
  const parts = A2UI.parseSmallChoiceValues(selection);
  const labels = component.options
    .filter((option) => parts.includes(option.label))
    .map((option) => option.label);

  // A manually typed response also consumes this one-shot surface. Preserve
  // that response as the compact completion rather than reopening a disabled
  // picker after navigation.
  if (!labels.length) return parts.length ? parts : [selection];
  const known = new Set(labels);
  return [...labels, ...parts.filter((part) => !known.has(part))];
}
