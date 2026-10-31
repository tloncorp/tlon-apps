import {
  BOT_PROFILE_OPTION_FLAGS,
  type BotAuthorProfile,
  botProfileFlagIndex,
  parseBotProfileFlags,
} from '../bot-profile-flags';
import type { ChannelState } from '../channel-state-runtime';
import {
  DIARY_REMOVED,
  NOTES_CHANNEL_CONTENT_UNSUPPORTED,
  canonicalizeNest,
  dmWritTime,
  formatPostId,
  isDiaryNest,
  isNotesNest,
  mapWithConcurrency,
  parseNest,
  postIdLengthProblem,
  undottedPostId,
} from '../cli-utils';
import { assertPostableMediaUrl } from '../image-attach';
import {
  NO_ROLES,
  type Story,
  type StoryVerse,
  dmRoleMentionError,
  groupRoleMentionError,
  markdownToStory,
  unknownRoleMentions,
} from '../markdown';
import type { MediaProbe } from '../media-guard';
import {
  appendFileUploadToPostBlob,
  appendVideoToPostBlob,
  validatedBlob,
} from '../post-blob';
import { defaultReplyParentAuthor, isOneToOneDmTarget } from '../post-targets';
import {
  type CommandDeps,
  commandError,
  errorMessage,
  handleExpectedCommandError,
  isHelpArg,
  usageError,
  writeHelp,
  writeLine,
} from './command';

export const POSTS_HELP = `Usage: tlon posts <command>

Commands:
  send <channel> [message]                 Send a message to a channel [--image <url>] [--file <url>] [--video <url>] [--link <url>] [--blob <json>] [--title <text>] [--quote <channel> <post-id>] [--bot]
  reply <channel> <post-id> [message]      Reply to a channel post [--author ~ship] [--blob <json>] [--quote <channel> <post-id>] [--bot]
  forward <channel> <post-id> <target>  Forward a post as a reference card [--parent <post-id>] [--sent-at <ms>]
  react <channel> <post-id> <emoji>     React to a post with an emoji [--parent <post-id>]
  unreact <channel> <post-id>           Remove your reaction from a post [--parent <post-id>]
  edit <channel> <post-id> <message>    Edit a post's message text [--parent <post-id>]
  delete <channel> <post-id>            Delete a post [--parent <post-id>]
  pin <channel> <post-id>               Pin a post to the top of a channel (admin)
  unpin <channel> <post-id>             Unpin the channel's pinned post (admin)

Send options:
  --image <url>        Attach an image (direct png/jpeg/gif/webp URL, e.g. from
                       'tlon upload'); message becomes an optional caption
  --file <url>         Attach a file by its https URL
  --video <url>        Attach a video by its https URL
  --link <url>         Post a link card (gallery heap/ posts only; no message,
                       use --title). Posts a bare card with the --title;
                       page previews are not fetched
  --blob <json>        Attach a post-blob JSON array of known entry types (e.g.
                       an a2ui entry); checked before sending
  --title <text>       Set a title on a gallery (heap/) post
  --sent-at <ms>       Override the send timestamp (unix ms); the post id
                       derives from it. Applies to send, reply and forward.
  --bot                Author the message as a bot (renders the "Bot" tag).
                       Applies to send and reply.
  --quote <channel> <post-id>
                       Quote a post (send and reply; the message becomes
                       optional). The source is a post in a joined group chat/
                       or heap/ channel, a DM (~ship) or a group DM (0v...).
  --quote-parent <post-id>
                       The quoted post is a thread reply under this post
                       (group channel sources only).

Attachments:
  --image, --file and --video take an https URL, never a local path: upload
  a local file first ('tlon upload <path>') and pass the URL it returns.
  --link takes an http or https URL. A gallery (heap/) post takes at most one
  attachment (--image, --file, --video, --link, or a file, video or voice
  memo entry in --blob); send one post per attachment. Chat and DM sends take
  several: images become blocks in flag order (at most 4), files and videos
  become blob entries in flag order after any --blob entries. --quote takes
  no attachment flags (a --blob is still allowed). Quote a message that
  contains a flag word (e.g. --file) to send it as text.

Quotes and forwards:
  A quoted channel post becomes a reference card, placed where the app puts
  it; a quoted DM post becomes a "> " quote of its first line. In a
  one-to-one DM the author is found automatically; another member's post in
  a group DM needs its author: ~author/<post-id>.
  forward sends only the reference card of a post in a joined group chat/ or
  heap/ channel (--parent <post-id> for a thread reply) to a chat/ or heap/
  channel, a DM or a group DM.
  Quotes and forwards are read back: channel targets print a Ref, DM targets
  an ID. If the output says "not confirmed", check before sending again.
  A separate --quote or --quote-parent token is an option; to send it as
  text, put it inside the message argument.

Pins and thread replies:
  pin and unpin need a group admin or the channel's host ship and work in
  group chat/ and heap/ channels.
  Pinning keeps the previous pin queued behind the new one, so unpinning the
  current pin can bring that earlier pin back; the output names it.
  With --parent, edit and delete act on a thread reply: <post-id> is the reply
  id and --parent is the thread's top-level post. Find reply ids with
  'tlon messages post <channel> <post-id>'. Only a reply's author can edit
  it; deleting another member's reply needs a group admin or the channel's
  host ship. A separately supplied --parent token selects the reply path, so
  quote a message that contains those words as one argument. A reply edit that leaves the
  content unchanged is reported as confirmed without proving anything changed.

Mentions:
  ~ship mentions a person; @role-id mentions a group role (the id, not its title,
  case-insensitive) and @all mentions every member. DMs take @all only. An unknown
  @word is refused; wrap it in backticks or write \\@word to send it as text.
  Mentions notify only in plain paragraph text, not inside bold, quotes, headings,
  lists or tables, and edits never notify. An edit re-validates every @role
  against the group's current roles, so an edit keeping a since-deleted role is
  refused.

Examples:
  tlon posts send chat/~host/channel "Hello from tlon"
  tlon posts send chat/~host/channel "Look at this" --image https://storage.../tree.png
  tlon posts send heap/~host/gallery "A caption" --title "Gallery item"
  tlon posts send heap/~host/gallery --link https://example.com --title "A site"
  tlon posts send heap/~host/gallery --file https://storage.../report.pdf
  tlon posts reply chat/~host/channel 170.141... "Thread reply"
  tlon posts send chat/~host/channel "See this" --quote chat/~host/other 170.141...
  tlon posts forward chat/~host/other 170.141... ~sampel-palnet
  tlon posts edit chat/~host/channel 170.141... "Updated message"
  tlon posts pin chat/~host/channel 170.141...
  tlon posts delete chat/~host/channel 170.142... --parent 170.141...

Channel format: chat/~host/channel-name, heap/~host/name
Use 'tlon messages channel <nest> --limit N' to see post IDs.`;

export const POSTS_COMMAND_HELP: Record<string, string> = {
  send: 'Usage: tlon posts send <channel> [message] [--image <url>]... [--file <url>]... [--video <url>]... [--link <url>] [--blob <json>] [--title <text>] [--quote <channel> <post-id> [--quote-parent <post-id>]] [--sent-at <ms>] [--bot] (message optional with an attachment or --quote; a gallery post takes one attachment)\n~ship in the message mentions that person and notifies them; @role-id mentions a group role, @all every member.',
  reply:
    'Usage: tlon posts reply <channel> <post-id> [message] [--author ~ship] [--blob <json>] [--quote <channel> <post-id> [--quote-parent <post-id>]] [--sent-at <ms>] [--bot] (message optional with --quote)\n~ship in the message mentions that person and notifies them; @role-id mentions a group role, @all every member.',
  forward:
    'Usage: tlon posts forward <src-channel> <src-id> <target> [--parent <src-parent-id>] [--sent-at <ms>]',
  react:
    'Usage: tlon posts react <channel> <post-id> <emoji> [--parent <post-id>]',
  unreact: 'Usage: tlon posts unreact <channel> <post-id> [--parent <post-id>]',
  edit: 'Usage: tlon posts edit <channel> <post-id> <message> [--parent <post-id>]',
  delete: 'Usage: tlon posts delete <channel> <post-id> [--parent <post-id>]',
  pin: 'Usage: tlon posts pin <channel> <post-id>',
  unpin: 'Usage: tlon posts unpin <channel> <post-id>',
};

// Retained for back-compat with existing imports; the canonical source is the
// command help map above. The react usage line must stay byte-identical.
export const POSTS_REACT_HELP = POSTS_COMMAND_HELP.react;

// `--title`/`--image`/`--content` were notebook-only edit affordances (diary
// cover/title/Story-file). Diary/notebook is removed, so edit becomes plain
// message-content editing and these flags are refused (not silently swallowed —
// they used to act as message-slice boundaries, so a stale invocation must fail
// loudly rather than absorb the flag into the message).
const POSTS_EDIT_REMOVED_FLAGS_MESSAGE =
  'tlon posts edit no longer supports --title/--image/--content (notebook-only affordances). Edit the message text directly; use `tlon notes` for %notes content.';

const POST_REPLY_OPTION_FLAGS = [
  'author',
  'blob',
  'sent-at',
  'quote',
  'quote-parent',
  ...BOT_PROFILE_OPTION_FLAGS,
] as const;
// Send's options and how many values each takes. The message is the words
// before the first of these; everything from there on must be options and
// their values (a stray word or unknown flag is refused, never dropped).
const POST_SEND_OPTION_ARITY: ReadonlyMap<string, number> = new Map([
  ['--image', 1],
  ['--file', 1],
  ['--video', 1],
  ['--link', 1],
  ['--blob', 1],
  ['--title', 1],
  ['--sent-at', 1],
  ...BOT_PROFILE_OPTION_FLAGS.map((flag): [string, number] => [`--${flag}`, 0]),
  ['--quote', 2],
  ['--quote-parent', 1],
]);
// Only the media flags repeat; a second of any other option is refused.
const REPEATABLE_SEND_OPTIONS = new Set(['--image', '--file', '--video']);
const MEDIA_SEND_FLAGS = ['--image', '--file', '--video'] as const;
type MediaSendFlag = (typeof MEDIA_SEND_FLAGS)[number];
// Each image is downloaded to read its dimensions; the cap bounds that work
// per send.
const MAX_IMAGES_PER_SEND = 4;
// The blob entry types that render as an attachment.
const ATTACHMENT_BLOB_TYPES = new Set(['file', 'video', 'voicememo']);
const GALLERY_ONE_ATTACHMENT =
  'galleries take one attachment per post; send one `posts send` per attachment';

