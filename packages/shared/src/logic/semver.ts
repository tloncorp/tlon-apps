const SEMVER_RE =
  /^(\d+)\.(\d+)(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

// Parse a full semver string into its numeric core, or null if the entire
// string is not a valid semver (a partially parseable prefix like
// "11.2.2 dirty" returns null, not [11, 2, 2]). The patch component may be
// omitted, so a minimum can be written as "11.4".
export function parseVersion(version: string): [number, number, number] | null {
  const match = SEMVER_RE.exec(version.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function prereleaseIds(version: string): string[] | null {
  const suffix = SEMVER_RE.exec(version.trim())?.[4];
  return suffix ? suffix.split('.') : null;
}

// Semver 11.4: a prerelease sorts below its release; identifiers compare
// numerically when numeric and lexically otherwise; when every shared
// identifier is equal, the longer list sorts higher.
function comparePrerelease(a: string[] | null, b: string[] | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    const numA = Number(a[i]);
    const numB = Number(b[i]);
    if (!Number.isNaN(numA) || !Number.isNaN(numB)) return numA - numB;
    return a[i] < b[i] ? -1 : 1;
  }
  return a.length - b.length;
}

function compareCore(a: string, b: string): number {
  const parsedA = parseVersion(a);
  const parsedB = parseVersion(b);
  if (!parsedA || !parsedB) return 0;
  for (let i = 0; i < 3; i++) {
    if (parsedA[i] !== parsedB[i]) return parsedA[i] - parsedB[i];
  }
  return comparePrerelease(prereleaseIds(a), prereleaseIds(b));
}

export function isVersionBelow(current: string, minimum: string): boolean {
  return compareCore(current, minimum) < 0;
}
