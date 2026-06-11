import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
import { describe, expect, it } from "vitest";
import { resolveTlonAccount } from "./types.js";

describe("resolveTlonAccount telemetry", () => {
  it("defaults telemetry to disabled", () => {
    const account = resolveTlonAccount({
      channels: {
        tlon: {
          ship: "~zod",
          url: "https://example.com",
          code: "code-123",
        },
      },
    } as OpenClawConfig);

    expect(account.telemetry).toEqual({
      enabled: false,
      apiKey: null,
      host: null,
    });
  });

  it("merges base and account telemetry settings", () => {
    const account = resolveTlonAccount(
      {
        channels: {
          tlon: {
            telemetry: {
              enabled: true,
              apiKey: "phc_base",
              host: "https://eu.i.posthog.com",
            },
            accounts: {
              hosted: {
                ship: "~zod",
                url: "https://example.com",
                code: "code-123",
                telemetry: {
                  apiKey: "phc_account",
                },
              },
            },
          },
        },
      } as OpenClawConfig,
      "hosted",
    );

    expect(account.telemetry).toEqual({
      enabled: true,
      apiKey: "phc_account",
      host: "https://eu.i.posthog.com",
    });
  });

  it("still requires an explicit enable flag", () => {
    const account = resolveTlonAccount({
      channels: {
        tlon: {
          telemetry: {
            apiKey: "phc_base",
          },
          ship: "~zod",
          url: "https://example.com",
          code: "code-123",
        },
      },
    } as OpenClawConfig);

    expect(account.telemetry.enabled).toBe(false);
    expect(account.telemetry.apiKey).toBe("phc_base");
  });
});

describe("resolveTlonAccount allowPrivateNetwork", () => {
  it("reads the canonical nested network.dangerouslyAllowPrivateNetwork", () => {
    const account = resolveTlonAccount({
      channels: {
        tlon: {
          ship: "~zod",
          url: "https://example.com",
          code: "code-123",
          network: { dangerouslyAllowPrivateNetwork: true },
        },
      },
    } as OpenClawConfig);

    expect(account.allowPrivateNetwork).toBe(true);
  });

  it("falls back to the legacy flat allowPrivateNetwork alias", () => {
    const account = resolveTlonAccount({
      channels: {
        tlon: {
          ship: "~zod",
          url: "https://example.com",
          code: "code-123",
          allowPrivateNetwork: true,
        },
      },
    } as OpenClawConfig);

    expect(account.allowPrivateNetwork).toBe(true);
  });

  it("prefers the canonical shape over the legacy alias when both are set", () => {
    const account = resolveTlonAccount({
      channels: {
        tlon: {
          ship: "~zod",
          url: "https://example.com",
          code: "code-123",
          allowPrivateNetwork: false,
          network: { dangerouslyAllowPrivateNetwork: true },
        },
      },
    } as OpenClawConfig);

    expect(account.allowPrivateNetwork).toBe(true);
  });

  it("reads per-account nested network override", () => {
    const account = resolveTlonAccount(
      {
        channels: {
          tlon: {
            accounts: {
              hosted: {
                ship: "~zod",
                url: "https://example.com",
                code: "code-123",
                network: { dangerouslyAllowPrivateNetwork: true },
              },
            },
          },
        },
      } as OpenClawConfig,
      "hosted",
    );

    expect(account.allowPrivateNetwork).toBe(true);
  });

  it("honors a per-account legacy alias even when base is canonical", () => {
    const account = resolveTlonAccount(
      {
        channels: {
          tlon: {
            network: { dangerouslyAllowPrivateNetwork: true },
            accounts: {
              hosted: {
                ship: "~zod",
                url: "https://example.com",
                code: "code-123",
                allowPrivateNetwork: false,
              },
            },
          },
        },
      } as OpenClawConfig,
      "hosted",
    );

    expect(account.allowPrivateNetwork).toBe(false);
  });
});
