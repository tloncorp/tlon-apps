import {
  AGENT_PROTOCOL_LIMITS,
  AgentProvisionActionContextSchema,
  TLON_A2UI_CATALOG_ID,
} from '@tloncorp/api';

const AGENT_TASK_PLAN_AUTO_PROVISION_COMPONENT_ID = 'auto-provision';

export type AgentTaskPlanToolParams = {
  target: string;
  fallbackSummary: string;
  surfaceId: string;
  summary: string;
  groupId: string;
  purposeId: string;
  purpose: string;
  approach: string;
  topics: string[];
  scheduleHour: number;
  scheduleMinute: number;
  scheduleExpression: string;
  scheduleDescription: string;
  timezoneOverride?: string;
  taskPrompt: string;
};

export type AgentTaskPlanEvidence = {
  interviewMessageId: string;
};

function formatDailyTime(hour: number, minute: number): string {
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const meridiem = hour < 12 ? 'AM' : 'PM';
  return minute === 0
    ? `${displayHour} ${meridiem}`
    : `${displayHour}:${String(minute).padStart(2, '0')} ${meridiem}`;
}

function copyHasDailyTime(copy: string, acceptedDisplayTimes: string[]) {
  const upper = copy.toUpperCase();
  return (
    /\b(?:daily|every day)\b/i.test(copy) &&
    acceptedDisplayTimes.some((time) => upper.includes(time))
  );
}

const READABLE_TIMEZONE_AFTER_CLOCK =
  /\b(?:AM|PM)(?:\s*[,;:()\-–—]\s*|\s+)(?:in\s+)?[A-Za-z]+(?:\s+[A-Za-z]+){0,2}\s+time\b/i;

const TIMEZONE_READABLE_ALIASES: Record<string, string[]> = {
  'America/New_York': ['New York', 'Eastern'],
  'America/Chicago': ['Chicago', 'Central'],
  'America/Denver': ['Denver', 'Mountain'],
  'America/Los_Angeles': ['Los Angeles', 'Pacific'],
  'Europe/London': ['London', 'British'],
  'Europe/Paris': ['Paris', 'Central European'],
  'Asia/Tokyo': ['Tokyo', 'Japan'],
  'Australia/Sydney': ['Sydney', 'Australian Eastern'],
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
      maxLength: 512,
      description: 'Unique A2UI surface ID beginning with agent-task-plan-.',
    },
    summary: {
      type: 'string',
      maxLength: 1000,
      description: 'Plain-language focus, schedule, and output summary.',
    },
    groupId: { type: 'string' },
    purposeId: {
      type: 'string',
      enum: ['agent-daily-digest', 'agent-learning', 'agent-research'],
    },
    purpose: { type: 'string' },
    approach: {
      type: 'string',
      description:
        'The owner’s exact selected answer to the required topic-specific approach question.',
    },
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
      description:
        'Daily five-field cron expression matching scheduleHour and scheduleMinute: “minute hour * * *”.',
    },
    scheduleDescription: {
      type: 'string',
      description: 'Phrase completing “the task will run …”.',
    },
    timezoneOverride: {
      type: 'string',
      description:
        'IANA timezone only when the owner explicitly requested a timezone different from the client device. Omit for ordinary local-time schedules.',
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
    'approach',
    'topics',
    'scheduleHour',
    'scheduleMinute',
    'scheduleExpression',
    'scheduleDescription',
    'taskPrompt',
  ],
  additionalProperties: false,
} as const;

export function resolveTaskPlanGroupId(
  groupsOutput: string,
  target: string
): string {
  let groups: unknown;
  try {
    groups = JSON.parse(groupsOutput);
  } catch {
    throw new Error('could not read the current Tlon groups');
  }
  if (!Array.isArray(groups)) {
    throw new Error('could not read the current Tlon groups');
  }

  const matches = groups.filter((group) => {
    if (!group || typeof group !== 'object') return false;
    const candidate = group as { id?: unknown; channels?: unknown };
    return (
      typeof candidate.id === 'string' &&
      Array.isArray(candidate.channels) &&
      candidate.channels.some(
        (channel) =>
          channel &&
          typeof channel === 'object' &&
          (channel as { nest?: unknown }).nest === target
      )
    );
  }) as Array<{ id: string }>;

  if (matches.length !== 1) {
    throw new Error('task plan target must belong to exactly one Tlon group');
  }
  return matches[0].id;
}

