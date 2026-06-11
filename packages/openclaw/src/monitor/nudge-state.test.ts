import { beforeEach, describe, expect, it } from "vitest";
import {
  _testing,
  clearShadowsForAccount,
  getLastNudgeStageShadow,
  getLastOwnerActivity,
  ownerActivityFromSettings,
  setLastNudgeStageShadow,
  setLastOwnerActivity,
} from "./nudge-state.js";

beforeEach(() => {
  _testing.clearAll();
});

describe("nudge-state shadows", () => {
  it("owner-activity set/get roundtrip", () => {
    setLastOwnerActivity("a", { at: 1000, date: "2026-04-21" });
    expect(getLastOwnerActivity("a")).toEqual({ at: 1000, date: "2026-04-21" });
  });

  it("owner-activity clear with null", () => {
    setLastOwnerActivity("a", { at: 1000, date: "2026-04-21" });
    setLastOwnerActivity("a", null);
    expect(getLastOwnerActivity("a")).toBeNull();
  });

  it("stage-shadow set/get roundtrip, including zero", () => {
    setLastNudgeStageShadow("a", 0);
    expect(getLastNudgeStageShadow("a")).toBe(0);
    setLastNudgeStageShadow("a", 2);
    expect(getLastNudgeStageShadow("a")).toBe(2);
  });

  it("stage-shadow get returns null when unset", () => {
    expect(getLastNudgeStageShadow("missing")).toBeNull();
  });

  it("per-account isolation", () => {
    setLastOwnerActivity("a", { at: 1, date: "2026-04-21" });
    setLastOwnerActivity("b", { at: 2, date: "2026-04-22" });
    setLastNudgeStageShadow("a", 1);
    setLastNudgeStageShadow("b", 3);

    expect(getLastOwnerActivity("a")?.at).toBe(1);
    expect(getLastOwnerActivity("b")?.at).toBe(2);
    expect(getLastNudgeStageShadow("a")).toBe(1);
    expect(getLastNudgeStageShadow("b")).toBe(3);
  });

  it("clearShadowsForAccount drops both shadows for that account only", () => {
    setLastOwnerActivity("a", { at: 1, date: "2026-04-21" });
    setLastOwnerActivity("b", { at: 2, date: "2026-04-22" });
    setLastNudgeStageShadow("a", 1);
    setLastNudgeStageShadow("b", 3);

    clearShadowsForAccount("a");

    expect(getLastOwnerActivity("a")).toBeNull();
    expect(getLastNudgeStageShadow("a")).toBeNull();
    expect(getLastOwnerActivity("b")).toEqual({ at: 2, date: "2026-04-22" });
    expect(getLastNudgeStageShadow("b")).toBe(3);
  });

  describe("ownerActivityFromSettings", () => {
    it("returns null when neither field is present", () => {
      expect(ownerActivityFromSettings({})).toBeNull();
    });

    it("returns both fields when both are present", () => {
      const got = ownerActivityFromSettings({
        lastOwnerMessageAt: 1000,
        lastOwnerMessageDate: "2026-04-21",
      });
      expect(got).toEqual({ at: 1000, date: "2026-04-21" });
    });

    it("derives the date string from lastOwnerMessageAt when only at is present", () => {
      const got = ownerActivityFromSettings({ lastOwnerMessageAt: Date.UTC(2026, 3, 21) });
      expect(got?.at).toBe(Date.UTC(2026, 3, 21));
      expect(got?.date).toBe("2026-04-21");
    });

    it("derives at from the date string when only date is present", () => {
      const got = ownerActivityFromSettings({ lastOwnerMessageDate: "2026-04-21" });
      expect(got?.date).toBe("2026-04-21");
      expect(got?.at).toBe(Date.parse("2026-04-21"));
    });

    it("returns null for an unparseable date string", () => {
      expect(ownerActivityFromSettings({ lastOwnerMessageDate: "not-a-date" })).toBeNull();
    });
  });
});
