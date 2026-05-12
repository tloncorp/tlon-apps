import { z } from 'zod';

export const TLON_A2UI_ACTION_SEND_MESSAGE = 'tlon.sendMessage';

type A2UIComponentBase = {
  id: string;
  weight?: number;
};

export type A2UITextComponent = A2UIComponentBase & {
  component: 'Text';
  text: string;
  variant?: 'body' | 'caption' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5';
};

export type A2UIContainerComponent = A2UIComponentBase & {
  component: 'Row' | 'Column';
  children: string[];
  justify?: 'start' | 'center' | 'end' | 'spaceBetween' | 'spaceAround';
  align?: 'start' | 'center' | 'end' | 'stretch';
};

export type A2UICardComponent = A2UIComponentBase & {
  component: 'Card';
  child: string;
};

export type A2UIDividerComponent = A2UIComponentBase & {
  component: 'Divider';
};

export type A2UIButtonComponent = A2UIComponentBase & {
  component: 'Button';
  child: string;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'secondary' | 'borderless';
  action: {
    event: {
      name: typeof TLON_A2UI_ACTION_SEND_MESSAGE;
      context?: {
        text?: string;
      };
    };
  };
};

export type A2UIComponent =
  | A2UITextComponent
  | A2UIContainerComponent
  | A2UICardComponent
  | A2UIDividerComponent
  | A2UIButtonComponent;

export type A2UICreateSurfaceMessage = {
  version: 'v0.9';
  createSurface: {
    surfaceId: string;
    catalogId: string;
  };
};

export type A2UIUpdateComponentsMessage = {
  version: 'v0.9';
  updateComponents: {
    surfaceId: string;
    components: A2UIComponent[];
    root?: string;
  };
};

export type A2UIMessage =
  | A2UICreateSurfaceMessage
  | A2UIUpdateComponentsMessage;

export type PostBlobDataEntryA2UI = {
  type: 'a2ui';
  version: 1;
  messages: A2UIMessage[];
  recipe?: unknown;
};

const A2UI_LIMITS = {
  maxBytes: 32 * 1024,
  maxComponents: 50,
  maxDepth: 8,
  maxChildren: 12,
  maxButtons: 8,
  maxTextNodeLength: 1000,
  maxButtonMessageLength: 1000,
  maxTotalTextLength: 8000,
} as const;

const A2UI_CONTAINER_JUSTIFY_VALUES = [
  'start',
  'center',
  'end',
  'spaceBetween',
  'spaceAround',
] as const;

const A2UI_CONTAINER_ALIGN_VALUES = [
  'start',
  'center',
  'end',
  'stretch',
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidWeight(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 12)
  );
}

function isValidContainerJustify(value: unknown): boolean {
  return (
    value === undefined ||
    A2UI_CONTAINER_JUSTIFY_VALUES.includes(
      value as (typeof A2UI_CONTAINER_JUSTIFY_VALUES)[number]
    )
  );
}

function isValidContainerAlign(value: unknown): boolean {
  return (
    value === undefined ||
    A2UI_CONTAINER_ALIGN_VALUES.includes(
      value as (typeof A2UI_CONTAINER_ALIGN_VALUES)[number]
    )
  );
}

function validateA2UIComponent(component: unknown): component is A2UIComponent {
  if (!isPlainObject(component) || !isNonEmptyString(component.id)) {
    return false;
  }
  if (!isValidWeight(component.weight)) {
    return false;
  }

  switch (component.component) {
    case 'Text':
      return (
        typeof component.text === 'string' &&
        component.text.length <= A2UI_LIMITS.maxTextNodeLength
      );
    case 'Row':
    case 'Column':
      return (
        Array.isArray(component.children) &&
        component.children.length <= A2UI_LIMITS.maxChildren &&
        component.children.every((child) => isNonEmptyString(child)) &&
        isValidContainerJustify(component.justify) &&
        isValidContainerAlign(component.align)
      );
    case 'Card':
      return isNonEmptyString(component.child);
    case 'Divider':
      return true;
    case 'Button': {
      const action = component.action;
      const event = isPlainObject(action) ? action.event : null;
      const context = isPlainObject(event) ? event.context : undefined;
      return (
        isNonEmptyString(component.child) &&
        isPlainObject(action) &&
        isPlainObject(event) &&
        event.name === TLON_A2UI_ACTION_SEND_MESSAGE &&
        (context === undefined || isPlainObject(context)) &&
        (context === undefined ||
          context.text === undefined ||
          (typeof context.text === 'string' &&
            context.text.length <= A2UI_LIMITS.maxButtonMessageLength))
      );
    }
    default:
      return false;
  }
}

