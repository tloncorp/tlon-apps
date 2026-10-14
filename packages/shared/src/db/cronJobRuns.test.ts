import { expect, test } from 'vitest';

import * as db from '../db';
import { lensRunCronJobId } from '../logic';
import { setupDatabaseTestSuite } from '../test/helpers';

setupDatabaseTestSuite();

const bot = '~sampel-palnet-bot';

function run(
  lensId: string,
  receivedAt: number,
  lens: Record<string, unknown>,
  botShip = bot
): db.ContextLensRun {
  return {
    botShip,
    lensId,
    complete: true,
    receivedAt,
    payload: { schemaVersion: 1, lens: { lensId, ...lens } },
  };
}

test('getContextLensRunsForCronJob finds one task, stamped or legacy', async () => {
  await db.insertContextLensRuns([
    run('stamped', 3, { runKind: 'cron', cron: { jobId: 'job-1' } }),
    run('test', 4, { runKind: 'cron', cron: { jobId: 'job-1', test: true } }),
    run('legacy', 2, {
      runKind: 'cron',
      triggerDetails: { preview: 'cron job job-1' },
    }),
    run('other-job', 5, { runKind: 'cron', cron: { jobId: 'job-2' } }),
    // stamped for another job; its preview must not pull it in
    run('stamped-elsewhere', 6, {
      runKind: 'cron',
      cron: { jobId: 'job-2' },
      triggerDetails: { preview: 'cron job job-1' },
    }),
    run('conversation', 7, {
      runKind: 'conversation',
      triggerDetails: { preview: 'cron job job-1' },
    }),
    run(
      'other-bot',
      8,
      { runKind: 'cron', cron: { jobId: 'job-1' } },
      '~other-bot'
    ),
  ]);

  const runs = await db.getContextLensRunsForCronJob({
    botShip: bot,
    jobId: 'job-1',
  });

  expect(runs.map((row) => row.lensId)).toEqual(['test', 'stamped', 'legacy']);
  // The query and the in-memory matcher agree.
  for (const row of runs) {
    expect(lensRunCronJobId(row.payload)).toBe('job-1');
  }
});

test('getContextLensRunsForCronJob keeps to the newest runs it is asked for', async () => {
  await db.insertContextLensRuns([
    run('oldest', 1, { runKind: 'cron', cron: { jobId: 'job-1' } }),
    run('middle', 2, { runKind: 'cron', cron: { jobId: 'job-1' } }),
    run('newest', 3, { runKind: 'cron', cron: { jobId: 'job-1' } }),
  ]);

  const runs = await db.getContextLensRunsForCronJob({
    botShip: bot,
    jobId: 'job-1',
    limit: 2,
  });

  expect(runs.map((row) => row.lensId)).toEqual(['newest', 'middle']);
});

test('insertContextLensRuns never undoes a finished run', async () => {
  const running = {
    ...run('run', 1, { runKind: 'cron', status: 'running' }),
    complete: false,
  };
  const finished = run('run', 1, { runKind: 'cron', status: 'completed' });

  // The feed's final record lands first, then an older snapshot of the run.
  await db.insertContextLensRuns([finished]);
  await db.insertContextLensRuns([running]);
  expect(await db.getContextLensRun({ botShip: bot, lensId: 'run' })).toEqual(
    finished
  );

  // A later finished record still replaces it.
  const revised = run('run', 1, { runKind: 'cron', status: 'error' });
  await db.insertContextLensRuns([revised]);
  expect(await db.getContextLensRun({ botShip: bot, lensId: 'run' })).toEqual(
    revised
  );
});
