/* oxlint-disable no-unused-vars -- every declaration in this file IS a check;
   nothing here is meant to be called or referenced. */
import type { PostBlobDataEntry } from '../client/content-helpers';
import type {
  SurfaceOp,
  PointerResult,
  ApplyOpResult,
} from '../client/surface/jsonPointer';
import type { SurfaceReduction } from '../client/surface/reducer';
import type {
  SurfaceEventEntry,
  SurfaceSpecReadResult,
} from '../client/surface/schemas';
import type { AssertFalse, IsAny } from '../client/typeAssertions';

/**
 * Type-level contracts for the exported discriminated unions of the surface
 * API. Every assertion here is checked by `tsc`, not by vitest: the functions
 * are never called and the `type` declarations have no runtime form. What runs
 * this file is `pnpm --filter @tloncorp/api tsc` (`tsc --noEmit`, which
 * `tsconfig.json` points at all of `./src`) — the same script CI's
 * `pnpm -r tsc` step invokes.
 *
 * Two properties per union, because they fail independently:
 *
 * 1. the union is not `any`. `z.infer` of a generic zod wrapper without an
 *    explicit return annotation is `any`, and `any` is contagious: one such
 *    member makes the whole union `any` for every consumer.
 * 2. the union still discriminates. Narrow to one arm, and another arm's
 *    exclusive field must be a type error. This is the property consumers
 *    actually rely on, and it is the one that dies silently — under a
 *    degraded union `entry.type === 'x'` still compiles and so does
 *    `entry.fieldFromSomeOtherArm`.
 *
 * The `@ts-expect-error` directives are the teeth of (2). They are errors when
 * the error they suppress stops occurring ("Unused '@ts-expect-error'
 * directive", TS2578), which is exactly the degraded case. Each is kept to a
 * bare property access so it cannot pass by absorbing some unrelated error on
 * the same line.
 */

// --- 1. not `any` ---------------------------------------------------------
//
// `SurfaceEventEntry` and the field-level `sizeCapped` sites are also asserted
// at their definition in `client/surface/schemas.ts`, and `PostBlobDataEntry`
// in `client/content-helpers.ts`, so those survive a build-config typecheck
// that excludes `src/__tests__`. Repeated here so this file states the whole
// contract in one place.

type _SurfaceEventEntryIsNotAny = AssertFalse<IsAny<SurfaceEventEntry>>;
type _PostBlobDataEntryIsNotAny = AssertFalse<IsAny<PostBlobDataEntry>>;
type _SurfaceSpecReadResultIsNotAny = AssertFalse<IsAny<SurfaceSpecReadResult>>;
type _SurfaceOpIsNotAny = AssertFalse<IsAny<SurfaceOp>>;
type _PointerResultIsNotAny = AssertFalse<IsAny<PointerResult>>;
type _ApplyOpResultIsNotAny = AssertFalse<IsAny<ApplyOpResult>>;
type _SurfaceReductionIsNotAny = AssertFalse<IsAny<SurfaceReduction>>;

// --- 2. the unions still discriminate -------------------------------------

/** `SurfaceEventEntry` on `mode`: `ops` is host-only, `actionId` invoke-only. */
function _surfaceEventEntryDiscriminates(entry: SurfaceEventEntry): unknown {
  if (entry.mode === 'host') {
    return [
      entry.ops,
      // @ts-expect-error `actionId` exists only on the invoke arm
      entry.actionId,
    ];
  }
  return [
    entry.actionId,
    // @ts-expect-error `ops` exists only on the host arm
    entry.ops,
  ];
}

/**
 * `PostBlobDataEntry` on `type`. The `surface-event` case is the one the
 * incident ran through: `SurfaceEventEntrySchema` is a member of this union,
 * so its degradation collapsed the union for consumers that had never heard
 * of surface channels.
 */
function _postBlobDataEntryDiscriminates(entry: PostBlobDataEntry): unknown {
  if (entry.type === 'surface-event') {
    return [
      entry.mode,
      // @ts-expect-error `upToSequenceNum` belongs to `surface-snapshot`
      entry.upToSequenceNum,
    ];
  }
  if (entry.type === 'file') {
    return [
      entry.fileUri,
      // @ts-expect-error `lensId` belongs to `tlon-context-lens`
      entry.lensId,
    ];
  }
  return entry.type;
}

/** `SurfaceSpecReadResult` on `status`. */
function _surfaceSpecReadResultDiscriminates(
  result: SurfaceSpecReadResult
): unknown {
  if (result.status === 'valid') {
    return [
      result.spec,
      // @ts-expect-error `version` belongs to the `version-too-new` arm
      result.version,
    ];
  }
  return result.status;
}

/** `SurfaceOp` on `op`: only `set`/`append` carry a `value`. */
function _surfaceOpDiscriminates(op: SurfaceOp): unknown {
  if (op.op === 'del') {
    return [
      op.path,
      // @ts-expect-error a `del` op has no `value`
      op.value,
    ];
  }
  return op.value;
}

/** `PointerResult` on the boolean `ok`. */
function _pointerResultDiscriminates(result: PointerResult): unknown {
  if (result.ok) {
    return [
      result.segments,
      // @ts-expect-error `error` exists only on the failure arm
      result.error,
    ];
  }
  return result.error;
}

/** `ApplyOpResult` on the boolean `ok`. */
function _applyOpResultDiscriminates(result: ApplyOpResult): unknown {
  if (result.ok) {
    return [
      result.state,
      // @ts-expect-error `refusal` exists only on the failure arm
      result.refusal,
    ];
  }
  return result.refusal;
}

/**
 * `SurfaceReduction` on `status`. Pinned to `status` and `state` only —
 * the reduced arm's counter fields are being reshaped on this branch, and a
 * guard about discrimination should not also be a pin on arm contents.
 */
function _surfaceReductionDiscriminates(reduction: SurfaceReduction): unknown {
  if (reduction.status === 'migration-pending') {
    return [
      reduction.status,
      // @ts-expect-error the pending arm carries no state
      reduction.state,
    ];
  }
  return reduction.state;
}

/**
 * There is deliberately no runtime test here. The `.test-d.ts` suffix keeps
 * vitest's `src/__tests__/**\/*.test.ts` glob off this file, because the only
 * check it carries is the compile. A runtime test asserting these functions
 * are functions would pass whether or not the union still discriminates, and
 * the value-level counterpart — that the SCHEMAS reject cross-arm shapes at
 * parse time — is already covered by `surfaceSchemas.test.ts`
 * ('rejects cross-arm and malformed shapes', 'strips smuggled ops from invoke
 * entries').
 */
