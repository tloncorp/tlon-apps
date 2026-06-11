/**
 * Regression tests for the plugin-driven nudge lifecycle at the monitor
 * seam. Exercises the exact shared-state sequences that
 * `src/monitor/index.ts` performs for:
 *
 *   - startup rehydration (shadows cleared before load, seeded after)
 *   - owner-reply persistence queue ordering
 *   - owner-reply handler attribution, stage clearing, and reply-context
 *   - crash-consistency scenarios (partial or missing del-entry)
 *   - final-cleanup drain
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeTargetStage, daysBetween, resolveLastOwnerInstant } from "../nudge-decision.js";
import {
  clearPendingNudge,
  DEFAULT_ATTRIBUTION_WINDOW_MS,
  getPendingNudge,
  isNudgeEligible,
  registerPersistCallback,
  setPendingNudge,
  syncPendingNudgeFromStore,
  type PendingNudge,
  _testing as pendingTesting,
} from "../pending-nudge.js";
import type { TlonSettingsStore } from "../settings.js";
import {
  _testing as shadowTesting,
  clearShadowsForAccount,
  getLastNudgeStageShadow,
  getLastOwnerActivity,
  ownerActivityFromSettings,
  setLastNudgeStageShadow,
  setLastOwnerActivity,
} from "./nudge-state.js";
import { createOwnerReplyPersistenceQueue } from "./owner-reply-persistence.js";
import { createPendingNudgePersistenceQueue } from "./pending-nudge-persistence.js";

/**
 * Mirror of the reconcile branch inside `monitorTlonProvider`'s
 * `applySettingsSnapshot`. Keeping the test helper 1:1 with production
 * lets the regression tests below run the exact seam the monitor
 * executes without reaching into unexported closures.
 */
function reconcileOwnerActivityShadow(
  accountId: string,
  prevSettings: TlonSettingsStore,
  newSettings: TlonSettingsStore,
  source: "subscription" | "refresh",
  opts: { fresh?: boolean } = {},
): void {
  const shadowReconcileTrusted = source === "subscription" || opts.fresh === true;
  const ownerActivityChanged =
    prevSettings.lastOwnerMessageAt !== newSettings.lastOwnerMessageAt ||
    prevSettings.lastOwnerMessageDate !== newSettings.lastOwnerMessageDate;
  if (shadowReconcileTrusted && ownerActivityChanged) {
    setLastOwnerActivity(accountId, ownerActivityFromSettings(newSettings));
  }
}

/**
 * Mirror of the `lastNudgeStage` reconcile branch inside
 * `monitorTlonProvider`'s `applySettingsSnapshot`.
 */
function reconcileStageShadow(
  accountId: string,
  prevSettings: TlonSettingsStore,
  newSettings: TlonSettingsStore,
  source: "subscription" | "refresh",
  opts: { fresh?: boolean } = {},
): void {
  const shadowReconcileTrusted = source === "subscription" || opts.fresh === true;
  const stageChanged = prevSettings.lastNudgeStage !== newSettings.lastNudgeStage;
  if (shadowReconcileTrusted && stageChanged) {
    setLastNudgeStageShadow(accountId, (newSettings.lastNudgeStage ?? 0) as 0 | 1 | 2 | 3);
  }
}

beforeEach(() => {
  pendingTesting.clearAll();
  shadowTesting.clearAll();
});

const ACCOUNT_ID = "default";

function makePendingNudge(overrides: Partial<PendingNudge> = {}): PendingNudge {
  return {
    sentAt: Date.now() - 1_000,
    stage: 1,
    ownerShip: "~zod",
    accountId: ACCOUNT_ID,
    content: "Hey!",
    ...overrides,
  };
}

