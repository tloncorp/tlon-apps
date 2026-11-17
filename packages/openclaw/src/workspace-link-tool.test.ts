import { describe, expect, it, vi } from "vitest";

import {
  createWorkspaceLinkToolExecutor,
  normalizeWorkspaceGroupId,
} from "./workspace-link-tool.js";

function setup(groups = ["~ten/japan-trip"]) {
  const postText = vi.fn(async () => undefined);
  const execute = createWorkspaceLinkToolExecutor({
    ownerShip: () => "~ten",
    groupIds: async () => groups,
    postText,
  });
  return { execute, postText };
}

describe('tlon_workspace_link', () => {
  it("posts the line and the group's reference to the owner", async () => {
    const { execute, postText } = setup();
    const result = await execute("call", {
      groupId: "~ten/japan-trip",
      line: "This fits in your Japan Trip April workspace:",
    });
    expect(postText).toHaveBeenCalledWith(
      "~ten",
      "This fits in your Japan Trip April workspace:\n/1/group/~ten/japan-trip",
    );
    expect(result.details).toBeUndefined();
    expect(result.content[0].text).toContain("answer the owner");
  });

  it("accepts the Ref path in place of the ID", () => {
    expect(normalizeWorkspaceGroupId("/1/group/~ten/japan-trip")).toBe(
      "~ten/japan-trip",
    );
    expect(normalizeWorkspaceGroupId("Japan Trip April")).toBeNull();
  });

  it("refuses a group the bot is not in", async () => {
    const { execute, postText } = setup([]);
    const result = await execute("call", {
      groupId: "~ten/japan-trip",
      line: "Your trip workspace:",
    });
    expect(postText).not.toHaveBeenCalled();
    expect(result.details).toEqual({ error: true });
    expect(result.content[0].text).toContain("not one of your groups");
  });

  it("refuses a missing line", async () => {
    const { execute, postText } = setup();
    const result = await execute("call", { groupId: "~ten/japan-trip" });
    expect(postText).not.toHaveBeenCalled();
    expect(result.details).toEqual({ error: true });
  });
});
