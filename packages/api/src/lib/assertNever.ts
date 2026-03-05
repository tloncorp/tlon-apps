/**
 * Assert that the argument is typed as `never`. Use to assert exhaustiveness
 * in cases that Typescript can't handle.
 *
 * ```ts
 * const x: string | number = 1;
 * switch (true) {
 *   case typeof x === 'string': return x;
 *   case typeof x === 'number': return 'number';
 *   default: return assertNever(x);
 * }
 * ```
 */
export function assertNever<T>(x: never): T {
  throw new Error(`Unexpected case: ${x}`);
}