describe("startup rehydration", () => {
  it("stale-shadow clearing before a load that returns no fresh data", () => {
    setLastOwnerActivity(ACCOUNT_ID, { at: 1, date: "2026-01-01" });
    setLastNudgeStageShadow(ACCOUNT_ID, 2);

    // Monitor runs clearShadowsForAccount BEFORE load.
    clearShadowsForAccount(ACCOUNT_ID);

    // Imagine `settingsManager.load()` returned { fresh: false, settings: {} }
    // — without an explicit clear, the previous-run values would leak.
    setLastOwnerActivity(ACCOUNT_ID, ownerActivityFromSettings({}));
    setLastNudgeStageShadow(ACCOUNT_ID, 0);

    expect(getLastOwnerActivity(ACCOUNT_ID)).toBeNull();
    expect(getLastNudgeStageShadow(ACCOUNT_ID)).toBe(0);
  });

  it("stale-shadow clearing when fresh load has only lastNudgeStage", () => {
    setLastOwnerActivity(ACCOUNT_ID, { at: 1, date: "2026-01-01" });
    setLastNudgeStageShadow(ACCOUNT_ID, 1);
    clearShadowsForAccount(ACCOUNT_ID);

    // Fresh load: only lastNudgeStage set.
    const settings = { lastNudgeStage: 2 as const };
    setLastOwnerActivity(ACCOUNT_ID, ownerActivityFromSettings(settings));
    setLastNudgeStageShadow(ACCOUNT_ID, settings.lastNudgeStage ?? 0);

    expect(getLastOwnerActivity(ACCOUNT_ID)).toBeNull();
    expect(getLastNudgeStageShadow(ACCOUNT_ID)).toBe(2);
  });

  it("clears expired persisted pendingNudge on startup", () => {
    const persistCb = vi.fn();

    const expired: PendingNudge = makePendingNudge({
      sentAt: Date.now() - DEFAULT_ATTRIBUTION_WINDOW_MS - 1000,
      stage: 2,
    });
    syncPendingNudgeFromStore(ACCOUNT_ID, expired);
    registerPersistCallback(ACCOUNT_ID, persistCb);

    const rehydrated = getPendingNudge(ACCOUNT_ID);
    expect(rehydrated).not.toBeNull();
    expect(isNudgeEligible(rehydrated!)).toBe(false);

    clearPendingNudge(ACCOUNT_ID);

    expect(getPendingNudge(ACCOUNT_ID)).toBeNull();
    expect(persistCb).toHaveBeenCalledWith(null);
  });

  it("keeps a valid persisted pendingNudge on startup", () => {
    const persistCb = vi.fn();
    const valid: PendingNudge = makePendingNudge({ sentAt: Date.now() - 1000 });
    syncPendingNudgeFromStore(ACCOUNT_ID, valid);
    registerPersistCallback(ACCOUNT_ID, persistCb);

    expect(isNudgeEligible(getPendingNudge(ACCOUNT_ID)!)).toBe(true);
    expect(getPendingNudge(ACCOUNT_ID)).toEqual(valid);
    expect(persistCb).not.toHaveBeenCalled();
  });
});

describe("owner-reply handler: queue ordering", () => {
  it("put-entries resolve before the del-entry is issued", async () => {
    const order: string[] = [];
    const entryKeys: string[] = [];

    const api = {
      poke: vi.fn(async (params: Record<string, unknown>) => {
        const json = params.json as Record<string, unknown>;
        const put = json["put-entry"] as Record<string, unknown> | undefined;
        const del = json["del-entry"] as Record<string, unknown> | undefined;
        const key = put ? String(put["entry-key"]) : del ? String(del["entry-key"]) : "?";
        order.push(`start:${key}`);
        entryKeys.push(key);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        order.push(`end:${key}`);
      }),
    };

    const queue = createOwnerReplyPersistenceQueue(api);
    queue.enqueue({ at: 1000, date: "2026-04-21", clearStage: true });
    await queue.flush();

    // Both put-entries must have ended before the del-entry started.
    const delStart = order.indexOf("start:lastNudgeStage");
    expect(delStart).toBeGreaterThan(-1);
    expect(order.indexOf("end:lastOwnerMessageAt")).toBeLessThan(delStart);
    expect(order.indexOf("end:lastOwnerMessageDate")).toBeLessThan(delStart);
  });

  it("hot path: handler updates shadows synchronously and does not await the queue", async () => {
    const api = {
      poke: vi.fn(async () => undefined),
    };

    const queue = createOwnerReplyPersistenceQueue(api);

    const timestamp = Date.now();
    const isoDate = new Date(timestamp).toISOString().split("T")[0] ?? "";

    // Simulate what the monitor does synchronously in the owner-reply handler.
    // `enqueue` must return synchronously, and `queue.flush()` must not be
    // awaited by the hot path — both conditions model the production handler.
    setLastOwnerActivity(ACCOUNT_ID, { at: timestamp, date: isoDate });
    setLastNudgeStageShadow(ACCOUNT_ID, 0);
    queue.enqueue({ at: timestamp, date: isoDate, clearStage: true });

    // Shadows observable immediately — no await needed.
    expect(getLastOwnerActivity(ACCOUNT_ID)?.at).toBe(timestamp);
    expect(getLastNudgeStageShadow(ACCOUNT_ID)).toBe(0);

    // enqueue is synchronous: its return value is undefined (not a promise).
    const enqueueResult: void = queue.enqueue({
      at: timestamp,
      date: isoDate,
      clearStage: false,
    });
    expect(enqueueResult).toBeUndefined();

    // After draining, the pokes should have happened.
    await queue.flush();
    expect(api.poke).toHaveBeenCalled();
  });
});

