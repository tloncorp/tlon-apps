import { z } from 'zod';

const ACTION_SEND_MESSAGE = 'tlon.sendMessage';
const ACTION_NAVIGATE = 'tlon.navigate';

type ComponentBase = {
  id: string;
  weight?: number;
};

export namespace A2UI {
  export type Text = ComponentBase & {
    component: 'Text';
    text: string;
    variant?: 'body' | 'caption' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5';
  };

  export type Container = ComponentBase & {
    component: 'Row' | 'Column';
    children: string[];
    justify?: 'start' | 'center' | 'end' | 'spaceBetween' | 'spaceAround';
    align?: 'start' | 'center' | 'end' | 'stretch';
  };

  export type Card = ComponentBase & {
    component: 'Card';
    child: string;
  };

  export type Divider = ComponentBase & {
    component: 'Divider';
  };

  export type SendMessageEvent = {
    name: typeof ACTION_SEND_MESSAGE;
    context: {
      text: string;
    };
  };

  export type MessageNavigationTarget = {
    type: 'message';
    channelId: string;
    postId: string;
    parentId?: string;
    parentAuthorId?: string;
    authorId?: string;
    groupId?: string;
  };

  export type ChannelNavigationTarget = {
    type: 'channel';
    channelId: string;
    groupId?: string;
    selectedPostId?: string;
  };

  export type GroupNavigationTarget = {
    type: 'group';
    groupId: string;
  };

  export type ProfileNavigationTarget = {
    type: 'profile';
    userId: string;
    groupId?: string;
    channelId?: string;
  };

  export type ChatDetailsNavigationTarget = {
    type: 'chatDetails';
    chatType: 'group' | 'channel';
    chatId: string;
    groupId?: string;
  };

  export type ChatVolumeNavigationTarget = {
    type: 'chatVolume';
    chatType: 'group' | 'channel';
    chatId: string;
    groupId?: string;
  };

  export type NavigationTarget =
    | MessageNavigationTarget
    | ChannelNavigationTarget
    | GroupNavigationTarget
    | ProfileNavigationTarget
    | ChatDetailsNavigationTarget
    | ChatVolumeNavigationTarget;

  export type NavigateEvent = {
    name: typeof ACTION_NAVIGATE;
    context: {
      target: NavigationTarget;
    };
  };

  export type EventAction = {
    event: SendMessageEvent | NavigateEvent;
  };

  export type ButtonAction = EventAction;

  export type Button = ComponentBase & {
    component: 'Button';
    child: string;
    disabled?: boolean;
    variant?: 'default' | 'primary' | 'secondary' | 'borderless';
    action: ButtonAction;
  };

  export type Component = Text | Container | Card | Divider | Button;

  export type CreateSurfaceMessage = {
    version: 'v0.9';
    createSurface: {
      surfaceId: string;
      catalogId: string;
    };
  };

  export type UpdateComponentsMessage = {
    version: 'v0.9';
    updateComponents: {
      surfaceId: string;
      components: Component[];
      root?: string;
    };
  };

  export type Message = CreateSurfaceMessage | UpdateComponentsMessage;

  export type BlobEntry = {
    type: 'a2ui';
    version: 1;
    messages: Message[];
    recipe?: unknown;
  };
}

const LIMITS = {
  maxBytes: 32 * 1024,
  maxComponents: 50,
  maxDepth: 8,
  maxChildren: 12,
  maxTextNodeLength: 1000,
  maxButtonMessageLength: 1000,
  maxNavigationTargetIdLength: 500,
  maxTotalTextLength: 8000,
} as const;

const CONTAINER_JUSTIFY_VALUES = [
  'start',
  'center',
  'end',
  'spaceBetween',
  'spaceAround',
] as const;

const CONTAINER_ALIGN_VALUES = ['start', 'center', 'end', 'stretch'] as const;

const TEXT_VARIANT_VALUES = [
  'body',
  'caption',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
] as const;

