import { z } from 'zod';

import { AGENT_PROTOCOL_LIMITS } from './agentProtocol';

const ACTION_SEND_MESSAGE = 'tlon.sendMessage';
const ACTION_NAVIGATE = 'tlon.navigate';
const ACTION_PROVISION_AGENT = 'tlon.provisionAgent';
const ACTION_CONFIGURE_AGENT_PROVIDERS = 'tlon.configureAgentProviders';

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

  /**
   * The app screens a blob may navigate to. An allowlist rather than a free
   * route name: blobs cross the wire, and the renderer must not be able to
   * be pointed at an arbitrary navigator route. Unknown names fail
   * validation, so a card using a newer screen degrades to its text
   * fallback on older clients.
   */
  export type ScreenName = 'botMcpSettings';

  export type ScreenNavigationTarget = {
    type: 'screen';
    screen: ScreenName;
    /** Provider to open immediately when navigating to MCP settings. */
    providerId?: string;
  };

  export type NavigationTarget =
    | MessageNavigationTarget
    | ChannelNavigationTarget
    | GroupNavigationTarget
    | ProfileNavigationTarget
    | ChatDetailsNavigationTarget
    | ChatVolumeNavigationTarget
    | ScreenNavigationTarget;

  export type NavigateEvent = {
    name: typeof ACTION_NAVIGATE;
    context: {
      target: NavigationTarget;
    };
  };

  /**
   * Finish the durable, message-by-message agent onboarding conversation.
   * The bot supplies only the choices already visible in the transcript; the
   * owner client binds them to its group, notebook, and local timezone before
   * posting the canonical provision request.
   */
  export type ProvisionAgentEvent = {
    name: typeof ACTION_PROVISION_AGENT;
    context: {
      groupId: string;
      purposeId: string;
      purpose: string;
      topics: string[];
      scheduleHour: number;
      scheduleMinute: number;
    };
  };

  /**
   * Bind already-connected Hosting providers to this group's recurring agent
   * job. The client replaces the representative provider list with the
   * viewer's live selection before posting the durable configuration event.
   */
  export type ConfigureAgentProvidersEvent = {
    name: typeof ACTION_CONFIGURE_AGENT_PROVIDERS;
    context: {
      groupId: string;
      provisionId: string;
      providerIds: string[];
    };
  };

  export type EventAction = {
    event:
      | SendMessageEvent
      | NavigateEvent
      | ProvisionAgentEvent
      | ConfigureAgentProvidersEvent;
  };

  export type ButtonAction = EventAction;

  /** An action narrowed to posting a message, for controls that only ever do that. */
  export type SendMessageAction = {
    event: SendMessageEvent;
  };

  export type NavigateAction = {
    event: NavigateEvent;
  };

  export type ProvisionAgentAction = {
    event: ProvisionAgentEvent;
  };

  export type ConfigureAgentProvidersAction = {
    event: ConfigureAgentProvidersEvent;
  };

  export type Button = ComponentBase & {
    component: 'Button';
    child: string;
    disabled?: boolean;
    variant?: 'default' | 'primary' | 'secondary' | 'borderless';
    action: ButtonAction;
  };

  /**
   * Icons a Choice option may carry. An allowlist rather than a free string:
   * these blobs are built by Tlon code, but the renderer must not be able to
   * be pointed at an arbitrary asset name by anything that reaches the wire.
   */
  export type ChoiceIcon =
    | 'ChannelNotebooks'
    | 'ChannelTalk'
    | 'ChannelGalleries'
    | 'Clock'
    | 'Search'
    | 'Face'
    | 'Link';

  export type ChoiceAccent = 'blue' | 'green' | 'indigo' | 'neutral';

  export type ChoiceOption = {
    id: string;
    label: string;
    /** secondary line under the label */
    description?: string;
    icon?: ChoiceIcon;
    accent?: ChoiceAccent;
    action: ButtonAction;
  };

  /**
   * A group of tappable option cards — icon, title, description — where the
   * whole card is the target. Buttons can only carry a text label, so this is
   * the primitive for "pick one of these" choices.
   */
  export type Choice = ComponentBase & {
    component: 'Choice';
    options: ChoiceOption[];
  };

  export type SmallChoiceOption = {
    id: string;
    label: string;
  };

  /**
   * A wrapping list of pill buttons the user can multi-select, with a submit
   * that posts the chosen labels as one message.
   *
   * Distinct from Choice: Choice is "pick one of these, each a card with a
   * description"; SmallChoice is "pick as many of these short labels as
   * apply". Selection lives in the client until submit — nothing is posted
   * per tap — so the action is always a sendMessage whose `context.text` is a
   * prefix and whose selected labels are appended, comma-joined.
   */
  export type SmallChoice = ComponentBase & {
    component: 'SmallChoice';
    options: SmallChoiceOption[];
    /** label for the confirm control, e.g. "Done" */
    submitLabel: string;
    /**
     * When set, the picker renders a free-text field with this placeholder,
     * and whatever is typed submits *with* the selected pills as one message
     * — without it, "some of these plus one of my own" takes two messages.
     * Older clients ignore the field and render the pills alone.
     */
    freeTextPlaceholder?: string;
    action: SendMessageAction | ProvisionAgentAction;
  };

  /**
   * A client-owned menu of the MCP providers available to the current user.
   * Provider names and connection state are deliberately loaded by the
   * client: they are Hosting data, not facts the message author can know.
   */
  export type McpConnect = ComponentBase & {
    component: 'McpConnect';
    /** number of providers shown before the menu expands */
    maxVisible: number;
    seeAllLabel: string;
    submitLabel: string;
    action: NavigateAction;
    configureAction: ConfigureAgentProvidersAction;
    /** Optional final action rendered inside the connector menu shell. */
    completionLabel?: string;
    completionAction?: SendMessageAction;
  };

  export type Component =
    | Text
    | Container
    | Card
    | Divider
    | Button
    | Choice
    | SmallChoice
    | McpConnect;

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
    /** The post story is a complete fallback for clients without this UI. */
    storyMode?: 'fallback';
    recipe?: unknown;
  };
}

