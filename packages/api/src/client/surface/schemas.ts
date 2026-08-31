import { z } from 'zod';

import {
  Json,
  JsonObjectSchema,
  JsonSchema,
  SURFACE_JSON_MAX_DEPTH,
  isForbiddenObjectKey,
  jsonByteLength,
} from './json';
import { SurfaceOp } from './jsonPointer';

/**
 * Zod schemas for the surface wire format: the `surfaceSpec` channel
 * description payload and the surface post blob entries. Caps (§7 of the
 * plan) are enforced here at parse; a violation fails validation, which for
 * blob entries means the whole entry degrades to `{ type: 'unknown' }`.
 * Pointer path grammar is deliberately NOT validated here — a bad path is
 * refused at reduce time, where (like every refusal) it aborts the rest of
 * its entry rather than degrading the entry to unknown.
 */

/** §7 caps. KB = 1024 bytes; sizes measure UTF-8 JSON serialization. */
export const SURFACE_CAPS = {
  /** bundle size in bytes (publish gate + fetch re-check) */
  bundleSize: 256 * 1024,
  /** whole serialized spec */
  specTotal: 32 * 1024,
  initialState: 8 * 1024,
  recipe: 8 * 1024,
  actionsPerSpec: 64,
  /** ops per action and per host event */
  opsPerEvent: 20,
  opValue: 4 * 1024,
  eventEntryTotal: 8 * 1024,
  /**
   * Snapshot `state`, and NOT an independent number: it must never sit below
   * `reducedState`, because a state the reducer will hold has to be a state a
   * snapshot can carry.
   *
   * It was 64 KB against a 128 KB reducer, which opened a band of live states
   * that were legal to hold and impossible to write down. A `--preserve-state`
   * publish folds such a state, moves the definition to a preserving revision,
   * and only then finds the snapshot will not validate — leaving a channel
   * whose migration snapshot nobody can post, with no recovery that keeps the
   * state. The band is the root cause; aligning the two caps closes it.
   */
  snapshotState: 128 * 1024,
  /** reduced in-memory state; enforced by the reducer, not a schema */
  reducedState: 128 * 1024,
  jsonDepth: SURFACE_JSON_MAX_DEPTH,
} as const;

export const ACTION_ID_MAX_LENGTH = 64;
const ACTION_ID_PATTERN = /^[a-z0-9-]+$/;

export const ActionIdSchema = z
  .string()
  .min(1)
  .max(ACTION_ID_MAX_LENGTH)
  .regex(ACTION_ID_PATTERN)
  .refine((id) => !isForbiddenObjectKey(id), {
    message: 'reserved action id',
  });

export type ActionId = z.infer<typeof ActionIdSchema>;

/**
 * Wraps a schema in a byte-size check without losing its inferred type.
 *
 * The explicit return annotation is load-bearing. `superRefine` is declared as
 * `ZodEffects<this, Output, Input>`, and on a value whose type is still the
 * unresolved generic `T`, TypeScript reads `Output`/`Input` off the constraint
 * `z.ZodTypeAny` — i.e. `ZodType<any, ZodTypeDef, any>`. Without the
 * annotation these helpers return `ZodEffects<T, any, any>`, so `z.infer` of
 * anything they produce is `any`, and any union containing such a member
 * collapses to `any` for every consumer. Restating the parameters here keeps
 * the wrapped schema's own output and input.
 */
