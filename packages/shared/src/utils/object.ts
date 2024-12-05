/**
 * Similar to `Object.keys`, but returns `(keyof T)[]` instead of `string[]`.
 * This can be unsafe with values that have been unsafely mutated.
 *
 * This can be inaccurate if the object has been unsafely mutated:
 * ```ts
 * const obj = { a: 1, b: 2 } as const;
 * const keys = objectKeys(obj); // ['a', 'b']
 *
 * // ts-ignore
 * obj.c = 3;
 * const keysAfter = objectKeys(obj); // ['a', 'b', 'c']
 * // keysAfter satisfies ['a', 'b'], but contains 'c' as well.
 *
 * // If you were to do a `switch` on `keysAfter[number]`, TS would think
 * // that matching on 'a' | 'b' is exhaustive; failing to handle 'c' could lead
 * // to a runtime error.
 * ```
 */
export function objectKeys<T extends Record<any, any>>(obj: Readonly<T>) {
  return Object.keys(obj) as (keyof T)[];
}

/**
 * Similar to `Object.entries`, but returns `[key, value][]` instead of
 * `[string, value][]`.
 *
 * This can be inaccurate if the object has been unsafely mutated; see `objectKeys`.
 */
export function objectEntries<T extends Record<any, any>>(
  obj: Readonly<T>
): { [K in keyof T]: [K, T[K]] }[keyof T][] {
  return objectKeys(obj).map((key) => [key, obj[key]]);
}
