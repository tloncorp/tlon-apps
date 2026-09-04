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
import type { AssertFalse, IsAny } from '../typeAssertions';

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
  /**
   * The lineage block `surface fork` writes. Small by construction — two ids,
   * a revision, a hash and a mode — so the cap is a bound on abuse rather than
   * on legitimate content: nothing correct comes near 1KB, and a spec near
   * `specTotal` must not be pushed over it by a field nobody chose to add.
   */
  provenance: 1024,
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
    /**
     * The publish gate's opt-out from the member-interaction rule: an app that
     * declares no actions is display-only BY DESIGN — a countdown, a schedule,
     * a read-only summary whose state moves only from host events — rather
     * than by omission. The reducer never reads it.
     *
     * `mode` is an enum with one legal value rather than a boolean, for two
     * reasons. `displayOnly: false` over an empty action map would be a spec
     * asserting members can act while declaring nothing they can do, a third
     * state the schema cannot refuse. And the claim is about the MEMBER's half
     * of the action map, not about the screen — a display-only surface still
     * changes, from host events.
     *
     * ── Why the marker costs a sentence ────────────────────────────────
     *
     * It started as a bare `'none'` and the first app to carry it was the
     * exact app the rule was written to catch: an expense split nobody can add
     * an expense to, shipped inert a second time, one session after being
     * named — declared this time, so the warning never fired. The marker had
     * been copied out of the doctrine's example before any lint ran, from a
     * snippet that sat eleven lines below the paragraph explaining that this
     * app shape is the wrong reason to reach for it.
     *
     * A marker that costs nothing to write gets written. `because` is not
     * decoration and it is not machine-checkable: it is the sentence the
     * rubric's eighth check is scored against, and its job is to make an
     * author who cannot name the host event that moves the state notice that
     * they cannot, at the moment they are typing rather than two sessions
     * later.
     *
     * Declared here for the reason `duplicatesTolerated` is: `z.object` strips
     * what it does not declare, so an undeclared marker is present in a
     * written spec and absent from the validated read-back of that same spec,
     * and every comparison of the two sees a difference that is not there.
     */
    memberInteraction: z
      .object({
        mode: z.literal('none'),
        /** what moves this app's state instead, in the author's own words */
        because: z.string().min(1),
      })
      .optional(),
    /**
     * The time-display declaration: this app's screen depends on the
     * host-supplied `now`, and the host should keep sending fresh ones every
     * `refreshSeconds` while a viewer has it open.
     *
     * The reducer never reads it — nothing here can reach a write. That is
     * the whole point of the flag being on the DISPLAY side: a state
     * transition that depends on time ("closed once the date passes") is
     * still a host event and nothing else, and no value of this field will
     * ever make it otherwise.
     *
     * It exists as a spec field rather than as something inferred from the
     * bundle for two reasons. The host has to know whether to run a timer at
     * all, and reading that off the bundle would mean parsing app code in the
     * render path. And the publish gate has to be able to SEE it: an app
     * whose screen moves with the clock while its spec says nothing is an app
     * whose reviewers scored a screenshot that will not stay true, which is
     * what the `time-display` rule refuses.
     *
     * Declared here (not left as an unknown key) for the reason
     * `duplicatesTolerated` and `memberInteraction` are: `z.object` strips
     * what it does not declare, so an undeclared marker is present in a
     * written spec and absent from the validated read-back of that same spec,
     * and every comparison of the two sees a difference that is not there.
     */
    timeDisplay: z
      .object({
        /**
         * Seconds between host `now` refreshes. Bounded below at 1 (a busier
         * timer than one repaint a second buys nothing a viewer can read) and
         * above at a day, which is the longest cadence that is still a timer
         * rather than a reason to reopen the screen.
         */
        refreshSeconds: z.number().int().min(1).max(86400),
      })
      .optional(),
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
    /**
     * Where this app was copied from. Written by `surface fork`.
     *
     * **A CLAIM, never an attestation.** The forker writes every field of it
     * and nothing verifies any of them: a `sha256` here is the source bundle's
     * hash as the forker read it, not a hash anything re-checked, and
     * `surfaceId` names a surface the reader may not be able to see. Treat it
     * as attribution and lineage, never as trust. `bundle.sha256` is the only
     * hash in a spec that a client enforces.
     *
     * Declared here for the third time for the same reason (D67, D72): a key
     * the schema does not declare is present in a written spec and absent from
     * the validated read-back of that same spec, so every comparison of the
     * two sees a difference that is not there. Fork wrote this key from the
     * day it shipped and was safe only because every comparison on its write
     * path happens to be raw-to-raw — which is a property of today's call
     * sites, not of the field. Declaring it also makes lineage readable off a
     * validated spec, which the §9 fork affordance needs in order to display
     * anything at all.
     *
     * `channel` is optional ON PURPOSE: naming the source nest tells every
     * member of the forker's group that a channel by that name exists
     * somewhere, which is a disclosure the forker should have to opt into.
     */
    provenance: sizeCapped(
      z.object({
        surfaceId: z.string().min(1),
        specRevision: z.number().int().positive(),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
        channel: z.string().min(1).optional(),
        mode: z.enum(['copy', 'regenerated']),
      }),
      SURFACE_CAPS.provenance,
      'provenance'
    ).optional(),
  })
  .superRefine((spec, ctx) => {
    if (jsonByteLength(spec as Json) > SURFACE_CAPS.specTotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `spec exceeds ${SURFACE_CAPS.specTotal} bytes`,
      });
    }
    // The marker is an opt-out from a rule that only fires on an EMPTY action
    // map, so beside a nonempty one it asserts nothing and contradicts what it
    // sits next to (D191). It was permitted, and lint returned early whenever
    // actions existed, so an actionful spec could carry "members cannot act"
    // and pass clean — while the rubric, which keys check 8 off the marker's
    // presence alone, generated a check about a display-only app for a board
    // full of controls.
    //
    // Refused at the SCHEMA and not in lint, because lint is the publish gate
    // and the contradiction is readable by everything that validates a spec:
    // the reducer's own read-back, `surface show`, the preview, the client.
    // A gate-only rule would leave every one of those agreeing that a
    // self-contradicting spec is fine.
    if (
      spec.memberInteraction !== undefined &&
      Object.keys(spec.actions ?? {}).length > 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['memberInteraction'],
        message: `memberInteraction declares that members cannot act, but this spec declares ${Object.keys(spec.actions ?? {}).length} action(s) they can. Remove the marker, or remove the actions.`,
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
 * Drift guards for the two generic helpers above.
 *
 * `sizeCapped` and `entrySizeCapped` both wrap an unresolved generic `T`, so
 * both degrade to `ZodEffects<T, any, any>` the moment their explicit return
 * annotation is removed or paraphrased. What that costs depends on where the
 * helper was applied, and the two shapes need separate assertions:
 *
 * - applied to a whole union member (`entrySizeCapped` around
 *   `SurfaceEventEntrySchema`), the `any` is contagious: `SurfaceEventEntry`
 *   becomes `any`, and so does every union containing it, `PostBlobDataEntry`
 *   included. That is what d5c41acdc5 fixed. `packages/api` typechecked clean
 *   throughout; it surfaced two packages away in `packages/openclaw` as
 *   `TS7006: Parameter 'providerId' implicitly has an 'any' type`, the first
 *   place `noImplicitAny` could speak up.
 * - applied to a FIELD (`sizeCapped` around `initialState`, `recipe`,
 *   snapshot `state`), the `any` stays put and no union collapses. Nothing
 *   about `PostBlobDataEntry` changes, so a union-level guard cannot see it —
 *   verified, not assumed: stripping `sizeCapped`'s annotation fails only the
 *   four assertions below and leaves every union guard green. These are the
 *   silent widenings d5c41acdc5 also repaired (`SurfaceSnapshotEntry.state`
 *   and `SurfaceSpec.recipe` were both `any`).
 *
 * Hence one assertion per applied site rather than one per exported union.
 * Narrowing assertions (the other half of the contract) need value-level code
 * and live in `src/__tests__/surfaceTypeContracts.test-d.ts`.
 */
// oxlint-disable-next-line no-unused-vars -- the declaration IS the check
type _SurfaceEventEntryIsNotAny = AssertFalse<IsAny<SurfaceEventEntry>>;
// oxlint-disable-next-line no-unused-vars -- the declaration IS the check
type _SurfaceSpecInitialStateIsNotAny = AssertFalse<
  IsAny<SurfaceSpec['initialState']>
>;
// oxlint-disable-next-line no-unused-vars -- the declaration IS the check
type _SurfaceSpecRecipeIsNotAny = AssertFalse<IsAny<SurfaceSpec['recipe']>>;
// oxlint-disable-next-line no-unused-vars -- the declaration IS the check
type _SurfaceSnapshotStateIsNotAny = AssertFalse<
  IsAny<SurfaceSnapshotEntry['state']>
>;
/**
 * The fourth `sizeCapped` site. Asserted on the SCHEMA's inferred output, not
 * on `Extract<SurfaceOp, { op: 'set' }>['value']`: `SurfaceOpSchema` is
 * `as unknown as z.ZodType<SurfaceOp>`, and that cast restores `Json` from the
 * hand-written type no matter what the helper inferred, so a guard phrased
 * against `SurfaceOp` could not fail and would only look like a check.
 */
// oxlint-disable-next-line no-unused-vars -- the declaration IS the check
type _SurfaceOpValueIsNotAny = AssertFalse<
  IsAny<z.infer<typeof SurfaceOpValueSchema>>
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
