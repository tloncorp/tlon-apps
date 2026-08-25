import { A2UI } from '@tloncorp/shared/logic';

export function isA2UISendMessageActionConsumed(
  action: A2UI.ButtonAction,
  sentMessageText?: string
): boolean {
  if (action.event.name !== A2UI.action.sendMessage) return false;
  const expected = action.event.context.text.trim();
  return expected.length > 0 && expected === sentMessageText?.trim();
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

  return {
    completed: true,
    topics: consumedLocally ? localTopics : (durableTopics ?? []),
  };
}

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
  let selection = message;
  if (prefix && message.startsWith(`${prefix} `)) {
    selection = message.slice(prefix.length + 1);
  } else if (prefix) {
    for (
      let separator = message.lastIndexOf(' ');
      separator > 0;
      separator = message.lastIndexOf(' ', separator - 1)
    ) {
      if (message.slice(0, separator) === prefix.slice(0, separator)) {
        selection = message.slice(separator + 1);
        break;
      }
    }
  }

  const parts = parseSmallChoiceValues(selection);
  const labels = component.options
    .filter((option) => parts.includes(option.label))
    .map((option) => option.label);
  if (!labels.length) return parts.length ? parts : [selection];

  const known = new Set(labels);
  return [...labels, ...parts.filter((part) => !known.has(part))];
}

function parseSmallChoiceValues(value: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '"') {
      if (quoted && value[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      if (current.trim()) values.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim()) values.push(current.trim());
  return values;
}
