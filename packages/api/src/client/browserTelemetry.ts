import { z } from 'zod';

/** Correlation only: neither identifier grants access to a browser. */
export const browserTelemetryContextSchema = z.object({
  browserTaskId: z.string().uuid().optional(),
  browserSessionId: z.string().regex(/^[a-f0-9]{64}$/),
  browserHandoffId: z.string().uuid(),
});

export type BrowserTelemetryContext = z.infer<
  typeof browserTelemetryContextSchema
>;

export const browserLifecycleEventSchema = z.object({
  browserTaskId: z.string().uuid().optional(),
  schemaVersion: z.literal(1).default(1),
  source: z.enum(['agent', 'client']),
  phase: z.enum([
    'operation_started',
    'session_created',
    'session_released',
    'session_activity',
    'handoff_requested',
    'handoff_ready',
    'handoff_failed',
    'form_opened',
    'form_ready',
    'form_failed',
    'form_closed',
    'fill_started',
    'fill_accepted',
    'fill_failed',
    'next_form_ready',
    'next_form_failed',
    'continuation_requested',
    'continuation_queued',
    'continuation_failed',
  ]),
  browserSessionId: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  browserHandoffId: z.string().uuid().optional(),
  // An operation outcome never asserts that the user's task succeeded.
  outcome: z.enum(['accepted', 'failed', 'unknown']),
  taskOutcome: z.literal('unknown').default('unknown'),
  durationMs: z.number().finite().nonnegative().optional(),
  elapsedMs: z.number().finite().nonnegative().optional(),
  operation: z
    .enum([
      'session_create',
      'session_release',
      'session_live_view',
      'session_handoff',
      'navigate',
      'snapshot',
      'screenshot',
      'click',
      'type',
      'fill',
      'scroll',
      'keypress',
      'evaluate',
      'run',
      'scrape',
      'find',
      'act',
      'wait',
      'other',
    ])
    .optional(),
  formKind: z.enum(['login', 'details']).optional(),
  submitted: z.boolean().optional(),
  httpStatus: z.number().int().min(400).max(599).optional(),
  runStatus: z
    .enum([
      'done',
      'uncertain',
      'needs_review',
      'stuck',
      'page_changed',
      'needs_input',
      'needs_handoff',
      'needs_confirmation',
      'cancelled',
      'error',
    ])
    .optional(),
  reason: z
    .enum([
      'lookup_failed',
      'delivery_failed',
      'request_failed',
      'missing_context',
    ])
    .optional(),
});

export type BrowserLifecycleEvent = z.infer<typeof browserLifecycleEventSchema>;
export type BrowserLifecycleInput = z.input<typeof browserLifecycleEventSchema>;

/** Strip unknown fields at the telemetry boundary; never spread tool/form data. */
export function browserLifecycleEvent(
  input: unknown
): BrowserLifecycleEvent | undefined {
  const result = browserLifecycleEventSchema.safeParse(input);
  return result.success ? result.data : undefined;
}
