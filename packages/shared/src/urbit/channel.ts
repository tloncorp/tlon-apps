import bigInt, { BigInteger } from 'big-integer';
//REVIEW  non-native!
import _ from 'lodash';
import BTree from 'sorted-btree';

import { parseIdNumber } from '../api/apiUtils';
import { Stringified } from '../utils';
import { Block, Image, Inline, isBlock, isImage } from './content';
import { Flag } from './hark';
import { Metadata } from './meta';

export interface CacheId {
  author: string;
  sent: number;
}

export interface Writ {
  seal: WritSeal;
  essay: WritEssay;
}

export interface WritEssay extends PostEssay {
  'kind-data': KindDataChat;
}

export interface WritSeal extends PostSeal {
  time: number;
}

export type BotProfile = {
  ship: Ship;
  nickname: string | null;
  avatar: string | null;
};

export type Patda = string;
export type Ship = string;
export type Author = Ship | BotProfile;
export type Nest = string;
export type React = string | { any: string };

export interface ReplyMeta {
  replyCount: number;
  lastRepliers: Ship[];
  lastReply: number | null;
}

export interface PostSeal {
  id: string;
  reacts: { [ship: Ship]: React };
  replies: ReplyTuple[] | null;
  meta: ReplyMeta;
  seq?: number;
}

export interface ReplySeal {
  id: string;
  'parent-id': string;
  reacts: {
    [ship: Ship]: React;
  };
}

export interface VerseInline {
  inline: Inline[];
}

export interface VerseBlock {
  block: Block;
}

export function isBlockVerse(verse: Verse): verse is VerseBlock {
  return 'block' in verse;
}

export type Verse = VerseInline | VerseBlock;

export type Story = Verse[];

export type ChatBlock = Block;

// TODO: remove all dependence on chat story.
export type ChatStory = {
  inline: Inline[];
  block: ChatBlock[];
};

export type KindDataHeap = {
  heap: string;
};

export type KindDataDiary = {
  diary: {
    title: string;
    image?: string;
  };
};

export type KindDataChat = {
  chat: null | { notice: null };
};

export type KindData = KindDataDiary | KindDataChat | KindDataHeap;
export type Kind = 'heap' | 'diary' | 'chat';

export interface PostEssay {
  content: Story;
  author: Author;
  sent: number;
  kind: string;
  blob: string | null;
  meta: Metadata | null;
}

export type PostTombstone = {
  author: Author;
  id: string;
  ['deleted-at']: number;
  seq: number;
  type: 'tombstone';
};

export type Post = {
  seal: PostSeal;
  essay: PostEssay;
  revision?: string;
  type: 'post';
};

export interface PagedPosts {
  posts: Posts;
  newer: string | null;
  older: string | null;
  total: number;
  newest: number;
}

export interface PagedPostsMap extends Omit<PagedPosts, 'posts'> {
  posts: PageMap;
}

export type PostLike = Post | PostTombstone;

export interface SequencedPosts {
  posts: Posts;
  newest: number;
}

export interface Posts {
  [time: string]: PostLike;
}

export type PostTuple = [BigInteger, Post | null];

export type ReplyTuple = [BigInteger, Reply | null];

export type PageMap = BTree<BigInteger, Post | null>;

export interface Reply {
  seal: ReplySeal;
  memo: Memo;
  revision?: string;
}

export interface Memo {
  content: Story;
  author: Author;
  sent: number;
}

export type ReplyMap = BTree<BigInteger, Reply>;

export interface Replies {
  [id: string]: Reply | PostTombstone;
}

interface PostActionAdd {
  add: PostEssay;
}

interface PostActionAdd1 {
  add: PostEssay;
}

interface PostActionEdit {
  edit: {
    id: string;
    essay: PostEssay;
  };
}

interface PostActionDel {
  del: string;
}

interface PostActionAddReact {
  'add-react': {
    id: string;
    react: React;
    ship: string;
  };
}

interface PostActionDelReact {
  'del-react': {
    id: string;
    ship: string;
  };
}

interface DiffAddWriters {
  'add-writers': string[];
}

interface DiffDelWriters {
  'del-writers': string[];
}

interface DiffArrangedPosts {
  order: string[];
}

interface DiffSort {
  sort: SortMode;
}

interface DiffMeta {
  meta: Stringified<ChannelMetadata> | null;
}

interface PostActionReply {
  reply: {
    id: string; // post id
    action: ReplyAction;
  };
}

export type PostAction =
  | PostActionAdd
  | PostActionEdit
  | PostActionDel
  | PostActionAddReact
  | PostActionDelReact
  | PostActionReply
  | PostActionAdd1;

