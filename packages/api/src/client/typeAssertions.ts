/**
 * Compile-time assertion vocabulary.
 *
 * These are types, not functions: instantiating one with a value its
 * constraint rejects is a `tsc` error at the declaration site, so a
 * `type _Whatever = AssertTrue<...>` declaration IS the check. Nothing has to
 * run, which is what makes them usable against types that have no runtime
 * representation at all.
 *
 * The failure they exist for is silent: an exported type degrading to `any`.
 * `any` swallows every subsequent check made against it — `entry.type === 'x'`
 * still compiles, `entry.wrongField` still compiles — so the degradation is
 * reported nowhere near its cause, if at all.
 */

/** Fails to compile unless `T` is exactly `true`. */
export type AssertTrue<T extends true> = T;

/** Fails to compile unless `T` is exactly `false`. */
export type AssertFalse<T extends false> = T;

/**
 * `true` when `T` is `any`, `false` otherwise.
 *
 * `1 & T` collapses to `any` only when `T` is `any` (for every other `T` it is
 * an intersection no `0` inhabits), so the `0 extends ...` probe distinguishes
 * `any` from `unknown`, `never`, and every ordinary type. A plain
 * `T extends any` cannot: everything satisfies it.
 */
export type IsAny<T> = 0 extends 1 & T ? true : false;