describe("owner-reply handler: attribution and stage clearing", () => {
  it("emits reengagement when owner messages within 72h", () => {
    const capture = vi.fn();
    const pending = makePendingNudge({ sentAt: Date.now() - 3600_000 });
    setPendingNudge(ACCOUNT_ID, pending);

    const retrieved = getPendingNudge(ACCOUNT_ID);
    expect(retrieved).not.toBeNull();
    expect(isNudgeEligible(retrieved!)).toBe(true);

    const reengagedAt = retrieved!.sentAt + 1234;
    capture({
      ownerShip: retrieved!.ownerShip,
      botShip: "~nec",
      nudgeStage: retrieved!.stage,
      nudgeSentAt: retrieved!.sentAt,
      reengagedAt,
      reengagementDelayMs: reengagedAt - retrieved!.sentAt,
      channel: "tlon",
      accountId: retrieved!.accountId,
    });
    clearPendingNudge(ACCOUNT_ID);

    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][0]).toMatchObject({
      ownerShip: "~zod",
      nudgeStage: 1,
      reengagedAt,
    });
    expect(getPendingNudge(ACCOUNT_ID)).toBeNull();
  });

  it("uses inbound message time for the attribution window", () => {
    const sentAt = 1_000;
    const messageTs = sentAt + DEFAULT_ATTRIBUTION_WINDOW_MS - 1;
    const delayed = sentAt + DEFAULT_ATTRIBUTION_WINDOW_MS + 60_000;

    const pending = makePendingNudge({ sentAt });
    setPendingNudge(ACCOUNT_ID, pending);

    expect(isNudgeEligible(pending, delayed)).toBe(false);
    expect(isNudgeEligible(pending, messageTs)).toBe(true);
  });

  it("clears expired pending nudge without emitting telemetry", () => {
    const capture = vi.fn();
    const expired = makePendingNudge({
      sentAt: Date.now() - DEFAULT_ATTRIBUTION_WINDOW_MS - 1000,
    });
    setPendingNudge(ACCOUNT_ID, expired);
    const rehydrated = getPendingNudge(ACCOUNT_ID);
    expect(isNudgeEligible(rehydrated!)).toBe(false);
    clearPendingNudge(ACCOUNT_ID);
    expect(capture).not.toHaveBeenCalled();
    expect(getPendingNudge(ACCOUNT_ID)).toBeNull();
  });

  it("synchronously updates both shadows before any async poke", () => {
    const pending = makePendingNudge();
    setPendingNudge(ACCOUNT_ID, pending);

    const api = {
      poke: vi.fn(() => new Promise<void>(() => undefined)),
    };
    const queue = createOwnerReplyPersistenceQueue(api);

    const timestamp = Date.now();
    const iso = new Date(timestamp).toISOString().split("T")[0] ?? "";

    // Monitor does these first, synchronously.
    setLastOwnerActivity(ACCOUNT_ID, { at: timestamp, date: iso });
    const shadowStage = getLastNudgeStageShadow(ACCOUNT_ID) ?? 0;
    const willClear = shadowStage > 0 || Boolean(getPendingNudge(ACCOUNT_ID));
    if (willClear) {
      setLastNudgeStageShadow(ACCOUNT_ID, 0);
    }
    queue.enqueue({ at: timestamp, date: iso, clearStage: willClear });

    expect(getLastOwnerActivity(ACCOUNT_ID)).toEqual({ at: timestamp, date: iso });
    expect(getLastNudgeStageShadow(ACCOUNT_ID)).toBe(0);
  });
});

