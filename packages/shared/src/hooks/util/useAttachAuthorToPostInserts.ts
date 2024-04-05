import _ from 'lodash';
import { useEffect, useMemo, useState } from 'react';

import * as db from '../../db';

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
    const contactPromises = missingAuthors.map((authorId) =>
      db.getContact({ id: authorId })
    );
    const newContacts = await Promise.all(contactPromises);
    newContacts.forEach((newContact) =>
      newContact ? addAuthorToCache(newContact) : null
    );
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
