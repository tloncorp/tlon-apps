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
