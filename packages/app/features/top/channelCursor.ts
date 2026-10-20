import { isThirdPartyChannel } from '@tloncorp/api/urbit';

// Third-party channels (Notes) ride their own target through selectedPostId;
// it is not a %channels post and must not become a post cursor.
export function postCursorFor(
  channelId: string,
  selectedPostId: string | null | undefined,
  unreadCursor: string | null | undefined
): string | undefined {
  if (isThirdPartyChannel(channelId)) {
    return undefined;
  }
  return selectedPostId || unreadCursor || undefined;
}
