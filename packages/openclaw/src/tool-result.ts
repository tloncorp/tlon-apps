/**
 * A tool result whose text the model reads either way it calls the tool. A
 * direct call reads `content`; an OpenClaw Code Mode script receives only
 * `details`, so the text rides in both.
 */
export function textToolResult<D extends Record<string, unknown>>(
  text: string,
  details?: D
) {
  return {
    content: [{ type: 'text' as const, text }],
    details: { ...(details as D), text },
  };
}
