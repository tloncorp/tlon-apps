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
  const time = Date.now();
  return {
    id: `${window.our}/${formatUd(unixToDa(time))}`,
    time,
  };
}

export function createMessage(
  whom: string,
  mem: PostEssay,
  replying?: string
): { id: string; delta: WritDeltaAdd | ReplyDelta } {
  const { id, time } = makeId();
  const memo: Omit<PostEssay, 'kind-data'> = {
    content: mem.content,
    author: mem.author,
    sent: time,
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

  return { id, delta };
}
