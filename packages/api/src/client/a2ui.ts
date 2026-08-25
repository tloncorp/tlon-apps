import { z } from 'zod';

import {
  AgentProviderConfigContextSchema,
  AgentProvisionActionContextSchema,
} from './agentProtocol';

const ACTION_SEND_MESSAGE = 'tlon.sendMessage';
const ACTION_NAVIGATE = 'tlon.navigate';
const ACTION_PROVISION_AGENT = 'tlon.provisionAgent';
const ACTION_CONFIGURE_AGENT_PROVIDERS = 'tlon.configureAgentProviders';

const LIMITS = {
  maxBytes: 32 * 1024,
  maxComponents: 50,
  maxDepth: 8,
  maxChildren: 12,
  maxChoiceOptions: 6,
  maxSmallChoiceOptions: 12,
  maxIdLength: 512,
  /** pills hold a word or two; a paragraph in one would break the layout */
  maxPillLabelLength: 64,
  maxTextNodeLength: 1000,
  maxButtonMessageLength: 1000,
  maxNavigationTargetIdLength: 500,
  maxTotalTextLength: 8000,
} as const;

const choiceIconSchema = z.enum([
  'ChannelNotebooks',
  'ChannelTalk',
  'ChannelGalleries',
  'Clock',
  'Search',
  'Face',
  'Link',
]);
const choiceAccentSchema = z.enum(['blue', 'green', 'indigo', 'neutral']);
const containerJustifySchema = z.enum([
  'start',
  'center',
  'end',
  'spaceBetween',
  'spaceAround',
]);
const containerAlignSchema = z.enum(['start', 'center', 'end', 'stretch']);
const textVariantSchema = z.enum([
  'body',
  'caption',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
]);
const buttonVariantSchema = z.enum([
  'default',
  'primary',
  'secondary',
  'borderless',
]);
const screenNameSchema = z.enum(['botMcpSettings']);

const nonEmptyString = (max?: number) => {
  const schema = max === undefined ? z.string() : z.string().max(max);
  return schema.refine((value) => value.trim().length > 0);
};

const uniqueBy = <T>(values: T[], select: (value: T) => unknown) =>
  new Set(values.map(select)).size === values.length;

const targetIdSchema = nonEmptyString(LIMITS.maxNavigationTargetIdLength);
const componentBaseShape = {
  id: nonEmptyString(LIMITS.maxIdLength),
  weight: z.number().min(0).max(12).optional(),
};

const messageNavigationTargetSchema = z.object({
  type: z.literal('message'),
  channelId: targetIdSchema,
  postId: targetIdSchema,
  parentId: targetIdSchema.optional(),
  parentAuthorId: targetIdSchema.optional(),
  authorId: targetIdSchema.optional(),
  groupId: targetIdSchema.optional(),
});
const channelNavigationTargetSchema = z.object({
  type: z.literal('channel'),
  channelId: targetIdSchema,
  groupId: targetIdSchema.optional(),
  selectedPostId: targetIdSchema.optional(),
});
const groupNavigationTargetSchema = z.object({
  type: z.literal('group'),
  groupId: targetIdSchema,
});
const profileNavigationTargetSchema = z.object({
  type: z.literal('profile'),
  userId: targetIdSchema,
  groupId: targetIdSchema.optional(),
  channelId: targetIdSchema.optional(),
});
const chatDetailsNavigationTargetSchema = z.object({
  type: z.literal('chatDetails'),
  chatType: z.enum(['group', 'channel']),
  chatId: targetIdSchema,
  groupId: targetIdSchema.optional(),
});
const chatVolumeNavigationTargetSchema = z.object({
  type: z.literal('chatVolume'),
  chatType: z.enum(['group', 'channel']),
  chatId: targetIdSchema,
  groupId: targetIdSchema.optional(),
});
const screenNavigationTargetSchema = z.object({
  type: z.literal('screen'),
  screen: screenNameSchema,
  providerId: targetIdSchema.optional(),
});
const navigationTargetSchema = z.discriminatedUnion('type', [
  messageNavigationTargetSchema,
  channelNavigationTargetSchema,
  groupNavigationTargetSchema,
  profileNavigationTargetSchema,
  chatDetailsNavigationTargetSchema,
  chatVolumeNavigationTargetSchema,
  screenNavigationTargetSchema,
]);

