/** maps available units to how many bytes fit in one unit, ordered by preference */
const unitToBytes: Array<{
  unit: string;
  /** how many bytes fit in one unit */
  bytes: number;
}> = [
  { unit: 'gb', bytes: Math.pow(1024, 3) },
  { unit: 'mb', bytes: Math.pow(1024, 2) },
  { unit: 'kb', bytes: Math.pow(1024, 1) },
  { unit: 'b', bytes: Math.pow(1024, 0) },
];

/**
 * @example
 * ```ts
 * formatMemorySize(1024) === '1kb'
 * formatMemorySize(1_572_864) === '1.5mb'
 * ```
 */
export function formatMemorySize(bytes: number): string {
  function format(n: number, unit: string): string {
    return `${+n.toFixed(1)}${unit}`;
  }

  const matchingUnit =
    unitToBytes.find((x) => bytes / x.bytes >= 1) ?? unitToBytes.at(-1)!;
  return format(bytes / matchingUnit.bytes, matchingUnit.unit);
}