export interface DiffView {
  view: DisplayMode;
}

export interface CreateDiff {
  create: {
    perm: Perm;
    posts: PageMap;
  };
}

export interface ReplyActionAdd {
  add: Memo;
}

export interface ReplyActionEdit {
  edit: {
    id: string;
    memo: Memo;
  };
}

export interface ReplyActionDel {
  del: string;
}

export type ReplyAction =
  | ReplyActionAdd
  | ReplyActionDel
  | ReplyActionEdit
  | PostActionAddReact
  | PostActionDelReact;

export type DisplayMode = 'list' | 'grid';

export type SortMode = 'alpha' | 'time' | 'arranged';

export interface PendingMessages {
  posts: Record<string, PostEssay>;
  replies: Record<string, Record<string, Memo>>;
}

export type JSONValue = number | string | boolean;

export interface PostInput {
  type: string;
  postType: string;
  configuration?: Record<string, JSONValue>;
}

export interface PostCollectionRenderer {
  id: string;
  configuration?: Record<string, JSONValue>;
}

export interface ContentRenderer {
  rendererId: string;
}

export interface ChannelMetadataSchemaV1 {
  version: 1;
  postInput: PostInput;
  postCollectionRenderer: PostCollectionRenderer;
  defaultContentRenderer: ContentRenderer;
}

export type ChannelMetadata = ChannelMetadataSchemaV1;

export interface Channel {
  perms: Perm;
  view: DisplayMode;
  order: string[];
  sort: SortMode;
  pending: PendingMessages;
  meta: ChannelMetadata;
}

export interface ChannelFromServer {
  perms: Perm;
  view: DisplayMode;
  order: string[];
  sort: SortMode;
  pending: PendingMessages;
  meta: Stringified<ChannelMetadata> | null;
}

export interface Channels {
  [key: string]: Channel;
}

export interface Create {
  kind: Kind;
  group: Flag;
  name: string;
  title: string;
  description: string;
  meta: Stringified<ChannelMetadata> | null;
  readers: string[];
  writers: string[];
}

export interface Perm {
  writers: string[];
  group: Flag;
}

export interface ReplyReferenceResponse {
  reply: {
    'id-post': string;
    reply: Reply;
  };
}

export interface PostReferenceResponse {
  post: Post;
}

export type ReferenceResponse = ReplyReferenceResponse | PostReferenceResponse;

export interface Said {
  nest: Nest;
  reference: ReferenceResponse;
}

export interface Init {
  channels: Channels;
}

export type Diff = CreateDiff | Command;

export type Action =
  | { join: Flag } // group flag
  | { leave: null }
  | { read: null }
  | { 'read-at': string }
  | { watch: null }
  | { unwatch: null }
  | Command;

export type ChannelsAction =
  | { channel: { nest: Nest; action: Action } }
  | { create: Create };

export type Command =
  | { post: PostAction }
  | DiffView
  | DiffAddWriters
  | DiffDelWriters
  | DiffArrangedPosts
  | DiffSort
  | DiffMeta;

export type PostResponse =
  | { set: Post | null }
  | { reply: { id: string; 'r-reply': ReplyResponse; meta: ReplyMeta } }
  | { essay: PostEssay }
  | { reacts: Record<string, React> };

export type ReplyResponse = { set: Reply } | { reacts: Record<string, React> };

export interface ChannelPostResponse {
  post: {
    id: string;
    'r-post': PostResponse;
  };
}

export type PendingResponse =
  | { post: PostEssay }
  | {
      reply: {
        top: string;
        meta: ReplyMeta;
        memo: Memo;
      };
    };

export interface ChannelPendingResponse {
  pending: {
    id: CacheId;
    pending: PendingResponse;
  };
}

export type Response =
  | { posts: Posts }
  | ChannelPostResponse
  | ChannelPendingResponse
  | { order: string[] }
  | { view: DisplayMode }
  | { sort: SortMode }
  | { perm: Perm }
  | { meta: Stringified<ChannelMetadata> | null }
  | { create: Perm }
  | { join: string }
  | { leave: null }
  | { read: null }
  | { 'read-at': string }
  | { watch: null }
  | { unwatch: null };

export interface ChannelsResponse {
  nest: Nest;
  response: Response;
}

export interface ChannelsSubscribeResponse extends ChannelsResponse {
  show: string;
  hide: string;
}

export function blockContentIsImage(content: Story) {
  return (
    content.length > 0 &&
    content.filter((c) => 'block' in c).length > 0 &&
    isImage((content.filter((c) => 'block' in c)[0] as VerseBlock).block)
  );
}