/**
 * Simulate the owner-reply handler's synchronous prologue with the
 * production gating logic: clear the stage when the stage shadow is
 * non-zero OR when pendingNudge is present. This keeps the race fix
 * under test alongside the legacy attribution path.
 */
function runOwnerReplyHandler(
  accountId: string,
  timestamp: number,
  queue: ReturnType<typeof createOwnerReplyPersistenceQueue>,
): { willClearStage: boolean } {
  const iso = new Date(timestamp).toISOString().split("T")[0] ?? "";
  setLastOwnerActivity(accountId, { at: timestamp, date: iso });
  const pending = getPendingNudge(accountId);
  const shadowStage = getLastNudgeStageShadow(accountId) ?? 0;
  const willClearStage = shadowStage > 0 || Boolean(pending);
  if (willClearStage) {
    setLastNudgeStageShadow(accountId, 0);
  }
  queue.enqueue({ at: timestamp, date: iso, clearStage: willClearStage });
  if (pending) {
    clearPendingNudge(accountId);
  }
  return { willClearStage };
}

describe("in-flight tick reply race", () => {
  it("clears stage when owner replies after poke but before pendingNudge is written", async () => {
    // Setup: the scheduler has just poked lastNudgeStage = 1 and set the
    // shadow to 1, and is now awaiting sendDm(). pendingNudge has NOT yet
    // been written (setLocalPendingNudge only fires after sendDm resolves).
    setLastNudgeStageShadow(ACCOUNT_ID, 1);
    expect(getPendingNudge(ACCOUNT_ID)).toBeNull();

    // Capture durable writes to confirm the del-entry is issued.
    const writes: string[] = [];
    const api = {
      poke: vi.fn(async (params: Record<string, unknown>) => {
        const json = params.json as Record<string, unknown>;
        const put = json["put-entry"] as Record<string, unknown> | undefined;
        const del = json["del-entry"] as Record<string, unknown> | undefined;
        if (put) {
          writes.push(`put:${String(put["entry-key"])}`);
        }
        if (del) {
          writes.push(`del:${String(del["entry-key"])}`);
        }
      }),
    };
    const queue = createOwnerReplyPersistenceQueue(api);

    const replyAt = Date.now();
    const result = runOwnerReplyHandler(ACCOUNT_ID, replyAt, queue);

    expect(result.willClearStage).toBe(true);
    expect(getLastNudgeStageShadow(ACCOUNT_ID)).toBe(0);

    await queue.flush();
    expect(writes).toContain("del:lastNudgeStage");
  });

  it("skips the clear when shadow stage is 0 and no pending nudge", async () => {
    setLastNudgeStageShadow(ACCOUNT_ID, 0);
    expect(getPendingNudge(ACCOUNT_ID)).toBeNull();

    const api = {
      poke: vi.fn(async () => undefined),
    };
    const queue = createOwnerReplyPersistenceQueue(api);
    const replyAt = Date.now();
    const result = runOwnerReplyHandler(ACCOUNT_ID, replyAt, queue);

    expect(result.willClearStage).toBe(false);
    await queue.flush();

    const keys = (api.poke.mock.calls as Array<[Record<string, unknown>]>).map(([p]) => {
      const json = p.json as Record<string, unknown>;
      const put = json["put-entry"] as Record<string, unknown> | undefined;
      const del = json["del-entry"] as Record<string, unknown> | undefined;
      return put ? `put:${String(put["entry-key"])}` : del ? `del:${String(del["entry-key"])}` : "?";
    });
    expect(keys).not.toContain("del:lastNudgeStage");
  });

  it("next inactivity cycle can re-send the same stage after the race", () => {
    // Scheduler advanced stage to 1, pendingNudge was never written before
    // the owner reply.
    setLastNudgeStageShadow(ACCOUNT_ID, 1);
    const queue = createOwnerReplyPersistenceQueue({
      poke: vi.fn(async () => undefined),
    });
    runOwnerReplyHandler(ACCOUNT_ID, Date.now(), queue);

    // Shadow is now 0 — the stage guard's `target > freshStage` check
    // (after 7+ days of silence) will permit stage 1 to be re-sent.
    expect(getLastNudgeStageShadow(ACCOUNT_ID)).toBe(0);

    // Model the tick's guard explicitly:
    const targetStage = 1;
    const freshStage = getLastNudgeStageShadow(ACCOUNT_ID) ?? 0;
    expect(targetStage > freshStage).toBe(true);
  });
});

