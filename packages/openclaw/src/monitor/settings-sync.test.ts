import { describe, expect, it } from "vitest";
import type { PendingNudge } from "../pending-nudge.js";
import type { TlonSettingsStore } from "../settings.js";
import { resolveSettingsMirrorSync } from "./settings-sync.js";

function makeNudge(overrides?: Partial<PendingNudge>): PendingNudge {
  return {
    sentAt: Date.now(),
    stage: 1,
    ownerShip: "~sampel-palnet",
    accountId: "default",
    ...overrides,
  };
}

describe("resolveSettingsMirrorSync", () => {
  describe("ownerShip transitions", () => {
    it("detects ownerShip set to new value", () => {
      const result = resolveSettingsMirrorSync({
        prevSettings: {},
        newSettings: { ownerShip: "sampel-palnet" },
        fileConfigOwnerShip: "~file-owner",
      });
      expect(result.ownerShipChanged).toBe(true);
      expect(result.effectiveOwnerShip).toBe("~sampel-palnet");
    });

    it("detects ownerShip changed to different value", () => {
      const result = resolveSettingsMirrorSync({
        prevSettings: { ownerShip: "~old-owner" },
        newSettings: { ownerShip: "~new-owner" },
        fileConfigOwnerShip: "~file-owner",
      });
      expect(result.ownerShipChanged).toBe(true);
      expect(result.effectiveOwnerShip).toBe("~new-owner");
    });

    it("detects ownerShip set to falsy — falls back to file config", () => {
      const result = resolveSettingsMirrorSync({
        prevSettings: { ownerShip: "~old-owner" },
        newSettings: { ownerShip: "" },
        fileConfigOwnerShip: "~file-owner",
      });
      expect(result.ownerShipChanged).toBe(true);
      expect(result.effectiveOwnerShip).toBe("~file-owner");
    });

    it("detects ownerShip deleted (undefined) — falls back to file config", () => {
      const result = resolveSettingsMirrorSync({
        prevSettings: { ownerShip: "~old-owner" },
        newSettings: {},
        fileConfigOwnerShip: "~file-owner",
      });
      expect(result.ownerShipChanged).toBe(true);
      expect(result.effectiveOwnerShip).toBe("~file-owner");
    });

    it("unchanged ownerShip returns false", () => {
      const result = resolveSettingsMirrorSync({
        prevSettings: { ownerShip: "~same-owner" },
        newSettings: { ownerShip: "~same-owner" },
        fileConfigOwnerShip: "~file-owner",
      });
      expect(result.ownerShipChanged).toBe(false);
    });
  });

  describe("pendingNudge transitions", () => {
    it("detects pendingNudge added", () => {
      const nudge = makeNudge();
      const result = resolveSettingsMirrorSync({
        prevSettings: {},
        newSettings: { pendingNudge: nudge },
        fileConfigOwnerShip: null,
      });
      expect(result.pendingNudgeChanged).toBe(true);
      expect(result.pendingNudge).toEqual(nudge);
    });

    it("detects pendingNudge deleted", () => {
      const nudge = makeNudge();
      const result = resolveSettingsMirrorSync({
        prevSettings: { pendingNudge: nudge },
        newSettings: {},
        fileConfigOwnerShip: null,
      });
      expect(result.pendingNudgeChanged).toBe(true);
      expect(result.pendingNudge).toBeNull();
    });

    it("unchanged pendingNudge (same reference) returns false", () => {
      const nudge = makeNudge();
      const settings: TlonSettingsStore = { pendingNudge: nudge };
      const result = resolveSettingsMirrorSync({
        prevSettings: settings,
        newSettings: settings,
        fileConfigOwnerShip: null,
      });
      expect(result.pendingNudgeChanged).toBe(false);
    });

    it("replaced pendingNudge (different reference) returns true", () => {
      const old = makeNudge({ stage: 1 });
      const replacement = makeNudge({ stage: 2 });
      const result = resolveSettingsMirrorSync({
        prevSettings: { pendingNudge: old },
        newSettings: { pendingNudge: replacement },
        fileConfigOwnerShip: null,
      });
      expect(result.pendingNudgeChanged).toBe(true);
      expect(result.pendingNudge).toEqual(replacement);
    });
  });

  describe("edge cases", () => {
    it("first onChange after startup with no new fields", () => {
      const result = resolveSettingsMirrorSync({
        prevSettings: {},
        newSettings: { dmAllowlist: ["~ship"] },
        fileConfigOwnerShip: null,
      });
      expect(result.pendingNudgeChanged).toBe(false);
      expect(result.ownerShipChanged).toBe(false);
    });
  });
});
