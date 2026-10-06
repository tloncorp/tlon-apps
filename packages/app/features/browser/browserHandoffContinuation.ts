import type { PostBlobDataEntryA2UISelection } from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import { A2UI, convertContent } from '@tloncorp/shared/logic';

export const BROWSER_HANDOFF_CONTINUATION =
  'I signed in; continue the browser task.';

export function getBrowserHandoffContinuationSelection(
  post: Pick<db.Post, 'id' | 'blob'>,
  viewerUrl: string
): PostBlobDataEntryA2UISelection | undefined {
  for (const block of convertContent(undefined, post.blob ?? undefined)) {
    if (block.type !== 'a2ui') continue;
    const components =
      A2UI.getUpdateMessage(block.a2ui)?.updateComponents.components ?? [];
    const login = components.find((component) => {
      if (
        component.component !== 'Button' ||
        component.action.event.name !== A2UI.action.navigate
      )
        return false;
      const target = component.action.event.context.target;
      return (
        target.type === 'screen' &&
        target.screen === 'browserCredentialHandoff' &&
        target.viewerUrl === viewerUrl
      );
    });
    if (!login) continue;
    const continuation = components.find(
      (component) =>
        component.component === 'Button' &&
        component.action.event.name === A2UI.action.sendMessage &&
        component.action.event.context.text.trim() ===
          BROWSER_HANDOFF_CONTINUATION
    );
    return {
      type: 'tlon-a2ui-selection',
      version: 1,
      sourcePostId: post.id,
      surfaceId:
        A2UI.getCreateMessage(block.a2ui)?.createSurface.surfaceId ??
        'unknown-surface',
      componentId: continuation?.id ?? login.id,
      values: [BROWSER_HANDOFF_CONTINUATION],
    };
  }
}

const pendingContinuations = new Map<string, Promise<void>>();

export async function sendBrowserHandoffContinuation({
  channelId,
  authorId,
  selection,
  send,
}: {
  channelId: string;
  authorId: string;
  selection: PostBlobDataEntryA2UISelection;
  send: () => Promise<void>;
}): Promise<void> {
  const key = JSON.stringify([
    channelId,
    authorId,
    selection.sourcePostId,
    selection.surfaceId,
    selection.componentId,
  ]);
  const pending = pendingContinuations.get(key);
  if (pending) return pending;
  const continuation = (async () => {
    // Read at action time: the modal can outlive the message render, and a
    // receipt can arrive from another device while the login form is open.
    const receipts = await db.getA2UISelections({ channelId, authorId });
    if (
      receipts.some(
        (receipt) =>
          receipt.sourcePostId === selection.sourcePostId &&
          receipt.surfaceId === selection.surfaceId &&
          receipt.componentId === selection.componentId
      )
    )
      return;
    await send();
  })();
  pendingContinuations.set(key, continuation);
  try {
    await continuation;
  } finally {
    pendingContinuations.delete(key);
  }
}
