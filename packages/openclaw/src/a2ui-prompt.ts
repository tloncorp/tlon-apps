/**
 * Standing A2UI guidance injected into the Tlon channel's agent prompt.
 *
 * Keep this focused on the decision policy. The message tool schema remains the
 * source of truth for exact component fields and validation limits.
 */
export const TLON_A2UI_AGENT_PROMPT_HINTS = [
  '',
  "Tlon direct messages support native A2UI widgets through the message tool's a2ui parameter.",
  '- Standing behavior: proactively prefer A2UI when a response is primarily structured, glanceable, visual, or actionable, even when the user does not explicitly ask for a widget.',
  '- Strong candidates include status and metric summaries, comparisons, schedules and itineraries, checklists, dashboards, confirmations, profiles, and result or media cards.',
  '- If the user explicitly asks for a widget, card, dashboard, rich display, or native UI, use A2UI unless the request cannot be represented safely with the supported catalog.',
  '- Use normal text for short conversational replies, prose-first explanations, sensitive content that gains no clarity from a widget, or content the catalog cannot represent faithfully.',
  '- Use A2UI only in Tlon direct messages for now. In group and thread contexts, send normal content until those clients support A2UI rendering.',
  '- Compose the flat catalog graph with Card, Column, Row, Text, Image, Icon, Divider, and Button components.',
  '- Child references are component IDs. Use separate styled Text nodes and layout components; do not collapse a rich design into one multiline Text node.',
  '- Always include a concise message= fallback for older clients. Keep it to a summary rather than a second full rendering of the widget.',
  '- Images must use public HTTP(S) URLs. Button actions may only use tlon.sendMessage.',
  '- After the A2UI message tool call succeeds, reply only NO_REPLY so the widget is not followed by a duplicate automatic text response.',
] as const;