// Reply's options after the message. With --quote the message is optional,
// so the whole suffix is checked against these: a stray word or flag after
// the options would otherwise be dropped without a trace.
const QUOTE_SUFFIX_ARITY = {
  reply: new Map([
    ['--author', 1],
    ['--blob', 1],
    ['--sent-at', 1],
    ['--bot', 0],
    ['--quote', 2],
    ['--quote-parent', 1],
  ]),
};

export interface PostReactionInput {
  channelId: string;
  postId: string;
  emoji: string;
  our: string;
  postAuthor: string;
  parentId?: string;
}

export interface PostReactionRemoveInput {
  channelId: string;
  postId: string;
  our: string;
  postAuthor: string;
  parentId?: string;
}

export interface PostDeleteInput {
  channelId: string;
  postId: string;
  authorId: string;
}

export interface PostEditMetadata {
  title?: string;
  image?: string;
  description?: string;
  cover?: string;
}

export interface PostEditInput {
  channelId: string;
  postId: string;
  // Set for a thread reply: the top-level post the reply belongs to.
  parentId?: string;
  authorId: string;
  sentAt: number;
  content: Story;
  // Replies carry no metadata.
  metadata?: PostEditMetadata;
  blob?: string;
  botProfile?: BotAuthorProfile;
}

export interface PostSendInput {
  channelId: string;
  authorId: string;
  sentAt: number;
  content: Story;
  blob?: string;
  // A gallery post's title, and its image (the app's gallery shape).
  metadata?: { title?: string; image?: string };
  botProfile?: BotAuthorProfile;
}

export interface PostReplyInput {
  channelId: string;
  parentId: string;
  parentAuthor: string;
  content: Story;
  sentAt: number;
  authorId: string;
  blob?: string;
  botProfile?: BotAuthorProfile;
}

export interface PostLookupQuery {
  channelId: string;
  cursor?: string;
  mode: 'around' | 'newest';
  count: number;
  includeReplies: boolean;
}

export interface ExistingPost {
  id: string;
  sentAt: number;
  title?: string | null;
  image?: string | null;
  description?: string | null;
  cover?: string | null;
  isBot?: boolean | null;
  // The bot author's nickname and avatar, when the read carried them.
  botProfile?: BotAuthorProfile | null;
  blob?: string | null;
  authorId?: string;
  // Comparable with `PostsDeps.contentKeyOf`, like `ExistingReply.contentKey`.
  contentKey?: string;
  isDeleted?: boolean | null;
}

export interface PostLookupResult {
  posts: ExistingPost[];
}

export interface PostThreadQuery {
  channelId: string;
  postId: string;
  // DM posts are addressed by author and time; the runtime defaults to us.
  authorId?: string;
}

export interface ExistingReply {
  id: string;
  authorId: string;
  sentAt: number;
  // Order-insensitive projection of the reply's content, comparable with
  // `PostsDeps.contentKeyOf` of the story that was sent.
  contentKey: string;
  isBot?: boolean | null;
  // The bot author's nickname and avatar, when the read carried them.
  botProfile?: BotAuthorProfile | null;
  isDeleted?: boolean | null;
  blob?: string | null;
}

export interface ExistingThread {
  id: string;
  authorId: string;
  isDeleted?: boolean | null;
  sentAt?: number;
  contentKey?: string;
  // The plain text of the post's first paragraph, line breaks kept.
  quoteText?: string;
  replies: ExistingReply[];
}

export interface ReplyDeleteInput {
  channelId: string;
  parentId: string;
  parentAuthorId: string;
  postId: string;
  authorId: string;
}

// Re-exported for callers that typed channel reads against this module.
export type { ChannelState };

export interface PostsApi {
  addReaction: (input: PostReactionInput) => Promise<void>;
  removeReaction: (input: PostReactionRemoveInput) => Promise<void>;
  deletePost: (input: PostDeleteInput) => Promise<void>;
  editPost: (input: PostEditInput) => Promise<void>;
  sendPost: (input: PostSendInput) => Promise<void>;
  sendReply: (input: PostReplyInput) => Promise<void>;
  getChannelPosts: (query: PostLookupQuery) => Promise<PostLookupResult>;
  // A top-level post with all its replies, tombstones included.
  getPostWithReplies: (query: PostThreadQuery) => Promise<ExistingThread>;
  deleteReply: (input: ReplyDeleteInput) => Promise<void>;
  // Replaces the channel's whole arranged-post order; order[0] is the pin.
  setOrder: (channelId: string, order: string[]) => Promise<void>;
}

// Subset of the api-client's subscription apps that posts targets can need.
export type PostAuthApp = 'channels' | 'chat';

export interface PostsDeps extends CommandDeps {
  authenticate: (apps: PostAuthApp[]) => Promise<void>;
  getCurrentUserId: () => string;
  now: () => number;
  // Injected so the edit retry can be exercised without real sleeping.
  sleep?: (ms: number) => Promise<void>;
  // Fetch an image URL and build its story image verse (network IO).
  buildImageVerse: (url: string) => Promise<StoryVerse>;
  // Headers-only look at a --file/--video URL. Throws when the URL must not
  // be posted; a failed look resolves to unknown metadata (`size: -1`).
  probeMedia: (url: string) => Promise<MediaProbe>;
  postsApi: PostsApi;
  // The acting ship's local view of a channel: its group and arranged order.
  getChannelState: (nest: string) => Promise<ChannelState>;
  // The ids of a group's roles, for checking typed @role mentions.
  getGroupRoleIds: (groupId: string) => Promise<string[]>;
  // Throws when the acting ship cannot administer the channel `nest`.
  assertCanAdminister: (
    groupId: string,
    action: string,
    nest: string
  ) => Promise<void>;
  // The projection the runtime applies to a read-back reply's content.
  contentKeyOf: (story: Story) => string;
}

// A post to quote or forward. `parentId` is set for a thread reply.
interface QuoteSource {
  channelId: string;
  postId: string;
  parentId?: string;
}

// A media flag's canonical URL, in the order the flags were given.
interface SendMedia {
  flag: MediaSendFlag;
  url: string;
}

type ParsedPostsArgs =
  | { kind: 'help'; help: string }
  | {
      kind: 'send';
      channelId: string;
      message: string;
      media: SendMedia[];
      link?: string;
      title?: string;
      blob?: string;
      sentAt?: number;
      botProfile?: BotAuthorProfile;
      quote?: QuoteSource;
    }
  | {
      kind: 'reply';
      channelId: string;
      postId: string;
      message: string;
      parentAuthor?: string;
      blob?: string;
      sentAt?: number;
      botProfile?: BotAuthorProfile;
      quote?: QuoteSource;
    }
  | { kind: 'forward'; source: QuoteSource; target: string; sentAt?: number }
  | {
      kind: 'react';
      channelId: string;
      postId: string;
      emoji: string;
      parentId?: string;
    }
  | { kind: 'unreact'; channelId: string; postId: string; parentId?: string }
  | { kind: 'delete'; channelId: string; postId: string; parentId?: string }
  | {
      kind: 'edit';
      channelId: string;
      postId: string;
      message: string;
      parentId?: string;
    }
  | { kind: 'pin' | 'unpin'; channelId: string; postId: string };

function optionalReactionParent(
  args: string[],
  help: string
): string | undefined {
  const idx = args.indexOf('--parent');
  if (idx === -1) return undefined;
  // Reject a duplicate `--parent` and a value that is itself an option
  // token (e.g. `--parent --bogus` reading the next flag as the id).
  if (args.indexOf('--parent', idx + 1) !== -1) throw usageError(help);
  const parentId = args[idx + 1];
  if (!parentId || parentId.startsWith('--')) throw usageError(help);
  return parentId;
}

// After `--parent <id>` is taken, any other option token (a typo, or the
// unsupported `--parent=<id>` form) is refused rather than silently ignored:
// an unconsumed `--parent=` would turn a reply delete into a top-level one.
function rejectStrayOptions(args: string[], help: string): void {
  const parentIdx = args.indexOf('--parent');
  args.forEach((arg, idx) => {
    if (idx === parentIdx || (parentIdx !== -1 && idx === parentIdx + 1)) {
      return;
    }
    if (arg.startsWith('--')) {
      throw usageError(`Unexpected argument: ${arg}`, help);
    }
  });
}

// Optional `--sent-at <unix-ms>`: overrides the send timestamp so a caller
// (e.g. the Hermes adapter) controls the post's `sent` — and can therefore
// derive the post id (~author/<@da of sent>) itself without scraping output.
function validatedSentAt(args: string[], help: string): number | undefined {
  const idx = args.indexOf('--sent-at');
  return idx === -1 ? undefined : sentAtValue(args[idx + 1], help);
}

function sentAtValue(raw: string | undefined, help: string): number {
  const ms = Number(raw);
  if (!raw || !Number.isInteger(ms) || ms <= 0) {
    throw usageError(help);
  }
  return ms;
}

function wantsHelp(args: string[]): boolean {
  return args.some(isHelpArg);
}

function getPostsHelp(command: string | undefined): string {
  return command && POSTS_COMMAND_HELP[command]
    ? POSTS_COMMAND_HELP[command]
    : POSTS_HELP;
}

function validatedBlobFlag(args: string[], help: string): string | undefined {
  const blobIdx = args.indexOf('--blob');
  if (blobIdx === -1) {
    return undefined;
  }
  const blob = args[blobIdx + 1];
  if (!blob) {
    throw usageError(help);
  }
  return validatedBlob(blob).raw;
}

function validatedBotProfile(
  args: string[],
  usage: string
): BotAuthorProfile | undefined {
  const parsed = parseBotProfileFlags(args);
  if (!parsed.ok) {
    throw usageError(usage);
  }
  return parsed.botProfile;
}

// Plain `--flag` boundary scan. Edit/reply use this for all their flags — a
// `--image=url` token is deliberately NOT a flag boundary for edit, matching
// legacy behavior.
function firstFlagIndex(args: string[], flags: readonly string[]): number {
  const indexes = flags
    .map((flag) => args.indexOf(`--${flag}`))
    .filter((idx) => idx !== -1);
  return indexes.length > 0 ? Math.min(...indexes) : args.length;
}