export function imageUrlFromContent(content: Story) {
  if (blockContentIsImage(content)) {
    return (
      (content.filter((c) => 'block' in c)[0] as VerseBlock).block as Image
    ).image.src;
  }
  return undefined;
}

export function chatStoryFromStory(story: Story): ChatStory {
  const newCon: ChatStory = {
    inline: [],
    block: [],
  };

  const inlines: Inline[] = story
    .filter((s) => 'inline' in s)
    .map((s) => (s as VerseInline).inline)
    .flat();
  const blocks: ChatBlock[] = story
    .filter((s) => 'block' in s)
    .map((s) => (s as VerseBlock).block as ChatBlock)
    .flat();

  newCon.inline = inlines;
  newCon.block = blocks;

  return newCon;
}

export function storyFromChatStory(chatStory: ChatStory): Story {
  const newStory: Story = [];

  const inlines: Inline[] = chatStory.inline;
  const blocks: Block[] = chatStory.block;

  newStory.push({ inline: inlines });

  blocks.forEach((b) => {
    newStory.push({ block: b });
  });

  return newStory;
}

export function getIdFromPostAction(postAction: PostAction): string {
  if ('add' in postAction) {
    return postAction.add.sent.toString();
  }
  if ('edit' in postAction) {
    return postAction.edit.id;
  }
  if ('del' in postAction) {
    return postAction.del;
  }
  if ('add-react' in postAction) {
    return postAction['add-react'].id;
  }
  if ('del-react' in postAction) {
    return postAction['del-react'].id;
  }
  if ('reply' in postAction) {
    return postAction.reply.id;
  }
  return '';
}

export const emptyPost: Post = {
  seal: {
    id: '',
    reacts: {},
    replies: null,
    meta: {
      replyCount: 0,
      lastRepliers: [],
      lastReply: null,
    },
    seq: 1,
  },
  revision: '0',
  essay: {
    author: '',
    content: [],
    sent: 0,
    kind: '/chat',
    blob: null,
    meta: null,
  },
  type: 'post',
};

export const emptyReply: Reply = {
  seal: {
    id: '',
    'parent-id': '',
    reacts: {},
  },
  revision: '0',
  memo: {
    author: '',
    content: [],
    sent: 0,
  },
};

export function constructStory(data: (Inline | Block)[]): Story {
  const postContent: Story = [];
  let index = 0;
  data.forEach((c, i) => {
    if (i < index) {
      return;
    }

    if (isBlock(c)) {
      postContent.push({ block: c as Block });
      index += 1;
    } else {
      const inline = _.takeWhile(
        _.drop(data, index),
        (d) => !isBlock(d)
      ) as Inline[];
      postContent.push({ inline });
      index += inline.length;
    }
  });

  return postContent;
}

export function newReplyMap(
  entries?: [BigInteger, Reply][],
  reverse = false
): BTree<BigInteger, Reply> {
  return new BTree<BigInteger, Reply>(entries, (a, b) =>
    reverse ? b.compare(a) : a.compare(b)
  );
}

export function newPostTupleArray(
  data:
    | {
        pages: PagedPosts[];
      }
    | undefined
): PostTuple[] {
  if (data === undefined || data.pages.length === 0) {
    return [];
  }

  return _.uniqBy(
    data.pages
      .map((page) => {
        const pagePosts = Object.entries(page.posts).map(
          ([k, v]) => [bigInt(parseIdNumber(k)), v] as PostTuple
        );

        return pagePosts;
      })
      .flat(),
    ([k]) => k.toString()
  ).sort(([a], [b]) => a.compare(b));
}

export function newPostMap(entries?: PostTuple[], reverse = false): PageMap {
  return new BTree<BigInteger, Post | null>(entries, (a, b) =>
    reverse ? b.compare(a) : a.compare(b)
  );
}

export type ChatMap = BTree<BigInteger, Post | Writ | Reply | null>;

export interface PostSealDataResponse {
  id: string;
  replies: Replies;
  reacts: {
    [ship: Ship]: React;
  };
  meta: {
    replyCount: number;
    lastRepliers: Ship[];
    lastReply: number | null;
  };
}

export interface PostDataResponse {
  seal: PostSealDataResponse;
  revision?: string;
  essay: PostEssay;
}

export type ChannelScanItem = { post: Post } | ReplyReferenceResponse;

export type ChannelScan = ChannelScanItem[];

export type ChannelScam = { last: string | null; scan: ChannelScan };

export type TogglePost = { hide: string } | { show: string };

export type HiddenPosts = string[];

export type ChannelHead = {
  recency: number;
  nest: string;
  latest: Writ;
};

export type ChannelHeadsResponse = ChannelHead[];

export type ChannelHooksPreview = { name: string; meta: Metadata }[];