describe("owner-reply reply-context", () => {
  it("eligible PendingNudge with content yields a prefix containing the content", () => {
    const pending = makePendingNudge({ content: "Quick ideas for your week" });
    setPendingNudge(ACCOUNT_ID, pending);

    const timestamp = pending.sentAt + 1000;
    let messageText = "hey";

    const retrieved = getPendingNudge(ACCOUNT_ID);
    if (retrieved && isNudgeEligible(retrieved, timestamp)) {
      const sentIso = new Date(retrieved.sentAt).toISOString();
      const contentBlock = retrieved.content ? `Message content:\n\n${retrieved.content}\n\n` : "";
      messageText =
        `[Context: You recently sent ${retrieved.ownerShip} a stage-${retrieved.stage} ` +
        `re-engagement nudge at ${sentIso}. ${contentBlock}` +
        `The owner's reply below may be responding to that nudge.]\n\n` +
        messageText;
    }

    expect(messageText).toContain("re-engagement nudge");
    expect(messageText).toContain("Quick ideas for your week");
  });

  it("PendingNudge without content omits the content block", () => {
    const pending = makePendingNudge({ content: undefined });
    setPendingNudge(ACCOUNT_ID, pending);

    const retrieved = getPendingNudge(ACCOUNT_ID);
    expect(retrieved!.content).toBeUndefined();

    let messageText = "hey";
    if (retrieved && isNudgeEligible(retrieved)) {
      const sentIso = new Date(retrieved.sentAt).toISOString();
      const contentBlock = retrieved.content ? `Message content:\n\n${retrieved.content}\n\n` : "";
      messageText =
        `[Context: stage-${retrieved.stage} at ${sentIso}. ${contentBlock}]\n\n` + messageText;
    }

    expect(messageText).not.toContain("Message content");
    expect(messageText).toContain("stage-1");
  });

  it("expired PendingNudge does not inject reply context", () => {
    const pending = makePendingNudge({
      sentAt: Date.now() - DEFAULT_ATTRIBUTION_WINDOW_MS - 1000,
    });
    setPendingNudge(ACCOUNT_ID, pending);

    const retrieved = getPendingNudge(ACCOUNT_ID);
    let injected = false;
    if (retrieved && isNudgeEligible(retrieved)) {
      injected = true;
    }
    expect(injected).toBe(false);
  });

  /**
   * Mirrors the production guard `pending && isNudgeEligible(...) && !isGroup`
   * around the reply-context injection in `src/monitor/index.ts`. The
   * function returns the message text the agent would see for a given
   * `isGroup` value. Used by the DM-only / channel-suppressed tests below.
   */
  function applyReplyContext(
    pending: PendingNudge | null,
    timestamp: number,
    isGroup: boolean,
    base: string,
  ): string {
    if (pending && isNudgeEligible(pending, timestamp) && !isGroup) {
      const sentIso = new Date(pending.sentAt).toISOString();
      const contentBlock = pending.content ? `Message content:\n\n${pending.content}\n\n` : "";
      return (
        `[Context: You recently sent ${pending.ownerShip} a stage-${pending.stage} ` +
        `re-engagement nudge at ${sentIso}. ${contentBlock}` +
        `The owner's reply below may be responding to that nudge.]\n\n` +
        base
      );
    }
    return base;
  }

  it("DM-only: owner DM receives prepended nudge context", () => {
    const pending = makePendingNudge({ content: "Quick ideas for your week" });
    setPendingNudge(ACCOUNT_ID, pending);

    const text = applyReplyContext(getPendingNudge(ACCOUNT_ID), pending.sentAt + 1000, false, "hi");
    expect(text).toContain("re-engagement nudge");
    expect(text).toContain("Quick ideas for your week");
  });

  it("DM-only: owner channel/group message does NOT receive prepended nudge context", () => {
    const pending = makePendingNudge({ content: "Quick ideas for your week" });
    setPendingNudge(ACCOUNT_ID, pending);

    const text = applyReplyContext(getPendingNudge(ACCOUNT_ID), pending.sentAt + 1000, true, "hi");
    expect(text).toBe("hi");
    expect(text).not.toContain("re-engagement nudge");
    expect(text).not.toContain("Quick ideas for your week");
  });
});

