import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';

import {
  EXCLUDED_PATHS,
  compareTrees,
  contentDigest,
  digestTree,
} from './surfaces-desk-preflight.mjs';

const roots = [];
function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'desk-preflight-test-'));
  roots.push(root);
  for (const [path, contents] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
  return root;
}
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

test('an identical tree compares clean', () => {
  const files = { 'app/groups.hoon': '|_  bowl\n', 'sur/g.hoon': '|%\n' };
  const comparison = compareTrees(
    digestTree(tree(files)),
    digestTree(tree(files))
  );
  assert.equal(comparison.ok, true);
});

/**
 * The drift that actually happened, reproduced: a develop merge added
 * `mar/group/action-5.hoon` and the running ships never got it. The check has
 * to name the file, because "something is stale" sends whoever reads it
 * looking at the client, which is what cost the weeks.
 */
test('a mark the ship never got is named, not summarised', () => {
  const branch = digestTree(
    tree({
      'app/groups.hoon': '|_  bowl\n',
      'mar/group/action-5.hoon': '|_  a=action\n',
    })
  );
  const ship = digestTree(tree({ 'app/groups.hoon': '|_  bowl\n' }));
  const comparison = compareTrees(branch, ship);
  assert.equal(comparison.ok, false);
  assert.deepEqual(comparison.missing, ['mar/group/action-5.hoon']);
  assert.deepEqual(comparison.extra, []);
  assert.deepEqual(comparison.changed, []);
});

test('a file left over from another branch is reported as extra', () => {
  const branch = digestTree(tree({ 'app/groups.hoon': 'a\n' }));
  const ship = digestTree(
    tree({ 'app/groups.hoon': 'a\n', 'lib/leftover.hoon': 'b\n' })
  );
  assert.deepEqual(compareTrees(branch, ship).extra, ['lib/leftover.hoon']);
});

test('a single changed byte is a failure', () => {
  const branch = digestTree(tree({ 'app/groups.hoon': 'a\n' }));
  const ship = digestTree(tree({ 'app/groups.hoon': 'a \n' }));
  const comparison = compareTrees(branch, ship);
  assert.equal(comparison.ok, false);
  assert.deepEqual(comparison.changed, ['app/groups.hoon']);
});

/**
 * The exclusions are the places the check stops looking, so they get a test
 * each rather than a shared one: an exclusion that silently widened would
 * reintroduce the failure this file exists to catch, in the quietest possible
 * way.
 */
test('the build stamp does not fail the comparison', () => {
  assert.equal(EXCLUDED_PATHS.has('commit.txt'), true);
  const branch = digestTree(
    tree({ 'app/groups.hoon': 'a\n', 'commit.txt': 'cfc03257ae\n' })
  );
  const ship = digestTree(
    tree({ 'app/groups.hoon': 'a\n', 'commit.txt': '53a13e8056\n' })
  );
  assert.equal(compareTrees(branch, ship).ok, true);
});

test('the released frontend glob does not fail the comparison', () => {
  assert.equal(EXCLUDED_PATHS.has('desk.docket-0'), true);
  const branch = digestTree(
    tree({ 'app/groups.hoon': 'a\n', 'desk.docket-0': 'glob-http+[A]\n' })
  );
  const ship = digestTree(
    tree({ 'app/groups.hoon': 'a\n', 'desk.docket-0': 'glob-http+[B]\n' })
  );
  assert.equal(compareTrees(branch, ship).ok, true);
});

test('nothing else is excluded', () => {
  assert.deepEqual([...EXCLUDED_PATHS].sort(), ['commit.txt', 'desk.docket-0']);
});

test('Finder droppings are not drift', () => {
  const branch = digestTree(tree({ 'app/groups.hoon': 'a\n' }));
  const ship = digestTree(
    tree({ 'app/groups.hoon': 'a\n', 'app/.DS_Store': 'junk' })
  );
  assert.equal(compareTrees(branch, ship).ok, true);
});

/**
 * The ledger compares digests, so the digest has to move when the desk moves
 * and stay put when only an excluded path does — otherwise "clay was verified
 * against this content" would be a claim about the wrong content.
 */
test('the content digest ignores excluded paths and nothing else', () => {
  const base = digestTree(
    tree({ 'app/groups.hoon': 'a\n', 'commit.txt': 'aaa\n' })
  );
  const stampOnly = digestTree(
    tree({ 'app/groups.hoon': 'a\n', 'commit.txt': 'bbb\n' })
  );
  const sourceMoved = digestTree(
    tree({ 'app/groups.hoon': 'b\n', 'commit.txt': 'aaa\n' })
  );
  assert.equal(contentDigest(base), contentDigest(stampOnly));
  assert.notEqual(contentDigest(base), contentDigest(sourceMoved));
});

test('the content digest is not order-dependent', () => {
  const a = digestTree(tree({ 'a.hoon': '1\n', 'b.hoon': '2\n' }));
  const b = digestTree(tree({ 'b.hoon': '2\n', 'a.hoon': '1\n' }));
  assert.equal(contentDigest(a), contentDigest(b));
});

test('a rename is not mistaken for an unchanged desk', () => {
  // Same bytes, different path. A digest over contents alone would call these
  // identical, and a desk with a file in the wrong place does not compile.
  const a = digestTree(tree({ 'lib/x.hoon': '1\n' }));
  const b = digestTree(tree({ 'lib/y.hoon': '1\n' }));
  assert.notEqual(contentDigest(a), contentDigest(b));
});