const BUTTON_VARIANT_VALUES = [
  'default',
  'primary',
  'secondary',
  'borderless',
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidTargetId(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    value.length <= LIMITS.maxNavigationTargetIdLength
  );
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
    CONTAINER_JUSTIFY_VALUES.includes(
      value as (typeof CONTAINER_JUSTIFY_VALUES)[number]
    )
  );
}

function isValidContainerAlign(value: unknown): boolean {
  return (
    value === undefined ||
    CONTAINER_ALIGN_VALUES.includes(
      value as (typeof CONTAINER_ALIGN_VALUES)[number]
    )
  );
}

function isValidTextVariant(value: unknown): boolean {
  return (
    value === undefined ||
    TEXT_VARIANT_VALUES.includes(value as (typeof TEXT_VARIANT_VALUES)[number])
  );
}

function isValidButtonVariant(value: unknown): boolean {
  return (
    value === undefined ||
    BUTTON_VARIANT_VALUES.includes(
      value as (typeof BUTTON_VARIANT_VALUES)[number]
    )
  );
}

function isValidChatType(value: unknown): value is 'group' | 'channel' {
  return value === 'group' || value === 'channel';
}

function isValidOptionalTargetId(value: unknown): boolean {
  return value === undefined || isValidTargetId(value);
}

function validateNavigationTarget(
  target: unknown
): target is A2UI.NavigationTarget {
  if (!isPlainObject(target)) {
    return false;
  }

  switch (target.type) {
    case 'message':
      return (
        isValidTargetId(target.channelId) &&
        isValidTargetId(target.postId) &&
        isValidOptionalTargetId(target.parentId) &&
        isValidOptionalTargetId(target.parentAuthorId) &&
        isValidOptionalTargetId(target.authorId) &&
        isValidOptionalTargetId(target.groupId)
      );
    case 'channel':
      return (
        isValidTargetId(target.channelId) &&
        isValidOptionalTargetId(target.groupId) &&
        isValidOptionalTargetId(target.selectedPostId)
      );
    case 'group':
      return isValidTargetId(target.groupId);
    case 'profile':
      return (
        isValidTargetId(target.userId) &&
        isValidOptionalTargetId(target.groupId) &&
        isValidOptionalTargetId(target.channelId)
      );
    case 'chatDetails':
    case 'chatVolume':
      return (
        isValidChatType(target.chatType) &&
        isValidTargetId(target.chatId) &&
        isValidOptionalTargetId(target.groupId)
      );
    default:
      return false;
  }
}

function validateButtonAction(action: unknown): action is A2UI.ButtonAction {
  if (!isPlainObject(action) || !isPlainObject(action.event)) {
    return false;
  }

  const { event } = action;
  const context = event.context;

  if (event.name === ACTION_SEND_MESSAGE) {
    return (
      isPlainObject(context) &&
      isNonEmptyString(context.text) &&
      context.text.length <= LIMITS.maxButtonMessageLength
    );
  }

  if (event.name === ACTION_NAVIGATE) {
    return isPlainObject(context) && validateNavigationTarget(context.target);
  }

  return false;
}

function validateComponent(component: unknown): component is A2UI.Component {
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
        component.text.length <= LIMITS.maxTextNodeLength &&
        isValidTextVariant(component.variant)
      );
    case 'Row':
    case 'Column':
      return (
        Array.isArray(component.children) &&
        component.children.length <= LIMITS.maxChildren &&
        component.children.every((child) => isNonEmptyString(child)) &&
        new Set(component.children).size === component.children.length &&
        isValidContainerJustify(component.justify) &&
        isValidContainerAlign(component.align)
      );
    case 'Card':
      return isNonEmptyString(component.child);
    case 'Divider':
      return true;
    case 'Button': {
      const action = component.action;
      return (
        isNonEmptyString(component.child) &&
        (component.disabled === undefined ||
          typeof component.disabled === 'boolean') &&
        isValidButtonVariant(component.variant) &&
        validateButtonAction(action)
      );
    }
    default:
      return false;
  }
}

