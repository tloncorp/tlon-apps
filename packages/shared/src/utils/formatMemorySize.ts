/** maps available units to how many bytes fit in one unit, ordered by preference */
const unitToBytes = [
  { unit: 'gb', bytes: Math.pow(1024, 3) },
  { unit: 'mb', bytes: Math.pow(1024, 2) },
  { unit: 'kb', bytes: Math.pow(1024, 1) },
  { unit: 'b', bytes: Math.pow(1024, 0) },
] as const satisfies Array<{
  unit: string;
  /** how many bytes fit in one unit */
  bytes: number;
}>;

type Unit = (typeof unitToBytes)[number]['unit'];

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

/**
 * @example
 * ```ts
 * convert(1, 'kb').to('b') === 1024
 * convert(1, 'gb').to('mb') === 1024
 * ```
 */
export function convert(value: number, fromUnit: Unit) {
  return {
    to: (toUnit: Unit) =>
      value *
      (unitToBytes.find((u) => u.unit === fromUnit)!.bytes /
        unitToBytes.find((u) => u.unit === toUnit)!.bytes),
  };
}
