import { parseArgs } from 'node:util';

// OpenClaw versions are YYYY.M.N; prereleases (`-beta.1`) and respins
// (`-1`) are never `latest` and never count as releases here.
const STABLE = /^(\d+)\.(\d+)\.(\d+)$/;

export function isStable(version: string) {
  return STABLE.test(version);
}

function parts(version: string) {
  const match = STABLE.exec(version);
  if (!match) {
    throw new Error(`not a stable OpenClaw version: ${version}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareVersions(a: string, b: string) {
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) {
      return pa[i] - pb[i];
    }
  }
  return 0;
}

// The release line is YYYY.M (9.x in upstream's own wording).
export function lineOf(version: string) {
  const [year, month] = parts(version);
  return `${year}.${month}`;
}

export function shortVersion(version: string, reference: string) {
  const [year] = parts(version);
  return year === parts(reference)[0]
    ? version.slice(`${year}.`.length)
    : version;
}

// Stable releases strictly between prev and next that lead up to next. Lines
// are monthly and upstream keeps shipping maintenance releases on older lines
// after the next line opens, so an older-line release counts only when it was
// published before the first stable release on next's line.
export function versionsBetween(
  // npm `time`: version → ISO publish date
  time: Record<string, string>,
  prev: string,
  next: string
) {
  const nextLine = lineOf(next);
  const lineOpened = Math.min(
    ...Object.keys(time)
      .filter((v) => isStable(v) && lineOf(v) === nextLine)
      .map((v) => Date.parse(time[v]))
      .filter((at) => !Number.isNaN(at))
  );
  return Object.keys(time)
    .filter(
      (version) =>
        isStable(version) &&
        compareVersions(version, prev) > 0 &&
        compareVersions(version, next) < 0 &&
        (lineOf(version) === nextLine || Date.parse(time[version]) < lineOpened)
    )
    .sort(compareVersions);
}

// For the workflow's shell steps:
// node scripts/upstream-watch/versions.ts --compare <a> <b>
// prints -1, 0 or 1 as a is older than, equal to or newer than b.
export function compareCli(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    options: { compare: { type: 'boolean' } },
    allowPositionals: true,
  });
  if (!values.compare || positionals.length !== 2) {
    throw new Error('usage: versions.ts --compare <a> <b>');
  }
  return String(Math.sign(compareVersions(positionals[0], positionals[1])));
}

// Stable tags from `git ls-remote --tags` output (`<sha>\trefs/tags/v<x>`,
// plus peeled `^{}` duplicates).
export function parseTagList(lsRemote: string) {
  const tags = new Set<string>();
  for (const line of lsRemote.split('\n')) {
    const match = /refs\/tags\/v([^\s^]+)(\^\{\})?$/.exec(line.trim());
    if (match && isStable(match[1])) {
      tags.add(match[1]);
    }
  }
  return tags;
}

if (import.meta.main) {
  process.stdout.write(compareCli(process.argv.slice(2)) + '\n');
}