const CHOICE_ICONS = [
  'ChannelNotebooks',
  'ChannelTalk',
  'ChannelGalleries',
  'Clock',
  'Search',
  'Face',
  'Link',
] as const;

const CHOICE_ACCENTS = ['blue', 'green', 'indigo', 'neutral'] as const;

const LIMITS = {
  maxBytes: 32 * 1024,
  maxComponents: 50,
  maxDepth: 8,
  maxChildren: 12,
  maxChoiceOptions: 6,
  maxSmallChoiceOptions: 12,
  /** pills hold a word or two; a paragraph in one would break the layout */
  maxPillLabelLength: 64,
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
    case 'screen':
      return (
        A2UI_SCREEN_NAMES.has(target.screen as A2UI.ScreenName) &&
        isValidOptionalTargetId(target.providerId)
      );
    default:
      return false;
  }
}

/** Matches {@link A2UI.ScreenName} — the validator's runtime allowlist. */
const A2UI_SCREEN_NAMES: ReadonlySet<A2UI.ScreenName> = new Set([
  'botMcpSettings',
]);

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

  if (event.name === ACTION_PROVISION_AGENT) {
    return (
      isPlainObject(context) &&
      isNonEmptyString(context.groupId) &&
      context.groupId.length <= AGENT_PROTOCOL_LIMITS.groupIdLength &&
      isNonEmptyString(context.purposeId) &&
      context.purposeId.length <= AGENT_PROTOCOL_LIMITS.identifierLength &&
      isNonEmptyString(context.purpose) &&
      context.purpose.length <= AGENT_PROTOCOL_LIMITS.purposeLength &&
      Array.isArray(context.topics) &&
      context.topics.length > 0 &&
      context.topics.length <= AGENT_PROTOCOL_LIMITS.topicCount &&
      context.topics.every(
        (topic) =>
          isNonEmptyString(topic) &&
          topic.length <= AGENT_PROTOCOL_LIMITS.topicLength
      ) &&
      typeof context.scheduleHour === 'number' &&
      Number.isInteger(context.scheduleHour) &&
      context.scheduleHour >= 0 &&
      context.scheduleHour <= 23 &&
      typeof context.scheduleMinute === 'number' &&
      Number.isInteger(context.scheduleMinute) &&
      context.scheduleMinute >= 0 &&
      context.scheduleMinute <= 59
    );
  }

  if (event.name === ACTION_CONFIGURE_AGENT_PROVIDERS) {
    return (
      isPlainObject(context) &&
      isNonEmptyString(context.groupId) &&
      context.groupId.length <= AGENT_PROTOCOL_LIMITS.groupIdLength &&
      isNonEmptyString(context.provisionId) &&
      context.provisionId.length <= AGENT_PROTOCOL_LIMITS.identifierLength &&
      Array.isArray(context.providerIds) &&
      context.providerIds.length <= AGENT_PROTOCOL_LIMITS.providerCount &&
      context.providerIds.every(
        (providerId) =>
          isNonEmptyString(providerId) &&
          providerId.length <= AGENT_PROTOCOL_LIMITS.providerIdLength &&
          /^[a-z0-9][a-z0-9._-]*$/i.test(providerId)
      ) &&
      new Set(context.providerIds).size === context.providerIds.length
    );
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
    case 'Choice':
      return validOptionList(
        component.options,
        LIMITS.maxChoiceOptions,
        validateChoiceOption
      );
    case 'SmallChoice':
      return (
        validOptionList(
          component.options,
          LIMITS.maxSmallChoiceOptions,
          validateSmallChoiceOption
        ) &&
        isNonEmptyString(component.submitLabel) &&
        (component.submitLabel as string).length <= LIMITS.maxPillLabelLength &&
        (component.freeTextPlaceholder === undefined ||
          (isNonEmptyString(component.freeTextPlaceholder) &&
            (component.freeTextPlaceholder as string).length <=
              LIMITS.maxPillLabelLength)) &&
        validateSmallChoiceAction(component.action)
      );
    case 'McpConnect':
      return (
        Number.isInteger(component.maxVisible) &&
        (component.maxVisible as number) >= 1 &&
        (component.maxVisible as number) <= LIMITS.maxSmallChoiceOptions &&
        isShortLabel(component.seeAllLabel) &&
        isShortLabel(component.submitLabel) &&
        validateButtonAction(component.action) &&
        component.action.event.name === ACTION_NAVIGATE &&
        component.action.event.context.target.type === 'screen' &&
        component.action.event.context.target.screen === 'botMcpSettings' &&
        validateButtonAction(component.configureAction) &&
        component.configureAction.event.name ===
          ACTION_CONFIGURE_AGENT_PROVIDERS &&
        ((component.completionLabel === undefined &&
          component.completionAction === undefined) ||
          (isShortLabel(component.completionLabel) &&
            validateButtonAction(component.completionAction) &&
            component.completionAction.event.name === ACTION_SEND_MESSAGE))
      );
    default:
      return false;
  }
}

