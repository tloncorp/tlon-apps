/**
 * Ordered background queue for owner-reply %settings writes.
 *
 * The monitor's owner-message handler calls `enqueue` synchronously without
 * awaiting. Inside each batch task, the two `put-entry` pokes
 * (`lastOwnerMessageAt` + `lastOwnerMessageDate`) must settle before the
 * optional `del-entry` (`lastNudgeStage`) is issued on the wire. That
 * ordering is what keeps a mid-reply crash from landing the persistent
 * state in "stage cleared, owner still idle", which could otherwise let a
 * duplicate nudge fire on the next tick after restart.
 */

import type { UrbitSSEClient } from "../urbit/sse-client.js";
import { describeError } from "../urbit/errors.js";

export type OwnerReplyPersistenceBatch = {
  at: number;
  date: string;
  clearStage: boolean;
};

export type OwnerReplyPersistenceQueue = {
  enqueue(batch: OwnerReplyPersistenceBatch): void;
  /**
   * Append a standalone `lastNudgeStage` del-entry to the tail.
   *
   * Used by the nudge runner to clear a just-poked stage when it detects
   * that the owner replied during the `await pokeLastNudgeStage` window —
   * a window where the owner-reply handler may have observed
   * `shadowStage === 0` (because the runner hadn't yet advanced it) and
   * therefore skipped enqueuing the del-entry itself. Routing through
   * this queue preserves the "activity settles before stage clear"
   * ordering invariant against any in-flight reply batch.
   */
  enqueueStageClear(): void;
  flush(): Promise<void>;
};

type Pokeable = Pick<UrbitSSEClient, "poke">;

export function createOwnerReplyPersistenceQueue(
  api: Pokeable,
  log: { error?: (msg: string) => void } = {},
): OwnerReplyPersistenceQueue {
  let tail: Promise<void> = Promise.resolve();

  return {
    enqueue(batch: OwnerReplyPersistenceBatch): void {
      tail = tail
        .catch(() => undefined)
        .then(async () => {
          try {
            await Promise.all([
              api.poke({
                app: "settings",
                mark: "settings-event",
                json: {
                  "put-entry": {
                    desk: "moltbot",
                    "bucket-key": "tlon",
                    "entry-key": "lastOwnerMessageAt",
                    value: batch.at,
                  },
                },
              }),
              api.poke({
                app: "settings",
                mark: "settings-event",
                json: {
                  "put-entry": {
                    desk: "moltbot",
                    "bucket-key": "tlon",
                    "entry-key": "lastOwnerMessageDate",
                    value: batch.date,
                  },
                },
              }),
            ]);

            if (batch.clearStage) {
              await api.poke({
                app: "settings",
                mark: "settings-event",
                json: {
                  "del-entry": {
                    desk: "moltbot",
                    "bucket-key": "tlon",
                    "entry-key": "lastNudgeStage",
                  },
                },
              });
            }
          } catch (err) {
            log.error?.(`[tlon] owner-reply persistence failed: ${describeError(err)}`);
          }
        });
    },
    enqueueStageClear(): void {
      tail = tail
        .catch(() => undefined)
        .then(async () => {
          try {
            await api.poke({
              app: "settings",
              mark: "settings-event",
              json: {
                "del-entry": {
                  desk: "moltbot",
                  "bucket-key": "tlon",
                  "entry-key": "lastNudgeStage",
                },
              },
            });
          } catch (err) {
            log.error?.(`[tlon] owner-reply stage-clear failed: ${describeError(err)}`);
          }
        });
    },
    async flush(): Promise<void> {
      await tail;
    },
  };
}
