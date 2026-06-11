import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { resolveBridgeForCommand, checkOwner } from "./command-auth.js";
import { setBridge, removeBridge, type ApprovalCommandBridge } from "./command-bridge.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBridge(ownerShip: string | null): ApprovalCommandBridge {
  return {
    ownerShip,
    handleAction: async () => "ok",
    getPendingList: async () => "none",
    getBlockedList: async () => "none",
    handleUnblock: async () => "ok",
    isOwnedChannel: () => false,
    getOwnerListenGlobal: () => true,
    setOwnerListenGlobal: async (enabled: boolean) => enabled,
    isOwnerListenDisabled: () => false,
    setOwnerListenDisabled: async (_nest: string, disabled: boolean) => !disabled,
    listOwnerListenDisabled: () => [],
  };
}

// ---------------------------------------------------------------------------
// Test state management
// ---------------------------------------------------------------------------

// Track bridges we register so afterEach can clean them up
const registered: Array<{ accountId: string | undefined; bridge: ApprovalCommandBridge }> = [];

function registerBridge(
  accountId: string | undefined,
  ownerShip: string | null,
): ApprovalCommandBridge {
  const bridge = makeBridge(ownerShip);
  setBridge(accountId, bridge);
  registered.push({ accountId, bridge });
  return bridge;
}

beforeEach(() => {
  registered.length = 0;
});

afterEach(() => {
  for (const { accountId, bridge } of registered) {
    removeBridge(accountId, bridge);
  }
  registered.length = 0;
});

// ---------------------------------------------------------------------------
// resolveBridgeForCommand
// ---------------------------------------------------------------------------

describe("resolveBridgeForCommand", () => {
  it("returns error when no bridges are registered", () => {
    const result = resolveBridgeForCommand({ senderId: "~zod" });
    expect(result).toEqual({ error: "Bot is not connected yet." });
  });

  it("resolves single bridge for owner", () => {
    const bridge = registerBridge(undefined, "~zod");
    const result = resolveBridgeForCommand({ senderId: "~zod" });
    expect(result).toEqual({ bridge });
  });

  it("rejects non-owner on single bridge", () => {
    registerBridge(undefined, "~zod");
    const result = resolveBridgeForCommand({ senderId: "~bus" });
    expect(result).toEqual({ error: "Only the bot owner can use this command." });
  });

  it("resolves by accountId when available", () => {
    const bridge1 = registerBridge("acct-1", "~zod");
    registerBridge("acct-2", "~bus");
    const result = resolveBridgeForCommand({ accountId: "acct-1", senderId: "~zod" });
    expect(result).toEqual({ bridge: bridge1 });
  });

  it("rejects non-owner even when accountId matches", () => {
    registerBridge("acct-1", "~zod");
    const result = resolveBridgeForCommand({ accountId: "acct-1", senderId: "~bus" });
    expect(result).toEqual({ error: "Only the bot owner can use this command." });
  });

  it("falls back to senderId matching when accountId is missing with multiple bridges", () => {
    registerBridge("acct-1", "~zod");
    const bridge2 = registerBridge("acct-2", "~bus");
    const result = resolveBridgeForCommand({ senderId: "~bus" });
    expect(result).toEqual({ bridge: bridge2 });
  });

  it("returns ambiguity error when senderId matches no bridge owner", () => {
    registerBridge("acct-1", "~zod");
    registerBridge("acct-2", "~bus");
    const result = resolveBridgeForCommand({ senderId: "~nec" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Multiple accounts connected");
  });

  it("returns ambiguity error when two bridges share the same ownerShip", () => {
    registerBridge("acct-1", "~zod");
    registerBridge("acct-2", "~zod");
    const result = resolveBridgeForCommand({ senderId: "~zod" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Multiple accounts connected");
  });

  it("returns ambiguity error when senderId is missing with multiple bridges", () => {
    registerBridge("acct-1", "~zod");
    registerBridge("acct-2", "~bus");
    const result = resolveBridgeForCommand({});
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Multiple accounts connected");
  });
});

// ---------------------------------------------------------------------------
// checkOwner
// ---------------------------------------------------------------------------

describe("checkOwner", () => {
  it("returns bridge when senderId matches ownerShip", () => {
    const bridge = makeBridge("~zod");
    expect(checkOwner({ senderId: "~zod" }, bridge)).toEqual({ bridge });
  });

  it("normalizes ship names for comparison", () => {
    const bridge = makeBridge("~zod");
    expect(checkOwner({ senderId: "zod" }, bridge)).toEqual({ bridge });
  });

  it("rejects when ownerShip is null", () => {
    const bridge = makeBridge(null);
    expect(checkOwner({ senderId: "~zod" }, bridge)).toEqual({
      error: "Owner ship not configured.",
    });
  });

  it("rejects when senderId is missing", () => {
    const bridge = makeBridge("~zod");
    expect(checkOwner({}, bridge)).toEqual({ error: "Cannot identify sender." });
  });

  it("rejects when senderId is null", () => {
    const bridge = makeBridge("~zod");
    expect(checkOwner({ senderId: null }, bridge)).toEqual({
      error: "Cannot identify sender.",
    });
  });

  it("rejects when senderId does not match ownerShip", () => {
    const bridge = makeBridge("~zod");
    expect(checkOwner({ senderId: "~bus" }, bridge)).toEqual({
      error: "Only the bot owner can use this command.",
    });
  });
});
