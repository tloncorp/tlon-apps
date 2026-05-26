const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

function parse(version: string): [number, number, number] | null {
  const match = SEMVER_RE.exec(version.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareSemver(a: string, b: string): number {
  const parsedA = parse(a);
  const parsedB = parse(b);
  if (!parsedA || !parsedB) return 0;
  for (let i = 0; i < 3; i++) {
    if (parsedA[i] !== parsedB[i]) return parsedA[i] - parsedB[i];
  }
  return 0;
}

export function isVersionBelow(current: string, minimum: string): boolean {
  return compareSemver(current, minimum) < 0;
}
