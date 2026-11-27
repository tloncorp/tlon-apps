/**
 * Link an existing workspace in the owner's DM. The propose-first note asked
 * the model to write a line naming the workspace and then its `Ref:` path on a
 * line of its own; now and then it wrote the name and dropped the path, which
 * leaves the owner a bare title instead of a card to tap. This tool posts the
 * line and the reference itself, so the card can't go missing.
 */

const GROUP_ID_REGEX = /^~[a-z][a-z-]*\/[a-z][a-z0-9-]*$/;

export const workspaceLinkToolMetadata = {
  name: 'tlon_workspace_link',
  label: 'Sato Workspace Link',
  description:
    "Point your owner to a workspace they already have, in their DM: posts your one line naming it and the workspace's card. " +
    'Use it instead of proposing a new workspace when one already covers the topic, once per conversation. ' +
    "Then answer the owner's message as usual; don't repeat the link or its path.",
  promptSnippet:
    '`tlon_workspace_link`: link the owner to an existing workspace that covers the topic',
  promptGuidelines: [],
};

export const workspaceLinkToolParameters = {
  type: 'object',
  properties: {
    groupId: {
      type: 'string',
      description:
        'The workspace\'s ID from `groups list`, such as "~sampel-palnet/lisbon-trip".',
    },
    line: {
      type: 'string',
      maxLength: 200,
      description:
        'One line naming the workspace, such as "This fits in your Lisbon Trip workspace:".',
    },
  },
  required: ['groupId', 'line'],
  additionalProperties: false,
} as const;

function textResult(text: string, error = false) {
  return {
    content: [{ type: 'text' as const, text }],
    details: error ? { error: true } : undefined,
  };
}

/** `~host/slug`, from an ID or a `/1/group/~host/slug` path. */
export function normalizeWorkspaceGroupId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const id = raw
    .trim()
    .replace(/^\/1\/group\//, '')
    .replace(/\/+$/, '');
  return GROUP_ID_REGEX.test(id) ? id : null;
}

export function createWorkspaceLinkToolExecutor(deps: {
  ownerShip: () => string | undefined;
  /** The bot's groups, by ID: a link to anything else would be a dead card. */
  groupIds: () => Promise<string[]>;
  /** Posts text the way replies are posted, so the path becomes a card. */
  postText: (target: string, text: string) => Promise<unknown>;
}) {
  return async function execute(_id: string, params: unknown) {
    try {
      const ownerShip = deps.ownerShip();
      if (!ownerShip) throw new Error('no owner is configured for this bot');
      const p = (params ?? {}) as { groupId?: unknown; line?: unknown };
      const groupId = normalizeWorkspaceGroupId(p.groupId);
      if (!groupId) {
        throw new Error(
          'groupId must be a workspace ID from `groups list`, such as "~sampel-palnet/lisbon-trip"'
        );
      }
      const line =
        typeof p.line === 'string' ? p.line.replace(/\s+/g, ' ').trim() : '';
      if (!line)
        throw new Error('line is required: one line naming the workspace');
      const known = await deps.groupIds();
      if (!known.includes(groupId)) {
        throw new Error(
          `${groupId} is not one of your groups; use an ID from \`groups list\``
        );
      }
      await deps.postText(ownerShip, `${line}\n/1/group/${groupId}`);
      return textResult(
        `Posted the link to ${groupId}. Now answer the owner's message as usual. Don't repeat the link, its path or the workspace name on a line of its own.`
      );
    } catch (error) {
      return textResult(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
        true
      );
    }
  };
}
