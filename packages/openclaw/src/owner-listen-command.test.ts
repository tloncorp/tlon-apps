import { describe, expect, it } from "vitest";
import type { ApprovalCommandBridge } from "./monitor/command-bridge.js";
import { handleOwnerListenCommand } from "./owner-listen-command.js";

const OWNED_NEST = "chat/~zod/general";
const FOREIGN_NEST = "chat/~nec/lounge";

type BridgeSubset = Pick<
  ApprovalCommandBridge,
  | "isOwnedChannel"
  | "getOwnerListenGlobal"
  | "setOwnerListenGlobal"
  | "isOwnerListenDisabled"
  | "setOwnerListenDisabled"
  | "listOwnerListenDisabled"
>;

type StubState = {
  global: boolean;
  disabled: Set<string>;
  ownedNests: Set<string>;
  setGlobalCalls: boolean[];
  setDisabledCalls: Array<{ nest: string; disabled: boolean }>;
};

function makeStub(initial: Partial<StubState> = {}): StubState & { bridge: BridgeSubset } {
  const state: StubState = {
    global: initial.global ?? true,
    disabled: initial.disabled ?? new Set(),
    ownedNests: initial.ownedNests ?? new Set([OWNED_NEST]),
    setGlobalCalls: [],
    setDisabledCalls: [],
  };
  const bridge: BridgeSubset = {
    isOwnedChannel: (nest) => state.ownedNests.has(nest),
    getOwnerListenGlobal: () => state.global,
    setOwnerListenGlobal: async (enabled) => {
      state.global = enabled;
      state.setGlobalCalls.push(enabled);
      return enabled;
    },
    isOwnerListenDisabled: (nest) => state.disabled.has(nest),
    setOwnerListenDisabled: async (nest, disabled) => {
      if (disabled) {
        state.disabled.add(nest);
      } else {
        state.disabled.delete(nest);
      }
      state.setDisabledCalls.push({ nest, disabled });
      return !disabled;
    },
    listOwnerListenDisabled: () => [...state.disabled],
  };
  return { ...state, bridge };
}

describe("handleOwnerListenCommand: per-channel", () => {
  it("status (no args) in owned channel reports active", async () => {
    const stub = makeStub();
    const text = await handleOwnerListenCommand(stub.bridge, "", `tlon:group:${OWNED_NEST}`);
    expect(text).toContain(`Owner-listen for ${OWNED_NEST}: on`);
    expect(text).toContain("active");
  });

  it("off in owned channel calls setOwnerListenDisabled(nest, true)", async () => {
    const stub = makeStub();
    const text = await handleOwnerListenCommand(stub.bridge, "off", `tlon:group:${OWNED_NEST}`);
    expect(text).toBe(`Owner-listen for ${OWNED_NEST}: off (channel is muted).`);
    expect(stub.setDisabledCalls).toEqual([{ nest: OWNED_NEST, disabled: true }]);
  });

  it("on chat/~zod/general (explicit nest) calls setOwnerListenDisabled(nest, false)", async () => {
    const stub = makeStub({ disabled: new Set([OWNED_NEST]) });
    const text = await handleOwnerListenCommand(
      stub.bridge,
      `on ${OWNED_NEST}`,
      "tlon:~zod", // ctx is a DM; explicit nest is the target
    );
    expect(text).toBe(`Owner-listen for ${OWNED_NEST}: on (active).`);
    expect(stub.setDisabledCalls).toEqual([{ nest: OWNED_NEST, disabled: false }]);
  });

  it("on clears channel mute but reports global-off effective state", async () => {
    const stub = makeStub({ global: false, disabled: new Set([OWNED_NEST]) });
    const text = await handleOwnerListenCommand(stub.bridge, `on ${OWNED_NEST}`, "tlon:~zod");
    expect(text).toBe(
      `Owner-listen for ${OWNED_NEST}: off (global is off; channel mute cleared). Run /owner-listen all on to enable it.`,
    );
    expect(stub.setDisabledCalls).toEqual([{ nest: OWNED_NEST, disabled: false }]);
    expect(stub.disabled.has(OWNED_NEST)).toBe(false);
  });

  it("status reports muted when channel is in disabled set", async () => {
    const stub = makeStub({ disabled: new Set([OWNED_NEST]) });
    const text = await handleOwnerListenCommand(stub.bridge, "status", `tlon:group:${OWNED_NEST}`);
    expect(text).toContain(`Owner-listen for ${OWNED_NEST}: off`);
    expect(text).toContain("channel is muted");
  });

  it("status reports global-off when kill switch is off", async () => {
    const stub = makeStub({ global: false });
    const text = await handleOwnerListenCommand(stub.bridge, "", `tlon:group:${OWNED_NEST}`);
    expect(text).toContain("global is off");
  });

  it("rejects flip in non-owned channel", async () => {
    const stub = makeStub({ ownedNests: new Set() });
    const text = await handleOwnerListenCommand(stub.bridge, "off", `tlon:group:${FOREIGN_NEST}`);
    expect(text).toContain("not an owned channel");
    expect(stub.setDisabledCalls).toEqual([]);
  });

  it("returns usage when called from DM with no nest arg", async () => {
    const stub = makeStub();
    const text = await handleOwnerListenCommand(stub.bridge, "", "tlon:~zod");
    expect(text).toContain("Usage: /owner-listen");
  });

  it("passes the user-typed nest through to the bridge for canonicalization", async () => {
    // Bridge is responsible for normalizing the nest before storage so a missing
    // "~" or odd casing still matches incoming runtime nest events. The handler
    // itself is not in that path — it just hands the value off.
    const stub = makeStub({ ownedNests: new Set(["chat/zod/general"]) });
    const text = await handleOwnerListenCommand(stub.bridge, "off chat/zod/general", "tlon:~zod");
    expect(text).toBe("Owner-listen for chat/zod/general: off (channel is muted).");
    expect(stub.setDisabledCalls).toEqual([{ nest: "chat/zod/general", disabled: true }]);
  });
});