export function getA2UIUpdateMessage(
  entry: PostBlobDataEntryA2UI
): A2UIUpdateComponentsMessage | null {
  return (
    entry.messages.find(
      (message): message is A2UIUpdateComponentsMessage =>
        'updateComponents' in message
    ) ?? null
  );
}

export function getA2UIRootComponentId(
  entry: PostBlobDataEntryA2UI
): string | null {
  const update = getA2UIUpdateMessage(entry);
  if (!update) {
    return null;
  }
  return (
    update.updateComponents.root ??
    update.updateComponents.components[0]?.id ??
    null
  );
}

export function validateA2UIBlobEntry(
  entry: unknown
): entry is PostBlobDataEntryA2UI {
  if (!isPlainObject(entry) || entry.type !== 'a2ui' || entry.version !== 1) {
    return false;
  }

  if (JSON.stringify(entry).length > A2UI_LIMITS.maxBytes) {
    return false;
  }

  if (!Array.isArray(entry.messages)) {
    return false;
  }

  const createMessage = entry.messages.find(
    (message): message is A2UICreateSurfaceMessage =>
      isPlainObject(message) && 'createSurface' in message
  );
  const updateMessage = entry.messages.find(
    (message): message is A2UIUpdateComponentsMessage =>
      isPlainObject(message) && 'updateComponents' in message
  );

  if (
    !createMessage ||
    !updateMessage ||
    createMessage.version !== 'v0.9' ||
    updateMessage.version !== 'v0.9' ||
    !isPlainObject(createMessage.createSurface) ||
    !isPlainObject(updateMessage.updateComponents)
  ) {
    return false;
  }

  const surfaceId = createMessage.createSurface.surfaceId;
  const updateSurfaceId = updateMessage.updateComponents.surfaceId;
  const catalogId = createMessage.createSurface.catalogId;
  const components = updateMessage.updateComponents.components;

  if (
    !isNonEmptyString(surfaceId) ||
    surfaceId !== updateSurfaceId ||
    !isNonEmptyString(catalogId) ||
    !Array.isArray(components) ||
    components.length === 0 ||
    components.length > A2UI_LIMITS.maxComponents
  ) {
    return false;
  }

  if (!components.every(validateA2UIComponent)) {
    return false;
  }

  const byId = new Map<string, A2UIComponent>();
  let buttonCount = 0;
  let totalTextLength = 0;

  for (const component of components) {
    if (byId.has(component.id)) {
      return false;
    }
    byId.set(component.id, component);
    if (component.component === 'Button') {
      buttonCount += 1;
      totalTextLength += component.action.event.context?.text?.length ?? 0;
    } else if (component.component === 'Text') {
      totalTextLength += component.text.length;
    }
  }

  if (
    buttonCount > A2UI_LIMITS.maxButtons ||
    totalTextLength > A2UI_LIMITS.maxTotalTextLength
  ) {
    return false;
  }

  const root = updateMessage.updateComponents.root ?? components[0]?.id;
  if (!isNonEmptyString(root) || !byId.has(root)) {
    return false;
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(id: string, depth: number): boolean {
    if (depth > A2UI_LIMITS.maxDepth || visiting.has(id)) {
      return false;
    }
    if (visited.has(id)) {
      return true;
    }
    const component = byId.get(id);
    if (!component) {
      return false;
    }
    visiting.add(id);
    const children =
      component.component === 'Row' || component.component === 'Column'
        ? component.children
        : component.component === 'Card' || component.component === 'Button'
          ? [component.child]
          : [];
    if (children.length > A2UI_LIMITS.maxChildren) {
      return false;
    }
    for (const child of children) {
      if (!visit(child, depth + 1)) {
        return false;
      }
    }
    visiting.delete(id);
    visited.add(id);
    return true;
  }

  return visit(root, 1);
}

export const PostBlobDataEntryA2UISchema = z.custom<PostBlobDataEntryA2UI>(
  validateA2UIBlobEntry
);
