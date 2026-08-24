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
  topicLength: 200,
  topicCount: 12,
  timezoneLength: 100,
  notebookNestLength: 512,
  notebookTitleLength: 200,
  providerCount: 12,
  providerIdLength: 128,
} as const;

export const agentProtocolString = (maxLength: number) =>
  z
    .string()
    .max(maxLength)
    .refine((value) => value.trim().length > 0);

export const AgentProvisionActionContextSchema = z.object({
  groupId: agentProtocolString(AGENT_PROTOCOL_LIMITS.groupIdLength),
  purposeId: agentProtocolString(AGENT_PROTOCOL_LIMITS.identifierLength),
  purpose: agentProtocolString(AGENT_PROTOCOL_LIMITS.purposeLength),
  topics: z
    .array(agentProtocolString(AGENT_PROTOCOL_LIMITS.topicLength))
    .min(1)
    .max(AGENT_PROTOCOL_LIMITS.topicCount),
  scheduleHour: z.number().int().min(0).max(23),
  scheduleMinute: z.number().int().min(0).max(59),
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
