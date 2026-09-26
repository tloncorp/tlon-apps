import {
  SupersededTurnError,
  supersededToolResult,
} from './superseded-turn.js';
import {
  AGENT_PROTOCOL_LIMITS,
  AgentProvisionActionContextSchema,
  TLON_A2UI_CATALOG_ID,
} from '@tloncorp/api';

export const AGENT_TASK_PLAN_AUTO_PROVISION_COMPONENT_ID = 'auto-provision';
export type AgentTaskPlanToolParams = {
  target: string;
  summary: string;
  purposeId: string;
  purpose: string;
  approach?: string;
  topics: string[];
  scheduleHour: number;
  scheduleMinute: number;
  /** Days of the week (0 = Sunday … 6 = Saturday). Omitted means every day. */
  scheduleDays?: number[];
  scheduleDescription: string;
  timezoneOverride?: string;
  taskPrompt: string;
};

/** The five-field cron expression for a plan's time and days. */
export function taskPlanScheduleExpression(params: {
  scheduleHour: number;
  scheduleMinute: number;
  scheduleDays?: number[];
}): string {
  const days = [...new Set(params.scheduleDays ?? [])].sort((a, b) => a - b);
  const dayField = days.length && days.length < 7 ? days.join(',') : '*';
  return `${params.scheduleMinute} ${params.scheduleHour} * * ${dayField}`;
}

type ResolvedAgentTaskPlanToolParams = AgentTaskPlanToolParams & {
  groupId: string;
  scheduleExpression: string;
  surfaceId: string;
};

type AgentTaskPlanEvidence = {
  interviewStartMessageId?: string;
  interviewMessageId: string;
  interviewTimezone?: string;
  onboardingGroupId?: string;
  onboardingTarget?: string;
};

export const agentTaskPlanToolMetadata = {
  name: 'tlon_agent_task_plan',
  label: 'Tlon Agent Task Plan',
  description:
    'Post one automatically provisioned recurring-task plan during first-run onboarding. ' +
    'The tlon-agent-onboarding skill decides when the task is ready. The trusted client and coordinator create it without another confirmation gate. Use this instead of hand-authoring A2UI or calling cron directly.',
  promptSnippet:
    '`tlon_agent_task_plan`: automatically provision the finished recurring task during first-run onboarding',
  promptGuidelines: [
    'Follow the tlon-agent-onboarding skill. Do not call cron directly; after the plan posts, return NO_REPLY because the coordinator owns activation and result status.',
  ],
};

