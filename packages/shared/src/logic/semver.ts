const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:[-+].+)?$/;

// Parse a full semver string into its numeric core, or null if the entire
// string is not a valid semver (a partially parseable prefix like
// "11.2.2 dirty" returns null, not [11, 2, 2]).
export function parseVersion(version: string): [number, number, number] | null {
  const match = SEMVER_RE.exec(version.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareCore(a: string, b: string): number {
  const parsedA = parseVersion(a);
  const parsedB = parseVersion(b);
  if (!parsedA || !parsedB) return 0;
  for (let i = 0; i < 3; i++) {
    if (parsedA[i] !== parsedB[i]) return parsedA[i] - parsedB[i];
  }
  return 0;
}

export function isVersionBelow(current: string, minimum: string): boolean {
  return compareCore(current, minimum) < 0;
}
