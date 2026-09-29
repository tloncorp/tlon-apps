import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const directory = dirname(fileURLToPath(import.meta.url));
const source = await readFile(join(directory, 'data.js'), 'utf8');
const journeys = await Promise.all(
  (await readdir(directory))
    .filter((name) => name.endsWith('.yaml'))
    .map(async (name) => {
      const yaml = await readFile(join(directory, name), 'utf8');
      return /^  JOURNEY: (.+)$/m.exec(yaml)?.[1];
    })
).then((values) => [...new Set(values.filter(Boolean))]);

function fixture(journey, runTag, timestamp) {
  const context = {
    Date: { now: () => timestamp },
    JOURNEY: journey,
    MAESTRO_RUN_TAG: runTag,
    MAESTRO_SESSION: 'warm',
    MAESTRO_TEST_SHIP: '~zod',
    output: {},
  };
  vm.runInNewContext(source, context);
  return context.output.reliability;
}

test('every reliability journey gets short, searchable, retry-safe fixtures', () => {
  for (const journey of journeys) {
    for (const runTag of ['r123456789abc', 'r123456789abcdefghijklmnop']) {
      const first = fixture(journey, runTag, 1_800_000_000_000);
      const retry = fixture(journey, runTag, 1_800_000_000_001);

      assert.ok(first.group.includes(first.groupQuery), journey);
      assert.ok(first.group.length + ' renamed'.length <= 30, journey);
      assert.ok(first.channel.includes(first.groupQuery), journey);
      assert.ok(first.renamedChannel.includes(first.groupQuery), journey);
      assert.ok(first.channel.length <= 30, journey);
      assert.ok(first.renamedChannel.length <= 30, journey);
      assert.ok(first.contactNickname.length <= 30, journey);
      assert.ok(
        first.contactNickname.endsWith(runTag.slice(-8) + ' contact'),
        journey
      );
      assert.ok(first.profileStatus.length <= 50, journey);
      assert.ok(
        first.profileStatus.endsWith(runTag.slice(-8) + ' status'),
        journey
      );
      assert.ok(first.profileBio.length <= 300, journey);
      assert.ok(
        first.profileBio.endsWith(runTag.slice(-8) + ' biography'),
        journey
      );
      assert.notEqual(first.group, retry.group, journey);
      assert.notEqual(first.groupQuery, retry.groupQuery, journey);
      assert.notEqual(first.channel, retry.channel, journey);
      assert.notEqual(first.renamedChannel, retry.renamedChannel, journey);
    }
  }
});

test('parallel journeys cannot share fixture names or search queries', () => {
  const fixtures = journeys.map((journey) =>
    fixture(journey, 'r123456789abc', 1_800_000_000_000)
  );
  assert.equal(
    new Set(fixtures.map(({ group }) => group)).size,
    journeys.length
  );
  assert.equal(
    new Set(fixtures.map(({ groupQuery }) => groupQuery)).size,
    journeys.length
  );
  assert.equal(
    new Set(fixtures.map(({ channel }) => channel)).size,
    journeys.length
  );
  assert.equal(
    new Set(fixtures.map(({ renamedChannel }) => renamedChannel)).size,
    journeys.length
  );
});