const sendMessageEventSchema = z.object({
  name: z.literal(ACTION_SEND_MESSAGE),
  context: z.object({
    text: nonEmptyString(LIMITS.maxButtonMessageLength),
  }),
});
const smallChoiceSendMessageEventSchema = z.object({
  name: z.literal(ACTION_SEND_MESSAGE),
  context: z.object({
    text: z.string().max(LIMITS.maxButtonMessageLength),
  }),
});
const navigateEventSchema = z.object({
  name: z.literal(ACTION_NAVIGATE),
  context: z.object({ target: navigationTargetSchema }),
});
const provisionAgentEventSchema = z.object({
  name: z.literal(ACTION_PROVISION_AGENT),
  context: AgentProvisionActionContextSchema,
});
const configureAgentProvidersEventSchema = z.object({
  name: z.literal(ACTION_CONFIGURE_AGENT_PROVIDERS),
  context: AgentProviderConfigContextSchema,
});
const buttonEventSchema = z.discriminatedUnion('name', [
  sendMessageEventSchema,
  navigateEventSchema,
  provisionAgentEventSchema,
  configureAgentProvidersEventSchema,
]);
const buttonActionSchema = z.object({ event: buttonEventSchema });
const sendMessageActionSchema = z.object({ event: sendMessageEventSchema });
const navigateActionSchema = z.object({ event: navigateEventSchema });
const provisionAgentActionSchema = z.object({
  event: provisionAgentEventSchema,
});
const configureAgentProvidersActionSchema = z.object({
  event: configureAgentProvidersEventSchema,
});
const smallChoiceActionSchema = z.union([
  z.object({ event: smallChoiceSendMessageEventSchema }),
  provisionAgentActionSchema,
]);

