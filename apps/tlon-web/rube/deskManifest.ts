import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Files written into an assembled desk by the build, not source. Compared
// trees may legitimately differ here.
export const GENERATED_DESK_FILES: ReadonlySet<string> = new Set([
  'commit.txt',
]);

const hashFile = (filePath: string): string => {
  const content = fs.readFileSync(filePath);
  return crypto
    .createHash('md5')
    .update(content as any)
    .digest('hex');
};

// relative path -> md5 of contents, for every file under `root`, excluding
// GENERATED_DESK_FILES. Returns an empty Map if `root` does not exist.
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
        manifest.set(relativePath, hashFile(fullPath));
      }
    }
  };

  walk(root);

  return manifest;
}

// True when two desk trees are byte-identical apart from generated files.
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
