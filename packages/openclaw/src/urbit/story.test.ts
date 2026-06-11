import { describe, it, expect } from "vitest";
import { markdownToStory, hasMarkdown } from "./story.js";

describe("markdownToStory", () => {
  describe("ship mentions", () => {
    it("converts plain ship mention", () => {
      const story = markdownToStory("~zod is cool");
      // Should have inline content with ship mention
      expect(story).toHaveLength(1);
      expect(story[0]).toHaveProperty("inline");
      const inlines = (story[0] as { inline: unknown[] }).inline;
      // Find ship in inlines
      const hasShip = inlines.some(
        (i) => typeof i === "object" && i !== null && "ship" in i
      );
      expect(hasShip).toBe(true);
    });

    it("converts ship name wrapped in bold", () => {
      // **~sidwyn-nimnev-nocsyx-lassul/d4parq4f**
      const story = markdownToStory("**~sidwyn-nimnev-nocsyx-lassul/d4parq4f**");
      expect(story).toHaveLength(1);
      expect(story[0]).toHaveProperty("inline");

      const inlines = (story[0] as { inline: unknown[] }).inline;
      expect(inlines).toHaveLength(1);

      // First element should be bold
      const first = inlines[0] as { bold?: unknown[] };
      expect(first).toHaveProperty("bold");
      expect(first.bold).toBeDefined();

      // Bold content should contain ship and path
      const boldContent = first.bold as unknown[];
      const hasShip = boldContent.some(
        (i) => typeof i === "object" && i !== null && "ship" in i
      );
      expect(hasShip).toBe(true);
    });

    it("converts ship name wrapped in italics", () => {
      const story = markdownToStory("*~zod*");
      expect(story).toHaveLength(1);
      expect(story[0]).toHaveProperty("inline");

      const inlines = (story[0] as { inline: unknown[] }).inline;
      expect(inlines).toHaveLength(1);

      const first = inlines[0] as { italics?: unknown[] };
      expect(first).toHaveProperty("italics");
    });

    it("converts ship name in bold with surrounding text", () => {
      const story = markdownToStory("Check out **~sidwyn-nimnev-nocsyx-lassul/d4parq4f** for details.");
      expect(story).toHaveLength(1);
      expect(story[0]).toHaveProperty("inline");

      const inlines = (story[0] as { inline: unknown[] }).inline;
      // Should have: "Check out ", {bold: [ship, /path]}, " for details."
      expect(inlines.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("hasMarkdown", () => {
    it("detects bold formatting", () => {
      expect(hasMarkdown("**bold text**")).toBe(true);
    });

    it("detects double underscore bold", () => {
      expect(hasMarkdown("__bold text__")).toBe(true);
    });

    it("detects strikethrough", () => {
      expect(hasMarkdown("~~strikethrough~~")).toBe(true);
    });

    it("detects code blocks", () => {
      expect(hasMarkdown("```js\ncode\n```")).toBe(true);
    });

    it("detects headers", () => {
      expect(hasMarkdown("# H1")).toBe(true);
      expect(hasMarkdown("## H2")).toBe(true);
    });

    it("detects blockquotes", () => {
      expect(hasMarkdown("> quote")).toBe(true);
    });

    it("returns false for plain text", () => {
      expect(hasMarkdown("plain text")).toBe(false);
    });
  });

  describe("URL linkification", () => {
    it("linkifies a bare URL in plain text", () => {
      const story = markdownToStory("https://example.com/path");

      expect(story).toEqual([
        {
          inline: [
            {
              link: {
                href: "https://example.com/path",
                content: "https://example.com/path",
              },
            },
          ],
        },
      ]);
    });

    it("linkifies a bare URL when preceded by list punctuation", () => {
      const story = markdownToStory("- https://example.com/path");

      expect(story).toEqual([
        {
          inline: [
            "- ",
            {
              link: {
                href: "https://example.com/path",
                content: "https://example.com/path",
              },
            },
          ],
        },
      ]);
    });
  });
});
