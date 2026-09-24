import type { Entry } from './types';

export const channels = {
  // {mode} is outline or post; {nest} is kind/host/name.
  postsRange: {
    kind: 'scry',
    agent: 'channels',
    path: '/v5/{nest}/posts/range/{start}/{end}/{mode}',
    since: '12.2.0',
  },
  postsNewest: {
    kind: 'scry',
    agent: 'channels',
    path: '/v5/{nest}/posts/newest/{count}/{mode}',
    since: '12.2.0',
  },
  postsOlder: {
    kind: 'scry',
    agent: 'channels',
    path: '/v5/{nest}/posts/older/{cursor}/{count}/{mode}',
    since: '12.2.0',
  },
  postsNewer: {
    kind: 'scry',
    agent: 'channels',
    path: '/v5/{nest}/posts/newer/{cursor}/{count}/{mode}',
    since: '12.2.0',
  },
  postsAround: {
    kind: 'scry',
    agent: 'channels',
    path: '/v5/{nest}/posts/around/{cursor}/{count}/{mode}',
    since: '12.2.0',
  },
  postsChanges: {
    kind: 'scry',
    agent: 'channels',
    path: '/v4/{nest}/posts/changes/{start}/{end}/{after}',
    since: '12.2.0',
  },
  post: {
    kind: 'scry',
    agent: 'channels',
    path: '/v5/{nest}/posts/post/{id}',
    since: '12.2.0',
  },
  search: {
    kind: 'scry',
    agent: 'channels',
    path: '/v5/{nest}/search/bounded/text/{cursor}/{depth}/{query}',
    since: '12.2.0',
  },
  hiddenPosts: {
    kind: 'scry',
    agent: 'channels',
    path: '/hidden-posts',
    since: '12.2.0',
  },
  negotiateStatus: {
    kind: 'scry',
    agent: 'channels',
    path: '/~/negotiate/status/json',
    since: '12.2.0',
  },
  updates: {
    kind: 'subscribe',
    agent: 'channels',
    path: '/v4',
    since: '12.2.0',
  },
  hookPreview: {
    kind: 'subscribe',
    agent: 'channels',
    path: '/v1/hooks/preview/{nest}',
    since: '12.2.0',
  },
  // {ask} is mandatory at the tag (channels.hoon v3-v5 %said arm).
  said: {
    kind: 'subscribe',
    agent: 'channels',
    path: '/v5/said/{ask}/{nest}/post/{id}',
    since: '12.2.0',
  },
  saidReply: {
    kind: 'subscribe',
    agent: 'channels',
    path: '/v5/said/{ask}/{nest}/post/{id}/{reply}',
    since: '12.2.0',
  },
  negotiateNotify: {
    kind: 'subscribe',
    agent: 'channels',
    path: '/~/negotiate/notify/json',
    since: '12.2.0',
  },
  action: {
    kind: 'poke',
    agent: 'channels',
    mark: 'channel-action-2',
    since: '12.2.0',
  },
  // Runs from the %groups desk.
  setupFromTemplate: {
    kind: 'thread',
    agent: 'groups',
    name: 'channel-setup-from-template',
    inputMark: 'hook-setup-template-args',
    outputMark: 'json',
    since: '12.2.0',
  },
} as const satisfies Record<string, Entry>;