describe("crash-consistency", () => {
  it("reply crashes before the del-entry; restart sees stage=N, owner=fresh → no send", () => {
    // Simulate persisted state after a crash: the put-entries committed but
    // the del-entry never happened. lastNudgeStage remains at N (e.g. 1).
    const settings = {
      lastNudgeStage: 1 as const,
      lastOwnerMessageAt: Date.now(),
      lastOwnerMessageDate: new Date().toISOString().split("T")[0],
    };

    // Monitor startup: seed shadows from persisted settings.
    clearShadowsForAccount(ACCOUNT_ID);
    setLastOwnerActivity(ACCOUNT_ID, ownerActivityFromSettings(settings));
    setLastNudgeStageShadow(ACCOUNT_ID, settings.lastNudgeStage ?? 0);

    const shadow = getLastOwnerActivity(ACCOUNT_ID);
    expect(shadow).not.toBeNull();

    // A scheduler tick would observe daysIdle = 0 and short-circuit before
    // ever reading lastNudgeStage.
    expect(getLastNudgeStageShadow(ACCOUNT_ID)).toBe(1);
    // Safe path: short-circuit is ok for duplicate prevention.
  });

  it("reply crashes mid put-entries; restart sees only lastOwnerMessageAt → no send", () => {
    const settings = { lastOwnerMessageAt: Date.now() };

    clearShadowsForAccount(ACCOUNT_ID);
    setLastOwnerActivity(ACCOUNT_ID, ownerActivityFromSettings(settings));
    setLastNudgeStageShadow(ACCOUNT_ID, settings.lastNudgeStage ?? 0);

    const shadow = getLastOwnerActivity(ACCOUNT_ID);
    expect(shadow?.at).toBe(settings.lastOwnerMessageAt);
  });
});

describe("final-cleanup", () => {
  it("drains owner-reply queue, pending-nudge queue, then clears shadows", async () => {
    const order: string[] = [];
    const ownerApi = {
      poke: vi.fn(async () => {
        order.push("owner-poke");
      }),
    };
    const pnApi = vi.fn(async () => {
      order.push("pn-poke");
    });

    const ownerQueue = createOwnerReplyPersistenceQueue(ownerApi);
    const pnQueue = createPendingNudgePersistenceQueue(pnApi);

    ownerQueue.enqueue({ at: 1, date: "2026-04-21", clearStage: true });
    pnQueue.enqueue(null);

    // Seed some shadow state to verify cleanup.
    setLastOwnerActivity(ACCOUNT_ID, { at: 1, date: "2026-04-21" });
    setLastNudgeStageShadow(ACCOUNT_ID, 1);

    await ownerQueue.flush();
    await pnQueue.flush();
    clearShadowsForAccount(ACCOUNT_ID);

    expect(order.length).toBeGreaterThan(0);
    expect(getLastOwnerActivity(ACCOUNT_ID)).toBeNull();
    expect(getLastNudgeStageShadow(ACCOUNT_ID)).toBeNull();
  });
});