function parseParams(params: AgentTaskPlanToolParams): AgentTaskPlanToolParams {
  if (!/^chat\/~[a-z0-9-]+\/[a-z0-9-]+$/i.test(params.target)) {
    throw new Error('target must be a chat channel nest');
  }
  if (
    !params.surfaceId.startsWith('agent-task-plan-') ||
    params.surfaceId.length > 512
  ) {
    throw new Error(
      'surfaceId must begin with agent-task-plan- and be at most 512 characters'
    );
  }
  if (!params.fallbackSummary.trim() || params.fallbackSummary.length > 1000) {
    throw new Error('fallbackSummary must be 1-1000 characters');
  }
  if (!params.summary.trim() || params.summary.length > 1000) {
    throw new Error('summary must be 1-1000 characters');
  }
  const timezoneOverride = params.timezoneOverride?.trim() || undefined;
  if (timezoneOverride) {
    try {
      new Intl.DateTimeFormat('en', {
        timeZone: timezoneOverride,
      }).format();
    } catch {
      throw new Error('timezoneOverride must be a valid IANA timezone');
    }
  }
  const expectedDailyExpression = `${params.scheduleMinute} ${params.scheduleHour} * * *`;
  if (params.scheduleExpression.trim() !== expectedDailyExpression) {
    throw new Error(
      `onboarding schedules must be daily (${expectedDailyExpression})`
    );
  }
  const expectedDisplayTime = formatDailyTime(
    params.scheduleHour,
    params.scheduleMinute
  );
  const acceptedDisplayTimes =
    params.scheduleMinute === 0
      ? [
          expectedDisplayTime,
          `${params.scheduleHour % 12 || 12}:00 ${params.scheduleHour < 12 ? 'AM' : 'PM'}`,
        ]
      : [expectedDisplayTime];
  const scheduleCopies = [
    params.fallbackSummary,
    params.summary,
    params.scheduleDescription,
  ];
  if (
    !scheduleCopies.every((copy) =>
      copyHasDailyTime(copy, acceptedDisplayTimes)
    )
  ) {
    throw new Error(
      `all user-facing plan copy must describe a daily schedule at ${expectedDisplayTime}`
    );
  }
  const userFacingScheduleCopy = scheduleCopies.join('\n');
  if (
    /\b(?:Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Europe|Indian|Pacific)\/[A-Za-z_+-]+(?:\/[A-Za-z_+-]+)?\b/.test(
      userFacingScheduleCopy
    ) ||
    /\bUTC\b/.test(userFacingScheduleCopy) ||
    userFacingScheduleCopy.includes(params.scheduleExpression) ||
    /\b(?:[01]?\d|2[0-3]):[0-5]\d(?!\s*(?:AM|PM))\b/i.test(
      userFacingScheduleCopy
    )
  ) {
    throw new Error(
      'user-facing schedule copy must use AM/PM, not 24-hour time, cron, or technical timezone identifiers'
    );
  }
  if (
    !timezoneOverride &&
    READABLE_TIMEZONE_AFTER_CLOCK.test(userFacingScheduleCopy)
  ) {
    throw new Error(
      'timezone-specific copy requires the matching explicit timezoneOverride'
    );
  }
  if (timezoneOverride) {
    const timezoneParts = timezoneOverride.split('/');
    const readableCity = timezoneParts[timezoneParts.length - 1]?.replace(
      /_/g,
      ' '
    );
    const acceptableLabels = [
      ...(TIMEZONE_READABLE_ALIASES[timezoneOverride] ?? []),
      ...(readableCity ? [readableCity] : []),
    ];
    const description = params.scheduleDescription.toLocaleLowerCase();
    if (
      !acceptableLabels.some((label) =>
        description.includes(`${label.toLocaleLowerCase()} time`)
      )
    ) {
      throw new Error(
        'an explicit timezoneOverride requires a matching readable timezone in scheduleDescription'
      );
    }
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
    approach: params.approach,
    topics: params.topics,
    scheduleHour: params.scheduleHour,
    scheduleMinute: params.scheduleMinute,
    scheduleExpression: params.scheduleExpression,
    scheduleDescription: params.scheduleDescription,
    timezoneOverride,
    taskPrompt: params.taskPrompt,
  });
  if (!context.success) {
    throw new Error(`invalid task plan: ${context.error.message}`);
  }
  return { ...params, ...context.data, timezoneOverride };
}

