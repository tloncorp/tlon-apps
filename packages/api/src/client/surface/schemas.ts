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
 * Pointer path grammar is deliberately NOT validated here — a bad path
 * invalidates only that op at reduce time, never the containing entry.
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
  snapshotState: 64 * 1024,
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

function sizeCapped<T extends z.ZodTypeAny>(
  schema: T,
  maxBytes: number,
  label: string
) {
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

const surfaceEntryBase = {
  version: z.literal(1),
  surfaceId: z.string().min(1),
  specRevision: z.number().int().nonnegative(),
};

function entrySizeCapped<T extends z.ZodTypeAny>(schema: T) {
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
