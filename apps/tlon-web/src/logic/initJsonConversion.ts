import { daToUnix, formatUd, formatUv, patp } from '@urbit/aura';
import { Atom, Cell, EnjsFunction, Noun, enjs } from '@urbit/nockjs';
import { Group, GroupsInit } from 'packages/shared/src/urbit';

type Json = ReturnType<EnjsFunction>;

const giveNull: EnjsFunction = () => null;
const maybe: EnjsFunction = (fn: EnjsFunction) => (noun: Noun) => {
  if (noun instanceof Atom) {
    return null;
  }

  return fn(noun.tail);
};

const getPatp: EnjsFunction = (noun: Noun) => {
  if (noun instanceof Cell) {
    throw new Error(`malformed patp ${noun.toString()}`);
  }

  return patp(noun.number);
};

const getUv: EnjsFunction = runIfAtom((a) => formatUv(a.number));

const time: EnjsFunction = runIfAtom((a) => daToUnix(a.number));

function getMapAsObject<T>(
  noun: Noun,
  key: EnjsFunction,
  value: EnjsFunction
): Record<string, T> {
  return Object.fromEntries(
    enjs.tree((n: Noun) => {
      if (!(n instanceof Cell)) {
        throw new Error('malformed map');
      }

      return [key(n.head), value(n.tail)];
    })(noun) as [string, T][]
  );
}

function runIfAtom(fn: (atom: Atom) => Json): EnjsFunction {
  return (noun: Noun) => {
    if (noun instanceof Cell) {
      throw new Error('malformed atom');
    }

    return fn(noun);
  };
}

const nest: EnjsFunction = (noun: Noun) => {
  if (
    noun instanceof Atom ||
    noun.head instanceof Cell ||
    noun.tail instanceof Atom
  ) {
    throw new Error('malformed nest');
  }

  return `${enjs.cord(noun.head)}/${getPatp(noun.tail.head)}/${enjs.cord(noun.tail.tail)}`;
};

const flag: EnjsFunction = (noun: Noun) => {
  if (
    !(noun instanceof Cell) ||
    !(noun.head instanceof Atom) ||
    !(noun.tail instanceof Atom)
  ) {
    throw new Error(`malformed flag ${noun.toString()}`);
  }

  return `${patp(noun.head.number)}/${enjs.cord(noun.tail)}`;
};

const meta: EnjsFunction = enjs.pairs([
  { nom: 'title', get: enjs.cord },
  { nom: 'description', get: enjs.cord },
  { nom: 'image', get: enjs.cord },
  { nom: 'cover', get: enjs.cord },
]);

const shutCordon: EnjsFunction = enjs.pairs([
  { nom: 'pending', get: enjs.tree(enjs.cord) },
  { nom: 'ask', get: enjs.tree(enjs.cord) },
]);

const openCordon: EnjsFunction = enjs.pairs([
  { nom: 'ships', get: enjs.tree(getPatp) },
  { nom: 'ranks', get: enjs.tree(enjs.cord) },
]);

const afarCordon: EnjsFunction = enjs.pairs([
  { nom: 'flag', get: flag },
  { nom: 'path', get: enjs.path },
  { nom: 'description', get: enjs.cord },
]);

const cordon: EnjsFunction = enjs.frond([
  { tag: 'shut', get: shutCordon },
  { tag: 'open', get: openCordon },
  { tag: 'afar', get: afarCordon },
]);

const groups: EnjsFunction = (noun: Noun) => {
  return getMapAsObject<Group>(noun, flag, group) as unknown as Json;
};

const gangs: EnjsFunction = (noun: Noun) => {
  return getMapAsObject<Group>(noun, flag, gang) as unknown as Json;
};

const gang: EnjsFunction = (noun: Noun) => {
  return enjs.pairs([
    { nom: 'claim', get: claim },
    { nom: 'preview', get: preview },
    { nom: 'invite', get: invite },
  ])(noun);
};

const claim: EnjsFunction = maybe((noun: Noun) => {
  return enjs.pairs([
    { nom: 'join-all', get: enjs.loob },
    { nom: 'progress', get: enjs.cord },
  ])(noun);
});

const preview: EnjsFunction = maybe(
  enjs.pairs([
    { nom: 'flag', get: flag },
    { nom: 'meta', get: meta },
    { nom: 'cordon', get: cordon },
    { nom: 'time', get: time },
    { nom: 'secret', get: enjs.loob },
  ])
);

