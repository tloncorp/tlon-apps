import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useMemo, useState } from 'react';

/**
 * Hook to check if a post author is blocked and manage the "show anyway" state.
 *
 * @param post - The post to check
 * @returns Object containing:
 *   - isAuthorBlocked: boolean indicating if the author is in the blocked list
 *   - showBlockedContent: boolean indicating if the user has chosen to reveal the content
 *   - handleShowAnyway: function to call when user clicks "Show anyway"
 */
export function useBlockedAuthor(post: db.Post) {
  const [showBlockedContent, setShowBlockedContent] = useState(false);
  const { data: blockedContacts } = store.useBlockedContacts();

  const isAuthorBlocked = useMemo(() => {
    if (!blockedContacts || !post.authorId) {
      return false;
    }
    return blockedContacts.some((contact) => contact.id === post.authorId);
  }, [blockedContacts, post.authorId]);

  const handleShowAnyway = () => {
    setShowBlockedContent(true);
  };

  return {
    isAuthorBlocked,
    showBlockedContent,
    handleShowAnyway,
  };
}
