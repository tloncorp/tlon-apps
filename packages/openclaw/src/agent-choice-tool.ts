import {
  AGENT_ONBOARDING_APPROACH_CHOICE_MARKER,
  TLON_A2UI_CATALOG_ID,
} from '@tloncorp/api';

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

export type AgentChoiceEvidence = {
  interviewStartMessageId: string;
};

export const agentChoiceToolParameters = {
  type: 'object',
  properties: {
    target: {
      type: 'string',
      description:
        'Current Tlon chat nest, for example chat/~zod/home-group-chat.',
    },
    surfaceId: {
      type: 'string',
      description: 'Unique A2UI surface ID beginning with agent-choice-.',
    },
    dimension: {
      type: 'string',
      enum: ['focus', 'time', 'approach', 'context', 'priority', 'output'],
      description:
        'The single decision this question resolves. Every onboarding interview must include an approach question before the task plan.',
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
        'Two to six short, useful answers, each at most 36 characters so labels fit the mobile row. Approach answers must be concise ways of gathering information or developing the answer, not output formats or topic slices. The control also lets the owner write their own answer.',
      items: { type: 'string', maxLength: MAX_APPROACH_OPTION_LENGTH },
    },
  },
  required: ['target', 'surfaceId', 'dimension', 'question', 'options'],
  additionalProperties: false,
} as const;

function parseParams(params: AgentChoiceToolParams): AgentChoiceToolParams {
  if (!/^chat\/~[a-z0-9-]+\/[a-z0-9-]+$/i.test(params.target)) {
    throw new Error('target must be a chat channel nest');
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

export function buildAgentChoiceBlob(
  input: AgentChoiceToolParams,
  evidence?: AgentChoiceEvidence
) {
  const params = parseParams(input);
  const interviewStartMessageId = evidence?.interviewStartMessageId?.trim();
  if (!interviewStartMessageId && evidence) {
    throw new Error('agent choice requires a trusted interview start');
  }
  return [
    ...(interviewStartMessageId
      ? [
          {
            type: 'tlon-agent-post-marker' as const,
            version: 1 as const,
            key:
              params.dimension === 'approach'
                ? AGENT_ONBOARDING_APPROACH_CHOICE_MARKER
                : `agent-choice-dimension:${params.dimension}`,
            interviewStartMessageId,
          },
        ]
      : []),
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
  getEvidence: (toolCallId: string) => AgentChoiceEvidence;
}) {
  return async function execute(id: string, params: AgentChoiceToolParams) {
    try {
      const parsed = parseParams(params);
      const evidence = deps.getEvidence(id);
      const output = await deps.postChoice({
        target: parsed.target,
        fallbackQuestion: parsed.question,
        blob: JSON.stringify(buildAgentChoiceBlob(parsed, evidence)),
      });
      return {
        content: [{ type: 'text' as const, text: output }],
        details: undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        details: { error: true },
      };
    }
  };
}
