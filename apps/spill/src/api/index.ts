import {formatUd, unixToDa} from '@urbit/aura';
import EventEmitter from 'events';
import * as db from '@db';
import {timer} from '@utils/debug';
import * as io from './conversion';
import * as groups from './types';
import {Contact} from './types/contact';
import {Groups} from './types/groups';
import * as urbit from './urbit/src';

export * from './ship';

type PatP = `~${string}`;
type PatUv = `0v${string}`;
type GroupChatId = PatUv;
type ChannelId = string;

let urbitClient: urbit.Urbit;

export async function initWithCookie({
  shipUrl,
  ship,
  cookie,
}: {
  shipUrl: string;
  ship: string;
  cookie: string;
}) {
  if (urbitClient) return;
  console.log('init with coolke', shipUrl, ship, cookie);
  urbitClient = new urbit.Urbit(shipUrl);
  urbitClient.cookie = cookie;
  urbitClient.ship = ship;
  timer.start('opening airlock');
  await urbitClient.poke({
    app: 'hood',
    mark: 'helm-hi',
    json: 'opening airlock',
  });
  timer.stop('opening airlock');
  timer.start('opening event source');
  await urbitClient.eventSource();
  timer.stop('opening event source');
}

export const init = async ({
  ship,
  shipUrl,
  accessCode,
}: {
  ship: string;
  shipUrl: string;
  accessCode: string;
}) => {
  console.log('init called');
  if (urbitClient) return;
  console.log('Base init', ship, shipUrl, accessCode);
  const startTime = Date.now();
  urbitClient = await urbit.Urbit.authenticate({
    url: shipUrl,
    code: accessCode,
    ship: ship,
  });
  console.log('authenticated in', Date.now() - startTime + 'ms');

  // events:  'subscription' 'status-update' 'id-update' 'fact' 'error' 'reset' 'seamless-reset' 'init';
  // urbitClient.on('subscription', subscription => {
  //   console.log('UE: subscription', subscription);
  // });
  // urbitClient.on('status-update', statusUpdate => {
  //   console.log('UE: status-update', statusUpdate);
  // });
  // urbitClient.on('id-update', idUpdate => {
  //   console.log('UE: id-update', idUpdate);
  // });
  // urbitClient.on('fact', fact => {
  //   console.log('UE: fact', fact);
  // });
  // urbitClient.on('error', error => {
  //   console.log('UE: error', error);
  // });
  // urbitClient.on('reset', reset => {
  //   console.log('UE: reset', reset);
  // });
  // urbitClient.on('seamless-reset', reset => {
  //   console.log('UE: seamless-reset', reset);
  // });
  // urbitClient.on('init', initData => {
  //   console.log('UE: init', initData);
  // });
};

export function getCookie() {
  return urbitClient.cookie;
}
interface SendMessageParams {
  from: PatP;
  to: PatP | ChannelId | GroupChatId;
  time: Date;
  content: groups.Story;
}

function isPatP(input: string): input is PatP {
  return input.startsWith('~');
}

function isChannelId(input: string): input is ChannelId {
  return input.match(/[\w+]\/~[\w-]+\/[\w-]+/) !== null;
}

function isGroupChatId(input: string): input is GroupChatId {
  return input.startsWith('0v');
}

function createMessageId(from: PatP, time: Date) {
  return `${from}/${formatUd(unixToDa(time.getTime()))}`;
}

export function sendMessage(params: SendMessageParams) {
  if (isPatP(params.to)) {
    sendDmMessage(params);
  } else if (isChannelId(params.to)) {
    sendChannelMessage(params);
  } else if (isGroupChatId(params.to)) {
    sendGroupChatMessage(params);
  } else {
    throw new Error('Invalid recipient id');
  }
}

function sendDmMessage({from, to, time, content}: SendMessageParams) {
  return sendPoke({
    ship: from.slice(1),
    app: 'chat',
    mark: 'chat-dm-action',
    json: {
      ship: to,
      diff: {
        id: createMessageId(from, time),
        delta: {
          add: {
            memo: {
              content,
              author: from,
              sent: time.getTime(),
            },
            kind: null,
            time: null,
          },
        },
      },
    },
  });
}

// Maybe a protocol version number? Not sure why this value, but this is what's
// used in landscape-apps.
const GROUP_CHAT_UID = '0v3';

