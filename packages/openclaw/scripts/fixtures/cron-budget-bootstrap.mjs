import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import {
  resolveCronStorePath,
  saveCronStore,
  loadCronStore,
} from 'openclaw/plugin-sdk/config-runtime';
const root = process.env.OPENCLAW_STATE_DIR;
await writeFile(process.env.OPENCLAW_CONFIG_PATH, '{}');
await writeFile(
  process.env.TLON_CRON_BUDGET_FILE,
  JSON.stringify({ version: 1, state: 'available', revision: 'stale' })
);
process.env.TLON_CRON_BUDGET_STARTUP = JSON.stringify({
  state: 'limited',
  staleRevision: 'stale',
});
const past = Date.now() - 60_000;
const job = (id, schedule, enabled = true) => ({
  id,
  name: id,
  description: 'Retain me',
  enabled,
  createdAtMs: past,
  updatedAtMs: past,
  schedule,
  sessionTarget: 'isolated',
  wakeMode: 'now',
  payload: { kind: 'agentTurn', message: 'fixture only; never execute' },
  state: { nextRunAtMs: past },
});
const storePath = resolveCronStorePath();
await saveCronStore(storePath, {
  version: 1,
  jobs: [
    job('repeat', { kind: 'every', everyMs: 60_000 }),
    job('manual', { kind: 'every', everyMs: 60_000 }, false),
    job('once', { kind: 'at', at: new Date(past).toISOString() }),
  ],
});
const run = () =>
  execFileSync(
    process.execPath,
    [new URL('./cron-budget-bootstrap.js', import.meta.url).pathname],
    { env: process.env, stdio: 'pipe' }
  );
run();
let store = await loadCronStore(storePath);
assert.deepEqual(
  store.jobs.map((j) => j.enabled),
  [false, false, true]
);
assert.equal(store.jobs[0].state.nextRunAtMs, undefined);
assert.equal(store.jobs[2].state.nextRunAtMs, past);
assert.equal(store.jobs[0].description, '[Paused: credit budget] Retain me');
const ledger = JSON.parse(
  await readFile(root + '/tlon-cron-budget-holds.json', 'utf8')
);
assert.deepEqual(Object.keys(ledger.holds), ['repeat']);
assert.equal(ledger.notified, false);
assert.equal(ledger.pendingTelemetryChanges.length, 1);
assert.equal(ledger.pendingTelemetryChanges[0].jobId, 'repeat');
assert.equal(ledger.pendingTelemetryChanges[0].action, 'paused');
assert.equal(ledger.pendingTelemetryChanges[0].source, 'startup');
assert.equal(ledger.pendingTelemetryChanges[0].episodeId, ledger.episodeId);
run();
assert.deepEqual(
  JSON.parse(await readFile(root + '/tlon-cron-budget-holds.json', 'utf8')),
  ledger
);
await writeFile(
  process.env.TLON_CRON_BUDGET_FILE,
  JSON.stringify({ version: 1, state: 'available', revision: 'fresh' })
);
run();
store = await loadCronStore(storePath);
assert.equal(
  store.jobs[0].enabled,
  false,
  'release must wait for live scheduling API'
);
console.log(
  'bootstrap smoke passed (due recurring task held, manual pause and one-shot preserved, restart idempotent)'
);
