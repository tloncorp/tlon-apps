import type { AgentEndEvent } from './agent-hook-types.js';

export function isExplicitSilentReply(text: string | undefined): boolean {
  return text?.trim().toUpperCase() === 'NO_REPLY';
}

// Inspect only the final assistant output; never retain message contents.
export function isSuccessfulSilentAgentOutput(event: AgentEndEvent): boolean {
  if (!event.success || event.error) return false;
  const last = event.messages.at(-1);
  if (!last || typeof last !== 'object') return false;
  const message = last as { role?: unknown; content?: unknown };
  if (message.role !== 'assistant' || !Array.isArray(message.content))
    return false;
  const texts: string[] = [];
  for (const block of message.content) {
    if (!block || typeof block !== 'object') return false;
    if (block.type === 'thinking') continue;
    if (block.type !== 'text' || typeof block.text !== 'string') return false;
    texts.push(block.text);
  }
  return isExplicitSilentReply(texts.join('\n'));
}
