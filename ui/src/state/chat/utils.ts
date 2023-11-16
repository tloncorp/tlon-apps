import { PostEssay } from '@/types/channel';
import { Club, ReplyDelta, WritDeltaAdd } from '@/types/dms';
import { formatUd, unixToDa } from '@urbit/aura';

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

function makeId() {
  const sent = Date.now();
  return {
    id: `${window.our}/${formatUd(unixToDa(sent))}`,
    sent,
  };
}

export function createMessage(
  whom: string,
  mem: PostEssay,
  replying?: string
): {
  id: string;
  cacheId: { author: string; sent: number };
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
