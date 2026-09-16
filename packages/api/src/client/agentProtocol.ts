import { z } from 'zod';

/**
 * Shared limits for the durable agent-onboarding protocol.
 *
 * Keep these in the API package because both the wire schemas and the A2UI
 * action validator must accept exactly the same payloads. Product copy and
 * onboarding presentation do not belong here.
 */
export const AGENT_PROTOCOL_LIMITS = {
  groupIdLength: 512,
  identifierLength: 128,
  purposeLength: 200,
  approachLength: 1000,
  topicLength: 200,
  topicCount: 12,
  taskPromptLength: 4000,
  scheduleExpressionLength: 200,
  scheduleDescriptionLength: 200,
  timezoneLength: 100,
  localeLength: 100,
  notebookNestLength: 512,
  notebookTitleLength: 200,
  providerCount: 12,
  providerIdLength: 128,
} as const;

/** Stable identifiers shared by the client and the Tlonbot coordinator. */
export const TLON_A2UI_CATALOG_ID = 'tlon.a2ui.basic.v2';
export const AGENT_ONBOARDING_FIRST_ENTRY_MARKER = 'first-entry-ping';
export const AGENT_ONBOARDING_FIRST_ENTRY_FAILED_MARKER = 'first-entry-failed';
export const AGENT_ONBOARDING_APPROACH_CHOICE_MARKER =
  'agent-choice-dimension:approach';

export const AGENT_ONBOARDING_PURPOSE_IDS = [
  'agent-daily-digest',
  'agent-learning',
  'agent-research',
] as const;
export const AgentOnboardingPurposeIdSchema = z.enum(
  AGENT_ONBOARDING_PURPOSE_IDS
);
export type AgentOnboardingPurposeId = z.infer<
  typeof AgentOnboardingPurposeIdSchema
>;

export const agentProtocolString = (maxLength: number) =>
  z
    .string()
    .max(maxLength)
    .refine((value) => value.trim().length > 0);

export const AgentProvisionActionContextSchema = z.object({
  groupId: agentProtocolString(AGENT_PROTOCOL_LIMITS.groupIdLength),
  purposeId: AgentOnboardingPurposeIdSchema,
  purpose: agentProtocolString(AGENT_PROTOCOL_LIMITS.purposeLength),
  /**
   * The owner's selected information-gathering/development approach. Optional
   * on the wire so retained pre-interview provision receipts remain valid;
   * the automatic onboarding plan requires and verifies it separately.
   */
  approach: agentProtocolString(
    AGENT_PROTOCOL_LIMITS.approachLength
  ).optional(),
  topics: z
    .array(agentProtocolString(AGENT_PROTOCOL_LIMITS.topicLength))
    .min(1)
    .max(AGENT_PROTOCOL_LIMITS.topicCount),
  scheduleHour: z.number().int().min(0).max(23),
  scheduleMinute: z.number().int().min(0).max(59),
  /**
   * Model-authored task details for interview-driven onboarding. The legacy
   * purpose/topic fields remain required so older clients and group naming
   * continue to work; this prompt is authoritative when present.
   */
  taskPrompt: agentProtocolString(
    AGENT_PROTOCOL_LIMITS.taskPromptLength
  ).optional(),
  /** Five-field cron expression for ordinary time-based schedules. */
  scheduleExpression: agentProtocolString(
    AGENT_PROTOCOL_LIMITS.scheduleExpressionLength
  )
    .refine((value) => {
      const fields = value.trim().split(/\s+/);
      return (
        fields.length === 5 &&
        fields.every((field) => /^[0-9*/,-]+$/.test(field))
      );
    })
    .optional(),
  /** Human-readable cadence used in the confirmation message. */
  scheduleDescription: agentProtocolString(
    AGENT_PROTOCOL_LIMITS.scheduleDescriptionLength
  ).optional(),
  /**
   * Set only when the owner explicitly names a different timezone. The client
   * otherwise supplies its current device timezone at confirmation time.
   */
  timezoneOverride: agentProtocolString(
    AGENT_PROTOCOL_LIMITS.timezoneLength
  ).optional(),
});

export const AgentProviderIdSchema = agentProtocolString(
  AGENT_PROTOCOL_LIMITS.providerIdLength
).refine((value) => /^[a-z0-9][a-z0-9._-]*$/i.test(value));

export const AgentProviderConfigContextSchema = z.object({
  groupId: agentProtocolString(AGENT_PROTOCOL_LIMITS.groupIdLength),
  provisionId: agentProtocolString(AGENT_PROTOCOL_LIMITS.identifierLength),
  providerIds: z
    .array(AgentProviderIdSchema)
    .max(AGENT_PROTOCOL_LIMITS.providerCount)
    .refine((ids) => new Set(ids).size === ids.length),
});
