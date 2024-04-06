import { QueryClient } from '@tanstack/react-query';
import {
  CacheId,
  PostEssay,
  Replies,
  Reply,
  ReplyMeta,
  ReplyTuple,
} from '@tloncorp/shared/dist/urbit/channel';
import {
  Club,
  DMUnreads,
  PagedWrits,
  ReplyDelta,
  Writ,
  WritDeltaAdd,
  WritInCache,
  WritMemo,
  WritSeal,
} from '@tloncorp/shared/dist/urbit/dms';
import { udToDec } from '@urbit/api';
import { formatUd, unixToDa } from '@urbit/aura';
import bigInt from 'big-integer';
import _ from 'lodash';

export default function emptyMultiDm(): Club {
  return {
    hive: [],
    team: [],
    meta: {
      title: '',
      description: '',
      image: '',
      cover: '',
    },
  };
}

export function removePendingFromCache(queryClient: QueryClient, id: string) {
  queryClient.setQueryData(
    ['dms', 'pending'],
    (pending: string[] | undefined) => {
      if (!pending) {
        return pending;
      }
      return pending.filter((p) => p !== id);
    }
  );
}

export function removeUnreadFromCache(queryClient: QueryClient, id: string) {
  queryClient.setQueryData(
    ['dms', 'unreads'],
    (unreads: DMUnreads | undefined) => {
      if (!unreads) {
        return unreads;
      }

      const newUnreads = { ...unreads };
      delete newUnreads[id];

      return newUnreads;
    }
  );
}

interface PageParam {
  time: BigInteger;
  direction: string;
}
interface InfiniteDMsData {
  pages: PagedWrits[];
  pageParams: PageParam[];
}

export function findWritBySealId(
  pages: PagedWrits[] | undefined,
  sealId: string
) {
  const pagesOrEmpty = pages || [];

  let pageIndex = null;
  let writ = null;

  pagesOrEmpty.forEach((page, index) => {
    const found = Object.entries(page.writs).find(
      ([_id, currWrit]) => currWrit.seal.id === sealId
    );
    if (found) {
      writ = found;
      pageIndex = index;
    }
  });

  return {
    pageIndex,
    writ,
  };
}

function makeId() {
  const sent = Date.now();
  return {
    id: `${window.our}/${formatUd(unixToDa(sent))}`,
    sent,
  };
}

export function buildWritPage(writ: Writ): PagedWrits {
  return {
    writs: {
      [writ.seal.id]: writ,
    },
    newer: null,
    older: null,
    total: 1,
  };
}

export function appendWritToLastPage(
  pages: PagedWrits[],
  writ: Writ
): PagedWrits[] {
  const lastPage = _.last(pages)!;
  const newLastPage = {
    ...lastPage,
    writs: {
      ...lastPage.writs,
      [writ.seal.id]: writ,
    },
    total: lastPage.total + 1,
  };
  return [...pages.slice(0, -1), newLastPage];
}

export function updateWritMeta(writ: Writ, newMeta: Partial<ReplyMeta>): Writ {
  return {
    ...writ,
    seal: {
      ...writ.seal,
      meta: {
        ...writ.seal.meta,
        ...newMeta,
      },
    },
  };
}

export function updateWritSeal(writ: Writ, newSeal: Partial<WritSeal>): Writ {
  return {
    ...writ,
    seal: {
      ...writ.seal,
      ...newSeal,
    },
  };
}

export function addReplyToWrit(writ: Writ, reply: Reply): Writ {
  console.log('adding reply to writ', writ, reply);

  let newReplies: ReplyTuple[] = [];
  if (Array.isArray(writ.seal.replies)) {
    newReplies = [
      ...(writ.seal.replies || []),
      [unixToDa(reply.memo.sent), reply],
    ];
  } else if (typeof writ.seal.replies === 'object') {
    // if somehow we still have a map, convert it to the expected tuple list
    const replies = (writ.seal.replies || {}) as Replies;
    newReplies = Object.entries(replies).map(([k, v]) => [
      bigInt(udToDec(k)),
      v as Reply,
    ]);
  }

  return {
    ...writ,
    seal: {
      ...writ.seal,
      replies: newReplies,
    },
  };
}

export function updateWritInPages(
  pages: PagedWrits[] | undefined,
  sealId: string,
  updater: (writ: Writ) => Writ
): PagedWrits[] | undefined {
  if (pages === undefined || pages.length === 0) {
    return pages;
  }

  const allWrits = pages.flatMap((page) => Object.entries(page.writs));
  const writFind = allWrits.find(([k, w]) => w.seal.id === sealId);
  if (writFind) {
    const writKey = writFind[0];
    const writ = writFind[1];

    const containingPage = pages.find((page) => {
      return Object.keys(page.writs).includes(writKey);
    });

    const containingPageIndex = pages.findIndex((page) => {
      return Object.keys(page.writs).includes(writKey);
    });

    if (!containingPage || containingPageIndex === undefined) {
      return pages;
    }

    const newWrit = updater(writ);
    return [
      ...pages.slice(0, containingPageIndex),
      {
        ...containingPage,
        writs: {
          ...containingPage.writs,
          [writKey]: newWrit,
        },
      },
      ...pages.slice(containingPageIndex + 1),
    ];
  }
  return pages;
}

export function buildCachedWrit(sentTime: number, delta: WritDeltaAdd): Writ {
  const seal: WritSeal = {
    // we use the sent time here as the cache id since the real one
    // is assigned on the agent
    id: formatUd(unixToDa(sentTime)),
    time: sentTime.toString(),
    reacts: {},
    replies: [],
    meta: {
      replyCount: 0,
      lastRepliers: [],
      lastReply: null,
    },
  };

  const writ: Writ = {
    seal,
    essay: {
      ...delta.add.memo,
      'kind-data': {
        chat: 'kind' in delta.add ? delta.add.kind : null,
      },
    },
  };

  return writ;
}

export function buildAddDelta(essay: PostEssay): WritDeltaAdd {
  const sentTime = Date.now();

  return {
    add: {
      memo: {
        content: essay.content,
        author: essay.author,
        sent: sentTime,
      },
      kind: null,
      time: null,
    },
  };
}

export function buildReplyDelta(parentId: string, memo: WritMemo) {
  const sentTime = Date.now();

  return {
    reply: {
      id: parentId,
      meta: null,
      delta: {
        add: {
          memo: {
            content: memo.content,
            author: memo.author,
            sent: sentTime,
          },
          time: null,
        },
      },
    },
  };
}

export function buildReplyFromMemo(parentId: string, memo: WritMemo): Reply {
  return {
    seal: {
      id: unixToDa(memo.sent).toString(),
      'parent-id': parentId,
      reacts: {},
    },
    memo,
  };
}

export function createMessage(
  whom: string,
  mem: PostEssay,
  replying?: string
): {
  id: string;
  cacheId: CacheId;
  delta: WritDeltaAdd | ReplyDelta;
} {
  const { id, sent } = makeId();
  const cacheId = { author: mem.author, sent };
  const memo: Omit<PostEssay, 'kind-data'> = {
    content: mem.content,
    author: mem.author,
    sent,
  };

  let delta: WritDeltaAdd | ReplyDelta;
  if (!replying) {
    delta = {
      add: {
        memo,
        kind: null,
        time: null,
      },
    };
  } else {
    delta = {
      reply: {
        id,
        meta: null,
        delta: {
          add: {
            memo,
            time: null,
          },
        },
      },
    };
  }

  return { id, cacheId, delta };
}
