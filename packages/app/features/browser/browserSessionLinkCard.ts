import type { BlockData } from '@tloncorp/api/client/postContent';

import { trustedBrowserViewerUrl } from './browserCredentialHandoff';

/** Recognize the rich link card sent by `browser share`, not inline links. */
export function browserSessionLinkCard(
  block: BlockData,
  _surfaceId: string
): BlockData {
  if (
    block.type !== 'link' ||
    block.siteName !== 'Browser session' ||
    block.title !== 'Open browser'
  ) {
    return block;
  }
  try {
    const viewerUrl = trustedBrowserViewerUrl(block.url);
    // Reuse the viewer action and its owner/bot trust gate in ChatMessage.
    return {
      type: 'browser-card',
      card: { type: 'browser-session', version: 1, viewerUrl },
    };
  } catch {
    return block;
  }
}