function sizeCapped<T extends z.ZodTypeAny>(
  schema: T,
  maxBytes: number,
  label: string
): z.ZodEffects<T, z.output<T>, z.input<T>> {
  return schema.superRefine((value: Json, ctx: z.RefinementCtx) => {
    if (jsonByteLength(value) > maxBytes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} exceeds ${maxBytes} bytes`,
      });
    }
  });
}

const SurfaceOpValueSchema = sizeCapped(
  JsonSchema,
  SURFACE_CAPS.opValue,
  'op value'
);

export const SurfaceOpSchema: z.ZodType<SurfaceOp> = z.discriminatedUnion(
  'op',
  [
    z.object({
      op: z.literal('set'),
      // Path grammar is validated per-op at reduce time (see module doc).
      path: z.string(),
      value: SurfaceOpValueSchema,
    }),
    z.object({
      op: z.literal('del'),
      path: z.string(),
    }),
    z.object({
      op: z.literal('append'),
      path: z.string(),
      value: SurfaceOpValueSchema,
    }),
  ]
) as unknown as z.ZodType<SurfaceOp>;

const SurfaceOpsSchema = z.array(SurfaceOpSchema).max(SURFACE_CAPS.opsPerEvent);

export const SurfaceActionSchema = z.object({
  ops: SurfaceOpsSchema,
  acceptStale: z.boolean().optional(),
  /**
   * The publish gate's opt-out from the idempotency rule, required on any
   * action whose ops use `append` (D54). The reducer never reads it.
   *
   * It is declared HERE, rather than left as an unknown key the gate reads
   * off the raw spec, because `z.object` strips what it does not declare:
   * an undeclared marker is present in a written spec and absent from the
   * validated read-back of that same spec, so every comparison of the two
   * sees a difference that is not there. That divergence produced four
   * separate defects (D67, D72, the `decideRevision` false bump, and the
   * predicted fork-strips-the-marker hazard). Declaring the field is the
   * fix for the class; patching comparison sites one at a time is not.
   */
  duplicatesTolerated: z.boolean().optional(),
});

export type SurfaceAction = z.infer<typeof SurfaceActionSchema>;

export const SurfaceBundleRefSchema = z.object({
  assetRef: z.string().min(1),
  /** the authority: clients run only bytes matching this hash */
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  /** bytes; sanity bound before fetch */
  size: z.number().int().positive().max(SURFACE_CAPS.bundleSize),
  /** shell major version the bundle targets */
  shellVersion: z.number().int().positive(),
});

export type SurfaceBundleRef = z.infer<typeof SurfaceBundleRefSchema>;

export const SurfaceSpecSchema = z
  .object({
    version: z.literal(1),
    surfaceId: z.string().min(1),
    specRevision: z.number().int().nonnegative(),
    title: z.string().optional(),
    bundle: SurfaceBundleRefSchema,
    initialState: sizeCapped(
      JsonObjectSchema,
      SURFACE_CAPS.initialState,
      'initialState'
    ),
    preserveState: z.boolean().optional(),
    actions: z
      .record(ActionIdSchema, SurfaceActionSchema)
      .superRefine((actions, ctx) => {
        if (Object.keys(actions).length > SURFACE_CAPS.actionsPerSpec) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `more than ${SURFACE_CAPS.actionsPerSpec} actions`,
          });
        }
      }),
    recipe: sizeCapped(JsonSchema, SURFACE_CAPS.recipe, 'recipe').optional(),
  })
  .superRefine((spec, ctx) => {
    if (jsonByteLength(spec as Json) > SURFACE_CAPS.specTotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `spec exceeds ${SURFACE_CAPS.specTotal} bytes`,
      });
    }
  });

export type SurfaceSpec = z.infer<typeof SurfaceSpecSchema>;

/** The spec protocol version this client understands. */
export const SUPPORTED_SURFACE_SPEC_VERSION = 1;

export type SurfaceSpecReadResult =
  | { status: 'absent' }
  | { status: 'invalid' }
  | { status: 'version-too-new'; version: number }
  | { status: 'valid'; spec: SurfaceSpec };

/**
 * Reads a raw persisted `surfaceSpec` (JSON text) into the four-way result
 * the renderer maps to distinct states (§6 step 1): absent (not a surface
 * channel), invalid ("invalid definition" — never a chat fallback),
 * version-too-new ("update to view"), or valid. The stored value is never
 * trusted: it is re-validated on every read. A declared integer `version`
 * newer than this client understands wins over other validation failures —
 * a future-version spec is not "invalid", it's from the future.
 */
export function readSurfaceSpec(
  raw: string | null | undefined
): SurfaceSpecReadResult {
  if (raw == null || raw.length === 0) {
    return { status: 'absent' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'invalid' };
  }
  if (parsed === null) {
    return { status: 'absent' };
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { status: 'invalid' };
  }
  const version = (parsed as Record<string, unknown>).version;
  if (
    typeof version === 'number' &&
    Number.isInteger(version) &&
    version > SUPPORTED_SURFACE_SPEC_VERSION
  ) {
    return { status: 'version-too-new', version };
  }
  const result = SurfaceSpecSchema.safeParse(parsed);
  return result.success
    ? { status: 'valid', spec: result.data }
    : { status: 'invalid' };
}

const surfaceEntryBase = {
  version: z.literal(1),
  surfaceId: z.string().min(1),
  specRevision: z.number().int().nonnegative(),
};

/** Same type-preservation requirement as `sizeCapped`; see its comment. */
function entrySizeCapped<T extends z.ZodTypeAny>(
  schema: T
): z.ZodEffects<T, z.output<T>, z.input<T>> {
  return schema.superRefine((entry: Json, ctx: z.RefinementCtx) => {
    if (jsonByteLength(entry) > SURFACE_CAPS.eventEntryTotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `entry exceeds ${SURFACE_CAPS.eventEntryTotal} bytes`,
      });
    }
  });
}

/**
 * `surface-event` v1 blob entry: host raw-ops updates and member invokes
 * (§4.3). `specRevision` tags the revision the writer targeted; the reducer
 * enforces the revision filter and authorship rules.
 */
export const SurfaceEventEntrySchema = entrySizeCapped(
  z.discriminatedUnion('mode', [
    z.object({
      type: z.literal('surface-event'),
      ...surfaceEntryBase,
      mode: z.literal('host'),
      ops: SurfaceOpsSchema,
    }),
    z.object({
      type: z.literal('surface-event'),
      ...surfaceEntryBase,
      mode: z.literal('invoke'),
      actionId: ActionIdSchema,
    }),
  ])
);

export type SurfaceEventEntry = z.infer<typeof SurfaceEventEntrySchema>;

/**
 * `surface-snapshot` v1 blob entry (§4.4). Honored only from the channel
 * host and only at the current spec revision; the effective snapshot is the
 * valid one with the greatest `upToSequenceNum`.
 */
export const SurfaceSnapshotEntrySchema = z.object({
  type: z.literal('surface-snapshot'),
  ...surfaceEntryBase,
  upToSequenceNum: z.number().int().nonnegative(),
  state: sizeCapped(
    JsonObjectSchema,
    SURFACE_CAPS.snapshotState,
    'snapshot state'
  ),
});

export type SurfaceSnapshotEntry = z.infer<typeof SurfaceSnapshotEntrySchema>;

/**
 * `surface-spec-mirror` v1 blob entry (§4.2): non-authoritative revision
 * history for audit/rollback UI. Ignored by the reducer.
 */
export const SurfaceSpecMirrorEntrySchema = z.object({
  type: z.literal('surface-spec-mirror'),
  ...surfaceEntryBase,
  spec: SurfaceSpecSchema,
});

export type SurfaceSpecMirrorEntry = z.infer<
  typeof SurfaceSpecMirrorEntrySchema
>;

/**
 * Own-property action lookup: ids like `constructor` are rejected by
 * ActionIdSchema, but resolution stays own-property anyway so no inherited
 * name can ever resolve as a declared action.
 */
export function getDeclaredAction(
  spec: SurfaceSpec,
  actionId: string
): SurfaceAction | undefined {
  return Object.prototype.hasOwnProperty.call(spec.actions, actionId)
    ? spec.actions[actionId]
    : undefined;
}
