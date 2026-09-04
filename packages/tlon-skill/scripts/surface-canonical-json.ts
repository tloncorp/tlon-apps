/**
 * The ONE comparison helper for surface JSON (D72).
 *
 * D72 is not "the gate reads raw." It is: **any comparison of a written spec
 * against a read-back one must use the raw cell**, because `SurfaceSpecSchema`
 * is a `z.object` and strips exactly the keys such a gate depends on. Reading a
 * *field* off the validated spec stays correct; comparing *specs* does not.
 *
 * A convention that says "compare through the canonical helper" is only worth
 * anything while there is exactly one canonical helper. This module exists so
 * that sentence has a location: it is a leaf (no imports, so nothing can make
 * importing it a cycle or drag a CLI dependency into the publish gate), and
 * `surface-comparison-convention.ts` fails the build if a second `canonicalJson`
 * appears anywhere in the surface sources. Before that check existed the
 * codebase held three of them, agreeing on key ordering and disagreeing on
 * `undefined` — which is the only interesting case.
 *
 * Two properties, both load-bearing:
 *
 * - **Key order is not content.** A spec that differs only in the order its
 *   author's editor happened to serialize keys is not a change; bumping the
 *   revision for it is the same false positive as never bumping at all, in the
 *   other direction. So object keys sort and array order is preserved (array
 *   order IS meaning).
 * - **The output is what survives a JSON round trip.** Every comparison this
 *   serves has JSON text on at least one side — a spec written to a channel's
 *   description cell and read back out of it — so a value that `JSON.stringify`
 *   would erase must serialize the way the round trip leaves it: an
 *   `undefined`-valued key is dropped, and `undefined` inside an array becomes
 *   `null`. Emitting a bare `undefined` token instead (as one of the deleted
 *   copies did) invents a distinction no round trip can preserve, so two values
 *   that ARE equal after a write/read cycle would compare different.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries
    .map(
      ([key, entryValue]) =>
        `${JSON.stringify(key)}:${canonicalJson(entryValue)}`
    )
    .join(',')}}`;
}
