import _ from 'lodash';
import { useEffect, useMemo, useState } from 'react';

import * as db from '../../db';
import { getFallbackContact } from '../../db/fallback';

export function useAttachAuthorToPostInserts(posts: db.PostInsert[]) {
  const [postsWithAuthor, setPostsWithAuthor] = useState<
    db.PostInsertWithAuthor[]
  >([]);
  const [authorsCache, setAuthorsCache] = useState<Record<string, db.Contact>>(
    {}
  );
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

  const addAuthorToCache = (author: db.Contact) => {
    if (!authorsCache[author.id]) {
      setAuthorsCache((prev) => ({ ...prev, [author.id]: author }));
    }
  };

  const getMissingAuthors = async (missingAuthors: string[]) => {
    const newContacts = await db.getContactsBatch({
      contactIds: missingAuthors,
    });

    const foundContacts = new Set();
    newContacts.forEach((newContact) => {
      if (newContact) {
        addAuthorToCache(newContact);
        foundContacts.add(newContact.id);
      }
    });

    // even if we don't have a contact for a particular author, we still want to
    // display the search result, so we use a fallback
    missingAuthors.forEach((authorId) => {
      if (!foundContacts.has(authorId)) {
        addAuthorToCache(getFallbackContact(authorId));
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
          authorsCache[post.authorId] && !appendedPostIds.includes(post.id)
      ).length > 0;

    if ((incomplete && shouldUpdate) || maybeReset) {
      setPostsWithAuthor(
        posts
          .filter((post) => authorsCache[post.authorId])
          .map((post) => ({ ...post, author: authorsCache[post.authorId] }))
      );
    }
  }, [posts, authorsCache, postsWithAuthor, missingAuthors, appendedPostIds]);

  return postsWithAuthor;
}