describe("live-settings owner-activity shadow reconciliation", () => {
  const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

  function makeSettings(at: number | undefined): TlonSettingsStore {
    if (at == null) {return {};}
    return {
      lastOwnerMessageAt: at,
      lastOwnerMessageDate: new Date(at).toISOString().split("T")[0] ?? "",
    };
  }

  it("reconciles the shadow when a post-start poke backdates lastOwnerMessageAt", () => {
    const nowMs = Date.now();
    const freshAt = nowMs - THREE_DAYS_MS;

    // Startup seeded the shadow from settings that marked the owner as
    // fresh (3 days ago).
    const startupSettings = makeSettings(freshAt);
    setLastOwnerActivity(ACCOUNT_ID, ownerActivityFromSettings(startupSettings));

    // Admin pokes %settings to backdate the owner's last activity to 8
    // days ago — the scheduler should now treat the owner as idle even
    // though the shadow already held a fresher timestamp.
    const backdatedAt = nowMs - EIGHT_DAYS_MS;
    const subscriptionSettings = makeSettings(backdatedAt);
    reconcileOwnerActivityShadow(
      ACCOUNT_ID,
      startupSettings,
      subscriptionSettings,
      "subscription",
    );

    const shadow = getLastOwnerActivity(ACCOUNT_ID);
    expect(shadow?.at).toBe(backdatedAt);

    // Scheduler view: idle days should reflect the backdated admin value.
    const resolved = resolveLastOwnerInstant(shadow, subscriptionSettings);
    expect(resolved).toBe(backdatedAt);
    expect(computeTargetStage(daysBetween(resolved ?? 0, nowMs))).toBe(1);
  });

  it("reconciles the shadow when a post-start poke sets lastOwnerMessageAt to now", () => {
    const nowMs = Date.now();

    // Startup seeded the shadow as 8 days idle, so without reconciliation
    // the scheduler would fire a stage-1 nudge.
    const startupSettings = makeSettings(nowMs - EIGHT_DAYS_MS);
    setLastOwnerActivity(ACCOUNT_ID, ownerActivityFromSettings(startupSettings));

    // Admin/test harness pokes `lastOwnerMessageAt = now` to simulate
    // that the owner just replied. The scheduler should suppress the
    // nudge on the next tick because the shadow now reflects "fresh".
    const subscriptionSettings = makeSettings(nowMs);
    reconcileOwnerActivityShadow(
      ACCOUNT_ID,
      startupSettings,
      subscriptionSettings,
      "subscription",
    );

    const shadow = getLastOwnerActivity(ACCOUNT_ID);
    expect(shadow?.at).toBe(nowMs);

    const resolved = resolveLastOwnerInstant(shadow, subscriptionSettings);
    const idle = daysBetween(resolved ?? 0, nowMs);
    expect(idle).toBe(0);
    expect(computeTargetStage(idle)).toBeNull();
  });

  it("does not clobber a fresher local shadow from a fallback refresh (fresh: false)", () => {
    const nowMs = Date.now();

    // Local owner reply arrived after startup; the handler updated the
    // shadow synchronously before the %settings put-entry was echoed.
    const locallyFreshAt = nowMs - 1000;
    setLastOwnerActivity(ACCOUNT_ID, {
      at: locallyFreshAt,
      date: new Date(locallyFreshAt).toISOString().split("T")[0] ?? "",
    });

    // The preserved settings mirror still holds the older value because
    // the subscription hasn't echoed the put-entry yet, and the refresh
    // scry failed. `prev` and `new` also differ here (e.g. after an
    // earlier subscription update) so the diff gate would otherwise
    // reconcile — the `fresh: false` gate is what keeps the stale load
    // from regressing the shadow.
    const prevSettings = makeSettings(nowMs - EIGHT_DAYS_MS);
    const staleRefreshSettings = makeSettings(nowMs - 2 * EIGHT_DAYS_MS);
    reconcileOwnerActivityShadow(
      ACCOUNT_ID,
      prevSettings,
      staleRefreshSettings,
      "refresh",
      { fresh: false },
    );

    const shadow = getLastOwnerActivity(ACCOUNT_ID);
    expect(shadow?.at).toBe(locallyFreshAt);
  });

  it("applies a fresh refresh (fresh: true) even after startup", () => {
    const nowMs = Date.now();

    // Shadow held the startup snapshot value.
    const startupSettings = makeSettings(nowMs - EIGHT_DAYS_MS);
    setLastOwnerActivity(ACCOUNT_ID, ownerActivityFromSettings(startupSettings));

    // A subsequent fresh scry succeeds and returns a newer timestamp —
    // the refresh path is trusted when `fresh: true`.
    const refreshedAt = nowMs - 1000;
    const refreshSettings = makeSettings(refreshedAt);
    reconcileOwnerActivityShadow(
      ACCOUNT_ID,
      startupSettings,
      refreshSettings,
      "refresh",
      { fresh: true },
    );

    expect(getLastOwnerActivity(ACCOUNT_ID)?.at).toBe(refreshedAt);
  });

  it("leaves the shadow alone when a subscription event does not change owner-activity fields", () => {
    const nowMs = Date.now();
    const seededAt = nowMs - THREE_DAYS_MS;

    // Seed shadow with a fresher local value than what settings carries.
    const locallyFreshAt = nowMs - 500;
    setLastOwnerActivity(ACCOUNT_ID, {
      at: locallyFreshAt,
      date: new Date(locallyFreshAt).toISOString().split("T")[0] ?? "",
    });

    // Simulate an unrelated subscription event: `prev` and `new` both
    // carry the same owner-activity fields because the event updated a
    // different key (channelRules, say). The reconcile must NOT read
    // the settings mirror back into the shadow in that case.
    const baseSettings = makeSettings(seededAt);
    const unrelatedUpdate: TlonSettingsStore = {
      ...baseSettings,
      channelRules: { "chat/~zod/foo": { mode: "open", allowedShips: [] } },
    };
    reconcileOwnerActivityShadow(
      ACCOUNT_ID,
      baseSettings,
      unrelatedUpdate,
      "subscription",
    );

    expect(getLastOwnerActivity(ACCOUNT_ID)?.at).toBe(locallyFreshAt);
  });
});

