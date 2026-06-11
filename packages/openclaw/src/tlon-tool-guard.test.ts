import { describe, expect, it } from "vitest";
import { checkBlockedSendOperation } from "./tlon-tool-guard.js";

describe("tlon tool guard", () => {
  describe("blocks non-club dms send/reply", () => {
    it("blocks dms send with a ship target", () => {
      const result = checkBlockedSendOperation(["dms", "send", "~zod", "hello"]);
      expect(result).toContain("message");
      expect(result).toContain("Blocked");
      expect(result).toContain("target=~zod");
    });

    it("dms send redirect does NOT mention replyTo", () => {
      const result = checkBlockedSendOperation(["dms", "send", "~zod", "hello"]);
      expect(result).not.toContain("replyTo");
    });

    it("blocks dms reply with a ship target", () => {
      const result = checkBlockedSendOperation([
        "dms", "reply", "~sampel-palnet", "170.141.184.507", "reply text",
      ]);
      expect(result).toContain("message");
      expect(result).toContain("Blocked");
      expect(result).toContain("target=~sampel-palnet");
    });

    it("dms reply redirect includes replyTo with the messageId", () => {
      const result = checkBlockedSendOperation([
        "dms", "reply", "~sampel-palnet", "170.141.184.507", "reply text",
      ]);
      expect(result).toContain("replyTo=170.141.184.507");
    });
  });

  describe("allows legacy club targets", () => {
    it("allows dms send with a club ID", () => {
      const result = checkBlockedSendOperation([
        "dms", "send", "0v4.00000.fake1", "hello",
      ]);
      expect(result).toBeNull();
    });

    it("allows dms reply with a club ID", () => {
      const result = checkBlockedSendOperation([
        "dms", "reply", "0v4.00000.fake1", "170.141.184.507", "reply text",
      ]);
      expect(result).toBeNull();
    });
  });

  describe("allows non-send dms operations", () => {
    it("allows dms react", () => {
      expect(
        checkBlockedSendOperation(["dms", "react", "~zod", "170.141.184.507", "👍"]),
      ).toBeNull();
    });

    it("allows dms accept", () => {
      expect(checkBlockedSendOperation(["dms", "accept", "~zod"])).toBeNull();
    });

    it("allows dms decline", () => {
      expect(checkBlockedSendOperation(["dms", "decline", "~zod"])).toBeNull();
    });

    it("allows dms unreact", () => {
      expect(
        checkBlockedSendOperation(["dms", "unreact", "~zod", "170.141.184.507"]),
      ).toBeNull();
    });

    it("allows dms delete", () => {
      expect(
        checkBlockedSendOperation(["dms", "delete", "~zod", "170.141.184.507"]),
      ).toBeNull();
    });
  });

  describe("allows other subcommands", () => {
    it("allows notebook", () => {
      expect(
        checkBlockedSendOperation(["notebook", "diary/~host/slug", "Title"]),
      ).toBeNull();
    });

    it("allows posts react", () => {
      expect(
        checkBlockedSendOperation(["posts", "react", "chat/~host/slug", "170.141", "👍"]),
      ).toBeNull();
    });

    it("allows channels groups", () => {
      expect(checkBlockedSendOperation(["channels", "groups"])).toBeNull();
    });

    it("allows upload", () => {
      expect(
        checkBlockedSendOperation(["upload", "https://example.com/img.png"]),
      ).toBeNull();
    });

    it("allows activity mentions", () => {
      expect(
        checkBlockedSendOperation(["activity", "mentions", "--limit", "10"]),
      ).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("allows empty args", () => {
      expect(checkBlockedSendOperation([])).toBeNull();
    });

    it("allows single arg", () => {
      expect(checkBlockedSendOperation(["dms"])).toBeNull();
    });

    it("allows dms send with no target", () => {
      expect(checkBlockedSendOperation(["dms", "send"])).toBeNull();
    });
  });
});