export const agentTaskPlanToolParameters = {
  type: 'object',
  properties: {
    target: {
      type: 'string',
      description:
        'Exact active Tlon conversation target from context: the owner target in a DM, or the current group chat nest in a group. Never redirect a group plan to the owner DM.',
    },
    summary: {
      type: 'string',
      maxLength: 1000,
      description: 'Plain-language focus, schedule, and output summary.',
    },
    purposeId: {
      type: 'string',
      enum: ['agent-daily-digest', 'agent-learning', 'agent-research'],
      description:
        'Classify by what the task does: agent-daily-digest for briefings, reminders, prioritization, and check-ins; agent-learning for teaching and practice; agent-research for recurring investigation.',
    },
    purpose: { type: 'string' },
    approach: {
      type: 'string',
      description:
        'Optional owner-selected method, when the interview needed an approach choice. Omit when none was selected; never send an empty string.',
    },
    topics: {
      type: 'array',
      minItems: 1,
      maxItems: AGENT_PROTOCOL_LIMITS.topicCount,
      items: { type: 'string' },
    },
    scheduleHour: { type: 'integer', minimum: 0, maximum: 23 },
    scheduleMinute: { type: 'integer', minimum: 0, maximum: 59 },
    scheduleDays: {
      type: 'array',
      minItems: 1,
      maxItems: 7,
      items: { type: 'integer', minimum: 0, maximum: 6 },
      description:
        'Days of the week to run, 0 = Sunday through 6 = Saturday: [1,2,3,4,5] for weekdays, [0] for Sundays. Omit to run every day.',
    },
    scheduleDescription: {
      type: 'string',
      description:
        'Owner-facing phrase completing “the task will run …”. When the owner gave a fuzzy routine or day-part, use only that fuzzy wording and never reveal or approximate the interpreted clock.',
    },
    timezoneOverride: {
      type: 'string',
      description:
        'IANA timezone only when the owner established a scheduling location or timezone different from the client device. Omit the property for ordinary local-time schedules; never send an empty string.',
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
    'summary',
    'purposeId',
    'purpose',
    'topics',
    'scheduleHour',
    'scheduleMinute',
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

export function resolveOnboardingDmGroupId(
  target: string,
  evidence: AgentTaskPlanEvidence
): string {
  if (evidence.onboardingTarget !== target || !evidence.onboardingGroupId) {
    throw new Error('bot DM is not bound to an owner onboarding group');
  }
  return evidence.onboardingGroupId;
}

function parseParams(
  params: ResolvedAgentTaskPlanToolParams
): ResolvedAgentTaskPlanToolParams {
  if (!/^(?:chat\/~[a-z0-9-]+\/[a-z0-9-]+|~[a-z-]+)$/i.test(params.target)) {
    throw new Error('target must be a chat channel nest or bot DM');
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
  if (
    params.scheduleDays &&
    (!params.scheduleDays.length ||
      params.scheduleDays.some(
        (day) => !Number.isInteger(day) || day < 0 || day > 6
      ))
  ) {
    throw new Error('scheduleDays must be weekday numbers from 0 to 6');
  }
  const expectedExpression = taskPlanScheduleExpression(params);
  if (params.scheduleExpression.trim() !== expectedExpression) {
    throw new Error(
      `onboarding schedule must match its time and days (${expectedExpression})`
    );
  }
  const context = AgentProvisionActionContextSchema.safeParse({
    groupId: params.groupId,
    purposeId: params.purposeId,
    purpose: params.purpose,
    ...(params.approach ? { approach: params.approach } : {}),
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

function buildAgentTaskPlanBlob(
  input: ResolvedAgentTaskPlanToolParams,
  evidence: AgentTaskPlanEvidence
) {
  const params = parseParams(input);
  const interviewStartMessageId = evidence.interviewStartMessageId?.trim();
  const interviewMessageId = evidence.interviewMessageId?.trim();
  if (!interviewMessageId) {
    throw new Error('task plan requires a trusted owner interview message');
  }
  const interviewTimezone = evidence.interviewTimezone?.trim();
  if (interviewTimezone) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: interviewTimezone }).format();
    } catch {
      throw new Error(
        'trusted interview timezone must be a valid IANA timezone'
      );
    }
  }
  return [
    {
      type: 'a2ui',
      version: 2,
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
                children: [
                  'summary',
                  AGENT_TASK_PLAN_AUTO_PROVISION_COMPONENT_ID,
                ],
              },
              {
                id: 'summary',
                component: 'Text',
                text: params.summary,
              },
              {
                // This trusted action is part of the declared surface so the
                // client can verify its provenance. The client keeps this
                // reserved control hidden and submits it once when the plan
                // arrives.
                id: AGENT_TASK_PLAN_AUTO_PROVISION_COMPONENT_ID,
                component: 'Button',
                child: 'auto-provision-label',
                variant: 'primary',
                action: {
                  event: {
                    name: 'tlon.provisionAgent',
                    context: {
                      groupId: params.groupId,
                      ...(interviewStartMessageId
                        ? { interviewStartMessageId }
                        : {}),
                      interviewMessageId,
                      purposeId: params.purposeId,
                      purpose: params.purpose,
                      ...(params.approach ? { approach: params.approach } : {}),
                      topics: params.topics,
                      scheduleHour: params.scheduleHour,
                      scheduleMinute: params.scheduleMinute,
                      scheduleExpression: params.scheduleExpression,
                      scheduleDescription: params.scheduleDescription,
                      ...(params.timezoneOverride
                        ? { timezoneOverride: params.timezoneOverride }
                        : {}),
                      ...(interviewTimezone ? { interviewTimezone } : {}),
                      taskPrompt: params.taskPrompt,
                    },
                  },
                },
              },
              {
                id: 'auto-provision-label',
                component: 'Text',
                text: 'Set up task',
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
  resolveGroupId: (
    target: string,
    evidence: AgentTaskPlanEvidence
  ) => Promise<string>;
  getEvidence: (toolCallId: string) => AgentTaskPlanEvidence;
  assertCurrent: (toolCallId: string) => void;
  finish: (toolCallId: string, retainClaim: boolean) => void;
}) {
  return async function execute(id: string, params: AgentTaskPlanToolParams) {
    let publicationAttempted = false;
    try {
      const evidence = deps.getEvidence(id);
      const groupId = await deps.resolveGroupId(params.target, evidence);
      const resolved = {
        ...params,
        groupId,
        scheduleExpression: taskPlanScheduleExpression(params),
        surfaceId: `agent-task-plan-${id}`,
      };
      const blob = buildAgentTaskPlanBlob(resolved, evidence);
      deps.assertCurrent(id);
      publicationAttempted = true;
      const output = await deps.postPlan({
        target: params.target,
        fallbackSummary: params.summary.trim(),
        blob: JSON.stringify(blob),
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
      // A transport error after publication starts is ambiguous: the ship may
      // have accepted the post before the CLI lost its response. Retain the
      // one-plan claim so this run cannot publish a second automatic card.
      deps.finish(id, publicationAttempted);
      if (error instanceof SupersededTurnError) return supersededToolResult();
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        details: { error: true },
      };
    }
  };
}
