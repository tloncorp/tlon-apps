import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  setPendingNudge,
  getPendingNudge,
  clearPendingNudge,
  registerPersistCallback,
  syncPendingNudgeFromStore,
  isNudgeEligible,
  DEFAULT_ATTRIBUTION_WINDOW_MS,
  _testing,
  type PendingNudge,
} from "./pending-nudge.js";

function makePendingNudge(overrides: Partial<PendingNudge> = {}): PendingNudge {
  return {
    sentAt: Date.now(),
    stage: 1,
    ownerShip: "~sampel-palnet",
    accountId: "default",
    content: "test content",
    ...overrides,
  };
}

describe("pending-nudge", () => {
  beforeEach(() => {
    _testing.clearAll();
  });

  describe("set/get/clear lifecycle", () => {
    it("stores and retrieves a pending nudge", () => {
      const nudge = makePendingNudge();
      setPendingNudge("default", nudge);
      expect(getPendingNudge("default")).toEqual(nudge);
    });

    it("clears a pending nudge", () => {
      setPendingNudge("default", makePendingNudge());
      clearPendingNudge("default");
      expect(getPendingNudge("default")).toBeNull();
    });

    it("returns null for unknown account", () => {
      expect(getPendingNudge("unknown")).toBeNull();
    });
  });

  describe("account isolation", () => {
    it("different accounts are independent", () => {
      const nudgeA = makePendingNudge({ accountId: "a", ownerShip: "~ship-a" });
      const nudgeB = makePendingNudge({ accountId: "b", ownerShip: "~ship-b" });
      setPendingNudge("a", nudgeA);
      setPendingNudge("b", nudgeB);

      clearPendingNudge("a");
      expect(getPendingNudge("a")).toBeNull();
      expect(getPendingNudge("b")).toEqual(nudgeB);
    });
  });

  describe("per-account persist callbacks", () => {
    it("fires on set", () => {
      const cb = vi.fn();
      registerPersistCallback("default", cb);

      const nudge = makePendingNudge();
      setPendingNudge("default", nudge);

      expect(cb).toHaveBeenCalledOnce();
      expect(cb).toHaveBeenCalledWith(nudge);
    });

    it("fires on clear with null", () => {
      const cb = vi.fn();
      registerPersistCallback("default", cb);

      setPendingNudge("default", makePendingNudge());
      cb.mockClear();

      clearPendingNudge("default");
      expect(cb).toHaveBeenCalledOnce();
      expect(cb).toHaveBeenCalledWith(null);
    });

    it("per-account isolation: no cross-write", () => {
      const cbA = vi.fn();
      const cbB = vi.fn();
      registerPersistCallback("a", cbA);
      registerPersistCallback("b", cbB);

      setPendingNudge("a", makePendingNudge({ accountId: "a" }));
      expect(cbA).toHaveBeenCalledOnce();
      expect(cbB).not.toHaveBeenCalled();

      cbA.mockClear();
      clearPendingNudge("b");
      expect(cbB).toHaveBeenCalledOnce();
      expect(cbA).not.toHaveBeenCalled();
    });

    it("supersede calls callback with new record", () => {
      const cb = vi.fn();
      registerPersistCallback("default", cb);

      const first = makePendingNudge({ stage: 1 });
      const second = makePendingNudge({ stage: 2 });
      setPendingNudge("default", first);
      setPendingNudge("default", second);

      expect(cb).toHaveBeenCalledTimes(2);
      expect(cb).toHaveBeenLastCalledWith(second);
    });

    it("missing persist callback is safe", () => {
      // No callback registered — should not throw
      expect(() => setPendingNudge("default", makePendingNudge())).not.toThrow();
      expect(() => clearPendingNudge("default")).not.toThrow();
    });
  });

  describe("syncPendingNudgeFromStore", () => {
    it("sets in-memory state without firing persist callback", () => {
      const cb = vi.fn();
      registerPersistCallback("default", cb);

      const nudge = makePendingNudge();
      syncPendingNudgeFromStore("default", nudge);

      expect(getPendingNudge("default")).toEqual(nudge);
      expect(cb).not.toHaveBeenCalled();
    });

    it("clears in-memory state without firing persist callback", () => {
      const cb = vi.fn();
      registerPersistCallback("default", cb);

      setPendingNudge("default", makePendingNudge());
      cb.mockClear();

      syncPendingNudgeFromStore("default", null);
      expect(getPendingNudge("default")).toBeNull();
      expect(cb).not.toHaveBeenCalled();
    });

    it("clears existing record when given null", () => {
      setPendingNudge("default", makePendingNudge());
      syncPendingNudgeFromStore("default", null);
      expect(getPendingNudge("default")).toBeNull();
    });
  });

  describe("isNudgeEligible", () => {
    it("returns true within window", () => {
      const nudge = makePendingNudge({ sentAt: Date.now() - 60 * 60 * 1000 }); // 1 hour ago
      expect(isNudgeEligible(nudge)).toBe(true);
    });

    it("returns true at boundary (uses <=)", () => {
      const now = Date.now();
      const nudge = makePendingNudge({ sentAt: now - DEFAULT_ATTRIBUTION_WINDOW_MS });
      expect(isNudgeEligible(nudge, now)).toBe(true);
    });

    it("returns false after window", () => {
      const now = Date.now();
      const nudge = makePendingNudge({ sentAt: now - DEFAULT_ATTRIBUTION_WINDOW_MS - 1 });
      expect(isNudgeEligible(nudge, now)).toBe(false);
    });

    it("supports custom window", () => {
      const now = Date.now();
      const oneHourMs = 60 * 60 * 1000;
      const nudge = makePendingNudge({ sentAt: now - 2 * oneHourMs });
      expect(isNudgeEligible(nudge, now, oneHourMs)).toBe(false);
    });

    it("supports injectable now", () => {
      const nudge = makePendingNudge({ sentAt: 100 });
      expect(isNudgeEligible(nudge, 200, 150)).toBe(true);
      expect(isNudgeEligible(nudge, 300, 150)).toBe(false);
    });
  });

  describe("content field", () => {
    it("tolerates pending nudge without content", () => {
      const nudge: PendingNudge = {
        sentAt: 1,
        stage: 1,
        ownerShip: "~zod",
        accountId: "default",
      };
      setPendingNudge("default", nudge);
      expect(getPendingNudge("default")?.content).toBeUndefined();
    });

    it("preserves content through set/get", () => {
      setPendingNudge("default", makePendingNudge({ content: "Hey friend!" }));
      expect(getPendingNudge("default")?.content).toBe("Hey friend!");
    });
  });
});
