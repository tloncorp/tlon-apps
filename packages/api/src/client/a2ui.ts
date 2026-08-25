import { z } from 'zod';

const ACTION_SEND_MESSAGE = 'tlon.sendMessage';
const ACTION_NAVIGATE = 'tlon.navigate';

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
const nonEmptyString = (max?: number) => {
  const schema = max === undefined ? z.string() : z.string().max(max);
  return schema.refine((value) => value.trim().length > 0);
};

const uniqueBy = <T>(values: T[], select: (value: T) => unknown) =>
  new Set(values.map(select)).size === values.length;

const targetIdSchema = nonEmptyString(LIMITS.maxNavigationTargetIdLength);
const componentBaseShape = {
  id: nonEmptyString(),
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
const navigationTargetSchema = z.discriminatedUnion('type', [
  messageNavigationTargetSchema,
  channelNavigationTargetSchema,
  groupNavigationTargetSchema,
  profileNavigationTargetSchema,
  chatDetailsNavigationTargetSchema,
  chatVolumeNavigationTargetSchema,
]);

const sendMessageEventSchema = z.object({
  name: z.literal(ACTION_SEND_MESSAGE),
  context: z.object({
    text: nonEmptyString(LIMITS.maxButtonMessageLength),
  }),
});
const navigateEventSchema = z.object({
  name: z.literal(ACTION_NAVIGATE),
  context: z.object({ target: navigationTargetSchema }),
});
const buttonEventSchema = z.discriminatedUnion('name', [
  sendMessageEventSchema,
  navigateEventSchema,
]);
const buttonActionSchema = z.object({ event: buttonEventSchema });

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
const componentSchema = z.discriminatedUnion('component', [
  textSchema,
  rowSchema,
  columnSchema,
  cardSchema,
  dividerSchema,
  buttonSchema,
]);
const createSurfaceMessageSchema = z.object({
  version: z.literal('v0.9'),
  createSurface: z.object({
    surfaceId: nonEmptyString(),
    catalogId: nonEmptyString(),
  }),
});
const updateComponentsMessageSchema = z.object({
  version: z.literal('v0.9'),
  updateComponents: z.object({
    surfaceId: nonEmptyString(),
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
  export type NavigationTarget = z.infer<typeof navigationTargetSchema>;
  export type NavigateEvent = z.infer<typeof navigateEventSchema>;
  export type EventAction = z.infer<typeof buttonActionSchema>;
  export type ButtonAction = EventAction;
  export type Button = z.infer<typeof buttonSchema>;
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
  })
  .passthrough();

export const blobEntrySchema = blobEntryShapeSchema.superRefine(
  validateParsedBlobEntry
);

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