// `--flag=value` for any send option but `--image`. It ends the message like
// the flag would, so the value (often a signed URL) is never posted as text,
// and `sendOptions` refuses it.
function isEqualsFormSendOption(arg: string): boolean {
  const eq = arg.indexOf('=');
  if (eq === -1) return false;
  const flag = arg.slice(0, eq);
  return flag !== '--image' && POST_SEND_OPTION_ARITY.has(flag);
}

function isPostSendOption(arg: string): boolean {
  return (
    POST_SEND_OPTION_ARITY.has(arg) ||
    arg.startsWith('--image=') ||
    isEqualsFormSendOption(arg)
  );
}

// Send's message ends at its first option token (any `--flag=value` form
// included); a `--word` that is not a send option stays message text.
function firstPostSendFlagIndex(args: string[]): number {
  const idx = args.findIndex((arg, i) => i >= 2 && isPostSendOption(arg));
  return idx === -1 ? args.length : idx;
}

// Reply's message ends at its first option token, `--bot` included.
function firstPostReplyFlagIndex(args: string[]): number {
  const inlineBot = botProfileFlagIndex(args);
  return Math.min(
    firstFlagIndex(args, POST_REPLY_OPTION_FLAGS),
    inlineBot === -1 ? args.length : inlineBot
  );
}

// Edit's only option is `--parent <post-id>` (the notebook-only flags are
// removed), so the message is everything after the post id except that pair,
// which may come before or after the text.
function getPostEditMessage(args: string[]): string {
  const parentIdx = args.indexOf('--parent');
  return args
    .slice(3)
    .filter(
      (_, i) =>
        parentIdx === -1 || (i + 3 !== parentIdx && i + 3 !== parentIdx + 1)
    )
    .join(' ');
}

// True when `posts edit` carries a removed notebook-only flag. Detected as a
// plain token (`--title`/`--content`) or in either `--image` form.
function editHasRemovedFlag(args: string[]): boolean {
  return args.some(
    (arg) =>
      arg === '--title' ||
      arg === '--content' ||
      arg === '--image' ||
      arg.startsWith('--image=')
  );
}

function getPostReplyMessage(args: string[]): string {
  return args.slice(3, firstPostReplyFlagIndex(args)).join(' ');
}

// When the message slice for a write subcommand contains a `--help`/`-h` token,
// help is suppressed and the token is treated as literal message content.
function isPostEditMessageHelpLiteral(args: string[]): boolean {
  return (
    args[0] === 'edit' && !!args[1] && !!args[2] && wantsHelp(args.slice(3))
  );
}

function isPostSendMessageHelpLiteral(args: string[]): boolean {
  return (
    args[0] === 'send' &&
    !!args[1] &&
    wantsHelp(args.slice(2, firstPostSendFlagIndex(args)))
  );
}

function isPostReplyMessageHelpLiteral(args: string[]): boolean {
  return (
    args[0] === 'reply' &&
    !!args[1] &&
    !!args[2] &&
    wantsHelp(args.slice(3, firstPostReplyFlagIndex(args)))
  );
}

// Send/reply may target a one-to-one DM or group DM, which is served by %chat
// rather than %channels; everything else authenticates against %channels. A
// quote or forward also reads its source, so it needs the source's app too.
function postTargetApps(parsed: ParsedPostsArgs): PostAuthApp[] {
  const appOf = (target: string): PostAuthApp =>
    isDmTarget(target) ? 'chat' : 'channels';
  let apps: PostAuthApp[];
  switch (parsed.kind) {
    case 'send':
    case 'reply':
      apps = [appOf(parsed.channelId)];
      if (parsed.quote) apps.push(appOf(parsed.quote.channelId));
      break;
    case 'forward':
      apps = ['channels', appOf(parsed.target)];
      break;
    default:
      apps = ['channels'];
  }
  return [...new Set(apps)];
}

function isDmTarget(target: string): boolean {
  return target.startsWith('~') || target.startsWith('0v');
}

function isGroupChannelNest(target: string): boolean {
  try {
    return ['chat', 'heap'].includes(parseNest(target).kind);
  } catch {
    return false;
  }
}

// Pins and thread-reply edits/deletes only exist in group chat/heap channels.
// Refused locally, before auth, and the nest is canonicalized (`chat/host/x`
// and `chat/~host/x` must hit the same scry key).
function pinTarget(target: string): string {
  if (isDmTarget(target)) {
    throw commandError(
      `Pins are for group channels (chat/ or heap/); ${target} is a DM.`
    );
  }
  if (!isGroupChannelNest(target)) {
    throw commandError(
      `Pins are for group chat/ and heap/ channels; ${target} is not one.`
    );
  }
  return canonicalizeNest(target);
}

function threadReplyTarget(target: string): string {
  if (isDmTarget(target)) {
    throw commandError(
      `Editing or deleting a thread reply is supported in group channels only; ${target} is a DM.`
    );
  }
  if (!isGroupChannelNest(target)) {
    throw commandError(
      `Thread replies can be edited or deleted only in group chat/ and heap/ channels; ${target} is not one.`
    );
  }
  return canonicalizeNest(target);
}

function quoteSourceOperand(args: string[]): string | undefined {
  const idx = args.indexOf('--quote');
  return idx === -1 ? undefined : args[idx + 1];
}

// A bad id is refused before auth, so it can never become a dangling cite.
function assertPostIds(ids: Array<string | undefined>, help: string): void {
  for (const id of ids) {
    if (id === undefined) continue;
    try {
      undottedPostId(id);
    } catch {
      throw usageError(help);
    }
  }
}

function canonicalQuoteSource(source: QuoteSource, help: string): QuoteSource {
  const { channelId, parentId } = source;
  if (isDmTarget(channelId)) {
    // Quoting a DM thread reply would also need the parent's author.
    if (parentId !== undefined) {
      throw commandError(
        `--quote-parent is for thread replies in group channels; ${channelId} is a DM.`
      );
    }
  } else if (!isGroupChannelNest(channelId)) {
    throw commandError(
      `--quote takes a post in a group chat/ or heap/ channel, a DM (~ship) or a group DM (0v…); ${channelId} is not one.`
    );
  }
  assertPostIds([source.postId, parentId], help);
  return isDmTarget(channelId)
    ? source
    : { ...source, channelId: canonicalizeNest(channelId) };
}

// `--quote <channel> <post-id> [--quote-parent <post-id>]` on reply (send
// reads it from `sendOptions`). `operands` is how many positionals precede
// the message.
function validatedQuote(
  args: string[],
  operands: number,
  messageEnd: number,
  arity: ReadonlyMap<string, number>,
  help: string
): QuoteSource | undefined {
  const quoteIdx = args.indexOf('--quote');
  if (quoteIdx === -1) {
    if (args.includes('--quote-parent')) {
      throw usageError('--quote-parent needs --quote', help);
    }
    return undefined;
  }
  // A --quote among the operands would leave a target or post id missing.
  if (args.slice(1, operands + 1).some((operand) => operand.startsWith('--'))) {
    throw usageError(help);
  }
  const seen = new Set<string>();
  for (let idx = messageEnd; idx < args.length;) {
    const flag = args[idx];
    const count = arity.get(flag);
    if (count === undefined) {
      throw usageError(unexpectedArgumentAt(idx), help);
    }
    const values = args.slice(idx + 1, idx + 1 + count);
    if (
      seen.has(flag) ||
      values.length < count ||
      values.some((value) => value.startsWith('--'))
    ) {
      throw usageError(help);
    }
    seen.add(flag);
    idx += 1 + count;
  }
  const parentIdx = args.indexOf('--quote-parent');
  return canonicalQuoteSource(
    {
      channelId: args[quoteIdx + 1],
      postId: args[quoteIdx + 2],
      ...(parentIdx === -1 ? {} : { parentId: args[parentIdx + 1] }),
    },
    help
  );
}

// A quote or forward target is read back after the send, so a channel target
// must be one that read can serve, canonicalized here (DM ids are not nests).
function quoteTarget(target: string): string {
  if (isDmTarget(target)) return target;
  if (!isGroupChannelNest(target)) {
    throw commandError(
      `Can't quote into ${target}: --quote is supported for chat/ and heap/ channels, DMs (~ship) and group DMs (0v…).`
    );
  }
  return canonicalizeNest(target);
}

interface SendOption {
  flag: string;
  values: string[];
}

// A stray token in an option suffix is named by position only: it may be a
// signed URL, a token or blob JSON, none of which may be echoed.
function unexpectedArgumentAt(position: number): string {
  return `Unexpected argument ${position} (counting the channel as 1): it is not an option or an option's value. Put a message that contains a flag word in quotes; give each URL its own flag.`;
}

// The options after the message, in order. Each consumes its values; a
// missing or empty value, a value that is an option token, a repeated
// non-media option, a `--flag=value` form other than `--image=`, a stray word
// or an unknown flag is a usage error.
function sendOptions(
  args: string[],
  start: number,
  help: string
): SendOption[] {
  const options: SendOption[] = [];
  const seen = new Set<string>();
  for (let idx = start; idx < args.length;) {
    const token = args[idx];
    if (token.startsWith('--image=')) {
      const value = token.slice('--image='.length);
      if (!value) throw usageError(help);
      options.push({ flag: '--image', values: [value] });
      idx += 1;
      continue;
    }
    if (isEqualsFormSendOption(token)) throw usageError(help);
    const count = POST_SEND_OPTION_ARITY.get(token);
    if (count === undefined) {
      throw usageError(unexpectedArgumentAt(idx), help);
    }
    const values = args.slice(idx + 1, idx + 1 + count);
    if (
      (seen.has(token) && !REPEATABLE_SEND_OPTIONS.has(token)) ||
      values.length < count ||
      values.some((value) => value === '' || value.startsWith('--'))
    ) {
      throw usageError(help);
    }
    seen.add(token);
    options.push({ flag: token, values });
    idx += 1 + count;
  }
  return options;
}

