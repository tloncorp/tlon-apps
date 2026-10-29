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
  stripSystemOwnedHoldLabels,
  writeBudgetHoldState,
} from './cron-budget-hold.js';

const paths = budgetHoldPaths();
if (paths) {
  const state = await readBudgetHoldState(paths.state);
  // OpenClaw 2026.9.x no longer takes a cron store path from config; the SDK
  // resolves the gateway's store location itself.
  const storePath = resolveCronStorePath();
  const store = await loadCronStore(storePath);
  // Core forbids live edits to system-owned jobs; only this pre-gateway write
  // can remove a label an older plugin left on them.
  const relabelled = new Map(
    stripSystemOwnedHoldLabels(store.jobs).map((job) => [job.id, job])
  );
  if (relabelled.size) {
    store.jobs = store.jobs.map((job) =>
      relabelled.has(job.id)
        ? { ...relabelled.get(job.id)!, updatedAtMs: Date.now() }
        : job
    );
    await saveCronStore(storePath, store);
  }
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
