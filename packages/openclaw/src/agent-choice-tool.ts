import { TLON_A2UI_CATALOG_ID } from '@tloncorp/api';

const MAX_OPTIONS = 6;
const MAX_QUESTION_LENGTH = 1000;
const MAX_OPTION_LENGTH = 64;
const MAX_APPROACH_OPTION_LENGTH = 36;
const MAX_SURFACE_ID_LENGTH = 512;
const RESERVED_FREEFORM_OPTION =
  /^(?:other|custom|something else|write your own)(?:\s*(?:\([^)]*\)|[-–—:/].*))?$/i;

export type AgentChoiceToolParams = {
  target: string;
  surfaceId: string;
  dimension: 'focus' | 'time' | 'approach' | 'context' | 'priority' | 'output';
  question: string;
  options: string[];
};

export const agentChoiceToolParameters = {
  type: 'object',
  properties: {
    target: {
      type: 'string',
      description: 'Current Tlon chat nest or first-run bot DM target.',
    },
    surfaceId: {
      type: 'string',
      description: 'Unique A2UI surface ID beginning with agent-choice-.',
    },
    dimension: {
      type: 'string',
      enum: ['focus', 'time', 'approach', 'context', 'priority', 'output'],
      description:
        'The single decision this question resolves. Ask only when this unanswered decision materially changes the task.',
    },
    question: {
      type: 'string',
      description:
        'One concise question covering a single decision about the task.',
    },
    options: {
      type: 'array',
      minItems: 2,
      maxItems: MAX_OPTIONS,
      description:
        'Two to six short, useful answers, each at most 36 characters so labels fit the mobile row. Time answers should normally be natural, fuzzy parts of the day tailored to the task instead of a fixed exact-clock list. Approach answers must be concise ways of gathering information or developing the answer, not output formats or topic slices. The control also lets the owner write their own answer.',
      items: { type: 'string', maxLength: MAX_APPROACH_OPTION_LENGTH },
    },
  },
  required: ['target', 'surfaceId', 'dimension', 'question', 'options'],
  additionalProperties: false,
} as const;

function parseParams(params: AgentChoiceToolParams): AgentChoiceToolParams {
  if (!/^(?:chat\/~[a-z0-9-]+\/[a-z0-9-]+|~[a-z-]+)$/i.test(params.target)) {
    throw new Error('target must be a chat channel nest or bot DM');
  }
  if (
    !params.surfaceId.startsWith('agent-choice-') ||
    params.surfaceId.length > MAX_SURFACE_ID_LENGTH
  ) {
    throw new Error(
      `surfaceId must begin with agent-choice- and be at most ${MAX_SURFACE_ID_LENGTH} characters`
    );
  }
  if (
    !['focus', 'time', 'approach', 'context', 'priority', 'output'].includes(
      params.dimension
    )
  ) {
    throw new Error('dimension must identify one supported interview decision');
  }

  const question = params.question.trim();
  if (!question || question.length > MAX_QUESTION_LENGTH) {
    throw new Error(`question must be 1-${MAX_QUESTION_LENGTH} characters`);
  }
  if (params.options.length < 2 || params.options.length > MAX_OPTIONS) {
    throw new Error(`options must contain 2-${MAX_OPTIONS} answers`);
  }

  const options = params.options.map((option) => option.trim());
  if (options.some((option) => !option || option.length > MAX_OPTION_LENGTH)) {
    throw new Error(`each option must be 1-${MAX_OPTION_LENGTH} characters`);
  }
  if (
    params.dimension === 'approach' &&
    options.some((option) => option.length > MAX_APPROACH_OPTION_LENGTH)
  ) {
    throw new Error(
      `each approach option must be at most ${MAX_APPROACH_OPTION_LENGTH} characters`
    );
  }
  if (
    new Set(options.map((option) => option.toLocaleLowerCase())).size !==
    options.length
  ) {
    throw new Error('options must be unique');
  }
  if (options.some((option) => RESERVED_FREEFORM_OPTION.test(option))) {
    throw new Error(
      'options must not duplicate the built-in freeform answer (Other, Custom, Something else, or Write your own)'
    );
  }
  return { ...params, question, options };
}

export function buildAgentChoiceBlob(input: AgentChoiceToolParams) {
  const params = parseParams(input);
  return [
    {
      type: 'a2ui',
      version: 1,
      storyMode: 'fallback',
      messages: [
        {
          version: 'v0.9',
          createSurface: {
            surfaceId: params.surfaceId,
            catalogId: TLON_A2UI_CATALOG_ID,
          },
        },
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: params.surfaceId,
            root: 'root',
            components: [
              {
                id: 'root',
                component: 'Column',
                children: ['question', 'choices'],
              },
              {
                id: 'question',
                component: 'Text',
                text: params.question,
              },
              {
                id: 'choices',
                component: 'SmallChoice',
                selectionMode: 'single',
                options: params.options.map((label, index) => ({
                  id: `choice-${index + 1}`,
                  label,
                })),
                submitLabel: 'Continue',
                freeTextPlaceholder: 'Write your own…',
                action: {
                  event: {
                    name: 'tlon.sendMessage',
                    context: { text: '' },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  ];
}

export function createAgentChoiceToolExecutor(deps: {
  postChoice: (input: {
    target: string;
    fallbackQuestion: string;
    blob: string;
  }) => Promise<string>;
  assertCurrent: (toolCallId: string) => void;
  finish: (toolCallId: string, retainClaim: boolean) => void;
}) {
  return async function execute(id: string, params: AgentChoiceToolParams) {
    let publicationAttempted = false;
    try {
      const blob = buildAgentChoiceBlob(params);
      deps.assertCurrent(id);
      publicationAttempted = true;
      await deps.postChoice({
        target: params.target,
        fallbackQuestion: params.question.trim(),
        blob: JSON.stringify(blob),
      });
      deps.finish(id, true);
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Choice posted. Return NO_REPLY now and wait for the owner answer. Do not call another tool in this turn.',
          },
        ],
        details: undefined,
      };
    } catch (error) {
      // Validation and stale-turn errors are safe to retry in the same model
      // turn. Once publication starts, keep the claim because transport
      // failure is ambiguous and a duplicate choice would be worse.
      deps.finish(id, publicationAttempted);
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        details: { error: true },
      };
    }
  };
}