function isShortLabel(value: unknown): value is string {
  return isNonEmptyString(value) && value.length <= LIMITS.maxPillLabelLength;
}

/** A bounded, non-empty option list with unique ids and valid entries. */
function validOptionList(
  options: unknown,
  max: number,
  validate: (option: unknown) => boolean
): boolean {
  return (
    Array.isArray(options) &&
    options.length > 0 &&
    options.length <= max &&
    new Set(options.map((option) => (option as { id?: unknown })?.id)).size ===
      options.length &&
    options.every(validate)
  );
}

/**
 * A SmallChoice can either post its selection as text or finish agent setup
 * with that selection. Navigation is rejected because it would discard the
 * user's picks. A send-message text may be empty because it is only a prefix.
 */
function validateSmallChoiceAction(
  action: unknown
): action is A2UI.SmallChoice['action'] {
  if (!isPlainObject(action) || !isPlainObject(action.event)) {
    return false;
  }
  const { event } = action;
  if (event.name === ACTION_PROVISION_AGENT) {
    return validateButtonAction(action);
  }
  if (event.name !== ACTION_SEND_MESSAGE || !isPlainObject(event.context)) {
    return false;
  }
  const { text } = event.context;
  return (
    typeof text === 'string' && text.length <= LIMITS.maxButtonMessageLength
  );
}

function validateSmallChoiceOption(
  option: unknown
): option is A2UI.SmallChoiceOption {
  if (!isPlainObject(option)) {
    return false;
  }
  return (
    isNonEmptyString(option.id) &&
    isNonEmptyString(option.label) &&
    (option.label as string).length <= LIMITS.maxPillLabelLength
  );
}

function validateChoiceOption(option: unknown): option is A2UI.ChoiceOption {
  if (!isPlainObject(option)) {
    return false;
  }
  return (
    isNonEmptyString(option.id) &&
    isNonEmptyString(option.label) &&
    (option.label as string).length <= LIMITS.maxTextNodeLength &&
    (option.description === undefined ||
      (typeof option.description === 'string' &&
        option.description.length <= LIMITS.maxTextNodeLength)) &&
    isValidChoiceIcon(option.icon) &&
    isValidChoiceAccent(option.accent) &&
    validateButtonAction(option.action)
  );
}

