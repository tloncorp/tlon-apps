import {
  AGENT_PROTOCOL_LIMITS,
  AgentProvisionActionContextSchema,
  TLON_A2UI_CATALOG_ID,
} from '@tloncorp/api';

export type AgentTaskPlanToolParams = {
  target: string;
  fallbackSummary: string;
  surfaceId: string;
  summary: string;
  groupId: string;
  purposeId: string;
  purpose: string;
  topics: string[];
  scheduleHour: number;
  scheduleMinute: number;
  scheduleExpression: string;
  scheduleDescription: string;
  taskPrompt: string;
};

export const agentTaskPlanToolParameters = {
  type: 'object',
  properties: {
    target: {
      type: 'string',
      description:
        'Current Tlon chat nest, for example chat/~zod/home-group-chat.',
    },
    fallbackSummary: {
      type: 'string',
      description: 'Short plain-text fallback shown when A2UI is unavailable.',
    },
    surfaceId: {
      type: 'string',
      description: 'Unique A2UI surface ID beginning with agent-task-plan-.',
    },
    summary: {
      type: 'string',
      description: 'Plain-language focus, schedule, and output summary.',
    },
    groupId: { type: 'string' },
    purposeId: {
      type: 'string',
      enum: ['agent-daily-digest', 'agent-learning', 'agent-research'],
    },
    purpose: { type: 'string' },
    topics: {
      type: 'array',
      minItems: 1,
      maxItems: AGENT_PROTOCOL_LIMITS.topicCount,
      items: { type: 'string' },
    },
    scheduleHour: { type: 'integer', minimum: 0, maximum: 23 },
    scheduleMinute: { type: 'integer', minimum: 0, maximum: 59 },
    scheduleExpression: {
      type: 'string',
      description: 'Ordinary five-field cron expression.',
    },
    scheduleDescription: {
      type: 'string',
      description: 'Phrase completing “the task will run …”.',
    },
    taskPrompt: {
      type: 'string',
      description:
        'Self-contained task instruction without scheduling or delivery mechanics. ' +
        'Keep item-count rules consistent: never combine exactly N with a fewer-than-N fallback.',
    },
  },
  required: [
    'target',
    'fallbackSummary',
    'surfaceId',
    'summary',
    'groupId',
    'purposeId',
    'purpose',
    'topics',
    'scheduleHour',
    'scheduleMinute',
    'scheduleExpression',
    'scheduleDescription',
    'taskPrompt',
  ],
  additionalProperties: false,
} as const;

function parseParams(params: AgentTaskPlanToolParams): AgentTaskPlanToolParams {
  if (!/^chat\/~[a-z0-9-]+\/[a-z0-9-]+$/i.test(params.target)) {
    throw new Error('target must be a chat channel nest');
  }
  if (!params.surfaceId.startsWith('agent-task-plan-')) {
    throw new Error('surfaceId must begin with agent-task-plan-');
  }
  if (!params.fallbackSummary.trim() || params.fallbackSummary.length > 1000) {
    throw new Error('fallbackSummary must be 1-1000 characters');
  }
  if (!params.summary.trim() || params.summary.length > 2000) {
    throw new Error('summary must be 1-2000 characters');
  }
  const hasSparseCountFallback =
    /(?:fewer|less) than (?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i.test(
      params.taskPrompt
    );
  const hasExactCount =
    /exactly (?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i.test(
      params.taskPrompt
    );
  if (hasSparseCountFallback && hasExactCount) {
    throw new Error(
      'taskPrompt must not combine an exact item count with a fewer-than-count fallback'
    );
  }
  const context = AgentProvisionActionContextSchema.safeParse({
    groupId: params.groupId,
    purposeId: params.purposeId,
    purpose: params.purpose,
    topics: params.topics,
    scheduleHour: params.scheduleHour,
    scheduleMinute: params.scheduleMinute,
    scheduleExpression: params.scheduleExpression,
    scheduleDescription: params.scheduleDescription,
    taskPrompt: params.taskPrompt,
  });
  if (!context.success) {
    throw new Error(`invalid task plan: ${context.error.message}`);
  }
  return { ...params, ...context.data };
}

export function buildAgentTaskPlanBlob(input: AgentTaskPlanToolParams) {
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
                children: ['summary', 'confirm'],
              },
              {
                id: 'summary',
                component: 'Text',
                text: params.summary,
              },
              {
                id: 'confirm',
                component: 'Button',
                child: 'confirm-label',
                variant: 'primary',
                action: {
                  event: {
                    name: 'tlon.provisionAgent',
                    context: {
                      groupId: params.groupId,
                      purposeId: params.purposeId,
                      purpose: params.purpose,
                      topics: params.topics,
                      scheduleHour: params.scheduleHour,
                      scheduleMinute: params.scheduleMinute,
                      scheduleExpression: params.scheduleExpression,
                      scheduleDescription: params.scheduleDescription,
                      taskPrompt: params.taskPrompt,
                    },
                  },
                },
              },
              {
                id: 'confirm-label',
                component: 'Text',
                text: 'Create this task',
              },
            ],
          },
        },
      ],
    },
  ];
}

export function createAgentTaskPlanToolExecutor(deps: {
  postPlan: (input: {
    target: string;
    fallbackSummary: string;
    blob: string;
  }) => Promise<string>;
}) {
  return async function execute(_id: string, params: AgentTaskPlanToolParams) {
    try {
      const parsed = parseParams(params);
      const output = await deps.postPlan({
        target: parsed.target,
        fallbackSummary: parsed.fallbackSummary,
        blob: JSON.stringify(buildAgentTaskPlanBlob(parsed)),
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