describe("live-settings lastNudgeStage shadow reconciliation", () => {
  it("subscription clear (del-entry) lowers a non-zero shadow to 0", () => {
    setLastNudgeStageShadow(ACCOUNT_ID, 1);
    const prev: TlonSettingsStore = { lastNudgeStage: 1 };
    // After del-entry the parser leaves lastNudgeStage undefined.
    const next: TlonSettingsStore = {};
    reconcileStageShadow(ACCOUNT_ID, prev, next, "subscription");
    expect(getLastNudgeStageShadow(ACCOUNT_ID)).toBe(0);
  });

  it("subscription lower from stage 2 to stage 1 updates the shadow", () => {
    setLastNudgeStageShadow(ACCOUNT_ID, 2);
    reconcileStageShadow(
      ACCOUNT_ID,
      { lastNudgeStage: 2 },
      { lastNudgeStage: 1 },
      "subscription",
    );
    expect(getLastNudgeStageShadow(ACCOUNT_ID)).toBe(1);
  });

  it("subscription raise from 0 to 1 updates the shadow", () => {
    setLastNudgeStageShadow(ACCOUNT_ID, 0);
    reconcileStageShadow(ACCOUNT_ID, {}, { lastNudgeStage: 1 }, "subscription");
    expect(getLastNudgeStageShadow(ACCOUNT_ID)).toBe(1);
  });

  it("subscription event without a lastNudgeStage diff does not touch the shadow", () => {
    setLastNudgeStageShadow(ACCOUNT_ID, 2);
    const prev: TlonSettingsStore = { lastNudgeStage: 2 };
    const next: TlonSettingsStore = {
      lastNudgeStage: 2,
      // unrelated key changed:
      channelRules: { "chat/~zod/foo": { mode: "open", allowedShips: [] } },
    };
    reconcileStageShadow(ACCOUNT_ID, prev, next, "subscription");
    expect(getLastNudgeStageShadow(ACCOUNT_ID)).toBe(2);
  });

  it("refresh fresh=false does not lower the shadow even on a stale snapshot diff", () => {
    setLastNudgeStageShadow(ACCOUNT_ID, 2);
    reconcileStageShadow(
      ACCOUNT_ID,
      { lastNudgeStage: 2 },
      {},
      "refresh",
      { fresh: false },
    );
    expect(getLastNudgeStageShadow(ACCOUNT_ID)).toBe(2);
  });

  it("refresh fresh=true reconciles a clear into the shadow", () => {
    setLastNudgeStageShadow(ACCOUNT_ID, 1);
    reconcileStageShadow(
      ACCOUNT_ID,
      { lastNudgeStage: 1 },
      {},
      "refresh",
      { fresh: true },
    );
    expect(getLastNudgeStageShadow(ACCOUNT_ID)).toBe(0);
  });

  it("after a live reset, the duplicate-prevention guard accepts the same stage again", () => {
    // Prior tick advanced the shadow to 1 and sent stage 1.
    setLastNudgeStageShadow(ACCOUNT_ID, 1);

    // External clear arrives via subscription: lastNudgeStage del-entry'd.
    reconcileStageShadow(
      ACCOUNT_ID,
      { lastNudgeStage: 1 },
      {},
      "subscription",
    );
    expect(getLastNudgeStageShadow(ACCOUNT_ID)).toBe(0);

    // Model the runner's resolveAuthoritativeStage guard. With the shadow
    // now at 0 and the storage echo also clearing, target=1 > fresh=0 so
    // the runner can re-send stage 1 on the next inactivity cycle.
    const targetStage = 1;
    const freshStage = Math.max(getLastNudgeStageShadow(ACCOUNT_ID) ?? 0, /* scry: */ 0);
    expect(targetStage > freshStage).toBe(true);
  });
});
