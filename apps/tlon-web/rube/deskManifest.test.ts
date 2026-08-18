import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { desksMatch } from './deskManifest';

describe('desksMatch', () => {
  let stagingRoot: string;
  let targetRoot: string;

  const writeFile = (root: string, relativePath: string, content: string) => {
    const fullPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  };

  beforeEach(() => {
    stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desk-staging-'));
    targetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desk-target-'));
  });

  afterEach(() => {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
    fs.rmSync(targetRoot, { recursive: true, force: true });
  });

  it('matches identical trees, including nested directories', () => {
    writeFile(stagingRoot, 'app/groups.hoon', 'groups-code');
    writeFile(stagingRoot, 'lib/nested/test.hoon', 'lib-code');
    writeFile(targetRoot, 'app/groups.hoon', 'groups-code');
    writeFile(targetRoot, 'lib/nested/test.hoon', 'lib-code');

    expect(desksMatch(stagingRoot, targetRoot)).toBe(true);
  });

  it('does not match when a file has different content', () => {
    writeFile(stagingRoot, 'app/groups.hoon', 'groups-code');
    writeFile(targetRoot, 'app/groups.hoon', 'stale-groups-code');

    expect(desksMatch(stagingRoot, targetRoot)).toBe(false);
  });

  it('does not match when a file exists only in the target tree', () => {
    writeFile(stagingRoot, 'app/groups.hoon', 'groups-code');
    writeFile(targetRoot, 'app/groups.hoon', 'groups-code');
    writeFile(targetRoot, 'app/deleted-from-desk.hoon', 'stale-file');

    expect(desksMatch(stagingRoot, targetRoot)).toBe(false);
  });

  it('does not match when a file exists only in the staging tree', () => {
    writeFile(stagingRoot, 'app/groups.hoon', 'groups-code');
    writeFile(targetRoot, 'app/groups.hoon', 'groups-code');
    writeFile(stagingRoot, 'lib/new-vendored-dep.hoon', 'new-dep-code');

    expect(desksMatch(stagingRoot, targetRoot)).toBe(false);
  });

  it('ignores a top-level commit.txt whose content differs', () => {
    writeFile(stagingRoot, 'app/groups.hoon', 'groups-code');
    writeFile(stagingRoot, 'commit.txt', 'abc1234');
    writeFile(targetRoot, 'app/groups.hoon', 'groups-code');
    writeFile(targetRoot, 'commit.txt', 'development');

    expect(desksMatch(stagingRoot, targetRoot)).toBe(true);
  });

  it('ignores a top-level commit.txt present in only one tree', () => {
    writeFile(stagingRoot, 'app/groups.hoon', 'groups-code');
    writeFile(stagingRoot, 'commit.txt', 'abc1234');
    writeFile(targetRoot, 'app/groups.hoon', 'groups-code');

    expect(desksMatch(stagingRoot, targetRoot)).toBe(true);
  });

  it('does not ignore a nested file named commit.txt', () => {
    writeFile(stagingRoot, 'app/groups.hoon', 'groups-code');
    writeFile(stagingRoot, 'lib/commit.txt', 'nested-a');
    writeFile(targetRoot, 'app/groups.hoon', 'groups-code');
    writeFile(targetRoot, 'lib/commit.txt', 'nested-b');

    expect(desksMatch(stagingRoot, targetRoot)).toBe(false);
  });

  it('returns false when either directory does not exist', () => {
    writeFile(stagingRoot, 'app/groups.hoon', 'groups-code');
    const missingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'desk-missing-'));
    fs.rmSync(missingDir, { recursive: true });

    expect(desksMatch(stagingRoot, missingDir)).toBe(false);
    expect(desksMatch(missingDir, targetRoot)).toBe(false);
    expect(desksMatch(missingDir, `${missingDir}-other`)).toBe(false);
  });
});
