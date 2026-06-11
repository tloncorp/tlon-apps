import { describe, expect, it } from "vitest";
import {
  type DisplayContext,
  type PendingApproval,
  generateApprovalId,
  createPendingApproval,
  findPendingApproval,
  formatApprovalRequest,
  formatApprovalConfirmation,
  formatBlockedList,
  formatPendingList,
  removePendingApproval,
  hasDuplicatePending,
  isExpired,
  APPROVAL_TTL_MS,
  emojiToApprovalAction,
  normalizeNotificationId,
} from "./approval.js";

// ---------------------------------------------------------------------------
// Short ID Generation
// ---------------------------------------------------------------------------

describe("generateApprovalId", () => {
  it("generates IDs with type prefix", () => {
    expect(generateApprovalId("dm")).toMatch(/^d[0-9a-f]{4}$/);
    expect(generateApprovalId("channel")).toMatch(/^c[0-9a-f]{4}$/);
    expect(generateApprovalId("group")).toMatch(/^g[0-9a-f]{4}$/);
  });

  it("avoids collisions with existing IDs", () => {
    const existing: string[] = [];
    for (let i = 0; i < 20; i++) {
      const id = generateApprovalId("dm", existing);
      expect(existing).not.toContain(id);
      existing.push(id);
    }
  });
});

describe("createPendingApproval", () => {
  it("passes existing IDs for collision avoidance", () => {
    const first = createPendingApproval({ type: "dm", requestingShip: "~zod" });
    const second = createPendingApproval(
      { type: "dm", requestingShip: "~bus" },
      [first.id],
    );
    expect(second.id).not.toBe(first.id);
  });

  it("stores groupTitle when provided", () => {
    const approval = createPendingApproval({
      type: "group",
      requestingShip: "~zod",
      groupFlag: "~host/my-group",
      groupTitle: "My Cool Group",
    });
    expect(approval.groupTitle).toBe("My Cool Group");
  });
});

// ---------------------------------------------------------------------------
// Approval Expiration
// ---------------------------------------------------------------------------

