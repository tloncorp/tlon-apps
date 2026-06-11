import { describe, expect, it, vi } from "vitest";

import { resolveTlonBinary } from "./tlon-binary.js";

describe("resolveTlonBinary", () => {
  it("prefers the tlon-skill package bin resolved from module resolution", () => {
    const exists = vi.fn((path: string) => path === "/repo/node_modules/@tloncorp/tlon-skill/bin/tlon.js");
    const resolveModule = vi.fn(() => "/repo/node_modules/@tloncorp/tlon-skill/package.json");
    const readFile = vi.fn(
      () =>
        JSON.stringify({
          bin: {
            tlon: "./bin/tlon.js",
          },
        }),
    );

    const binary = resolveTlonBinary({
      moduleDir: "/repo/dist",
      resolveModule,
      exists,
      readFile,
      log: () => {},
    });

    expect(binary).toBe("/repo/node_modules/@tloncorp/tlon-skill/bin/tlon.js");
  });

  it("falls back to the plugin package root node_modules bin when resolution fails", () => {
    const exists = vi.fn(
      (path: string) =>
        path === "/repo/package.json" || path === "/repo/node_modules/.bin/tlon",
    );
    const resolveModule = vi.fn(() => {
      throw new Error("not found");
    });

    const binary = resolveTlonBinary({
      moduleDir: "/repo/dist",
      resolveModule,
      exists,
      log: () => {},
    });

    expect(binary).toBe("/repo/node_modules/.bin/tlon");
  });

  it("falls back to PATH when no local candidate exists", () => {
    const exists = vi.fn(() => false);
    const resolveModule = vi.fn(() => {
      throw new Error("not found");
    });

    const binary = resolveTlonBinary({
      moduleDir: "/repo/dist",
      resolveModule,
      exists,
      log: () => {},
    });

    expect(binary).toBe("tlon");
  });
});