const textSchema = z.object({
  ...componentBaseShape,
  component: z.literal('Text'),
  text: z.string().max(LIMITS.maxTextNodeLength),
  variant: textVariantSchema.optional(),
});
const containerSchema = z.object({
  ...componentBaseShape,
  component: z.enum(['Row', 'Column']),
  children: z
    .array(nonEmptyString())
    .max(LIMITS.maxChildren)
    .refine((children) => uniqueBy(children, (child) => child)),
  justify: containerJustifySchema.optional(),
  align: containerAlignSchema.optional(),
});
const rowSchema = containerSchema.extend({ component: z.literal('Row') });
const columnSchema = containerSchema.extend({ component: z.literal('Column') });
const cardSchema = z.object({
  ...componentBaseShape,
  component: z.literal('Card'),
  child: nonEmptyString(),
});
const dividerSchema = z.object({
  ...componentBaseShape,
  component: z.literal('Divider'),
});
const buttonSchema = z.object({
  ...componentBaseShape,
  component: z.literal('Button'),
  child: nonEmptyString(),
  disabled: z.boolean().optional(),
  variant: buttonVariantSchema.optional(),
  action: buttonActionSchema,
});
const choiceOptionSchema = z.object({
  id: nonEmptyString(LIMITS.maxIdLength),
  label: nonEmptyString(LIMITS.maxTextNodeLength),
  description: z.string().max(LIMITS.maxTextNodeLength).optional(),
  icon: choiceIconSchema.optional(),
  accent: choiceAccentSchema.optional(),
  action: buttonActionSchema,
});
const choiceSchema = z.object({
  ...componentBaseShape,
  component: z.literal('Choice'),
  options: z
    .array(choiceOptionSchema)
    .min(1)
    .max(LIMITS.maxChoiceOptions)
    .refine((options) => uniqueBy(options, (option) => option.id)),
});
const smallChoiceOptionSchema = z.object({
  id: nonEmptyString(),
  label: nonEmptyString(LIMITS.maxPillLabelLength),
});
const smallChoiceSchema = z.object({
  ...componentBaseShape,
  component: z.literal('SmallChoice'),
  options: z
    .array(smallChoiceOptionSchema)
    .min(1)
    .max(LIMITS.maxSmallChoiceOptions)
    .refine((options) => uniqueBy(options, (option) => option.id))
    .refine((options) => uniqueBy(options, (option) => option.label)),
  submitLabel: nonEmptyString(LIMITS.maxPillLabelLength),
  freeTextPlaceholder: nonEmptyString(LIMITS.maxPillLabelLength).optional(),
  action: smallChoiceActionSchema,
});
const mcpSettingsNavigateActionSchema = z.object({
  event: z.object({
    name: z.literal(ACTION_NAVIGATE),
    context: z.object({
      target: screenNavigationTargetSchema.extend({
        screen: z.literal('botMcpSettings'),
      }),
    }),
  }),
});
const mcpConnectSchema = z.object({
  ...componentBaseShape,
  component: z.literal('McpConnect'),
  maxVisible: z.number().int().min(1).max(LIMITS.maxSmallChoiceOptions),
  seeAllLabel: nonEmptyString(LIMITS.maxPillLabelLength),
  submitLabel: nonEmptyString(LIMITS.maxPillLabelLength),
  action: mcpSettingsNavigateActionSchema,
  configureAction: configureAgentProvidersActionSchema,
  completionLabel: nonEmptyString(LIMITS.maxPillLabelLength).optional(),
  completionAction: sendMessageActionSchema.optional(),
});
const componentSchema = z
  .discriminatedUnion('component', [
    textSchema,
    rowSchema,
    columnSchema,
    cardSchema,
    dividerSchema,
    buttonSchema,
    choiceSchema,
    smallChoiceSchema,
    mcpConnectSchema,
  ])
  .refine(
    (component) =>
      component.component !== 'McpConnect' ||
      (component.completionLabel === undefined) ===
        (component.completionAction === undefined)
  );
