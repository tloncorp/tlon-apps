/**
 * Canonical re-engagement nudge messages, keyed by stage.
 *
 * Moved from the LLM-owned prompt (`tlonbot/prompts/HEARTBEAT.md`) into the
 * plugin so the plugin is the single source of truth for nudge content.
 */

export type NudgeStage = 1 | 2 | 3;

export const NUDGE_MESSAGES: Record<NudgeStage, string> = {
  1:
    "Hey! Quick ideas for your week:\n" +
    '• "Make me a group about cooking" — I\'ll set it up, then give you a link to invite your friends\n' +
    '• "Tell me the weather every morning at 8am"\n' +
    '• "Send me a daily digest with breaking news about AI"\n\n' +
    "Just reply with any of these or ask me anything 🌱",
  2:
    "A few things I can do for you:\n" +
    "• Create a group — tell me what you're into and I'll set it up. Invite your friends and get a conversation going.\n" +
    '• Run recurring jobs — "track AAPL and tell me if it moves more than 5%", "summarize the news every morning", "help me track my meals"\n' +
    "• Watch a channel and ping you when something important comes up\n\n" +
    "What sounds useful?",
  3:
    "Still here! Here's what I can do:\n\n" +
    "**Groups** — I'll create groups for you, help brainstorm ideas, and manage permissions. Invite your friends and hang out.\n" +
    "**Recurring jobs** — daily weather, news alerts, meal tracking, stock tracking, scheduled reminders — just tell me what and when.\n" +
    "**Catch up** — summarize threads, watch channels for keywords\n" +
    "**Research** — web search, fact-check, find recipes/flights/etc.\n\n" +
    "Just say the word 🌱",
};
