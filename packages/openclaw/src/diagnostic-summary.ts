export function diagnosticSummary(
  parts: Array<[string, string | number | boolean | null | undefined]>
): string {
  return parts
    .filter(
      ([, value]) => value !== null && value !== undefined && value !== ''
    )
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
}
