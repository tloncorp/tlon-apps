import { describe, expect, it, vi } from "vitest";
import type { PendingNudge } from "../pending-nudge.js";
import { createPendingNudgePersistenceQueue } from "./pending-nudge-persistence.js";

function makeNudge(overrides: Partial<PendingNudge> = {}): PendingNudge {
  return {
    sentAt: 1,
    stage: 1,
    ownerShip: "~zod",
    accountId: "default",
    content: "Quick ideas for your week",
    ...overrides,
  };
}

describe("pending-nudge-persistence", () => {
  it("serializes writes in enqueue order", async () => {
    const calls: string[] = [];
    let releaseFirst: (() => void) | null = null;

    const queue = createPendingNudgePersistenceQueue(async (nudge) => {
      calls.push(nudge ? `start:${nudge.stage}` : "start:clear");
      if (nudge?.stage === 1) {
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
      }
      calls.push(nudge ? `end:${nudge.stage}` : "end:clear");
    });

    queue.enqueue(makeNudge({ stage: 1 }));
    queue.enqueue(null);

    await vi.waitFor(() => {
      expect(calls).toEqual(["start:1"]);
    });

    releaseFirst?.();
    await queue.flush();

    expect(calls).toEqual(["start:1", "end:1", "start:clear", "end:clear"]);
  });

  it("preserves the content field through the persistence path", async () => {
    const seen: PendingNudge[] = [];
    const queue = createPendingNudgePersistenceQueue(async (nudge) => {
      if (nudge) {
        // Round-trip through JSON to match what the real persist callback does
        // (it calls JSON.stringify(nudge) before poking %settings).
        const roundTrip = JSON.parse(JSON.stringify(nudge)) as PendingNudge;
        seen.push(roundTrip);
      }
    });

    const nudge = makeNudge({
      stage: 2,
      content: "A few things I can do for you:\n• Create a group",
    });
    queue.enqueue(nudge);
    await queue.flush();

    expect(seen).toHaveLength(1);
    expect(seen[0].content).toBe(nudge.content);
    expect(seen[0]).toMatchObject({
      sentAt: nudge.sentAt,
      stage: nudge.stage,
      ownerShip: nudge.ownerShip,
      accountId: nudge.accountId,
      content: nudge.content,
    });
    // Legacy LLM fields must not surface in persisted records.
    expect(seen[0]).not.toHaveProperty("sessionKey");
    expect(seen[0]).not.toHaveProperty("provider");
    expect(seen[0]).not.toHaveProperty("model");
  });

  it("tolerates records without content (pre-upgrade shape)", async () => {
    const seen: (PendingNudge | null)[] = [];
    const queue = createPendingNudgePersistenceQueue(async (nudge) => {
      seen.push(nudge);
    });

    const nudge: PendingNudge = {
      sentAt: 1,
      stage: 1,
      ownerShip: "~zod",
      accountId: "default",
      // no content
    };
    queue.enqueue(nudge);
    await queue.flush();

    expect(seen[0]?.content).toBeUndefined();
  });
});
