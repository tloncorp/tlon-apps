import { A2UI } from '@tloncorp/shared/logic';

export function isA2UISendMessageActionConsumed(
  action: A2UI.ButtonAction,
  sentMessageText?: string
): boolean {
  if (action.event.name !== A2UI.action.sendMessage) return false;
  const expected = action.event.context.text.trim();
  // Typed replies intentionally consume only an exact matching action. The
  // coordinator accepts those replies as answers, but reconstructing control
  // state from arbitrary prose is brittle; structured receipts own that job.
  return expected.length > 0 && expected === sentMessageText?.trim();
}
