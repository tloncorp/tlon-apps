/** Run by the hosted wrapper BEFORE launching the gateway, never concurrently
 * with it. The public SDK owns storage compatibility (JSON vs SQLite). */
import {
  loadCronStore,
  resolveCronStorePath,
  saveCronStore,
} from 'openclaw/plugin-sdk/config-runtime';

import {
  budgetHoldPaths,
  readBudgetHoldState,
  readBudgetSignal,
  reconcileBudgetHolds,
  writeBudgetHoldState,
} from './cron-budget-hold.js';

const paths = budgetHoldPaths();
if (paths) {
  const state = await readBudgetHoldState(paths.state);
  // OpenClaw 2026.9.x no longer takes a cron store path from config; the SDK
  // resolves the gateway's store location itself.
  const storePath = resolveCronStorePath();
  const store = await loadCronStore(storePath);
  await reconcileBudgetHolds({
    budget: await readBudgetSignal(paths.signal),
    state,
    pauseOnly: true,
    save: () => writeBudgetHoldState(paths.state, state),
    cron: {
      list: async () => store.jobs,
      update: async (id, patch) => {
        const job = store.jobs.find((candidate) => candidate.id === id);
        if (!job) throw new Error(`Cron job disappeared: ${id}`);
        Object.assign(job, patch, { updatedAtMs: Date.now() });
        if (patch.enabled === false) {
          job.state ??= {};
          delete job.state.nextRunAtMs;
        }
        await saveCronStore(storePath, store);
      },
    },
  });
}
