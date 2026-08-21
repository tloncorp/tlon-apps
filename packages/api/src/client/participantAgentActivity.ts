import { z } from 'zod';

/**
 * Public, channel-visible projection of an agent run.
 *
 * Bot and channel identity deliberately do not live in this payload. Consumers
 * must derive both from the authenticated post envelope that carries it.
 */
export const PARTICIPANT_AGENT_ACTIVITY_SCHEMA_VERSION = 1 as const;
export const MAX_PARTICIPANT_AGENT_ACTIVITY_STEPS = 24;
export const MAX_PARTICIPANT_AGENT_ACTIVITY_BYTES = 24 * 1024;
export const MAX_PARTICIPANT_AGENT_ACTIVITY_TITLE_CHARS = 240;
export const MAX_PARTICIPANT_AGENT_ACTIVITY_UPDATE_CHARS = 1_000;

const opaqueIdSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[A-Za-z0-9_-]+$/);

function containsControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
}

const correlationIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(320)
  .refine((value) => !containsControlCharacters(value), {
    message: 'correlation ids may not contain control characters',
  });

const stepIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

const publicTextSchema = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !containsControlCharacters(value), {
      message: 'public text may not contain control characters',
    });

const timestampSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

export const ParticipantAgentActivityStateSchema = z.enum([
  'working',
  'waiting_requester',
  'waiting_owner',
  'completed',
  'incomplete',
  'failed',
  'timed_out',
  'cancelled',
]);

export const ParticipantAgentActivityStepStatusSchema = z.enum([
  'pending',
  'running',
  'waiting',
  'completed',
  'failed',
  'cancelled',
]);

export const ParticipantAgentActivityActionsSchema = z
  .object({
    total: z.number().int().nonnegative().max(10_000),
    completed: z.number().int().nonnegative().max(10_000),
  })
  .strict()
  .refine((actions) => actions.completed <= actions.total, {
    message: 'completed actions may not exceed total actions',
    path: ['completed'],
  });

export const ParticipantAgentActivityStepSchema = z
  .object({
    id: stepIdSchema,
    title: publicTextSchema(MAX_PARTICIPANT_AGENT_ACTIVITY_TITLE_CHARS),
    status: ParticipantAgentActivityStepStatusSchema,
    update: publicTextSchema(
      MAX_PARTICIPANT_AGENT_ACTIVITY_UPDATE_CHARS
    ).optional(),
    actions: ParticipantAgentActivityActionsSchema.optional(),
  })
  .strict();

function serializedByteLength(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

const TERMINAL_STATES = new Set([
  'completed',
  'incomplete',
  'failed',
  'timed_out',
  'cancelled',
]);

export const ParticipantAgentActivityProjectionV1Schema = z
  .object({
    schemaVersion: z.literal(PARTICIPANT_AGENT_ACTIVITY_SCHEMA_VERSION),
    /** Carrier posts are synthetic progress surfaces; final posts are replies. */
    surface: z.enum(['carrier', 'final']),
    /** Stable opaque identity. This must not be a Context Lens id. */
    publicRunId: opaqueIdSchema,
    /** Monotonic publisher revision used to ignore stale post edits. */
    revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    /** The real user post that triggered this run. */
    triggerPostId: correlationIdSchema,
    /** Present only when the trigger belongs to a thread. */
    threadRootId: correlationIdSchema.optional(),
    /** Opaque publicRunId of the run this run retries. */
    retryOf: opaqueIdSchema.optional(),
    /** Safe public lineage for a typed requester-input continuation. */
    continuation: z
      .object({
        kind: z.literal('request_input'),
        parentPublicRunId: opaqueIdSchema,
      })
      .strict()
      .optional(),
    state: ParticipantAgentActivityStateSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    completedAt: timestampSchema.optional(),
    steps: z
      .array(ParticipantAgentActivityStepSchema)
      .min(1)
      .max(MAX_PARTICIPANT_AGENT_ACTIVITY_STEPS),
    terminalReason: z
      .enum(['timeout', 'denied', 'interrupted', 'failed'])
      .optional(),
  })
  .strict()
  .superRefine((projection, ctx) => {
    if (projection.updatedAt < projection.createdAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'updatedAt may not precede createdAt',
        path: ['updatedAt'],
      });
    }
    if (
      projection.completedAt !== undefined &&
      (projection.completedAt < projection.createdAt ||
        projection.completedAt > projection.updatedAt)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'completedAt must fall within the projection lifetime',
        path: ['completedAt'],
      });
    }
    const isTerminal = TERMINAL_STATES.has(projection.state);
    if (!isTerminal && projection.completedAt !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'active or waiting projections may not be completed',
        path: ['completedAt'],
      });
    }
    if (!isTerminal && projection.terminalReason !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'active or waiting projections may not have a terminal reason',
        path: ['terminalReason'],
      });
    }
    if (
      serializedByteLength(projection) > MAX_PARTICIPANT_AGENT_ACTIVITY_BYTES
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'participant activity projection is too large',
      });
    }
  });

export type ParticipantAgentActivityState = z.infer<
  typeof ParticipantAgentActivityStateSchema
>;
export type ParticipantAgentActivityStepStatus = z.infer<
  typeof ParticipantAgentActivityStepStatusSchema
>;
export type ParticipantAgentActivityStep = z.infer<
  typeof ParticipantAgentActivityStepSchema
>;
export type ParticipantAgentActivityProjectionV1 = z.infer<
  typeof ParticipantAgentActivityProjectionV1Schema
>;