const createSurfaceMessageSchema = z.object({
  version: z.literal('v0.9'),
  createSurface: z.object({
    surfaceId: nonEmptyString(LIMITS.maxIdLength),
    catalogId: nonEmptyString(),
  }),
});
const updateComponentsMessageSchema = z.object({
  version: z.literal('v0.9'),
  updateComponents: z.object({
    surfaceId: nonEmptyString(LIMITS.maxIdLength),
    components: z.array(componentSchema).min(1).max(LIMITS.maxComponents),
    root: z.string().optional(),
  }),
});
export namespace A2UI {
  export type Text = z.infer<typeof textSchema>;
  export type Container = z.infer<typeof containerSchema>;
  export type Card = z.infer<typeof cardSchema>;
  export type Divider = z.infer<typeof dividerSchema>;
  export type SendMessageEvent = z.infer<typeof sendMessageEventSchema>;
  export type MessageNavigationTarget = z.infer<
    typeof messageNavigationTargetSchema
  >;
  export type ChannelNavigationTarget = z.infer<
    typeof channelNavigationTargetSchema
  >;
  export type GroupNavigationTarget = z.infer<
    typeof groupNavigationTargetSchema
  >;
  export type ProfileNavigationTarget = z.infer<
    typeof profileNavigationTargetSchema
  >;
  export type ChatDetailsNavigationTarget = z.infer<
    typeof chatDetailsNavigationTargetSchema
  >;
  export type ChatVolumeNavigationTarget = z.infer<
    typeof chatVolumeNavigationTargetSchema
  >;
  /**
   * App screens a blob may navigate to. Unknown names fail validation so a
   * newer card safely degrades to fallback text on an older client.
   */
  export type ScreenName = z.infer<typeof screenNameSchema>;
  export type ScreenNavigationTarget = z.infer<
    typeof screenNavigationTargetSchema
  >;
  export type NavigationTarget = z.infer<typeof navigationTargetSchema>;
  export type NavigateEvent = z.infer<typeof navigateEventSchema>;
  /** Finish the durable, client-bound agent onboarding setup. */
  export type ProvisionAgentEvent = z.infer<typeof provisionAgentEventSchema>;
  /** Bind already-connected Hosting providers to a recurring agent job. */
  export type ConfigureAgentProvidersEvent = z.infer<
    typeof configureAgentProvidersEventSchema
  >;
  export type EventAction = z.infer<typeof buttonActionSchema>;
  export type ButtonAction = EventAction;
  export type SendMessageAction = z.infer<typeof sendMessageActionSchema>;
  export type NavigateAction = z.infer<typeof navigateActionSchema>;
  export type ProvisionAgentAction = z.infer<typeof provisionAgentActionSchema>;
  export type ConfigureAgentProvidersAction = z.infer<
    typeof configureAgentProvidersActionSchema
  >;
  export type Button = z.infer<typeof buttonSchema>;
  /** Allowlisted assets a Choice option may render. */
  export type ChoiceIcon = z.infer<typeof choiceIconSchema>;
  export type ChoiceAccent = z.infer<typeof choiceAccentSchema>;
  export type ChoiceOption = z.infer<typeof choiceOptionSchema>;
  /** A group of full-row option cards where the whole card is tappable. */
  export type Choice = z.infer<typeof choiceSchema>;
  export type SmallChoiceOption = z.infer<typeof smallChoiceOptionSchema>;
  /** A client-owned multi-select whose selection is posted only on submit. */
  export type SmallChoice = z.infer<typeof smallChoiceSchema>;
  /** A client-owned menu populated from the viewer's live MCP providers. */
  export type McpConnect = z.infer<typeof mcpConnectSchema>;
  export type Component = z.infer<typeof componentSchema>;
  export type CreateSurfaceMessage = z.infer<typeof createSurfaceMessageSchema>;
  export type UpdateComponentsMessage = z.infer<
    typeof updateComponentsMessageSchema
  >;
  export type Message = CreateSurfaceMessage | UpdateComponentsMessage;
  export type BlobEntry = {
    type: 'a2ui';
    version: 1;
    messages: Message[];
    recipe?: unknown;
    storyMode?: 'fallback';
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type ValidatedEnvelope = {
  createMessage: A2UI.CreateSurfaceMessage;
  updateMessage: A2UI.UpdateComponentsMessage;
  components: A2UI.Component[];
};

function addParseIssues(
  context: z.RefinementCtx,
  error: z.ZodError,
  prefix: (string | number)[]
) {
  for (const issue of error.issues) {
    context.addIssue({ ...issue, path: [...prefix, ...issue.path] });
  }
}

function validateEnvelope(
  entry: unknown,
  context: z.RefinementCtx
): ValidatedEnvelope | null {
  if (
    !isPlainObject(entry) ||
    entry.type !== 'a2ui' ||
    entry.version !== 1 ||
    !Array.isArray(entry.messages)
  ) {
    return null;
  }

  if (JSON.stringify(entry).length > LIMITS.maxBytes) {
    context.addIssue({
      code: z.ZodIssueCode.too_big,
      type: 'string',
      maximum: LIMITS.maxBytes,
      inclusive: true,
      path: [],
      message: 'A2UI blob exceeds the wire-size limit',
    });
    return null;
  }

  const createIndex = entry.messages.findIndex(
    (message) => isPlainObject(message) && 'createSurface' in message
  );
  const updateIndex = entry.messages.findIndex(
    (message) => isPlainObject(message) && 'updateComponents' in message
  );
  const createCandidate = entry.messages[createIndex];
  const updateCandidate = entry.messages[updateIndex];
  const createResult = createSurfaceMessageSchema.safeParse(createCandidate);
  const updateResult = updateComponentsMessageSchema.safeParse(updateCandidate);
  if (!createResult.success) {
    addParseIssues(
      context,
      createResult.error,
      createIndex < 0 ? ['messages'] : ['messages', createIndex]
    );
  }
  if (!updateResult.success) {
    addParseIssues(
      context,
      updateResult.error,
      updateIndex < 0 ? ['messages'] : ['messages', updateIndex]
    );
  }
  if (!createResult.success || !updateResult.success) {
    return null;
  }

  const createMessage = createResult.data;
  const updateMessage = updateResult.data;

  const surfaceId = createMessage.createSurface.surfaceId;
  const updateSurfaceId = updateMessage.updateComponents.surfaceId;
  const catalogId = createMessage.createSurface.catalogId;
  const components = updateMessage.updateComponents.components;

  if (surfaceId !== updateSurfaceId || !catalogId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['messages', updateIndex, 'updateComponents', 'surfaceId'],
      message: 'Surface ids must match',
    });
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
  if (!root.trim() || !components.has(root)) {
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

export function getCreateMessage(
  entry: A2UI.BlobEntry
): A2UI.CreateSurfaceMessage | null {
  return (
    entry.messages.find(
      (message): message is A2UI.CreateSurfaceMessage =>
        isPlainObject(message) && 'createSurface' in message
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
  return blobEntrySchema.safeParse(entry).success;
}

function validateParsedBlobEntry(
  entry: A2UI.BlobEntry,
  context: z.RefinementCtx
): void {
  const envelope = validateEnvelope(entry, context);
  if (!envelope) {
    return;
  }

  const components = indexComponents(envelope.components);
  if (!components) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['messages'],
      message: 'Components exceed uniqueness or text limits',
    });
    return;
  }

  const root =
    envelope.updateMessage.updateComponents.root ?? envelope.components[0]?.id;
  if (!validateReachableTree(root, components)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['messages'],
      message: 'Component tree is invalid or exceeds render limits',
    });
  }
}

