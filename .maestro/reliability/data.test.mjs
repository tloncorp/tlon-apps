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

test('every reliability journey gets a short, searchable, retry-safe group', () => {
  for (const journey of journeys) {
    for (const runTag of ['r123456789abc', 'r123456789abcdefghijklmnop']) {
      const first = fixture(journey, runTag, 1_800_000_000_000);
      const retry = fixture(journey, runTag, 1_800_000_000_001);

      assert.ok(first.group.includes(first.groupQuery), journey);
      assert.ok(first.group.length + ' renamed'.length <= 30, journey);
      assert.notEqual(first.group, retry.group, journey);
      assert.notEqual(first.groupQuery, retry.groupQuery, journey);
    }
  }
});