// A gallery link post is one link block; the renderer parses the URL.
function validatedLink(raw: string): string {
  const url = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw commandError('--link takes an http(s) URL.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw commandError('--link takes an http(s) URL.');
  }
  // The media guard's userinfo rule: a bare "@" in the authority counts too.
  if (
    parsed.username ||
    parsed.password ||
    /^https?:\/\/[^/?#\\]*@/i.test(url)
  ) {
    throw commandError(
      '--link URLs with embedded credentials are not supported.'
    );
  }
  return url;
}

function parseSend(args: string[]): ParsedPostsArgs {
  const help = POSTS_COMMAND_HELP.send;
  const target = args[1];
  if (!target || target.startsWith('--')) {
    throw usageError(help);
  }
  const botProfile = validatedBotProfile(args, help);
  const messageEnd = firstPostSendFlagIndex(args);
  const options = sendOptions(args, messageEnd, help);
  const message = args.slice(2, messageEnd).join(' ');
  const valueOf = (flag: string): string[] | undefined =>
    options.find((option) => option.flag === flag)?.values;
  const has = (flag: string) => valueOf(flag) !== undefined;

  const quoteValues = valueOf('--quote');
  const quoteParent = valueOf('--quote-parent');
  if (!quoteValues && quoteParent) {
    throw usageError('--quote-parent needs --quote', help);
  }
  const isGallery = target.startsWith('heap/');
  if (quoteValues) {
    const attached = [...MEDIA_SEND_FLAGS, '--link'].find(has);
    if (attached) {
      throw usageError(`--quote cannot be combined with ${attached}`, help);
    }
  }
  const quote = quoteValues
    ? canonicalQuoteSource(
        {
          channelId: quoteValues[0],
          postId: quoteValues[1],
          ...(quoteParent ? { parentId: quoteParent[0] } : {}),
        },
        help
      )
    : undefined;

  const title = valueOf('--title')?.[0];
  if (title !== undefined && !isGallery) {
    throw usageError(
      '--title is only supported for gallery (heap/) posts',
      help
    );
  }
  const sentAtRaw = valueOf('--sent-at');
  const sentAt = sentAtRaw ? sentAtValue(sentAtRaw[0], help) : undefined;
  const blobRaw = valueOf('--blob')?.[0];
  const blob = blobRaw === undefined ? undefined : validatedBlob(blobRaw);

  const media = options.flatMap((option): SendMedia[] =>
    (MEDIA_SEND_FLAGS as readonly string[]).includes(option.flag)
      ? [
          {
            flag: option.flag as MediaSendFlag,
            url: assertPostableMediaUrl(option.values[0], option.flag),
          },
        ]
      : []
  );
  const linkRaw = valueOf('--link')?.[0];
  if (linkRaw !== undefined) {
    if (!isGallery) {
      throw usageError(
        '--link is only supported for gallery (heap/) posts',
        help
      );
    }
    if (message) {
      throw usageError(
        'a gallery link post has no caption; put the text in --title',
        help
      );
    }
  }
  const link = linkRaw === undefined ? undefined : validatedLink(linkRaw);

  const blobAttachments = (blob?.types ?? []).filter((type) =>
    ATTACHMENT_BLOB_TYPES.has(type)
  ).length;
  const attachments = media.length + (link ? 1 : 0) + blobAttachments;
  if (isGallery && attachments > 1) {
    throw usageError(GALLERY_ONE_ATTACHMENT, help);
  }
  const images = media.filter((item) => item.flag === '--image').length;
  if (images > MAX_IMAGES_PER_SEND) {
    throw usageError(
      `at most ${MAX_IMAGES_PER_SEND} --image attachments per send`,
      help
    );
  }
  // A quote alone is a post; otherwise there must be text or something that
  // renders as an attachment (an empty or metadata-only blob does not).
  if (!quote && !message && attachments === 0) {
    throw usageError(help);
  }
  return {
    kind: 'send',
    channelId: quote ? quoteTarget(target) : target,
    message,
    media,
    ...(link ? { link } : {}),
    title,
    blob: blob?.raw,
    sentAt,
    botProfile,
    ...(quote ? { quote } : {}),
  };
}

function parseForward(args: string[]): ParsedPostsArgs {
  const help = POSTS_COMMAND_HELP.forward;
  const [, source, postId, target] = args;
  if (
    !source ||
    !postId ||
    !target ||
    [source, postId, target].some((operand) => operand.startsWith('--'))
  ) {
    throw usageError(help);
  }
  const parentId = optionalReactionParent(args, help);
  const sentAt = validatedSentAt(args, help);
  const taken = [args.indexOf('--parent'), args.indexOf('--sent-at')]
    .filter((idx) => idx !== -1)
    .flatMap((idx) => [idx, idx + 1]);
  const stray = args.filter(
    (arg, idx) => !taken.includes(idx) && (idx > 3 || arg.startsWith('--'))
  );
  const extra = stray.find((arg) => arg.startsWith('--')) ?? stray[0];
  if (extra !== undefined) {
    throw usageError(`Unexpected argument: ${extra}`, help);
  }
  if (isDmTarget(source)) {
    throw commandError(
      `Only posts in group chat/ and heap/ channels can be forwarded; ${source} is a DM.`
    );
  }
  if (!isGroupChannelNest(source)) {
    throw commandError(
      `Only posts in group chat/ and heap/ channels can be forwarded; ${source} is not one.`
    );
  }
  if (!isDmTarget(target) && !isGroupChannelNest(target)) {
    throw commandError(
      `Can't forward to ${target}: posts can be forwarded only to chat/ and heap/ channels, DMs (~ship) and group DMs (0v…).`
    );
  }
  assertPostIds([postId, parentId], help);
  return {
    kind: 'forward',
    source: {
      channelId: canonicalizeNest(source),
      postId,
      ...(parentId === undefined ? {} : { parentId }),
    },
    target: quoteTarget(target),
    ...(sentAt === undefined ? {} : { sentAt }),
  };
}

// The host assigns a channel post's ID after the send returns, so no Ref can be
// printed here; point at the readback instead. DMs have no reference card.
function writePostRefHint(
  channelId: string,
  deps: PostsDeps,
  parentId?: string
): void {
  if (isDmTarget(channelId)) {
    return;
  }
  const hint = parentId
    ? `find the reply's ID with \`messages post ${channelId} ${parentId}\`, then put /1/chan/${channelId}/msg/${parentId}/<id>`
    : `find its ID with \`messages channel ${channelId} --limit 5\`, then put /1/chan/${channelId}/msg/<id>`;
  writeLine(
    deps.stdout,
    `  Share: the host assigns the post ID, so none is returned here; ${hint} in your reply to post a tappable card.`
  );
}

function parseArgs(args: string[]): ParsedPostsArgs {
  const command = args[0];

  if (isHelpArg(command)) {
    return { kind: 'help', help: POSTS_HELP };
  }

  if (
    wantsHelp(args.slice(1)) &&
    !isPostEditMessageHelpLiteral(args) &&
    !isPostSendMessageHelpLiteral(args) &&
    !isPostReplyMessageHelpLiteral(args)
  ) {
    return { kind: 'help', help: getPostsHelp(command) };
  }

  if (!command) {
    throw usageError(POSTS_HELP);
  }

  if (!POSTS_COMMAND_HELP[command]) {
    throw usageError(POSTS_HELP);
  }

  // Diary/notebook channels are removed; refuse a `diary/...` nest with the
  // explanatory message before per-subcommand validation, so the refusal wins
  // over an incidental missing-arg or removed-flag error on the same command.
  if (isDiaryNest(args[1])) {
    throw commandError(DIARY_REMOVED);
  }

  if (isNotesNest(args[1])) {
    throw commandError(NOTES_CHANNEL_CONTENT_UNSUPPORTED);
  }

  // The other nests a quote or forward names get the same diary refusal,
  // after the first operand's (the tlon tool guard mirrors this order).
  if (command === 'forward' && isDiaryNest(args[3])) {
    throw commandError(DIARY_REMOVED);
  }
  if (
    (command === 'send' || command === 'reply') &&
    isDiaryNest(quoteSourceOperand(args))
  ) {
    throw commandError(DIARY_REMOVED);
  }

  switch (command) {
    case 'send':
      return parseSend(args);
    case 'reply': {
      const quote = validatedQuote(
        args,
        2,
        firstPostReplyFlagIndex(args),
        QUOTE_SUFFIX_ARITY.reply,
        POSTS_COMMAND_HELP.reply
      );
      const channelId = args[1];
      const postId = args[2];
      const message = getPostReplyMessage(args);
      if (!channelId || !postId || (!message && !quote)) {
        throw usageError(POSTS_COMMAND_HELP.reply);
      }
      if (quote) {
        assertPostIds([postId], POSTS_COMMAND_HELP.reply);
      }
      const authorIdx = args.indexOf('--author');
      if (authorIdx !== -1 && !args[authorIdx + 1]) {
        throw usageError(POSTS_COMMAND_HELP.reply);
      }
      const parentAuthor = authorIdx !== -1 ? args[authorIdx + 1] : undefined;
      const blob = validatedBlobFlag(args, POSTS_COMMAND_HELP.reply);
      const sentAt = validatedSentAt(args, POSTS_COMMAND_HELP.reply);
      const botProfile = validatedBotProfile(args, POSTS_COMMAND_HELP.reply);
      return {
        kind: 'reply',
        channelId: quote ? quoteTarget(channelId) : channelId,
        postId,
        message,
        parentAuthor,
        blob,
        sentAt,
        botProfile,
        ...(quote ? { quote } : {}),
      };
    }
    case 'forward':
      return parseForward(args);
    case 'react': {
      const [, channelId, postId, emoji] = args;
      if (!channelId || !postId || !emoji) {
        throw usageError(POSTS_COMMAND_HELP.react);
      }
      // A positional slot filled by an option token (e.g. `--parent` swallowed
      // into the emoji slot when the emoji is omitted) is a usage error.
      if (
        channelId.startsWith('--') ||
        postId.startsWith('--') ||
        emoji.startsWith('--')
      ) {
        throw usageError(POSTS_COMMAND_HELP.react);
      }
      const parentId = optionalReactionParent(args, POSTS_COMMAND_HELP.react);
      rejectStrayOptions(args, POSTS_COMMAND_HELP.react);
      return { kind: 'react', channelId, postId, emoji, parentId };
    }
    case 'unreact': {
      const [, channelId, postId] = args;
      if (!channelId || !postId) {
        throw usageError(POSTS_COMMAND_HELP.unreact);
      }
      if (channelId.startsWith('--') || postId.startsWith('--')) {
        throw usageError(POSTS_COMMAND_HELP.unreact);
      }
      const parentId = optionalReactionParent(args, POSTS_COMMAND_HELP.unreact);
      rejectStrayOptions(args, POSTS_COMMAND_HELP.unreact);
      return { kind: 'unreact', channelId, postId, parentId };
    }
    case 'delete': {
      const [, channelId, postId] = args;
      if (!channelId || !postId) {
        throw usageError(POSTS_COMMAND_HELP.delete);
      }
      if (channelId.startsWith('--') || postId.startsWith('--')) {
        throw usageError(POSTS_COMMAND_HELP.delete);
      }
      const parentId = optionalReactionParent(args, POSTS_COMMAND_HELP.delete);
      rejectStrayOptions(args, POSTS_COMMAND_HELP.delete);
      if (parentId === undefined) {
        return { kind: 'delete', channelId, postId };
      }
      return {
        kind: 'delete',
        channelId: threadReplyTarget(channelId),
        postId,
        parentId,
      };
    }
    case 'edit': {
      const channelId = args[1];
      const postId = args[2];
      if (!channelId || !postId) {
        throw usageError(POSTS_COMMAND_HELP.edit);
      }
      if (editHasRemovedFlag(args)) {
        throw commandError(POSTS_EDIT_REMOVED_FLAGS_MESSAGE);
      }
      if (channelId.startsWith('--') || postId.startsWith('--')) {
        throw usageError(POSTS_COMMAND_HELP.edit);
      }
      const parentId = optionalReactionParent(args, POSTS_COMMAND_HELP.edit);
      const message = getPostEditMessage(args);
      if (!message) {
        throw usageError(POSTS_COMMAND_HELP.edit);
      }
      if (parentId === undefined) {
        return { kind: 'edit', channelId, postId, message };
      }
      return {
        kind: 'edit',
        channelId: threadReplyTarget(channelId),
        postId,
        message,
        parentId,
      };
    }
    case 'pin':
    case 'unpin': {
      const help = POSTS_COMMAND_HELP[command];
      const [, channelId, postId, extra] = args;
      if (
        !channelId ||
        !postId ||
        channelId.startsWith('--') ||
        postId.startsWith('--')
      ) {
        throw usageError(help);
      }
      // Replies cannot be pinned, so `--parent` is as unexpected as any token.
      if (extra !== undefined) {
        throw usageError(`Unexpected argument: ${extra}`, help);
      }
      return { kind: command, channelId: pinTarget(channelId), postId };
    }
  }

  // Unreachable: command is validated against POSTS_COMMAND_HELP above.
  throw usageError(POSTS_HELP);
}

// The host stores a reaction under whatever id it is given, so a mistyped id
// (one group dropped from a 13-group post id, say) prints success while the
// post the user meant stays unreacted. Read the target first, as delete does.
async function requireReactionTarget(
  parsed: { channelId: string; postId: string; parentId?: string },
  verb: 'added' | 'removed',
  deps: PostsDeps
): Promise<void> {
  const nest = parsed.channelId;
  const id = formatPostId(parsed.postId);
  if (parsed.parentId) {
    const pid = formatPostId(parsed.parentId);
    if (!(await fetchExistingReply(nest, pid, id, deps))) {
      throw commandError(
        `Could not read reply ${id} under ${pid} in ${nest}; no reaction was ${verb}. Read the thread (\`messages post ${nest} ${pid}\`) and use its ID line.`
      );
    }
    return;
  }
  if (!(await fetchExistingPost(nest, id, deps))) {
    throw commandError(
      `Could not read ${id} in ${nest}; no reaction was ${verb}. The id may not be the post's: read the channel (\`messages channel ${nest}\`) and use its ID line.`
    );
  }
}

async function reactToPost(
  parsed: {
    channelId: string;
    postId: string;
    emoji: string;
    parentId?: string;
  },
  deps: PostsDeps
): Promise<void> {
  await requireReactionTarget(parsed, 'added', deps);
  const our = deps.getCurrentUserId();
  await deps.postsApi.addReaction({
    channelId: parsed.channelId,
    postId: formatPostId(parsed.postId),
    emoji: parsed.emoji,
    our,
    postAuthor: our,
    ...(parsed.parentId ? { parentId: formatPostId(parsed.parentId) } : {}),
  });
}

async function unreactToPost(
  parsed: { channelId: string; postId: string; parentId?: string },
  deps: PostsDeps
): Promise<void> {
  await requireReactionTarget(parsed, 'removed', deps);
  const our = deps.getCurrentUserId();
  await deps.postsApi.removeReaction({
    channelId: parsed.channelId,
    postId: formatPostId(parsed.postId),
    our,
    postAuthor: our,
    ...(parsed.parentId ? { parentId: formatPostId(parsed.parentId) } : {}),
  });
}

// The host acks a %del for an id it has never seen, so without this read a
// wrong id (a sent-time id in place of the host's, say) prints success while
// the post stays up.
async function deletePost(
  parsed: { channelId: string; postId: string },
  deps: PostsDeps
): Promise<void> {
  const nest = parsed.channelId;
  const id = formatPostId(parsed.postId);
  const existing = await fetchExistingPost(nest, id, deps);
  if (!existing) {
    throw commandError(
      `Could not read ${id} in ${nest}; nothing was deleted. The id may not be the post's: read the channel (\`messages channel ${nest}\`) and use its ID line.`
    );
  }
  await deps.postsApi.deletePost({
    channelId: nest,
    postId: id,
    authorId: deps.getCurrentUserId(),
  });
}

type SendArgs = Extract<ParsedPostsArgs, { kind: 'send' }>;
type ReplyArgs = Extract<ParsedPostsArgs, { kind: 'reply' }>;
type ForwardArgs = Extract<ParsedPostsArgs, { kind: 'forward' }>;

type PreparedMedia =
  | { flag: '--image'; verse: StoryVerse }
  | { flag: '--file' | '--video'; url: string; probe: MediaProbe };

// "--file #2 (cdn.example.com)": names a failed attachment without its path
// or query, which may carry a signature.
function describeMedia(media: SendMedia[], index: number): string {
  const item = media[index];
  const nth = media
    .slice(0, index + 1)
    .filter((other) => other.flag === item.flag).length;
  return `${item.flag} #${nth} (${new URL(item.url).host})`;
}

async function prepareMedia(
  media: SendMedia[],
  deps: PostsDeps
): Promise<PreparedMedia[]> {
  if (media.length === 0) return [];
  // Each guard bounds its own work (image fetch and file/video probe
  // deadlines), at most four run at once, and a failure names its
  // attachment.
  return mapWithConcurrency(
    media,
    4,
    async (item, index): Promise<PreparedMedia> => {
      try {
        if (item.flag === '--image') {
          return {
            flag: item.flag,
            verse: await deps.buildImageVerse(item.url),
          };
        }
        return {
          flag: item.flag,
          url: item.url,
          probe: await deps.probeMedia(item.url),
        };
      } catch (error) {
        throw commandError(
          `${errorMessage(error)} (${describeMedia(media, index)})`
        );
      }
    }
  );
}

// The last path segment, decoded when it decodes.
function fileNameOf(url: string): string | undefined {
  const segment = new URL(url).pathname.split('/').pop();
  if (!segment) return undefined;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

// --file/--video entries go after any --blob entries, in flag order. The
// --blob entries are passed through as given.
function blobWithMedia(
  blob: string | undefined,
  prepared: PreparedMedia[]
): string | undefined {
  return prepared.reduce((acc, item) => {
    if (item.flag === '--image') return acc;
    const entry = {
      fileUri: item.url,
      mimeType: item.probe.mimeType,
      name: fileNameOf(item.url),
      size: item.probe.size,
    };
    return item.flag === '--file'
      ? appendFileUploadToPostBlob(acc, entry)
      : appendVideoToPostBlob(acc, entry);
  }, blob);
}

interface PlainSend {
  content: Story;
  blob?: string;
  image?: string;
}

// As the app composes: a chat or DM message puts its image blocks first,
// then the caption; a gallery post puts the caption first, then its one
// image, which is also the post's `metadata.image`; a gallery link post is
// the link block alone, with only `--title` in its meta (no page preview is
// fetched). Files and videos are blob entries.
async function plainSendContent(
  parsed: SendArgs,
  deps: PostsDeps
): Promise<PlainSend> {
  if (parsed.link) {
    const meta = parsed.title ? { title: parsed.title } : {};
    return { content: [{ block: { link: { url: parsed.link, meta } } }] };
  }
  // The caption is checked first so a refused mention fails before any
  // attachment is fetched.
  const caption = parsed.message
    ? await buildMessageStory(parsed.channelId, parsed.message, deps)
    : [];
  const prepared = await prepareMedia(parsed.media, deps);
  const images = prepared.flatMap((item) =>
    item.flag === '--image' ? [item.verse] : []
  );
  const blob = blobWithMedia(parsed.blob, prepared);
  if (parsed.channelId.startsWith('heap/')) {
    const image = parsed.media.find((item) => item.flag === '--image')?.url;
    return { content: [...caption, ...images], blob, image };
  }
  return { content: [...images, ...caption], blob };
}

async function sendPost(
  parsed: SendArgs,
  content: Story,
  deps: PostsDeps,
  attached: { blob?: string; image?: string } = {}
): Promise<number> {
  const authorId = deps.getCurrentUserId();
  const sentAt = parsed.sentAt ?? deps.now();
  const metadata = {
    ...(parsed.title ? { title: parsed.title } : {}),
    ...(attached.image ? { image: attached.image } : {}),
  };
  await deps.postsApi.sendPost({
    channelId: parsed.channelId,
    authorId,
    sentAt,
    content,
    blob: attached.blob ?? parsed.blob,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    ...(parsed.botProfile ? { botProfile: parsed.botProfile } : {}),
  });
  return sentAt;
}

async function sendReply(
  parsed: ReplyArgs,
  content: Story,
  deps: PostsDeps
): Promise<{ sentAt: number; parentAuthor: string }> {
  const authorId = deps.getCurrentUserId();
  const parentId = formatPostId(parsed.postId);
  const parentAuthor = defaultReplyParentAuthor(
    parsed.channelId,
    authorId,
    parsed.parentAuthor
  );
  const sentAt = parsed.sentAt ?? deps.now();
  await deps.postsApi.sendReply({
    channelId: parsed.channelId,
    parentId,
    parentAuthor,
    content,
    sentAt,
    authorId,
    blob: parsed.blob,
    ...(parsed.botProfile ? { botProfile: parsed.botProfile } : {}),
  });
  return { sentAt, parentAuthor };
}

// A post the CLI just created is not necessarily readable yet: %channels
// records the add in `pending.channel` and proxies it to the host, while this
// scry reads `posts.channel`, which is only populated once the host update
// returns. One delayed retry covers that window; a remotely hosted channel
// needs at least a host round trip. Replies have the same window
// (`pending.replies`).
export const EDIT_LOOKUP_RETRY_DELAY_MS = 1_500;

// Read-back budgets for pin/unpin and reply edit/delete. They mirror the
// group-admin verification (5 reads, 500 ms apart).
export const PIN_CONFIRM_ATTEMPTS = 5;
export const PIN_CONFIRM_DELAY_MS = 500;
export const REPLY_CONFIRM_ATTEMPTS = 5;
export const REPLY_CONFIRM_DELAY_MS = 500;

function sleepFor(deps: PostsDeps): (ms: number) => Promise<void> {
  return (
    deps.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  );
}

function normalizeShip(ship: string): string {
  const normalized = ship.trim().toLowerCase();
  return normalized.startsWith('~') ? normalized : `~${normalized}`;
}

// One look, then one delayed retry. A thrown lookup counts as a miss: both mean
// the state to preserve or act on is unknown.
async function lookWithRetry<T>(
  lookOnce: () => Promise<T | null>,
  deps: PostsDeps
): Promise<T | null> {
  const look = async (): Promise<T | null> => {
    try {
      return await lookOnce();
    } catch {
      return null;
    }
  };
  const first = await look();
  if (first !== null) {
    return first;
  }
  await sleepFor(deps)(EDIT_LOOKUP_RETRY_DELAY_MS);
  return look();
}

// Fetch the existing post so an edit can preserve what it must not re-derive.
// Returns null when the post is genuinely unreadable — the caller refuses to
// edit on that, because an edit replaces the whole essay and a null here would
// silently rewrite authorship and wipe metadata.
async function fetchExistingPost(
  channelId: string,
  postId: string,
  deps: PostsDeps
): Promise<ExistingPost | null> {
  const formattedId = formatPostId(postId);
  return lookWithRetry(async () => {
    const data = await deps.postsApi.getChannelPosts({
      channelId,
      cursor: formattedId,
      mode: 'around',
      count: 1,
      includeReplies: false,
    });
    return (
      data.posts.find(
        (candidate) => formatPostId(candidate.id) === formattedId
      ) ?? null
    );
  }, deps);
}

// The reply lookup is a scry of the acting ship's local %channels: the parent
// with all its replies, tombstones included. A missing reply is a miss.
async function fetchExistingReply(
  channelId: string,
  parentId: string,
  replyId: string,
  deps: PostsDeps
): Promise<{ thread: ExistingThread; reply: ExistingReply } | null> {
  return lookWithRetry(async () => {
    const thread = await deps.postsApi.getPostWithReplies({
      channelId,
      postId: parentId,
    });
    const reply = thread.replies.find(
      (candidate) => formatPostId(candidate.id) === replyId
    );
    return reply ? { thread, reply } : null;
  }, deps);
}

async function editPost(
  parsed: { channelId: string; postId: string; message: string },
  deps: PostsDeps
): Promise<void> {
  // Edit only the message text. Existing metadata (e.g. a heap curio's title) is
  // preserved by reading it back from the existing post — the CLI no longer
  // overrides it, but must not wipe it either.
  const existing = await fetchExistingPost(
    parsed.channelId,
    parsed.postId,
    deps
  );

  if (!existing) {
    // %edit submits the whole essay, so everything this lookup would have
    // preserved — the author object behind the Bot tag, a gallery item's title
    // and cover — is replaced by whatever is sent now. Editing blind is a
    // silent, durable rewrite; failing is visible and retryable once the post
    // is readable.
    const problem = postIdLengthProblem(parsed.postId);
    throw commandError(
      problem
        ? `${problem}. Copy it again from \`messages channel ${parsed.channelId}\`; nothing was changed.`
        : `Could not read ${formatPostId(parsed.postId)} in ${parsed.channelId} to preserve its authorship and metadata; the post may not be readable yet. Retry the edit.`
    );
  }

  const metadata: PostEditMetadata = {
    title: existing.title ?? undefined,
    image: existing.image ?? undefined,
    description: existing.description ?? undefined,
    cover: existing.cover ?? undefined,
  };

  await deps.postsApi.editPost({
    channelId: parsed.channelId,
    postId: formatPostId(parsed.postId),
    authorId: deps.getCurrentUserId(),
    // %edit stores the essay wholesale, so the sent time and blob are handed
    // back as they are (as the app does); blob edits are unsupported.
    sentAt: existing.sentAt,
    content: await buildMessageStory(parsed.channelId, parsed.message, deps),
    metadata,
    ...(existing.blob ? { blob: existing.blob } : {}),
    // Authorship comes from the existing post rather than being re-derived: a
    // bot post keeps its Bot tag, nickname and avatar unchanged, a human post
    // stays bare.
    ...(existing.isBot ? { botProfile: carriedBotProfile(existing) } : {}),
  });
}

// The profile an edit resends for a bot-authored post: exactly what it had.
function carriedBotProfile(existing: {
  botProfile?: BotAuthorProfile | null;
}): BotAuthorProfile {
  return {
    nickname: existing.botProfile?.nickname ?? null,
    avatar: existing.botProfile?.avatar ?? null,
  };
}

function sameBotProfile(a: BotAuthorProfile, b: BotAuthorProfile): boolean {
  return a.nickname === b.nickname && a.avatar === b.avatar;
}

type Confirmation = { confirmed: true } | { confirmed: false; reason: string };

// Poll `read` until `check` passes (returns null). One raw read per attempt; a
// thrown read is "not yet" and its message is kept, so a read error can never
// be mistaken for the requested state.
async function pollConfirm<T>(
  read: () => Promise<T>,
  check: (observed: T) => string | null,
  describeReadError: (error: unknown) => string,
  deps: PostsDeps
): Promise<Confirmation> {
  let reason = '';
  for (let attempt = 1; attempt <= REPLY_CONFIRM_ATTEMPTS; attempt += 1) {
    try {
      const failure = check(await read());
      if (failure === null) {
        return { confirmed: true };
      }
      reason = failure;
    } catch (error) {
      reason = describeReadError(error);
    }
    if (attempt < REPLY_CONFIRM_ATTEMPTS) {
      await sleepFor(deps)(REPLY_CONFIRM_DELAY_MS);
    }
  }
  return { confirmed: false, reason };
}

type ReplyCheck = (observed: ExistingReply | undefined) => string | null;

function confirmReply(
  channelId: string,
  parentId: string,
  replyId: string,
  check: ReplyCheck,
  deps: PostsDeps
): Promise<Confirmation> {
  return pollConfirm(
    async () =>
      (
        await deps.postsApi.getPostWithReplies({
          channelId,
          postId: parentId,
        })
      ).replies.find((candidate) => formatPostId(candidate.id) === replyId),
    check,
    (error) => `the thread could not be read back (${errorMessage(error)})`,
    deps
  );
}

async function editReply(
  parsed: {
    channelId: string;
    postId: string;
    parentId: string;
    message: string;
  },
  deps: PostsDeps
): Promise<void> {
  const nest = parsed.channelId;
  const pid = formatPostId(parsed.parentId);
  const rid = formatPostId(parsed.postId);

  const found = await fetchExistingReply(nest, pid, rid, deps);
  if (!found) {
    throw commandError(
      `Could not read reply ${rid} under ${pid} in ${nest} to preserve its authorship; it may not be readable yet. Retry the edit.`
    );
  }
  const original = found.reply;
  if (original.isDeleted) {
    throw commandError(`Reply ${rid} in ${nest} is deleted; nothing to edit.`);
  }

  // The host accepts a reply %edit only from its author.
  const our = normalizeShip(deps.getCurrentUserId());
  const author = normalizeShip(original.authorId);
  if (author !== our) {
    throw commandError(
      `Can't edit reply ${rid} in ${nest}: it was written by ${author}, not this ship (${our}). Only a reply's author can edit it.`
    );
  }

  const content = await buildMessageStory(nest, parsed.message, deps);
  await deps.postsApi.editPost({
    channelId: nest,
    postId: rid,
    parentId: pid,
    authorId: our,
    sentAt: original.sentAt,
    content,
    ...(original.blob ? { blob: original.blob } : {}),
    ...(original.isBot ? { botProfile: carriedBotProfile(original) } : {}),
  });

  const expectedContentKey = deps.contentKeyOf(content);
  const result = await confirmReply(
    nest,
    pid,
    rid,
    (observed) => {
      if (!observed) return 'the reply is no longer in the thread';
      if (observed.isDeleted) return 'the reply is now deleted';
      if (observed.contentKey !== expectedContentKey) {
        return 'the reply does not show the new content';
      }
      if (observed.sentAt !== original.sentAt) {
        return "the reply's sent time changed";
      }
      if ((observed.blob ?? null) !== (original.blob ?? null)) {
        return "the reply's attachment data changed";
      }
      if (!!observed.isBot !== !!original.isBot) {
        return "the reply's Bot authorship changed";
      }
      if (
        original.isBot &&
        !sameBotProfile(
          carriedBotProfile(observed),
          carriedBotProfile(original)
        )
      ) {
        return "the reply's bot nickname or avatar changed";
      }
      return null;
    },
    deps
  );
  if (!result.confirmed) {
    throw commandError(
      `Edit of reply ${rid} in ${nest} was sent but is not confirmed: ${result.reason}. The channel host may have refused it (for example, this ship may no longer be allowed to write in the channel), or a channel hook may have accepted it but transformed the content.`
    );
  }
}

async function deleteReply(
  parsed: { channelId: string; postId: string; parentId: string },
  deps: PostsDeps
): Promise<'deleted' | 'already-deleted'> {
  const nest = parsed.channelId;
  const pid = formatPostId(parsed.parentId);
  const rid = formatPostId(parsed.postId);

  const found = await fetchExistingReply(nest, pid, rid, deps);
  if (!found) {
    throw commandError(
      `Could not read reply ${rid} under ${pid} in ${nest}; nothing was deleted.`
    );
  }
  const { thread, reply } = found;
  if (reply.isDeleted) {
    return 'already-deleted';
  }

  // The host accepts a reply %del from its author, a group admin or the
  // ship hosting the channel.
  if (
    normalizeShip(reply.authorId) !== normalizeShip(deps.getCurrentUserId())
  ) {
    const state = await readChannelState(nest, deps);
    if (!state.joined) {
      throw commandError(notJoinedMessage(nest));
    }
    await deps.assertCanAdminister(
      state.groupId,
      "delete other members' replies",
      nest
    );
  }

  await deps.postsApi.deleteReply({
    channelId: nest,
    parentId: pid,
    parentAuthorId: thread.authorId,
    postId: rid,
    authorId: reply.authorId,
  });

  // Deletion leaves a tombstone. Absence or a read error proves nothing.
  const result = await confirmReply(
    nest,
    pid,
    rid,
    (observed) => {
      if (!observed) return 'the reply is no longer listed in the thread';
      if (!observed.isDeleted) return 'the reply is still live';
      return null;
    },
    deps
  );
  if (!result.confirmed) {
    throw commandError(
      `Delete of reply ${rid} in ${nest} was sent but is not confirmed: ${result.reason}. The channel host may have refused it.`
    );
  }
  return 'deleted';
}

// Message text as a story, with typed `@all` and `@role-id` as mentions. A
// role is checked against the target group's current roles and an unknown
// `@word` refuses the whole send: sent as text it would silently notify
// nobody. Only text naming a token other than `@all` costs a lookup.
async function buildMessageStory(
  target: string,
  message: string,
  deps: PostsDeps
): Promise<Story> {
  const story = markdownToStory(message, { roleIds: NO_ROLES });
  const unknown = unknownRoleMentions(message, NO_ROLES);
  if (unknown.length === 0) {
    return story;
  }
  if (isDmTarget(target)) {
    throw commandError(dmRoleMentionError(target, unknown));
  }
  const nest = canonicalizeNest(target);
  const state = await readChannelState(nest, deps);
  if (!state.joined) {
    throw commandError(`Cannot check role mentions: ${notJoinedMessage(nest)}`);
  }
  let roleIds: ReadonlySet<string>;
  try {
    roleIds = new Set(await deps.getGroupRoleIds(state.groupId));
  } catch (error) {
    throw commandError(
      `Could not read roles for group ${state.groupId} to check role mentions: ${errorMessage(error)}`
    );
  }
  const still = unknown.filter((token) => !roleIds.has(token.toLowerCase()));
  if (still.length > 0) {
    throw commandError(
      groupRoleMentionError(nest, state.groupId, roleIds, still)
    );
  }
  return markdownToStory(message, { roleIds });
}

function notJoinedMessage(nest: string): string {
  return `${nest} is not a channel this ship has joined; join it first.`;
}

async function assertJoined(nest: string, deps: PostsDeps): Promise<void> {
  const state = await readChannelState(nest, deps);
  if (!state.joined) {
    throw commandError(notJoinedMessage(nest));
  }
}

// The cite the app writes for a channel post: `where` takes undotted ids.
function chanCite(nest: string, postId: string, parentId?: string): StoryVerse {
  const where = parentId
    ? `/msg/${undottedPostId(parentId)}/${undottedPostId(postId)}`
    : `/msg/${undottedPostId(postId)}`;
  return { block: { cite: { chan: { nest, where } } } };
}

// A channel post is quoted as a reference card; a DM post, which has no card,
// as a blockquote of its first line.
interface QuoteVerse {
  cite: boolean;
  verse: StoryVerse;
}

async function readChannelQuote(
  source: QuoteSource,
  deps: PostsDeps
): Promise<QuoteVerse> {
  const nest = source.channelId;
  // Reading the post needs local %channels state, and "join it first" says
  // more than a failed read would.
  await assertJoined(nest, deps);
  if (source.parentId !== undefined) {
    const pid = formatPostId(source.parentId);
    const rid = formatPostId(source.postId);
    const found = await fetchExistingReply(nest, pid, rid, deps);
    if (!found) {
      throw commandError(
        `Could not read reply ${rid} under ${pid} in ${nest}; nothing was sent.`
      );
    }
    if (found.reply.isDeleted) {
      throw commandError(
        `Reply ${rid} in ${nest} is deleted; nothing was sent.`
      );
    }
  } else {
    const id = formatPostId(source.postId);
    // A deleted top-level post is not served at all, so it lands here too.
    const thread = await lookWithRetry(
      () => deps.postsApi.getPostWithReplies({ channelId: nest, postId: id }),
      deps
    );
    if (!thread) {
      throw commandError(
        `Could not read post ${id} in ${nest}; nothing was sent.`
      );
    }
    if (thread.isDeleted) {
      throw commandError(`Post ${id} in ${nest} is deleted; nothing was sent.`);
    }
  }
  return {
    cite: true,
    verse: chanCite(nest, source.postId, source.parentId),
  };
}

async function readDmQuote(
  source: QuoteSource,
  deps: PostsDeps
): Promise<QuoteVerse> {
  const { channelId } = source;
  const time = formatPostId(source.postId);
  const slash = source.postId.indexOf('/');
  const our = normalizeShip(deps.getCurrentUserId());
  // A DM post is addressed by its author as well as its time. Without an
  // explicit `~author/` the author is the peer or us in a one-to-one DM; in a
  // group DM only our own posts can be found.
  const authors =
    slash > 0
      ? [normalizeShip(source.postId.slice(0, slash))]
      : isOneToOneDmTarget(channelId) && normalizeShip(channelId) !== our
        ? [normalizeShip(channelId), our]
        : [our];
  const thread = await lookWithRetry(async () => {
    for (const authorId of authors) {
      try {
        return await deps.postsApi.getPostWithReplies({
          channelId,
          postId: time,
          authorId,
        });
      } catch {
        // A miss rejects rather than returning null; try the next author.
      }
    }
    return null;
  }, deps);
  if (!thread) {
    // A one-to-one DM has already tried both possible authors.
    const authorHint = isOneToOneDmTarget(channelId)
      ? ''
      : ` Another member's post in a group DM needs its author: ~author/${time}.`;
    throw commandError(
      `Could not read post ${time} in ${channelId}; nothing was sent.${authorHint}`
    );
  }
  if (thread.isDeleted) {
    throw commandError(
      `Post ${time} in ${channelId} is deleted; nothing was sent.`
    );
  }
  const firstLine = (thread.quoteText ?? '').split('\n')[0].trim();
  if (!firstLine) {
    throw commandError(
      `Post ${time} in ${channelId} has no text to quote; nothing was sent.`
    );
  }
  return { cite: false, verse: { inline: [{ blockquote: [firstLine] }] } };
}

function readQuoteSource(
  source: QuoteSource,
  deps: PostsDeps
): Promise<QuoteVerse> {
  return isDmTarget(source.channelId)
    ? readDmQuote(source, deps)
    : readChannelQuote(source, deps);
}

// Where the app puts a quote: a DM quote leads; a cite leads in a chat post and
// in any thread reply (the thread composer is always the chat composer), and
// follows the text in a gallery post or a DM.
function withQuote(
  kind: 'send' | 'reply',
  target: string,
  quote: QuoteVerse,
  text: Story
): Story {
  const leads =
    !quote.cite ||
    kind === 'reply' ||
    (!isDmTarget(target) && parseNest(target).kind === 'chat');
  return leads ? [quote.verse, ...text] : [...text, quote.verse];
}

// The new post must be readable locally for the read-back to see it.
async function assertJoinedTarget(
  target: string,
  deps: PostsDeps
): Promise<void> {
  if (!isDmTarget(target)) {
    await assertJoined(target, deps);
  }
}

interface SentPost {
  verb: 'Message' | 'Reply' | 'Forward';
  channelId: string;
  sentAt: number;
  content: Story;
  parent?: { id: string; authorId: string };
}

interface ReadBackPost {
  id: string;
  isDeleted?: boolean | null;
  contentKey?: string;
}

const NEW_POST_READ_BACK_COUNT = 20;

// Find the post just sent, by its author and sent time, and check it shows
// what was sent. Returns the line that names it: a Ref for a channel post, the
// post's ID for a DM, which has no reference card.
async function confirmSentPost(
  sent: SentPost,
  deps: PostsDeps
): Promise<string> {
  const nest = sent.channelId;
  const dm = isDmTarget(nest);
  const our = normalizeShip(deps.getCurrentUserId());
  const expectedKey = deps.contentKeyOf(sent.content);
  const isOurs = (post: { authorId?: string; sentAt?: number }) =>
    normalizeShip(post.authorId ?? '') === our && post.sentAt === sent.sentAt;
  const parent = sent.parent && {
    ...sent.parent,
    id: formatPostId(sent.parent.id),
  };

  let read: () => Promise<ReadBackPost | undefined>;
  let missing: string;
  let readSubject: string;
  let recheck: string;
  if (parent) {
    read = async () =>
      (
        await deps.postsApi.getPostWithReplies({
          channelId: nest,
          postId: parent.id,
          ...(dm ? { authorId: parent.authorId } : {}),
        })
      ).replies.find(isOurs);
    missing = `no reply by ${our} with this sent time is in the thread yet`;
    readSubject = dm ? 'DM' : 'thread';
    recheck = dm
      ? `messages post ${nest} ${parent.id} --author ${parent.authorId}`
      : `messages post ${nest} ${parent.id}`;
  } else if (dm) {
    read = () =>
      deps.postsApi.getPostWithReplies({
        channelId: nest,
        postId: dmWritTime(sent.sentAt),
        authorId: our,
      });
    missing = 'the DM could not be read back';
    readSubject = 'DM';
    recheck = isOneToOneDmTarget(nest)
      ? `messages dm ${nest} --limit 5`
      : `messages channel ${nest} --limit 5`;
  } else {
    read = async () =>
      (
        await deps.postsApi.getChannelPosts({
          channelId: nest,
          mode: 'newest',
          count: NEW_POST_READ_BACK_COUNT,
          includeReplies: false,
        })
      ).posts.find(isOurs);
    missing = `no post by ${our} with this sent time is among the channel's newest ${NEW_POST_READ_BACK_COUNT} posts yet`;
    readSubject = 'channel';
    recheck = `messages channel ${nest} --limit 5`;
  }

  let confirmedId = '';
  const result = await pollConfirm(
    read,
    (post) => {
      if (!post) return missing;
      if (post.isDeleted) return 'the post is deleted';
      if (post.contentKey !== expectedKey) {
        return 'the post shows different content (a channel hook may have changed it)';
      }
      confirmedId = post.id;
      return null;
    },
    (error) =>
      `the ${readSubject} could not be read back (${errorMessage(error)})`,
    deps
  );
  if (!result.confirmed) {
    throw commandError(
      `${sent.verb} to ${nest} was sent but is not confirmed: ${result.reason}. It may still arrive. Do not send it again; check first with \`${recheck}\``
    );
  }
  if (dm) {
    return `  ID: ${our}/${dmWritTime(sent.sentAt)}`;
  }
  const ids = parent ? [parent.id, confirmedId] : [confirmedId];
  return `  Ref: /1/chan/${nest}/msg/${ids.map(undottedPostId).join('/')}`;
}

async function sendWithQuote(
  parsed: SendArgs | ReplyArgs,
  source: QuoteSource,
  deps: PostsDeps
): Promise<string> {
  // The text is checked first so a refused mention fails before the source
  // read.
  const text = parsed.message
    ? await buildMessageStory(parsed.channelId, parsed.message, deps)
    : [];
  const quote = await readQuoteSource(source, deps);
  await assertJoinedTarget(parsed.channelId, deps);
  const content = withQuote(parsed.kind, parsed.channelId, quote, text);
  if (parsed.kind === 'reply') {
    const { sentAt, parentAuthor } = await sendReply(parsed, content, deps);
    return confirmSentPost(
      {
        verb: 'Reply',
        channelId: parsed.channelId,
        sentAt,
        content,
        parent: { id: parsed.postId, authorId: parentAuthor },
      },
      deps
    );
  }
  const sentAt = await sendPost(parsed, content, deps);
  return confirmSentPost(
    { verb: 'Message', channelId: parsed.channelId, sentAt, content },
    deps
  );
}

// As the app forwards: the reference alone, with no text, metadata, blob or
// bot profile.
async function forwardPost(
  parsed: ForwardArgs,
  deps: PostsDeps
): Promise<string> {
  const quote = await readChannelQuote(parsed.source, deps);
  await assertJoinedTarget(parsed.target, deps);
  const content: Story = [quote.verse];
  const authorId = deps.getCurrentUserId();
  const sentAt = parsed.sentAt ?? deps.now();
  await deps.postsApi.sendPost({
    channelId: parsed.target,
    authorId,
    sentAt,
    content,
  });
  return confirmSentPost(
    { verb: 'Forward', channelId: parsed.target, sentAt, content },
    deps
  );
}

async function readChannelState(
  nest: string,
  deps: PostsDeps
): Promise<ChannelState> {
  try {
    return await deps.getChannelState(nest);
  } catch (error) {
    throw commandError(
      `Could not read channel state for ${nest}: ${errorMessage(error)}`
    );
  }
}

// The admin check and target read can take seconds; the order is re-read right
// before deciding so the write composes on current state. The group must not
// have changed in between.
async function freshChannelState(
  nest: string,
  checkedGroupId: string,
  deps: PostsDeps
): Promise<{ groupId: string; order: string[] }> {
  const fresh = await readChannelState(nest, deps);
  if (!fresh.joined || fresh.groupId !== checkedGroupId) {
    throw commandError(
      `Channel state for ${nest} changed while checking; nothing changed. Retry.`
    );
  }
  return fresh;
}

function formatOrder(order: string[]): string {
  return `[${order.join(', ')}]`;
}

// The local order changes only when the host's update arrives, so an exact
// match in the expected group is host confirmation. Anything else — a read
// error, an unjoined channel, another group, any other order — is not.
async function confirmOrder(
  verb: 'Pin' | 'Unpin',
  nest: string,
  postId: string,
  expectedGroupId: string,
  expectedOrder: string[],
  deps: PostsDeps
): Promise<void> {
  let observedDescription = 'unreadable';
  let lastReadError: string | null = null;
  for (let attempt = 1; attempt <= PIN_CONFIRM_ATTEMPTS; attempt += 1) {
    try {
      const observed = await deps.getChannelState(nest);
      lastReadError = null;
      if (observed.joined) {
        const observedOrder = observed.order.map(formatPostId);
        if (
          observed.groupId === expectedGroupId &&
          observedOrder.length === expectedOrder.length &&
          observedOrder.every((id, i) => id === expectedOrder[i])
        ) {
          return;
        }
        observedDescription =
          observed.groupId === expectedGroupId
            ? formatOrder(observedOrder)
            : `${formatOrder(observedOrder)} under group ${observed.groupId}`;
      } else {
        observedDescription = 'unreadable (the channel is not joined)';
      }
    } catch (error) {
      observedDescription = 'unreadable';
      lastReadError = errorMessage(error);
    }
    if (attempt < PIN_CONFIRM_ATTEMPTS) {
      await sleepFor(deps)(PIN_CONFIRM_DELAY_MS);
    }
  }
  const errorSuffix = lastReadError
    ? ` (last read error: ${lastReadError})`
    : '';
  throw commandError(
    `${verb} of ${postId} in ${nest} was sent but is not confirmed: the channel order is now ${observedDescription}, expected ${formatOrder(expectedOrder)}. The channel host may have refused it, or another change landed at the same time.${errorSuffix}`
  );
}

async function pinPost(
  parsed: { channelId: string; postId: string },
  deps: PostsDeps
): Promise<'pinned' | 'already-pinned'> {
  const nest = parsed.channelId;
  const id = formatPostId(parsed.postId);

  const checked = await readChannelState(nest, deps);
  if (!checked.joined) {
    throw commandError(notJoinedMessage(nest));
  }
  await deps.assertCanAdminister(checked.groupId, 'pin posts', nest);

  // The host stores any id it is given, so this read is what keeps a reply,
  // deleted or mistyped id from becoming a phantom pin.
  const target = await lookWithRetry(
    () => deps.postsApi.getPostWithReplies({ channelId: nest, postId: id }),
    deps
  );
  if (!target || target.isDeleted) {
    throw commandError(
      `Could not read post ${id} in ${nest}; only an existing top-level post can be pinned.`
    );
  }

  const current = await freshChannelState(nest, checked.groupId, deps);
  const pinned = current.order[0];
  if (pinned !== undefined && formatPostId(pinned) === id) {
    return 'already-pinned';
  }

  // As the app does: the new pin first, the rest (old pin included) after it.
  // Scry ids are undotted; %order parses dotted @ud.
  const next = [
    id,
    ...current.order.map(formatPostId).filter((other) => other !== id),
  ];
  await deps.postsApi.setOrder(nest, next);
  await confirmOrder('Pin', nest, id, current.groupId, next, deps);
  return 'pinned';
}

async function unpinPost(
  parsed: { channelId: string; postId: string },
  deps: PostsDeps
): Promise<{ nowPinned: string | null }> {
  const nest = parsed.channelId;
  const id = formatPostId(parsed.postId);

  const checked = await readChannelState(nest, deps);
  if (!checked.joined) {
    throw commandError(notJoinedMessage(nest));
  }
  await deps.assertCanAdminister(checked.groupId, 'unpin posts', nest);

  const current = await freshChannelState(nest, checked.groupId, deps);
  const pinned = current.order[0];
  if (pinned === undefined) {
    throw commandError(
      `Post ${id} is not pinned in ${nest}: nothing is pinned. Nothing changed.`
    );
  }
  if (formatPostId(pinned) !== id) {
    throw commandError(
      `Post ${id} is not pinned in ${nest}: ${formatPostId(pinned)} is. Nothing changed.`
    );
  }

  // As the app does: drop the pin from the order, so an earlier pin queued
  // behind it becomes order[0] again.
  const next = current.order.map(formatPostId).filter((other) => other !== id);
  await deps.postsApi.setOrder(nest, next);
  await confirmOrder('Unpin', nest, id, current.groupId, next, deps);
  return { nowPinned: next[0] ?? null };
}

export async function run(args: string[], deps: PostsDeps): Promise<number> {
  try {
    const parsed = parseArgs(args);

    if (parsed.kind === 'help') {
      return writeHelp(deps, parsed.help);
    }

    await deps.authenticate(postTargetApps(parsed));

    switch (parsed.kind) {
      case 'send': {
        if (parsed.quote) {
          const named = await sendWithQuote(parsed, parsed.quote, deps);
          writeLine(deps.stdout, '✓ Message sent');
          writeLine(deps.stdout, named);
          return 0;
        }
        const plain = await plainSendContent(parsed, deps);
        await sendPost(parsed, plain.content, deps, plain);
        writeLine(deps.stdout, '✓ Message sent');
        writePostRefHint(parsed.channelId, deps);
        return 0;
      }
      case 'reply': {
        if (parsed.quote) {
          const named = await sendWithQuote(parsed, parsed.quote, deps);
          writeLine(deps.stdout, '✓ Reply sent');
          writeLine(deps.stdout, named);
          return 0;
        }
        await sendReply(
          parsed,
          await buildMessageStory(parsed.channelId, parsed.message, deps),
          deps
        );
        writeLine(deps.stdout, '✓ Reply sent');
        writePostRefHint(parsed.channelId, deps, formatPostId(parsed.postId));
        return 0;
      }
      case 'forward': {
        const named = await forwardPost(parsed, deps);
        writeLine(deps.stdout, '✓ Post forwarded');
        writeLine(deps.stdout, named);
        return 0;
      }
      case 'react':
        await reactToPost(parsed, deps);
        writeLine(deps.stdout, '✓ Reaction added');
        return 0;
      case 'unreact':
        await unreactToPost(parsed, deps);
        writeLine(deps.stdout, '✓ Reaction removed');
        return 0;
      case 'delete':
        if (parsed.parentId !== undefined) {
          const outcome = await deleteReply(
            { ...parsed, parentId: parsed.parentId },
            deps
          );
          writeLine(
            deps.stdout,
            outcome === 'already-deleted'
              ? '✓ Reply already deleted'
              : '✓ Reply deleted'
          );
          return 0;
        }
        await deletePost(parsed, deps);
        writeLine(deps.stdout, '✓ Post deleted');
        return 0;
      case 'edit':
        if (parsed.parentId !== undefined) {
          await editReply({ ...parsed, parentId: parsed.parentId }, deps);
          writeLine(deps.stdout, '✓ Reply edited');
          return 0;
        }
        await editPost(parsed, deps);
        writeLine(deps.stdout, '✓ Post edited');
        return 0;
      case 'pin': {
        const outcome = await pinPost(parsed, deps);
        writeLine(
          deps.stdout,
          outcome === 'already-pinned'
            ? '✓ Post already pinned'
            : '✓ Post pinned'
        );
        return 0;
      }
      case 'unpin': {
        const { nowPinned } = await unpinPost(parsed, deps);
        writeLine(deps.stdout, '✓ Post unpinned');
        if (nowPinned) {
          writeLine(deps.stdout, `  Now pinned: ${nowPinned}`);
        }
        return 0;
      }
    }
  } catch (error) {
    const handled = handleExpectedCommandError(error, deps);
    if (handled !== null) return handled;
    throw error;
  }
}