function isValidChoiceIcon(icon: unknown): icon is A2UI.ChoiceIcon | undefined {
  return (
    icon === undefined ||
    (typeof icon === 'string' &&
      (CHOICE_ICONS as readonly string[]).includes(icon))
  );
}

function isValidChoiceAccent(
  accent: unknown
): accent is A2UI.ChoiceAccent | undefined {
  return (
    accent === undefined ||
    (typeof accent === 'string' &&
      (CHOICE_ACCENTS as readonly string[]).includes(accent))
  );
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
    } else if (component.component === 'Choice') {
      // Choice carries its own copy — count it, or it bypasses the budget.
      for (const option of component.options) {
        totalTextLength += option.label.length;
        totalTextLength += option.description?.length ?? 0;
        if (option.action.event.name === ACTION_SEND_MESSAGE) {
          totalTextLength += option.action.event.context.text.length;
        }
      }
    } else if (component.component === 'SmallChoice') {
      for (const option of component.options) {
        totalTextLength += option.label.length;
      }
      totalTextLength += component.submitLabel.length;
      totalTextLength += component.freeTextPlaceholder?.length ?? 0;
      if (component.action.event.name === ACTION_SEND_MESSAGE) {
        totalTextLength += component.action.event.context.text.length;
      }
    } else if (component.component === 'McpConnect') {
      totalTextLength +=
        component.seeAllLabel.length + component.submitLabel.length;
      totalTextLength += component.completionLabel?.length ?? 0;
      totalTextLength +=
        component.completionAction?.event.context.text.length ?? 0;
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

/**
 * The message a SmallChoice posts for a given selection: the action's text as a
 * prefix, then the selected labels comma-joined in the order the options were
 * declared (not tap order, so the same picks always read the same).
 *
 * Shared so the renderer and the agent that reads the reply agree on the exact
 * wording — a mismatch here means the agent can't recognize its own picker's
 * answer.
 */
export function buildSmallChoiceMessage(
  component: A2UI.SmallChoice,
  selectedIds: Iterable<string>,
  /** free-text field contents; joins the selected labels as one more entry */
  freeText?: string
): string {
  const selected = new Set(selectedIds);
  const labels = component.options
    .filter((option) => selected.has(option.id))
    .map((option) => option.label);
  const typed = freeText?.trim();
  if (typed) {
    labels.push(typed);
  }
  if (!labels.length) {
    return '';
  }
  const selection = encodeSmallChoiceValues(labels);
  const prefix =
    component.action.event.name === ACTION_SEND_MESSAGE
      ? component.action.event.context.text.trim()
      : '';
  if (!prefix) {
    return selection.slice(0, LIMITS.maxButtonMessageLength);
  }
  const prefixBudget = Math.max(
    0,
    LIMITS.maxButtonMessageLength - selection.length - 1
  );
  return [prefix.slice(0, prefixBudget), selection].filter(Boolean).join(' ');
}

/** CSV keeps a custom value containing commas as one durable selection. */
export function encodeSmallChoiceValues(values: readonly string[]): string {
  return values
    .map((value) =>
      /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
    )
    .join(', ');
}

export function parseSmallChoiceValues(value: string): string[] {
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

/**
 * A stand-in message for asking "could this picker send anything at all?".
 *
 * A SmallChoice's own `action.event.context.text` is only a prefix and is
 * normally empty, so an availability check written for Button — where that text
 * *is* the whole message — reads it as "nothing to send" and disables the
 * picker before the user can choose. Probe with every option selected instead:
 * always non-empty, and representative of what submitting would post.
 */
export function smallChoiceProbeMessage(component: A2UI.SmallChoice): string {
  return buildSmallChoiceMessage(
    component,
    component.options.map((option) => option.id)
  );
}

export const A2UI = {
  /** Wire limits used by controls that construct durable agent actions. */
  agentProtocolLimits: AGENT_PROTOCOL_LIMITS,
  action: {
    sendMessage: ACTION_SEND_MESSAGE,
    navigate: ACTION_NAVIGATE,
    provisionAgent: ACTION_PROVISION_AGENT,
    configureAgentProviders: ACTION_CONFIGURE_AGENT_PROVIDERS,
  },
  getUpdateMessage,
  getRootComponentId,
  validateBlobEntry,
  blobEntrySchema,
  buildSmallChoiceMessage,
  parseSmallChoiceValues,
  smallChoiceProbeMessage,
} as const;