export function buildAgentTaskPlanBlob(
  input: AgentTaskPlanToolParams,
  evidence: AgentTaskPlanEvidence
) {
  const params = parseParams(input);
  const evidenceContext = AgentProvisionActionContextSchema.pick({
    interviewMessageId: true,
  }).safeParse(evidence);
  if (!evidenceContext.success || !evidenceContext.data.interviewMessageId) {
    throw new Error('task plan requires a trusted owner interview message');
  }
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
                children: ['summary'],
              },
              {
                id: 'summary',
                component: 'Text',
                text: params.summary,
              },
              {
                // This trusted orphan action is intentionally not rendered.
                // The client submits it once when the plan arrives, keeping
                // authorization and idempotency in the existing coordinator.
                id: AGENT_TASK_PLAN_AUTO_PROVISION_COMPONENT_ID,
                component: 'Button',
                child: 'auto-provision-label',
                variant: 'primary',
                action: {
                  event: {
                    name: 'tlon.provisionAgent',
                    context: {
                      groupId: params.groupId,
                      interviewMessageId:
                        evidenceContext.data.interviewMessageId,
                      purposeId: params.purposeId,
                      purpose: params.purpose,
                      approach: params.approach,
                      topics: params.topics,
                      scheduleHour: params.scheduleHour,
                      scheduleMinute: params.scheduleMinute,
                      scheduleExpression: params.scheduleExpression,
                      scheduleDescription: params.scheduleDescription,
                      ...(params.timezoneOverride
                        ? { timezoneOverride: params.timezoneOverride }
                        : {}),
                      taskPrompt: params.taskPrompt,
                    },
                  },
                },
              },
              {
                id: 'auto-provision-label',
                component: 'Text',
                text: 'Set up daily task',
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
  resolveGroupId?: (target: string) => Promise<string>;
  getEvidence: (toolCallId: string) => AgentTaskPlanEvidence;
  assertCurrent: (toolCallId: string) => void;
  finish: (toolCallId: string, succeeded: boolean) => void;
}) {
  return async function execute(id: string, params: AgentTaskPlanToolParams) {
    try {
      // The model describes the plan, but it does not authorize its target.
      // Resolve the active channel's group from Tlon so a mistyped or truncated
      // model-authored flag cannot leave a valid plan permanently disabled.
      const groupId = deps.resolveGroupId
        ? await deps.resolveGroupId(params.target)
        : params.groupId;
      const parsed = parseParams({ ...params, groupId });
      const evidence = deps.getEvidence(id);
      // Group resolution can perform network I/O. Recheck immediately before
      // publication so a newer owner message cannot race that await.
      deps.assertCurrent(id);
      const output = await deps.postPlan({
        target: parsed.target,
        fallbackSummary: parsed.fallbackSummary,
        blob: JSON.stringify(buildAgentTaskPlanBlob(parsed, evidence)),
      });
      deps.finish(id, true);
      return {
        content: [
          {
            type: 'text' as const,
            text: `${output}\nReturn NO_REPLY now. The deterministic coordinator owns all activation and result status.`,
          },
        ],
        details: undefined,
      };
    } catch (error) {
      deps.finish(id, false);
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        details: { error: true },
      };
    }
  };
}