describe("handleOwnerListenCommand: global kill switch", () => {
  it("/owner-listen all reports global state and disabled count", async () => {
    const stub = makeStub({
      global: true,
      disabled: new Set(["chat/~zod/x", "chat/~zod/y"]),
    });
    const text = await handleOwnerListenCommand(stub.bridge, "all", `tlon:group:${OWNED_NEST}`);
    expect(text).toContain("Global owner-listen: on");
    expect(text).toContain("2 channel(s) individually disabled");
  });

  it("/owner-listen all off calls setOwnerListenGlobal(false)", async () => {
    const stub = makeStub();
    const text = await handleOwnerListenCommand(stub.bridge, "all off", `tlon:group:${OWNED_NEST}`);
    expect(text).toBe("Global owner-listen is now off.");
    expect(stub.setGlobalCalls).toEqual([false]);
  });

  it("/owner-listen all on calls setOwnerListenGlobal(true)", async () => {
    const stub = makeStub({ global: false });
    const text = await handleOwnerListenCommand(stub.bridge, "all on", `tlon:group:${OWNED_NEST}`);
    expect(text).toBe("Global owner-listen is now on.");
    expect(stub.setGlobalCalls).toEqual([true]);
  });

  it("/owner-listen on all (swapped order) calls setOwnerListenGlobal(true)", async () => {
    const stub = makeStub({ global: false });
    const text = await handleOwnerListenCommand(stub.bridge, "on all", `tlon:group:${OWNED_NEST}`);
    expect(text).toBe("Global owner-listen is now on.");
    expect(stub.setGlobalCalls).toEqual([true]);
  });

  it("/owner-listen off all (swapped order) calls setOwnerListenGlobal(false)", async () => {
    const stub = makeStub();
    const text = await handleOwnerListenCommand(stub.bridge, "off all", `tlon:group:${OWNED_NEST}`);
    expect(text).toBe("Global owner-listen is now off.");
    expect(stub.setGlobalCalls).toEqual([false]);
  });

  it("/owner-listen all garbage returns usage", async () => {
    const stub = makeStub();
    const text = await handleOwnerListenCommand(
      stub.bridge,
      "all banana",
      `tlon:group:${OWNED_NEST}`,
    );
    expect(text).toContain("Usage: /owner-listen all [on|off]");
  });
});

describe("handleOwnerListenCommand: list", () => {
  it("reports global state and empty list when no overrides", async () => {
    const stub = makeStub();
    const text = await handleOwnerListenCommand(stub.bridge, "list", "tlon:~zod");
    expect(text).toContain("Global owner-listen: on");
    expect(text).toContain("No channels individually disabled");
  });

  it("formats disabled channels as bullets", async () => {
    const stub = makeStub({
      disabled: new Set(["chat/~zod/foo", "chat/~bus/bar"]),
    });
    const text = await handleOwnerListenCommand(stub.bridge, "list", "tlon:~zod");
    expect(text).toContain("• chat/~zod/foo");
    expect(text).toContain("• chat/~bus/bar");
  });
});
