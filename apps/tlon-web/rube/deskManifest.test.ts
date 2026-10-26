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

  const docket = (globLine: string, version = '[12 5 0]') =>
    [
      ":~  title+'Tlon'",
      globLine,
      "    base+'groups'",
      `    version+${version}`,
      '==',
      '',
    ].join('\n');
  const globA =
    "    glob-http+['https://bootstrap.urbit.org/glob-0v1.aaaaa.bbbbb.glob' 0v1.aaaaa.bbbbb]";
  const globB =
    "    glob-http+['https://bootstrap.urbit.org/glob-0v5.ccccc.ddddd.glob' 0v5.ccccc.ddddd]";

  it('ignores a docket whose only difference is the glob line', () => {
    writeFile(stagingRoot, 'desk.docket-0', docket(globA));
    writeFile(targetRoot, 'desk.docket-0', docket(globB));

    expect(desksMatch(stagingRoot, targetRoot)).toBe(true);
  });

  it('detects a docket version change alongside a glob change', () => {
    writeFile(stagingRoot, 'desk.docket-0', docket(globA, '[12 6 0]'));
    writeFile(targetRoot, 'desk.docket-0', docket(globB));

    expect(desksMatch(stagingRoot, targetRoot)).toBe(false);
  });

  it('compares a glob line in an unrecognized format raw', () => {
    const unrecognized = (hash: string) => `    glob-ames+[~zod ${hash}]`;
    writeFile(stagingRoot, 'desk.docket-0', docket(unrecognized('0v1.aaaaa')));
    writeFile(targetRoot, 'desk.docket-0', docket(unrecognized('0v5.ccccc')));

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
