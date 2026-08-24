import { A2UI } from '@tloncorp/shared/logic';

import type { A2UIReplyTextIndex } from '../../contexts/componentsKits';

/**
 * A later owner message only consumes the action that produced that exact
 * text. Treating every send-message action as consumed makes a remounted
 * Choice select its first option regardless of what the owner chose.
 */
export function isA2UISendMessageActionConsumed(
  action: A2UI.ButtonAction,
  sentMessageText?: string,
  sentMessageTextIndex?: A2UIReplyTextIndex
): boolean {
  if (action.event.name !== A2UI.action.sendMessage) return false;
  const expected = action.event.context.text.trim();
  const exactReplyIndex = sentMessageTextIndex?.lastIndexByText.get(expected);
  const exactReplyFound =
    exactReplyIndex !== undefined &&
    exactReplyIndex >= (sentMessageTextIndex?.start ?? 0);
  return (
    expected.length > 0 &&
    (expected === sentMessageText?.trim() || exactReplyFound)
  );
}