const invite: EnjsFunction = maybe(
  enjs.pairs([
    { nom: 'flag', get: flag },
    { nom: 'ship', get: getPatp },
  ])
);

const cabal: EnjsFunction = (noun: Noun) => {
  if (noun instanceof Atom) {
    throw new Error('malformed cabal');
  }

  return meta(noun.head);
};

const cabals: EnjsFunction = (noun: Noun) => {
  return getMapAsObject(noun, enjs.cord, cabal);
};

const zone: EnjsFunction = enjs.pairs([
  { nom: 'meta', get: meta },
  { nom: 'order', get: enjs.array(nest) },
]);

const zones: EnjsFunction = (noun: Noun) => {
  return getMapAsObject(noun, enjs.cord, zone);
};

const zoneOrd: EnjsFunction = enjs.array(enjs.cord);

const bloc: EnjsFunction = enjs.tree(enjs.cord);

const groupChannel: EnjsFunction = enjs.pairs([
  { nom: 'meta', get: meta },
  { nom: 'added', get: time },
  { nom: 'zone', get: enjs.cord },
  { nom: 'join', get: enjs.loob },
  { nom: 'readers', get: enjs.tree(enjs.cord) },
]);

const groupChannels: EnjsFunction = (noun: Noun) => {
  return getMapAsObject(noun, nest, groupChannel);
};

