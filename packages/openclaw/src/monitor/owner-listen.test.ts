import { describe, expect, it } from "vitest";
import { isOwnerListenSlashCommand, nestFromCtxFrom, shouldEngageInGroup } from "./utils.js";

const OWNER = "~zod";
const BOT = "~bus";
const STRANGER = "~nec";
const OWNED_BY_OWNER = "chat/~zod/general";
const OWNED_BY_BOT = "chat/~bus/garage";
const STRANGER_HOSTED = "chat/~nec/lounge";

function baseOpts(overrides: Partial<Parameters<typeof shouldEngageInGroup>[0]> = {}) {
  return {
    mentioned: false,
    inParticipatedThread: false,
    isOwnerBlob: false,
    senderShip: OWNER,
    ownerShip: OWNER,
    botShipName: BOT,
    channelNest: OWNED_BY_OWNER,
    groupHost: OWNER,
    ownerListenEnabled: true,
    ownerListenDisabledChannels: new Set<string>(),
    ...overrides,
  };
}

describe("shouldEngageInGroup", () => {
  it("engages on mention regardless of other inputs", () => {
    const result = shouldEngageInGroup(
      baseOpts({
        mentioned: true,
        ownerListenEnabled: false,
        senderShip: STRANGER,
        groupHost: STRANGER,
      }),
    );
    expect(result).toEqual({ engage: true, reason: "mention" });
  });

  it("engages on participated thread", () => {
    const result = shouldEngageInGroup(
      baseOpts({ inParticipatedThread: true, ownerListenEnabled: false }),
    );
    expect(result).toEqual({ engage: true, reason: "thread" });
  });

  it("engages on owner blob-only message even when listen path off", () => {
    const result = shouldEngageInGroup(baseOpts({ isOwnerBlob: true, ownerListenEnabled: false }));
    expect(result).toEqual({ engage: true, reason: "owner-blob" });
  });

  it("engages owner in owner-hosted channel", () => {
    expect(shouldEngageInGroup(baseOpts())).toEqual({ engage: true, reason: "owner-owned" });
  });

  it("engages owner in bot-hosted channel", () => {
    const result = shouldEngageInGroup(baseOpts({ channelNest: OWNED_BY_BOT, groupHost: BOT }));
    expect(result).toEqual({ engage: true, reason: "owner-owned" });
  });

  it("skips owner in stranger-hosted channel", () => {
    const result = shouldEngageInGroup(
      baseOpts({ channelNest: STRANGER_HOSTED, groupHost: STRANGER }),
    );
    expect(result).toEqual({ engage: false, reason: "skip" });
  });

  it("skips non-owner in owner-hosted channel", () => {
    const result = shouldEngageInGroup(baseOpts({ senderShip: STRANGER }));
    expect(result).toEqual({ engage: false, reason: "skip" });
  });

  it("skips owner-owned channel when channel is in disabled set", () => {
    const result = shouldEngageInGroup(
      baseOpts({ ownerListenDisabledChannels: new Set([OWNED_BY_OWNER]) }),
    );
    expect(result).toEqual({ engage: false, reason: "skip" });
  });

  it("kill switch wins: skips owner-owned when global is off", () => {
    expect(shouldEngageInGroup(baseOpts({ ownerListenEnabled: false }))).toEqual({
      engage: false,
      reason: "skip",
    });
  });

  it("skips when ownerShip is not configured", () => {
    expect(shouldEngageInGroup(baseOpts({ ownerShip: null }))).toEqual({
      engage: false,
      reason: "skip",
    });
  });

  it("skips when groupHost cannot be parsed", () => {
    expect(shouldEngageInGroup(baseOpts({ groupHost: null }))).toEqual({
      engage: false,
      reason: "skip",
    });
  });
});

describe("isOwnerListenSlashCommand", () => {
  it("matches exact /owner-listen commands with optional args", () => {
    expect(isOwnerListenSlashCommand("/owner-listen")).toBe(true);
    expect(isOwnerListenSlashCommand(" /owner-listen on")).toBe(true);
    expect(isOwnerListenSlashCommand("/OWNER-LISTEN all off")).toBe(true);
  });

  it("does not match mentions or similarly-prefixed commands", () => {
    expect(isOwnerListenSlashCommand("~bus /owner-listen on")).toBe(false);
    expect(isOwnerListenSlashCommand("/owner-listening on")).toBe(false);
    expect(isOwnerListenSlashCommand("hello /owner-listen on")).toBe(false);
  });
});

describe("nestFromCtxFrom", () => {
  it("extracts nest from a tlon group from-header", () => {
    expect(nestFromCtxFrom("tlon:group:chat/~zod/general")).toBe("chat/~zod/general");
  });

  it("returns null for DM from-header", () => {
    expect(nestFromCtxFrom("tlon:~zod")).toBeNull();
  });

  it("returns null for empty/missing input", () => {
    expect(nestFromCtxFrom(undefined)).toBeNull();
    expect(nestFromCtxFrom(null)).toBeNull();
    expect(nestFromCtxFrom("")).toBeNull();
  });
});