type ValidatedEnvelope = {
  createMessage: A2UI.CreateSurfaceMessage;
  updateMessage: A2UI.UpdateComponentsMessage;
  components: A2UI.Component[];
};

function validateEnvelope(entry: unknown): ValidatedEnvelope | null {
  if (!isPlainObject(entry) || entry.type !== 'a2ui' || entry.version !== 1) {
    return null;
  }

  if (JSON.stringify(entry).length > LIMITS.maxBytes) {
    return null;
  }

  if (!Array.isArray(entry.messages)) {
    return null;
  }

  const createMessage = entry.messages.find(
    (message): message is A2UI.CreateSurfaceMessage =>
      isPlainObject(message) && 'createSurface' in message
  );
  const updateMessage = entry.messages.find(
    (message): message is A2UI.UpdateComponentsMessage =>
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
    return null;
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
    components.length > LIMITS.maxComponents
  ) {
    return null;
  }

  if (!components.every(validateComponent)) {
    return null;
  }

  return { createMessage, updateMessage, components };
}

function indexComponents(
  components: A2UI.Component[]
): Map<string, A2UI.Component> | null {
  const byId = new Map<string, A2UI.Component>();
  let totalTextLength = 0;

  for (const component of components) {
    if (byId.has(component.id)) {
      return null;
    }
    byId.set(component.id, component);
    if (component.component === 'Button') {
      if (component.action.event.name === ACTION_SEND_MESSAGE) {
        totalTextLength += component.action.event.context.text.length;
      }
    } else if (component.component === 'Text') {
      totalTextLength += component.text.length;
    }
  }

  if (totalTextLength > LIMITS.maxTotalTextLength) {
    return null;
  }

  return byId;
}

function validateReachableTree(
  root: string,
  components: Map<string, A2UI.Component>
): boolean {
  if (!isNonEmptyString(root) || !components.has(root)) {
    return false;
  }

  const visiting = new Set<string>();
  let expandedComponentCount = 0;
  const maxExpandedComponents = LIMITS.maxComponents * LIMITS.maxChildren;

  function visit(id: string, depth: number): boolean {
    if (depth > LIMITS.maxDepth || visiting.has(id)) {
      return false;
    }
    expandedComponentCount += 1;
    if (expandedComponentCount > maxExpandedComponents) {
      return false;
    }
    const component = components.get(id);
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
    if (children.length > LIMITS.maxChildren) {
      return false;
    }
    for (const child of children) {
      if (!visit(child, depth + 1)) {
        return false;
      }
    }
    visiting.delete(id);
    return true;
  }

  return visit(root, 1);
}

export function getUpdateMessage(
  entry: A2UI.BlobEntry
): A2UI.UpdateComponentsMessage | null {
  return (
    entry.messages.find(
      (message): message is A2UI.UpdateComponentsMessage =>
        isPlainObject(message) && 'updateComponents' in message
    ) ?? null
  );
}

export function getRootComponentId(entry: A2UI.BlobEntry): string | null {
  const update = getUpdateMessage(entry);
  if (!update) {
    return null;
  }
  return (
    update.updateComponents.root ??
    update.updateComponents.components[0]?.id ??
    null
  );
}

export function validateBlobEntry(entry: unknown): entry is A2UI.BlobEntry {
  const envelope = validateEnvelope(entry);
  if (!envelope) {
    return false;
  }

  const components = indexComponents(envelope.components);
  if (!components) {
    return false;
  }

  const root =
    envelope.updateMessage.updateComponents.root ?? envelope.components[0]?.id;
  return validateReachableTree(root, components);
}

export const blobEntrySchema = z.custom<A2UI.BlobEntry>(validateBlobEntry);

export const A2UI = {
  action: {
    sendMessage: ACTION_SEND_MESSAGE,
    navigate: ACTION_NAVIGATE,
  },
  getUpdateMessage,
  getRootComponentId,
  validateBlobEntry,
  blobEntrySchema,
} as const;
