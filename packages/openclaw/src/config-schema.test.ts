import { describe, expect, it } from "vitest";
import { TlonAuthorizationSchema, TlonConfigSchema } from "./config-schema.js";

describe("Tlon config schema", () => {
  it("accepts channelRules with string keys", () => {
    const parsed = TlonAuthorizationSchema.parse({
      channelRules: {
        "chat/~zod/test": {
          mode: "open",
          allowedShips: ["~zod"],
        },
      },
    });

    expect(parsed.channelRules?.["chat/~zod/test"]?.mode).toBe("open");
  });

  it("accepts accounts with string keys", () => {
    const parsed = TlonConfigSchema.parse({
      accounts: {
        primary: {
          ship: "~zod",
          url: "https://example.com",
          code: "code-123",
        },
      },
    });

    expect(parsed.accounts?.primary?.ship).toBe("~zod");
  });

  it("accepts opt-in telemetry configuration", () => {
    const parsed = TlonConfigSchema.parse({
      telemetry: {
        enabled: true,
        apiKey: "phc_base",
        host: "https://us.i.posthog.com",
      },
      accounts: {
        hosted: {
          ship: "~zod",
          url: "https://example.com",
          code: "code-123",
          telemetry: {
            enabled: true,
            apiKey: "phc_account",
          },
        },
      },
    });

    expect(parsed.telemetry?.enabled).toBe(true);
    expect(parsed.accounts?.hosted?.telemetry?.apiKey).toBe("phc_account");
  });

  it("accepts an opt-in reengagement.enabled flag", () => {
    const parsed = TlonConfigSchema.parse({
      ship: "~zod",
      url: "https://example.com",
      code: "code-123",
      reengagement: { enabled: true },
    });
    expect(parsed.reengagement?.enabled).toBe(true);
  });

  it("accepts an absent reengagement block and leaves the flag undefined", () => {
    const parsed = TlonConfigSchema.parse({
      ship: "~zod",
      url: "https://example.com",
      code: "code-123",
    });
    expect(parsed.reengagement).toBeUndefined();
  });

  it("accepts reengagement.enabled = false explicitly", () => {
    const parsed = TlonConfigSchema.parse({
      ship: "~zod",
      url: "https://example.com",
      code: "code-123",
      reengagement: { enabled: false },
    });
    expect(parsed.reengagement?.enabled).toBe(false);
  });

  it("accepts a channels.tlon.nudgeActiveHours block with 24-hour bounds", () => {
    const parsed = TlonConfigSchema.parse({
      ship: "~zod",
      url: "https://example.com",
      code: "code-123",
      nudgeActiveHours: { start: "00:00", end: "24:00", timezone: "UTC" },
    });
    expect(parsed.nudgeActiveHours).toEqual({
      start: "00:00",
      end: "24:00",
      timezone: "UTC",
    });
  });

  it("accepts a partial nudgeActiveHours block with no timezone", () => {
    const parsed = TlonConfigSchema.parse({
      ship: "~zod",
      url: "https://example.com",
      code: "code-123",
      nudgeActiveHours: { start: "09:00", end: "17:00" },
    });
    expect(parsed.nudgeActiveHours).toEqual({ start: "09:00", end: "17:00" });
  });

  it("accepts ownerListenEnabled and ownerListenDisabledChannels", () => {
    const parsed = TlonConfigSchema.parse({
      ship: "~zod",
      url: "https://example.com",
      code: "code-123",
      ownerListenEnabled: false,
      ownerListenDisabledChannels: ["chat/~zod/foo", "diary/~bus/bar"],
    });
    expect(parsed.ownerListenEnabled).toBe(false);
    expect(parsed.ownerListenDisabledChannels).toEqual(["chat/~zod/foo", "diary/~bus/bar"]);
  });

  it("treats owner-listen fields as optional", () => {
    const parsed = TlonConfigSchema.parse({
      ship: "~zod",
      url: "https://example.com",
      code: "code-123",
    });
    expect(parsed.ownerListenEnabled).toBeUndefined();
    expect(parsed.ownerListenDisabledChannels).toBeUndefined();
  });
});