describe("isExpired", () => {
  it("returns false for fresh approvals", () => {
    const approval: PendingApproval = {
      id: "da1b2", type: "dm", requestingShip: "~zod", timestamp: Date.now(),
    };
    expect(isExpired(approval)).toBe(false);
  });

  it("returns true for approvals older than TTL", () => {
    const approval: PendingApproval = {
      id: "da1b2", type: "dm", requestingShip: "~zod",
      timestamp: Date.now() - APPROVAL_TTL_MS - 1,
    };
    expect(isExpired(approval)).toBe(true);
  });

  it("returns false for approvals at exactly TTL boundary", () => {
    const approval: PendingApproval = {
      id: "da1b2", type: "dm", requestingShip: "~zod",
      timestamp: Date.now() - APPROVAL_TTL_MS + 1000,
    };
    expect(isExpired(approval)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// findPendingApproval
// ---------------------------------------------------------------------------

describe("findPendingApproval", () => {
  const approvals: PendingApproval[] = [
    { id: "da1b2", type: "dm", requestingShip: "~zod", timestamp: Date.now() },
    { id: "cc3d4", type: "channel", requestingShip: "~bus", channelNest: "chat/~host/general", timestamp: Date.now() },
  ];

  it("finds by exact match", () => {
    expect(findPendingApproval(approvals, "da1b2")?.id).toBe("da1b2");
    expect(findPendingApproval(approvals, "cc3d4")?.id).toBe("cc3d4");
  });

  it("finds by prefix match when unambiguous", () => {
    expect(findPendingApproval(approvals, "d")?.id).toBe("da1b2");
    expect(findPendingApproval(approvals, "c")?.id).toBe("cc3d4");
  });

  it("returns undefined for ambiguous prefix", () => {
    const dupes: PendingApproval[] = [
      { id: "da1b2", type: "dm", requestingShip: "~zod", timestamp: Date.now() },
      { id: "da1b3", type: "dm", requestingShip: "~bus", timestamp: Date.now() },
    ];
    expect(findPendingApproval(dupes, "da1b")).toBeUndefined();
  });

  it("returns most recent when no ID given", () => {
    expect(findPendingApproval(approvals)?.id).toBe("cc3d4");
  });

  it("returns undefined for empty list", () => {
    expect(findPendingApproval([])).toBeUndefined();
    expect(findPendingApproval([], "da1b2")).toBeUndefined();
  });

  it("matches old-format long IDs", () => {
    const old: PendingApproval[] = [
      { id: "dm-1234567890-abc12345", type: "dm", requestingShip: "~zod", timestamp: Date.now() },
    ];
    expect(findPendingApproval(old, "dm-1234567890-abc12345")?.id).toBe("dm-1234567890-abc12345");
  });

  it("skips expired approvals", () => {
    const mixed: PendingApproval[] = [
      { id: "da1b2", type: "dm", requestingShip: "~zod", timestamp: Date.now() - APPROVAL_TTL_MS - 1 },
      { id: "cc3d4", type: "channel", requestingShip: "~bus", timestamp: Date.now() },
    ];
    expect(findPendingApproval(mixed, "da1b2")).toBeUndefined();
    expect(findPendingApproval(mixed, "cc3d4")?.id).toBe("cc3d4");
  });
});

// ---------------------------------------------------------------------------
// Display Context Formatting
// ---------------------------------------------------------------------------

const ctx: DisplayContext = {
  channelNames: new Map([["chat/~host/general", "general"]]),
  groupNames: new Map([["~host/cool-group", "Cool Group"]]),
};

describe("formatApprovalRequest", () => {
  it("DM request shows ship, reaction hints, and slash command hints", () => {
    const approval = createPendingApproval({
      type: "dm",
      requestingShip: "~sampel-palnet",
      messagePreview: "Hello there",
    });
    const text = formatApprovalRequest(approval, ctx);
    expect(text).toContain("~sampel-palnet");
    expect(text).toContain('"Hello there"');
    expect(text).toContain("React to this message: 👍 approve · 👎 deny · 🛑 block");
    expect(text).toContain("Or use a slash command:");
    expect(text).toContain(`/allow ${approval.id}`);
    expect(text).toContain(`/reject ${approval.id}`);
    expect(text).toContain(`/ban ${approval.id}`);
  });

  it("channel request shows channel name and ship", () => {
    const approval = createPendingApproval({
      type: "channel",
      requestingShip: "~sampel-palnet",
      channelNest: "chat/~host/general",
      messagePreview: "Hey @bot",
    });
    const text = formatApprovalRequest(approval, ctx);
    expect(text).toContain("~sampel-palnet");
    expect(text).toContain("general (chat/~host/general)");
    expect(text).toContain(`/allow ${approval.id}`);
  });

  it("group request shows group title", () => {
    const approval = createPendingApproval({
      type: "group",
      requestingShip: "~sampel-palnet",
      groupFlag: "~host/cool-group",
    });
    const text = formatApprovalRequest(approval, ctx);
    expect(text).toContain("Cool Group (~host/cool-group)");
    expect(text).toContain(`/allow ${approval.id}`);
  });

  it("group request uses groupTitle field over context", () => {
    const approval = createPendingApproval({
      type: "group",
      requestingShip: "~zod",
      groupFlag: "~host/other-group",
      groupTitle: "Other Title",
    });
    const text = formatApprovalRequest(approval, ctx);
    expect(text).toContain("Other Title (~host/other-group)");
  });

  it("works without context", () => {
    const approval = createPendingApproval({
      type: "dm",
      requestingShip: "~zod",
    });
    const text = formatApprovalRequest(approval);
    expect(text).toContain("~zod");
  });
});

describe("formatApprovalConfirmation", () => {
  it("shows ship in confirmation", () => {
    const approval: PendingApproval = {
      id: "da1b2", type: "dm", requestingShip: "~sampel-palnet", timestamp: 1,
    };
    expect(formatApprovalConfirmation(approval, "approve", ctx)).toContain("~sampel-palnet");
    expect(formatApprovalConfirmation(approval, "deny", ctx)).toContain("~sampel-palnet");
    expect(formatApprovalConfirmation(approval, "block", ctx)).toContain("~sampel-palnet");
  });

  it("channel confirmation shows channel name", () => {
    const approval: PendingApproval = {
      id: "cc3d4", type: "channel", requestingShip: "~zod",
      channelNest: "chat/~host/general", timestamp: 1,
    };
    expect(formatApprovalConfirmation(approval, "approve", ctx)).toContain("general (chat/~host/general)");
  });

  it("group confirmation shows group name", () => {
    const approval: PendingApproval = {
      id: "g5f6e", type: "group", requestingShip: "~zod",
      groupFlag: "~host/cool-group", timestamp: 1,
    };
    expect(formatApprovalConfirmation(approval, "approve", ctx)).toContain("Cool Group (~host/cool-group)");
  });

  it("works without context", () => {
    const approval: PendingApproval = {
      id: "da1b2", type: "dm", requestingShip: "~zod", timestamp: 1,
    };
    const text = formatApprovalConfirmation(approval, "approve");
    expect(text).toContain("~zod");
  });
});

// ---------------------------------------------------------------------------
// Blocked & Pending List Formatting
// ---------------------------------------------------------------------------

describe("formatBlockedList", () => {
  it("shows empty state", () => {
    expect(formatBlockedList([])).toBe("No ships are currently blocked.");
  });

  it("shows ships", () => {
    const text = formatBlockedList(["~sampel-palnet", "~zod"]);
    expect(text).toContain("~sampel-palnet");
    expect(text).toContain("~zod");
    expect(text).toContain("Blocked ships (2):");
    expect(text).toContain("`/unban ~ship-name`");
  });
});

describe("formatPendingList", () => {
  it("shows empty state", () => {
    expect(formatPendingList([])).toBe("No pending approval requests.");
  });

  it("shows short IDs with # prefix", () => {
    const approvals: PendingApproval[] = [
      { id: "da1b2", type: "dm", requestingShip: "~zod", timestamp: Date.now() },
    ];
    const text = formatPendingList(approvals);
    expect(text).toContain("#da1b2");
  });

  it("shows message previews", () => {
    const approvals: PendingApproval[] = [
      { id: "da1b2", type: "dm", requestingShip: "~zod", messagePreview: "Hello there", timestamp: Date.now() },
    ];
    const text = formatPendingList(approvals);
    expect(text).toContain('"Hello there"');
  });

  it("shows ship in pending list", () => {
    const approvals: PendingApproval[] = [
      { id: "da1b2", type: "dm", requestingShip: "~zod", timestamp: Date.now() },
    ];
    const text = formatPendingList(approvals, ctx);
    expect(text).toContain("~zod");
  });

  it("shows channel names for channel approvals", () => {
    const approvals: PendingApproval[] = [
      { id: "cc3d4", type: "channel", requestingShip: "~zod", channelNest: "chat/~host/general", timestamp: Date.now() },
    ];
    const text = formatPendingList(approvals, ctx);
    expect(text).toContain("general (chat/~host/general)");
  });

  it("shows group names for group approvals", () => {
    const approvals: PendingApproval[] = [
      { id: "g5f6e", type: "group", requestingShip: "~zod", groupFlag: "~host/cool-group", timestamp: Date.now() },
    ];
    const text = formatPendingList(approvals, ctx);
    expect(text).toContain("Cool Group (~host/cool-group)");
  });

  it("includes slash command usage hint", () => {
    const approvals: PendingApproval[] = [
      { id: "da1b2", type: "dm", requestingShip: "~zod", timestamp: Date.now() },
    ];
    const text = formatPendingList(approvals);
    expect(text).toContain("/allow");
    expect(text).toContain("/reject");
    expect(text).toContain("/ban");
  });

  it("filters out expired approvals", () => {
    const approvals: PendingApproval[] = [
      { id: "da1b2", type: "dm", requestingShip: "~zod", timestamp: Date.now() - APPROVAL_TTL_MS - 1 },
    ];
    const text = formatPendingList(approvals);
    expect(text).toBe("No pending approval requests.");
  });
});

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

describe("removePendingApproval", () => {
  it("removes by ID", () => {
    const approvals: PendingApproval[] = [
      { id: "da1b2", type: "dm", requestingShip: "~zod", timestamp: 1 },
      { id: "cc3d4", type: "channel", requestingShip: "~bus", timestamp: 2 },
    ];
    const result = removePendingApproval(approvals, "da1b2");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("cc3d4");
  });
});

// ---------------------------------------------------------------------------
// Emoji Reaction Mapping
// ---------------------------------------------------------------------------

describe("emojiToApprovalAction", () => {
  it("maps thumbs up to approve", () => {
    expect(emojiToApprovalAction("👍")).toBe("approve");
  });

  it("maps thumbs down to deny", () => {
    expect(emojiToApprovalAction("👎")).toBe("deny");
  });

  it("maps stop sign to block", () => {
    expect(emojiToApprovalAction("🛑")).toBe("block");
  });

  it("returns undefined for unrecognized emoji", () => {
    expect(emojiToApprovalAction("❤️")).toBeUndefined();
    expect(emojiToApprovalAction("🎉")).toBeUndefined();
    expect(emojiToApprovalAction("")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Notification ID Normalization
// ---------------------------------------------------------------------------

describe("normalizeNotificationId", () => {
  it("strips ship prefix and dots", () => {
    expect(normalizeNotificationId("~zod/170.141.184.507")).toBe("170141184507");
  });

  it("strips dots from bare IDs (no ship prefix)", () => {
    expect(normalizeNotificationId("170.141.184.507")).toBe("170141184507");
  });

  it("handles IDs without dots", () => {
    expect(normalizeNotificationId("170141184507")).toBe("170141184507");
  });

  it("handles full writ-id format", () => {
    expect(normalizeNotificationId("~sampel-palnet/170.141.184.507.799")).toBe("170141184507799");
  });
});

describe("hasDuplicatePending", () => {
  const approvals: PendingApproval[] = [
    { id: "da1b2", type: "dm", requestingShip: "~zod", timestamp: 1 },
    { id: "cc3d4", type: "channel", requestingShip: "~bus", channelNest: "chat/~host/general", timestamp: 2 },
  ];

  it("detects DM duplicates", () => {
    expect(hasDuplicatePending(approvals, "dm", "~zod")).toBe(true);
    expect(hasDuplicatePending(approvals, "dm", "~bus")).toBe(false);
  });

  it("detects channel duplicates by nest", () => {
    expect(hasDuplicatePending(approvals, "channel", "~bus", "chat/~host/general")).toBe(true);
    expect(hasDuplicatePending(approvals, "channel", "~bus", "chat/~host/other")).toBe(false);
  });
});
