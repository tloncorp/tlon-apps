import * as db from '@db';
import CookieManager from '@react-native-cookies/cookies';
import {formatUd, unixToDa} from '@urbit/aura';
import {appStore} from '@utils/state';
import EventEmitter from 'events';
import {atom, useAtomValue} from 'jotai';
import * as io from './conversion';
import {getShipFromCookie} from './ship';
import * as ub from './types';
import {Contact} from './types/contact';
import {Groups} from './types/groups';
import * as urbit from './urbit/src';
import {createLogger} from '@utils/debug';
import * as list from '@utils/list';

export * from './ship';

const logger = createLogger('api', false);

let urbitClient: urbit.Urbit;

type AuthState =
  | 'initial'
  | 'verifying-cookie'
  | 'logging-in'
  | 'not-logged-in'
  | 'logged-in';

export const authState = atom<AuthState>('initial');

appStore.sub(authState, () => {
  logger.log('Auth state changed to', appStore.get(authState));
});

export const useAuthState = () => useAtomValue(authState);

type AccountData = Omit<db.Account, 'id'>;
const accountState = atom<AccountData | null>(null);

export const authenticateWithCode = async (
  credentials: {
    shipUrl: string;
    accessCode: string;
  },
  onSuccess: (account: AccountData) => void,
) => {
  logger.log('authenticating with code', credentials);
  if (!canLogIn()) {
    logger.log("can't log in", appStore.get(authState));
    return;
  }
  appStore.set(authState, 'logging-in');
  try {
    logger.log('fetching login endpoint');
    const response = await fetch(`${credentials.shipUrl}/~/login`, {
      method: 'post',
      body: `password=${credentials.accessCode}`,
      credentials: 'include',
    });

    const rawCookie = response.headers.get('set-cookie');
    if (!rawCookie) {
      throw new Error('Missing cookie');
    }

    const cookie = rawCookie.split(';')[0];
    if (!cookie) {
      throw new Error('invalid cookie');
    }

    const ship = getShipFromCookie(cookie);
    logger.log('got cookie+ship', cookie, ship);
    appStore.set(accountState, {
      url: credentials.shipUrl,
      ship,
      cookie,
    });
    await setupChannel();
    appStore.set(authState, 'logged-in');
    onSuccess({url: credentials.shipUrl, cookie, ship});
  } catch (e) {
    appStore.set(authState, 'not-logged-in');
    throw e;
  }
};

export async function authenticateWithAccount(credentials?: db.Account | null) {
  if (!canLogIn()) {
    return;
  }
  if (!credentials || !credentials.cookie) {
    appStore.set(authState, 'not-logged-in');
    return;
  }
  try {
    const [cookieName, cookieValue] = credentials.cookie.split('=');
    if (!cookieName || !cookieValue) {
      throw new Error('invalid cookie');
    }
    appStore.set(authState, 'verifying-cookie');
    await CookieManager.clearAll();
    await CookieManager.set(credentials.url, {
      name: cookieName,
      value: cookieValue,
      path: '/',
      version: '1',
      secure: true,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toString(),
    });
    appStore.set(accountState, credentials);
    await setupChannel();
    appStore.set(authState, 'logged-in');
  } catch (e) {
    appStore.set(authState, 'not-logged-in');
    throw e;
  }
}

function canLogIn() {
  const currentAuthState = appStore.get(authState);
  return currentAuthState === 'not-logged-in' || currentAuthState === 'initial';
}

export async function setupChannel() {
  const credentials = appStore.get(accountState);
  if (!credentials) {
    throw new Error("can't setup channel without credentials");
  }

  urbitClient = new urbit.Urbit(credentials.url);
  urbitClient.cookie = credentials.cookie;
  urbitClient.ship = credentials.ship;

  await urbitClient.eventSource();
}

async function scry<T>(app: string, path: `${string}`) {
  return fetch(
    `${appStore.get(accountState)?.url}/~/scry/${app}${path}.json`,
  ).then(res => res.json()) as Promise<T>;
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
  const response = await scry<ub.Unreads>('channels', '/unreads');
  return io.channelUnreads.toLocal(response);
};

export const getChannelPosts = async (
  channelId: string,
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
  const result = await scry<ub.PagedPosts>('channels', path);
  return io.toPagedPostsData(channelId, result);
};

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
    event(data, mark) {
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
  });

  return emitter;
};

export async function getChannelReference(
  channelId: string,
  postId: string,
  replyId?: string,
) {
  const path =
    '/' +
    list
      .filterEmpty(['said', channelId, 'post', io.formatUd(postId), replyId])
      .join('/');
  const result = (await urbitClient.subscribeOnce(
    'channels',
    path,
  )) as ub.Said<ub.PostReferenceResponse>;
  return io.toPostData(
    result.reference.post.seal.id,
    result.nest,
    result.reference.post,
  );
}

export async function getGroupReference(groupId: string) {
  const path = `/gangs/${groupId}/preview`;
  const result = (await urbitClient.subscribeOnce(
    'groups',
    path,
  )) as ub.GroupPreview;
  return io.toGroupPreviewData(groupId, result);
}

export async function getAppReference(userId: string, appId: string) {
  const path = `/treaty/${userId}/${appId}`;
  const result = (await urbitClient.subscribeOnce(
    'treaty',
    path,
    20000,
  )) as ub.Treaty;
  return io.toApp(result);
}

function isChannelResponse(
  data: any,
  mark: string,
): data is ub.ChannelsResponse {
  return mark === 'channel-response';
}

function formatDateParam(date: Date) {
  return formatUd(unixToDa(date!.getTime()));
}
