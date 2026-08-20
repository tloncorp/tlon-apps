import { z } from 'zod';

const ACTION_SEND_MESSAGE = 'tlon.sendMessage';
const ACTION_NAVIGATE = 'tlon.navigate';

type ComponentBase = {
  id: string;
  weight?: number;
};

export namespace A2UI {
  export type CatalogId =
    | 'tlon.a2ui.basic.v1'
    | 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json';

  export type Text = ComponentBase & {
    component: 'Text';
    text: string;
    variant?: 'body' | 'caption' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5';
  };

  export type Image = ComponentBase & {
    component: 'Image';
    url: string;
    description?: string;
    fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scaleDown';
    variant?:
      | 'icon'
      | 'avatar'
      | 'smallFeature'
      | 'mediumFeature'
      | 'largeFeature'
      | 'header';
  };

  export type IconName =
    | 'accountCircle'
    | 'add'
    | 'arrowBack'
    | 'arrowForward'
    | 'attachFile'
    | 'calendarToday'
    | 'call'
    | 'camera'
    | 'check'
    | 'close'
    | 'delete'
    | 'download'
    | 'edit'
    | 'event'
    | 'error'
    | 'fastForward'
    | 'favorite'
    | 'favoriteOff'
    | 'folder'
    | 'help'
    | 'home'
    | 'info'
    | 'locationOn'
    | 'lock'
    | 'lockOpen'
    | 'mail'
    | 'menu'
    | 'moreVert'
    | 'moreHoriz'
    | 'notificationsOff'
    | 'notifications'
    | 'pause'
    | 'payment'
    | 'person'
    | 'phone'
    | 'photo'
    | 'play'
    | 'print'
    | 'refresh'
    | 'rewind'
    | 'search'
    | 'send'
    | 'settings'
    | 'share'
    | 'shoppingCart'
    | 'skipNext'
    | 'skipPrevious'
    | 'star'
    | 'starHalf'
    | 'starOff'
    | 'stop'
    | 'upload'
    | 'visibility'
    | 'visibilityOff'
    | 'volumeDown'
    | 'volumeMute'
    | 'volumeOff'
    | 'volumeUp'
    | 'warning';

  export type Icon = ComponentBase & {
    component: 'Icon';
    name: IconName;
  };

  export type Container = ComponentBase & {
    component: 'Row' | 'Column';
    children: string[];
    justify?:
      | 'start'
      | 'center'
      | 'end'
      | 'spaceBetween'
      | 'spaceAround'
      | 'spaceEvenly'
      | 'stretch';
    align?: 'start' | 'center' | 'end' | 'stretch';
  };

  export type Card = ComponentBase & {
    component: 'Card';
    child: string;
  };

