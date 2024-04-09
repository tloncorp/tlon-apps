import _ from 'lodash';
import { useEffect, useMemo, useState } from 'react';

import * as db from '../../db';
import { getFallbackContact } from '../../db/fallback';

export function useAttachAuthorToPostInserts(posts: db.PostInsert[]) {
  const [postsWithAuthor, setPostsWithAuthor] = useState<
    db.PostInsertWithAuthor[]
  >([]);
  const [authorsCache, setAuthorsCache] = useState<
    Record<string, db.Contact | null>
  >({});
  const missingAuthors = useMemo(
    () =>
      _.uniq(posts.map((post) => post.authorId)).filter(
        (author) => !authorsCache[author]
      ),
    [posts, authorsCache]
  );
  const appendedPostIds = useMemo(
    () => postsWithAuthor.map((post) => post.id),
    [postsWithAuthor]
  );

  const addAuthorToCache = (authorId: string, contact: db.Contact | null) => {
    if (authorsCache[authorId] === undefined) {
      setAuthorsCache((prev) => ({ ...prev, [authorId]: contact }));
    }
  };

  const getMissingAuthors = async (missingAuthors: string[]) => {
    const contactsBatch = await db.getContactsBatch({
      contactIds: missingAuthors,
    });

    const contactsMap = new Map();
    contactsBatch.forEach((contact) => {
      if (contact) {
        contactsMap.set(contact.id, contact); // Assuming each contact has an id
        addAuthorToCache(contact.id, contact);
      }
    });

    // if no contact found, mark them as null so we know we've already looked them up
    missingAuthors.forEach((authorId) => {
      if (!contactsMap.has(authorId)) {
        addAuthorToCache(authorId, null);
      }
    });
  };

  useEffect(() => {
    if (missingAuthors.length > 0) {
      getMissingAuthors(missingAuthors);
    }
  }, [posts, missingAuthors]);

  useEffect(() => {
    const maybeReset = posts.length === 0 && postsWithAuthor.length > 0;
    const incomplete = postsWithAuthor.length < posts.length;
    const shouldUpdate =
      posts.filter(
        (post) =>
          authorsCache[post.authorId] !== undefined &&
          !appendedPostIds.includes(post.id)
      ).length > 0;

    if ((incomplete && shouldUpdate) || maybeReset) {
      const updatedPostsWithAuthor = posts
        .filter((post) => authorsCache[post.authorId] !== undefined)
        .map((post) => ({
          ...post,
          author: authorsCache[post.authorId],
        }));
      setPostsWithAuthor(updatedPostsWithAuthor);
    }
  }, [posts, authorsCache, postsWithAuthor, missingAuthors, appendedPostIds]);

  return postsWithAuthor;
}
