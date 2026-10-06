import type {
  PostBlobDataEntryA2UISelection,
  BrowserTelemetryContext,
} from '@tloncorp/api';
import { trackBrowserLifecycle } from './browserTelemetry';
import * as db from '@tloncorp/shared/db';
import { A2UI, convertContent } from '@tloncorp/shared/logic';

export const BROWSER_HANDOFF_CONTINUATION =
  'Continue the task from the same browser session after the secure form handoff. Check the current page. The handoff does not confirm sign-in or authorize a purchase.';

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
    const continuations = components.filter(
      (component) =>
        component.component === 'Button' &&
        component.action.event.name === A2UI.action.sendMessage
    );
    const continuation =
      continuations.length === 1 ? continuations[0] : undefined;
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

export function getBrowserHandoffTelemetry(
  post: Pick<db.Post, 'id' | 'blob'>,
  selection: PostBlobDataEntryA2UISelection
): BrowserTelemetryContext | undefined {
  if (selection.sourcePostId !== post.id) return undefined;
  for (const block of convertContent(undefined, post.blob ?? undefined)) {
    if (
      block.type !== 'a2ui' ||
      A2UI.getCreateMessage(block.a2ui)?.createSurface.surfaceId !==
        selection.surfaceId
    )
      continue;
    for (const component of A2UI.getUpdateMessage(block.a2ui)?.updateComponents
      .components ?? []) {
      if (
        component.component !== 'Button' ||
        component.action.event.name !== A2UI.action.navigate
      )
        continue;
      const target = component.action.event.context.target;
      if (
        target.type !== 'screen' ||
        target.screen !== 'browserCredentialHandoff'
      )
        continue;
      const continuation = getBrowserHandoffContinuationSelection(
        post,
        target.viewerUrl
      );
      if (
        continuation?.surfaceId === selection.surfaceId &&
        continuation.componentId === selection.componentId
      )
        return target.telemetry;
    }
  }
}

const pendingContinuations = new Map<string, Promise<void>>();

export function isBrowserHandoffContinuationSelection(
  post: Pick<db.Post, 'id' | 'blob'>,
  selection: PostBlobDataEntryA2UISelection
): boolean {
  if (selection.sourcePostId !== post.id) return false;
  for (const block of convertContent(undefined, post.blob ?? undefined)) {
    if (block.type !== 'a2ui') continue;
    const components =
      A2UI.getUpdateMessage(block.a2ui)?.updateComponents.components ?? [];
    for (const component of components) {
      if (
        component.component !== 'Button' ||
        component.action.event.name !== A2UI.action.navigate
      )
        continue;
      const target = component.action.event.context.target;
      if (
        target.type !== 'screen' ||
        target.screen !== 'browserCredentialHandoff'
      )
        continue;
      const continuation = getBrowserHandoffContinuationSelection(
        post,
        target.viewerUrl
      );
      if (
        continuation?.surfaceId === selection.surfaceId &&
        continuation.componentId === selection.componentId
      )
        return true;
    }
  }
  return false;
}

export async function sendBrowserHandoffContinuation({
  channelId,
  authorId,
  selection,
  telemetry,
  send,
}: {
  channelId: string;
  authorId: string;
  selection: PostBlobDataEntryA2UISelection;
  telemetry?: BrowserTelemetryContext;
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
    const startedAt = Date.now();
    trackBrowserLifecycle({
      ...telemetry,
      source: 'client',
      phase: 'continuation_requested',
      outcome: 'unknown',
    });
    try {
      await send();
      // sendPostFromDraft acknowledges the local queue, not agent receipt.
      trackBrowserLifecycle({
        ...telemetry,
        source: 'client',
        phase: 'continuation_queued',
        outcome: 'accepted',
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      trackBrowserLifecycle({
        ...telemetry,
        source: 'client',
        phase: 'continuation_failed',
        outcome: 'failed',
        reason: 'delivery_failed',
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  })();
  pendingContinuations.set(key, continuation);
  try {
    await continuation;
  } finally {
    pendingContinuations.delete(key);
  }
}