const blobEntryShapeSchema: z.ZodType<A2UI.BlobEntry> = z
  .object({
    type: z.literal('a2ui'),
    version: z.literal(1),
    messages: z.array(z.any()),
    recipe: z.any().optional(),
    storyMode: z.literal('fallback').optional(),
  })
  .passthrough();

export const blobEntrySchema = blobEntryShapeSchema.superRefine(
  validateParsedBlobEntry
);

/**
 * The message a SmallChoice posts for a given selection: the action's text as a
 * prefix, then the selected labels comma-joined in declaration order. The
 * durable selection lives in a typed post-blob entry, so this string is only
 * presentation for the owner and bot.
 */
export function buildSmallChoiceMessage(
  component: A2UI.SmallChoice,
  selectedIds: Iterable<string>,
  /** free-text entries; each value remains a separate durable selection */
  freeText?: string | readonly string[]
): string {
  const selected = new Set(selectedIds);
  const labels = component.options
    .filter((option) => selected.has(option.id))
    .map((option) => option.label);
  const typed = (typeof freeText === 'string' ? [freeText] : (freeText ?? []))
    .map((value) => value.trim())
    .filter(Boolean);
  labels.push(...typed);
  if (!labels.length) {
    return '';
  }
  const selection = labels.join(', ');
  const prefix =
    component.action.event.name === ACTION_SEND_MESSAGE
      ? component.action.event.context.text.trim()
      : '';
  return [prefix, selection]
    .filter(Boolean)
    .join(' ')
    .slice(0, LIMITS.maxButtonMessageLength)
    .trim();
}

export const A2UI = {
  action: {
    sendMessage: ACTION_SEND_MESSAGE,
    navigate: ACTION_NAVIGATE,
    provisionAgent: ACTION_PROVISION_AGENT,
    configureAgentProviders: ACTION_CONFIGURE_AGENT_PROVIDERS,
  },
  getCreateMessage,
  getUpdateMessage,
  getRootComponentId,
  validateBlobEntry,
  blobEntrySchema,
  buildSmallChoiceMessage,
} as const;
