import type { PendingNudge } from "../pending-nudge.js";

type PendingNudgeWrite = (nudge: PendingNudge | null) => Promise<void>;

/**
 * Serialize pending-nudge persistence so %settings writes land in-order.
 */
export function createPendingNudgePersistenceQueue(write: PendingNudgeWrite) {
  let tail: Promise<void> = Promise.resolve();

  return {
    enqueue(nudge: PendingNudge | null): void {
      tail = tail.catch(() => undefined).then(() => write(nudge));
    },
    async flush(): Promise<void> {
      await tail;
    },
  };
}