const flaggedContent: EnjsFunction = (noun: Noun) => {
  return getMapAsObject(noun, nest, (n: Noun) => {
    const initMap = getMapAsObject(
      n,
      (k: Noun) => {
        if (k instanceof Atom) {
          throw new Error('malformed key');
        }

        const key = runIfAtom((a) => a.number.toString())(k.head);

        if (k.tail instanceof Atom) {
          return key;
        }

        return `${key}/${runIfAtom((a) => a.number.toString())(k.tail.tail)}`;
      },
      enjs.tree(getPatp)
    ) as unknown as Record<string, string[]>;

    return Object.entries(initMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .reduce(
        (finalMap, [k, v]) => {
          const parts = k.split('/');

          if (parts.length === 1) {
            finalMap[k] = {
              flaggers: v,
              flagged: true,
              replies: {},
            };
          } else {
            const post = finalMap[parts[0]];
            finalMap[parts[0]] = post
              ? {
                  ...post,
                  replies: {
                    ...post.replies,
                    [parts[1]]: v,
                  },
                }
              : {
                  flaggers: [],
                  flagged: false,
                  replies: {
                    [parts[1]]: v,
                  },
                };
          }

          return finalMap;
        },
        {} as Record<
          string,
          {
            flagged: boolean;
            flaggers: string[];
            replies: Record<string, string[]>;
          }
        >
      );
  });
};

const vessel: EnjsFunction = enjs.pairs([
  { nom: 'sects', get: enjs.tree(enjs.cord) },
  { nom: 'joined', get: time },
]);

const fleet: EnjsFunction = (noun: Noun) => {
  return getMapAsObject(noun, getPatp, vessel);
};

const group: EnjsFunction = (noun: Noun) => {
  if (noun instanceof Atom) {
    throw new Error('malformed group');
  }

  return enjs.pairs([
    { nom: 'fleet', get: fleet },
    { nom: 'cabals', get: cabals },
    { nom: 'zones', get: zones },
    { nom: 'zone-ord', get: zoneOrd },
    { nom: 'bloc', get: bloc },
    { nom: 'channels', get: groupChannels },
    { nom: 'imported', get: enjs.tree(nest) },
    { nom: 'cordon', get: cordon },
    { nom: 'secret', get: enjs.loob },
    { nom: 'meta', get: meta },
    { nom: 'flagged-content', get: flaggedContent },
  ])(noun.head) as unknown as Json;
};

const perm: EnjsFunction = enjs.pairs([
  { nom: 'writers', get: enjs.tree(enjs.cord) },
  { nom: 'group', get: flag },
]);

const channel: EnjsFunction = (noun: Noun) => {
  if (noun instanceof Atom) {
    throw new Error(`malformed channel ${noun.toString()}`);
  }

  const global = enjs.pairs([
    { nom: 'posts', get: giveNull },
    { nom: 'order', get: maybe(enjs.array(time)) },
    { nom: 'view', get: enjs.cord },
    { nom: 'sort', get: enjs.cord },
    { nom: 'perms', get: perm },
  ])(noun.head);

  const local = enjs.pairs([
    { nom: 'net', get: giveNull },
    { nom: 'remark', get: giveNull },
    { nom: 'pending', get: giveNull },
  ])(noun.tail);

  return { ...global, ...local };
};

const channels: EnjsFunction = (noun: Noun) => {
  return getMapAsObject(noun, nest, channel);
};

const unreadPoint: EnjsFunction = enjs.pairs([
  { nom: 'id', get: enjs.numb },
  { nom: 'count', get: enjs.numb },
]);

const unreadThreads: EnjsFunction = (noun: Noun) => {
  return getMapAsObject(noun, enjs.numb, unreadPoint);
};

const unread: EnjsFunction = (noun: Noun) => {
  return enjs.pairs([
    { nom: 'recency', get: time },
    { nom: 'count', get: enjs.numb },
    { nom: 'unread', get: maybe(unreadPoint) },
    { nom: 'threads', get: unreadThreads },
  ])(noun);
};

const unreads: EnjsFunction = (noun: Noun) => {
  return getMapAsObject(noun, nest, unread);
};

const chatWhom: EnjsFunction = enjs.frond([
  { tag: 'ship', get: getPatp },
  { tag: 'club', get: getUv },
]);

const whom: EnjsFunction = enjs.frond([
  { tag: 'group', get: flag },
  { tag: 'channel', get: nest },
  { tag: 'chat', get: chatWhom },
]);

const chatId: EnjsFunction = (noun: Noun) => {
  if (
    noun instanceof Atom ||
    noun.head instanceof Cell ||
    noun.tail instanceof Cell
  ) {
    throw new Error(`malformed chat id ${noun.toString()}`);
  }

  return `${getPatp(noun.head)}/${runIfAtom((a) => formatUd(a.number))(noun.tail)}`;
};

const msgKey: EnjsFunction = enjs.pairs([
  { nom: 'id', get: chatId },
  { nom: 'time', get: enjs.numb },
]);

const chatUnreadPoint: EnjsFunction = (noun: Noun) => {
  if (noun instanceof Atom) {
    throw new Error('malformed chat unread point');
  }

  const key = msgKey(noun.head);
  return { ...key, count: enjs.numb(noun.tail) };
};

const chatUnreadThreads: EnjsFunction = (noun: Noun) => {
  return Object.fromEntries(
    enjs.tree((n: Noun) => {
      if (!(n instanceof Cell)) {
        throw new Error('malformed map');
      }

      const { id, time } = msgKey(n.head);
      const point = chatUnreadPoint(n.tail);
      return [id, { ...point, ['parent-time']: time }];
    })(noun)
  );
};

const chatUnread: EnjsFunction = enjs.pairs([
  { nom: 'recency', get: time },
  { nom: 'count', get: enjs.numb },
  { nom: 'unread', get: maybe(chatUnreadPoint) },
  { nom: 'threads', get: chatUnreadThreads },
]);

const chatUnreads: EnjsFunction = (noun: Noun) => {
  return getMapAsObject(noun, chatWhom, chatUnread);
};

const logNoun: EnjsFunction =
  (fn: EnjsFunction, str: string) => (noun: Noun) => {
    console.log(str, noun.toString());
    return fn(noun);
  };

const club: EnjsFunction = enjs.pairs([
  { nom: 'team', get: enjs.tree(getPatp) },
  { nom: 'hive', get: enjs.tree(getPatp) },
  { nom: 'meta', get: meta },
  { nom: 'net', get: giveNull },
  { nom: 'pin', get: enjs.loob },
]);

const clubs: EnjsFunction = (noun: Noun) => {
  return getMapAsObject(noun, getUv, club);
};

const chat: EnjsFunction = enjs.pairs([
  { nom: 'clubs', get: clubs },
  { nom: 'dms', get: enjs.tree(getPatp) },
  { nom: 'unreads', get: chatUnreads },
  { nom: 'invited', get: enjs.tree(getPatp) },
  { nom: 'pins', get: enjs.array(chatWhom) },
]);

export const convertInit = (noun: Noun) =>
  enjs.pairs([
    { nom: 'groups', get: groups },
    { nom: 'gangs', get: gangs },
    { nom: 'channels', get: channels },
    { nom: 'unreads', get: unreads },
    { nom: 'pins', get: enjs.array(whom) },
    { nom: 'chat', get: chat },
    { nom: 'profile', get: enjs.loob },
  ])(noun) as unknown as GroupsInit;