function sendGroupChatMessage({from, to, time, content}: SendMessageParams) {
  return sendPoke({
    ship: from.slice(1),
    app: 'chat',
    mark: 'chat-club-action-0',
    json: {
      id: to,
      diff: {
        uid: GROUP_CHAT_UID,
        delta: {
          writ: {
            id: createMessageId(from, time),
            delta: {
              add: {
                memo: {
                  content: content,
                  author: from,
                  sent: time.getTime(),
                },
                kind: null,
                time: null,
              },
            },
          },
        },
      },
    },
  });
}

function sendChannelMessage({from, to, time, content}: SendMessageParams) {
  return sendPoke({
    ship: from.slice(1),
    app: 'channels',
    mark: 'channel-action',
    json: {
      channel: {
        nest: to,
        action: {
          post: {
            add: {
              'kind-data': {
                chat: null,
              },
              author: from,
              sent: time.getDate(),
              content: content,
            },
          },
        },
      },
    },
  });
}

export const sendPoke = async <T>(poke: urbit.Poke<T>) => {
  await urbitClient.poke(poke);
};

async function scry<T>(app: string, path: `${string}`) {
  return urbitClient.scry({
    app,
    path,
  }) as Promise<T>;
}

export const getGroups = async (
  {
    includeMembers,
  }: {
    includeMembers: boolean;
  } = {
    includeMembers: false,
  },
) => {
  const path = includeMembers ? '/groups' : '/groups/light';
  const groupData = await scry<Groups>('groups', path);
  return io.groups.toLocal(groupData);
};

export const getContacts = async (): Promise<Record<string, Contact>> => {
  return scry('contacts', '/all');
};

export const getUnreadChannels = async () => {
  const response = await scry<groups.Unreads>('channels', '/unreads');
  return io.channelUnreads.toLocal(response);
};

export const getChannelPosts = async (
  channelId: ChannelId,
  {
    cursor,
    date,
    direction = 'older',
    count = 20,
    includeReplies = false,
  }: {
    cursor?: string;
    date?: Date;
    direction?: 'older' | 'newer' | 'around';
    count?: number;
    includeReplies?: boolean;
  },
) => {
  if (cursor && date) {
    throw new Error('Cannot specify both cursor and date');
  }
  if (!cursor && !date) {
    throw new Error('Must specify either cursor or date');
  }
  let finalCursor = cursor ? cursor : formatDateParam(date!);
  const mode = includeReplies ? 'post' : 'outline';
  const path = `/${channelId}/posts/${direction}/${finalCursor}/${count}/${mode}`;
  const result = await scry<groups.PagedPosts>('channels', path);
  return io.toPagedPostsData(channelId, result);
};

function formatDateParam(date: Date) {
  return formatUd(unixToDa(date!.getTime()));
}

export type EventMap = {
  [key: string]: (...args: any[]) => void;
};

type Emitter<T extends EventMap> = {
  on<K extends keyof T>(event: K, listener: T[K]): void;
  emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): boolean;
};

type ChannelEvents = {
  posts: (posts: db.Post[]) => void;
  post: (post: db.Post) => void;
};

export const createChannelSubscription = () => {
  const emitter = new EventEmitter() as Emitter<ChannelEvents>;

  urbitClient.subscribe({
    app: 'channels',
    path: '/',
    err(error, id) {
      // console.log('E: channels error', error, id);
    },
    event(data, mark, id) {
      if (isChannelResponse(data, mark)) {
        const {nest: channelId, response} = data;
        if ('posts' in response) {
          const posts = io.toPostsData(channelId, response.posts);
          emitter.emit('posts', posts);
        } else if ('post' in response) {
          const {id: rawId, 'r-post': rawPost} = response.post;
          const id = io.formatUd(rawId);
          if ('set' in rawPost) {
            const post = io.toPostData(id, channelId, rawPost.set);
            emitter.emit('post', post);
          }
        }
      }
    },
    quit(data) {
      // console.log('E: channels quit', data);
    },
  });

  return emitter;
};

function isChannelResponse(
  data: any,
  mark: string,
): data is groups.ChannelsResponse {
  return mark === 'channel-response';
}

export const subscribeToChannel = async (channelId: ChannelId) => {
  urbitClient.subscribe({
    app: 'channels',
    path: '/' + channelId,
    err(error, id) {
      console.log('E: channels error', channelId, error, id);
    },
    event(data, mark, id) {
      console.log('E: channels event', channelId, data, mark, id);
    },
    quit(data) {
      console.log('E: channels quit', channelId, data);
    },
  });
};
