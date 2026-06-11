import { describe, expect, it } from "vitest";
import { canonicalizeNest } from "./targets.js";

describe("canonicalizeNest", () => {
  it("returns canonical form unchanged", () => {
    expect(canonicalizeNest("chat/~zod/general")).toBe("chat/~zod/general");
    expect(canonicalizeNest("heap/~bus/links")).toBe("heap/~bus/links");
    expect(canonicalizeNest("diary/~zod/notes")).toBe("diary/~zod/notes");
  });

  it("adds missing ~ on host ship", () => {
    expect(canonicalizeNest("chat/zod/general")).toBe("chat/~zod/general");
    expect(canonicalizeNest("heap/sampel-palnet/links")).toBe("heap/~sampel-palnet/links");
  });

  it("lowercases the nest prefix", () => {
    expect(canonicalizeNest("CHAT/~zod/general")).toBe("chat/~zod/general");
    expect(canonicalizeNest("Heap/~zod/links")).toBe("heap/~zod/links");
  });

  it("lowercases the host ship (Urbit @p is always lowercase)", () => {
    expect(canonicalizeNest("chat/~ZOD/general")).toBe("chat/~zod/general");
    expect(canonicalizeNest("chat/ZOD/general")).toBe("chat/~zod/general");
    expect(canonicalizeNest("chat/~Sampel-Palnet/foo")).toBe("chat/~sampel-palnet/foo");
  });

  it("preserves channel-name case", () => {
    expect(canonicalizeNest("chat/~zod/General")).toBe("chat/~zod/General");
    expect(canonicalizeNest("chat/~zod/q6QH2RoI")).toBe("chat/~zod/q6QH2RoI");
  });

  it("trims surrounding whitespace", () => {
    expect(canonicalizeNest("  chat/~zod/general  ")).toBe("chat/~zod/general");
  });

  it("returns null for invalid inputs", () => {
    expect(canonicalizeNest("")).toBeNull();
    expect(canonicalizeNest("not-a-nest")).toBeNull();
    expect(canonicalizeNest("chat/~zod")).toBeNull();
    expect(canonicalizeNest("chat/~zod/general/extra")).toBeNull();
    expect(canonicalizeNest("foo/~zod/general")).toBeNull(); // unsupported prefix
  });
});