  export type Divider = ComponentBase & {
    component: 'Divider';
    axis?: 'horizontal' | 'vertical';
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

  export type Component =
    | Text
    | Image
    | Icon
    | Container
    | Card
    | Divider
    | Button;

  export type CreateSurfaceMessage = {
    version: 'v0.9';
    createSurface: {
      surfaceId: string;
      catalogId: CatalogId;
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

  export type ResolvedComponentGraph = {
    root: string;
    components: Map<string, Component>;
  };
}

const LIMITS = {
  maxBytes: 32 * 1024,
  maxComponents: 50,
  maxDepth: 8,
  maxJsonDepth: 20,
  maxJsonNodes: 1000,
  maxChildren: 12,
  maxComponentIdLength: 200,
  maxComponentNameLength: 100,
  maxSurfaceIdLength: 500,
  maxTextNodeLength: 1000,
  maxImageUrlLength: 2048,
  maxImageDescriptionLength: 500,
  maxButtonMessageLength: 1000,
  maxNavigationTargetIdLength: 500,
  maxTotalTextLength: 8000,
} as const;

const CATALOG_IDS = [
  'tlon.a2ui.basic.v1',
  'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json',
] as const satisfies readonly A2UI.CatalogId[];

const COMPONENT_NAMES = [
  'Card',
  'Column',
  'Row',
  'Text',
  'Image',
  'Icon',
  'Divider',
  'Button',
] as const satisfies readonly A2UI.Component['component'][];

const CONTAINER_JUSTIFY_VALUES = [
  'start',
  'center',
  'end',
  'spaceBetween',
  'spaceAround',
  'spaceEvenly',
  'stretch',
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

const IMAGE_FIT_VALUES = [
  'contain',
  'cover',
  'fill',
  'none',
  'scaleDown',
] as const;

const IMAGE_VARIANT_VALUES = [
  'icon',
  'avatar',
  'smallFeature',
  'mediumFeature',
  'largeFeature',
  'header',
] as const;

const ICON_NAMES = [
  'accountCircle',
  'add',
  'arrowBack',
  'arrowForward',
  'attachFile',
  'calendarToday',
  'call',
  'camera',
  'check',
  'close',
  'delete',
  'download',
  'edit',
  'event',
  'error',
  'fastForward',
  'favorite',
  'favoriteOff',
  'folder',
  'help',
  'home',
  'info',
  'locationOn',
  'lock',
  'lockOpen',
  'mail',
  'menu',
  'moreVert',
  'moreHoriz',
  'notificationsOff',
  'notifications',
  'pause',
  'payment',
  'person',
  'phone',
  'photo',
  'play',
  'print',
  'refresh',
  'rewind',
  'search',
  'send',
  'settings',
  'share',
  'shoppingCart',
  'skipNext',
  'skipPrevious',
  'star',
  'starHalf',
  'starOff',
  'stop',
  'upload',
  'visibility',
  'visibilityOff',
  'volumeDown',
  'volumeMute',
  'volumeOff',
  'volumeUp',
  'warning',
] as const satisfies readonly A2UI.IconName[];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isBoundedNonEmptyString(
  value: unknown,
  maxLength: number
): value is string {
  return isNonEmptyString(value) && value.length <= maxLength;
}

function hasSafeJsonStructure(value: unknown): boolean {
  const stack = [{ value, depth: 0 }];
  const seen = new Set<object>();
  let nodeCount = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    nodeCount += 1;
    if (
      nodeCount > LIMITS.maxJsonNodes ||
      current.depth > LIMITS.maxJsonDepth
    ) {
      return false;
    }
    if (typeof current.value !== 'object' || current.value === null) {
      continue;
    }
    if (seen.has(current.value)) {
      return false;
    }
    seen.add(current.value);
    for (const child of Object.values(current.value)) {
      stack.push({ value: child, depth: current.depth + 1 });
    }
  }

  return true;
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index);
    if (codePoint === undefined) {
      continue;
    }
    if (codePoint <= 0x7f) {
      bytes += 1;
    } else if (codePoint <= 0x7ff) {
      bytes += 2;
    } else if (codePoint <= 0xffff) {
      bytes += 3;
    } else {
      bytes += 4;
      index += 1;
    }
  }
  return bytes;
}

function isSupportedCatalogId(value: unknown): value is A2UI.CatalogId {
  return CATALOG_IDS.includes(value as A2UI.CatalogId);
}

function isSafeImageUrl(value: unknown): value is string {
  if (
    !isBoundedNonEmptyString(value, LIMITS.maxImageUrlLength) ||
    (!value.startsWith('https://') && !value.startsWith('http://'))
  ) {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
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

function isValidImageFit(value: unknown): boolean {
  return (
    value === undefined ||
    IMAGE_FIT_VALUES.includes(value as (typeof IMAGE_FIT_VALUES)[number])
  );
}

function isValidImageVariant(value: unknown): boolean {
  return (
    value === undefined ||
    IMAGE_VARIANT_VALUES.includes(
      value as (typeof IMAGE_VARIANT_VALUES)[number]
    )
  );
}

function isValidIconName(value: unknown): value is A2UI.IconName {
  return ICON_NAMES.includes(value as A2UI.IconName);
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
  if (
    !isPlainObject(component) ||
    !isBoundedNonEmptyString(component.id, LIMITS.maxComponentIdLength) ||
    !isBoundedNonEmptyString(component.component, LIMITS.maxComponentNameLength)
  ) {
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
    case 'Image':
      return (
        isSafeImageUrl(component.url) &&
        (component.description === undefined ||
          (typeof component.description === 'string' &&
            component.description.length <=
              LIMITS.maxImageDescriptionLength)) &&
        isValidImageFit(component.fit) &&
        isValidImageVariant(component.variant)
      );
    case 'Icon':
      return isValidIconName(component.name);
    case 'Row':
    case 'Column':
      return (
        Array.isArray(component.children) &&
        component.children.length <= LIMITS.maxChildren &&
        component.children.every((child) =>
          isBoundedNonEmptyString(child, LIMITS.maxComponentIdLength)
        ) &&
        new Set(component.children).size === component.children.length &&
        isValidContainerJustify(component.justify) &&
        isValidContainerAlign(component.align)
      );
    case 'Card':
      return isBoundedNonEmptyString(
        component.child,
        LIMITS.maxComponentIdLength
      );
    case 'Divider':
      return (
        component.axis === undefined ||
        component.axis === 'horizontal' ||
        component.axis === 'vertical'
      );
    case 'Button': {
      const action = component.action;
      return (
        isBoundedNonEmptyString(component.child, LIMITS.maxComponentIdLength) &&
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

  if (!hasSafeJsonStructure(entry)) {
    return null;
  }

  try {
    if (utf8ByteLength(JSON.stringify(entry)) > LIMITS.maxBytes) {
      return null;
    }
  } catch {
    return null;
  }

  if (!Array.isArray(entry.messages) || entry.messages.length !== 2) {
    return null;
  }

  const isSupportedMessage = entry.messages.every((message) => {
    if (!isPlainObject(message) || message.version !== 'v0.9') {
      return false;
    }
    const hasCreate = 'createSurface' in message;
    const hasUpdate = 'updateComponents' in message;
    return (
      hasCreate !== hasUpdate &&
      Object.keys(message).every(
        (key) =>
          key === 'version' ||
          key === 'createSurface' ||
          key === 'updateComponents'
      )
    );
  });
  if (!isSupportedMessage) {
    return null;
  }

  const createMessages = entry.messages.filter(
    (message): message is A2UI.CreateSurfaceMessage =>
      isPlainObject(message) && 'createSurface' in message
  );
  const updateMessages = entry.messages.filter(
    (message): message is A2UI.UpdateComponentsMessage =>
      isPlainObject(message) && 'updateComponents' in message
  );
  const createMessage = createMessages[0];
  const updateMessage = updateMessages[0];

  if (
    createMessages.length !== 1 ||
    updateMessages.length !== 1 ||
    !createMessage ||
    !updateMessage ||
    !isPlainObject(createMessage.createSurface) ||
    !isPlainObject(updateMessage.updateComponents)
  ) {
    return null;
  }

  const surfaceId = createMessage.createSurface.surfaceId;
  const updateSurfaceId = updateMessage.updateComponents.surfaceId;
  const catalogId = createMessage.createSurface.catalogId;
  const components = updateMessage.updateComponents.components;
  const root = updateMessage.updateComponents.root;

  if (
    !isBoundedNonEmptyString(surfaceId, LIMITS.maxSurfaceIdLength) ||
    surfaceId !== updateSurfaceId ||
    !isSupportedCatalogId(catalogId) ||
    (root !== undefined &&
      !isBoundedNonEmptyString(root, LIMITS.maxComponentIdLength)) ||
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

function hasValidComponentReferences(
  components: Map<string, A2UI.Component>
): boolean {
  for (const component of components.values()) {
    const children =
      component.component === 'Row' || component.component === 'Column'
        ? component.children
        : component.component === 'Card' || component.component === 'Button'
          ? [component.child]
          : [];
    if (children.some((child) => !components.has(child))) {
      return false;
    }
  }
  return true;
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
  const explicitRoot = update.updateComponents.root;
  if (isBoundedNonEmptyString(explicitRoot, LIMITS.maxComponentIdLength)) {
    return explicitRoot;
  }
  return update.updateComponents.components.some(
    (component) => component.id === 'root'
  )
    ? 'root'
    : null;
}

export function resolveComponentGraph(
  entry: unknown
): A2UI.ResolvedComponentGraph | null {
  const envelope = validateEnvelope(entry);
  if (!envelope) {
    return null;
  }

  const components = indexComponents(envelope.components);
  if (!components || !hasValidComponentReferences(components)) {
    return null;
  }

  const root = isBoundedNonEmptyString(
    envelope.updateMessage.updateComponents.root,
    LIMITS.maxComponentIdLength
  )
    ? envelope.updateMessage.updateComponents.root
    : components.has('root')
      ? 'root'
      : null;
  if (!root || !validateReachableTree(root, components)) {
    return null;
  }
  return { root, components };
}

export function validateBlobEntry(entry: unknown): entry is A2UI.BlobEntry {
  return resolveComponentGraph(entry) !== null;
}

export function getValidationTelemetry(entry: unknown): {
  hasUnsupportedCatalog: boolean;
  unsupportedComponentCount: number;
} {
  if (!isPlainObject(entry) || !Array.isArray(entry.messages)) {
    return { hasUnsupportedCatalog: false, unsupportedComponentCount: 0 };
  }
  let hasUnsupportedCatalog = false;
  let unsupportedComponentCount = 0;
  for (const message of entry.messages) {
    if (!isPlainObject(message)) {
      continue;
    }
    if (isPlainObject(message.createSurface)) {
      const catalogId = message.createSurface.catalogId;
      hasUnsupportedCatalog ||= Boolean(
        isNonEmptyString(catalogId) && !isSupportedCatalogId(catalogId)
      );
    }
    if (
      isPlainObject(message.updateComponents) &&
      Array.isArray(message.updateComponents.components)
    ) {
      unsupportedComponentCount += message.updateComponents.components.filter(
        (component) =>
          isPlainObject(component) &&
          isNonEmptyString(component.component) &&
          !COMPONENT_NAMES.includes(
            component.component as A2UI.Component['component']
          )
      ).length;
    }
  }
  return { hasUnsupportedCatalog, unsupportedComponentCount };
}

export const blobEntrySchema = z.custom<A2UI.BlobEntry>(validateBlobEntry);

export const A2UI = {
  catalog: {
    ids: CATALOG_IDS,
    components: COMPONENT_NAMES,
    icons: ICON_NAMES,
  },
  action: {
    sendMessage: ACTION_SEND_MESSAGE,
    navigate: ACTION_NAVIGATE,
  },
  getUpdateMessage,
  getRootComponentId,
  resolveComponentGraph,
  getValidationTelemetry,
  validateBlobEntry,
  blobEntrySchema,
} as const;
