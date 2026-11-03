import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Files written into an assembled desk by the build, not source. Compared
// trees may legitimately differ here.
export const GENERATED_DESK_FILES: ReadonlySet<string> = new Set([
  'commit.txt',
]);

const DOCKET = 'desk.docket-0';

// The glob bot rewrites this docket line several times a day, and a pier whose
// docket names an older glob runs the same Hoon, so it must not force a desk
// copy and |commit. A line in any other format is kept (compared raw), so a
// format change costs a spurious commit, never a missed one. Kept in step with
// DOCKET_GLOB_LINE in scripts/desk-identity.sh.
const DOCKET_GLOB_LINE = /^ *glob-http\+\[[^ ]+ +0v[0-9a-v.]+\] *$/;

const normalizeDocket = (docket: string): string =>
  docket
    .split('\n')
    .filter((line) => !DOCKET_GLOB_LINE.test(line))
    .join('\n');

const hashFile = (filePath: string, relativePath: string): string => {
  const content =
    relativePath === DOCKET
      ? normalizeDocket(fs.readFileSync(filePath, 'utf8'))
      : fs.readFileSync(filePath);
  return crypto
    .createHash('md5')
    .update(content as any)
    .digest('hex');
};

// relative path -> md5 of contents (the docket's normalized), for every file
// under `root`, excluding GENERATED_DESK_FILES. Returns an empty Map if `root`
// does not exist.
export function buildDeskManifest(root: string): Map<string, string> {
  const manifest = new Map<string, string>();

  if (!fs.existsSync(root)) {
    return manifest;
  }

  const walk = (dir: string) => {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else {
        const relativePath = path
          .relative(root, fullPath)
          .split(path.sep)
          .join('/');
        if (GENERATED_DESK_FILES.has(relativePath)) {
          continue;
        }
        manifest.set(relativePath, hashFile(fullPath, relativePath));
      }
    }
  };

  walk(root);

  return manifest;
}

// True when two desk trees are byte-identical apart from generated files and
// the docket's glob line.
// MUST be symmetric: differing key sets in EITHER direction mean no match.
export function desksMatch(aRoot: string, bRoot: string): boolean {
  if (!fs.existsSync(aRoot) || !fs.existsSync(bRoot)) {
    return false;
  }

  const aManifest = buildDeskManifest(aRoot);
  const bManifest = buildDeskManifest(bRoot);

  if (aManifest.size !== bManifest.size) {
    return false;
  }

  for (const [relativePath, hash] of aManifest) {
    if (bManifest.get(relativePath) !== hash) {
      return false;
    }
  }

  return true;
}
