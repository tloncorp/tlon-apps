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
  formatPostId,
  isDiaryNest,
  isNotesNest,
  parseNest,
} from '../cli-utils';
import { imageFlagIndex, validatedImageFlag } from '../image-attach';
import {
  NO_ROLES,
  type Story,
  type StoryVerse,
  dmRoleMentionError,
  groupRoleMentionError,
  markdownToStory,
  unknownRoleMentions,
} from '../markdown';
import { defaultReplyParentAuthor } from '../post-targets';
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
  send <channel> [message]                 Send a message to a channel [--blob <json>] [--image <url>] [--title <text>] [--bot]
  reply <channel> <post-id> <message>      Reply to a channel post [--author ~ship] [--blob <json>] [--bot]
  react <channel> <post-id> <emoji>     React to a post with an emoji [--parent <post-id>]
  unreact <channel> <post-id>           Remove your reaction from a post [--parent <post-id>]
  edit <channel> <post-id> <message>    Edit a post's message text [--parent <post-id>]
  delete <channel> <post-id>            Delete a post [--parent <post-id>]
  pin <channel> <post-id>               Pin a post to the top of a channel (admin)
  unpin <channel> <post-id>             Unpin the channel's pinned post (admin)

Send options:
  --blob <json>        Attach a post-blob JSON array (e.g. an a2ui entry)
  --image <url>        Attach an image (direct png/jpeg/gif/webp URL, e.g. from
                       'tlon upload'); message becomes an optional caption
  --title <text>       Set a title on a gallery (heap/) post
  --sent-at <ms>       Override the send timestamp (unix ms); the post id
                       derives from it. Applies to send and reply.
  --bot                Author the message as a bot (renders the "Bot" tag).
                       Applies to send and reply.

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
  @word is refused; wrap it in backticks to send it as text. Mentions notify only
  in plain paragraph text, not inside bold, quotes, headings, lists or tables, and
  edits never notify. An edit re-validates every @role against the group's current
  roles, so an edit keeping a since-deleted role is refused.

Examples:
  tlon posts send chat/~host/channel "Hello from tlon"
  tlon posts send chat/~host/channel "Look at this" --image https://storage.../tree.png
  tlon posts send heap/~host/gallery "A link or caption" --title "Gallery item"
  tlon posts reply chat/~host/channel 170.141... "Thread reply"
  tlon posts edit chat/~host/channel 170.141... "Updated message"
  tlon posts pin chat/~host/channel 170.141...
  tlon posts delete chat/~host/channel 170.142... --parent 170.141...

Channel format: chat/~host/channel-name, heap/~host/name
Use 'tlon messages channel <nest> --limit N' to see post IDs.`;

export const POSTS_COMMAND_HELP: Record<string, string> = {
  send: 'Usage: tlon posts send <channel> [message] [--blob <json>] [--image <url>] [--title <text>] [--sent-at <ms>] [--bot] (message optional with --image)',
  reply:
    'Usage: tlon posts reply <channel> <post-id> <message> [--author ~ship] [--blob <json>] [--sent-at <ms>] [--bot]',
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
  ...BOT_PROFILE_OPTION_FLAGS,
] as const;
const POST_SEND_OPTION_FLAGS = [
  'blob',
  'image',
  'title',
  'sent-at',
  ...BOT_PROFILE_OPTION_FLAGS,
] as const;

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
  metadata?: { title?: string };
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
  cursor: string;
  mode: 'around';
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
}

export interface PostLookupResult {
  posts: ExistingPost[];
}

export interface PostThreadQuery {
  channelId: string;
  postId: string;
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

type ParsedPostsArgs =
  | { kind: 'help'; help: string }
  | {
      kind: 'send';
      channelId: string;
      message: string;
      imageUrl?: string;
      title?: string;
      blob?: string;
      sentAt?: number;
      botProfile?: BotAuthorProfile;
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
    }
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
  if (idx === -1) {
    return undefined;
  }
  const raw = args[idx + 1];
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

function validatedBlobFlag(
  args: string[],
  help: string = POSTS_COMMAND_HELP.send
): string | undefined {
  const blobIdx = args.indexOf('--blob');
  if (blobIdx === -1) {
    return undefined;
  }
  const blob = args[blobIdx + 1];
  if (!blob) {
    throw usageError(help);
  }
  try {
    if (!Array.isArray(JSON.parse(blob))) {
      throw new Error('not an array');
    }
  } catch {
    throw commandError('--blob must be a JSON array of post-blob entries');
  }
  return blob;
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

function validatedTitleFlag(args: string[], usage: string): string | undefined {
  const titleIdx = args.indexOf('--title');
  if (titleIdx === -1) {
    return undefined;
  }
  const title = args[titleIdx + 1];
  if (!title || title.startsWith('--')) {
    throw usageError(usage);
  }
  return title;
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

// Send treats `--image`/`--image=` (via imageFlagIndex) as a boundary too.
function firstPostSendFlagIndex(args: string[]): number {
  const indexes = [
    ...POST_SEND_OPTION_FLAGS.map((flag) =>
      flag === 'image' ? imageFlagIndex(args) : args.indexOf(`--${flag}`)
    ),
    botProfileFlagIndex(args),
  ].filter((idx) => idx !== -1);
  return indexes.length > 0 ? Math.min(...indexes) : args.length;
}

// Reply's flags are plain tokens except the bot value flags, which also accept
// the `--flag=value` form.
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

function getPostSendMessage(args: string[]): string {
  return args.slice(2, firstPostSendFlagIndex(args)).join(' ');
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
// rather than %channels; everything else authenticates against %channels.
function postTargetApps(
  command: string,
  target: string | undefined
): PostAuthApp[] {
  if ((command === 'send' || command === 'reply') && target) {
    return isDmTarget(target) ? ['chat'] : ['channels'];
  }
  return ['channels'];
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

  switch (command) {
    case 'send': {
      const imageUrl = validatedImageFlag(args, POSTS_COMMAND_HELP.send);
      const message = getPostSendMessage(args);
      if (!args[1] || (!message && !imageUrl)) {
        throw usageError(POSTS_COMMAND_HELP.send);
      }
      const blob = validatedBlobFlag(args);
      const title = validatedTitleFlag(args, POSTS_COMMAND_HELP.send);
      if (title !== undefined && !args[1].startsWith('heap/')) {
        throw usageError(
          '--title is only supported for gallery (heap/) posts',
          POSTS_COMMAND_HELP.send
        );
      }
      const sentAt = validatedSentAt(args, POSTS_COMMAND_HELP.send);
      const botProfile = validatedBotProfile(args, POSTS_COMMAND_HELP.send);
      return {
        kind: 'send',
        channelId: args[1],
        message,
        imageUrl,
        title,
        blob,
        sentAt,
        botProfile,
      };
    }
    case 'reply': {
      const channelId = args[1];
      const postId = args[2];
      const message = getPostReplyMessage(args);
      if (!channelId || !postId || !message) {
        throw usageError(POSTS_COMMAND_HELP.reply);
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
        channelId,
        postId,
        message,
        parentAuthor,
        blob,
        sentAt,
        botProfile,
      };
    }
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

async function reactToPost(
  parsed: {
    channelId: string;
    postId: string;
    emoji: string;
    parentId?: string;
  },
  deps: PostsDeps
): Promise<void> {
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
  const our = deps.getCurrentUserId();
  await deps.postsApi.removeReaction({
    channelId: parsed.channelId,
    postId: formatPostId(parsed.postId),
    our,
    postAuthor: our,
    ...(parsed.parentId ? { parentId: formatPostId(parsed.parentId) } : {}),
  });
}

async function deletePost(
  parsed: { channelId: string; postId: string },
  deps: PostsDeps
): Promise<void> {
  await deps.postsApi.deletePost({
    channelId: parsed.channelId,
    postId: formatPostId(parsed.postId),
    authorId: deps.getCurrentUserId(),
  });
}

async function buildImageVerse(
  url: string,
  deps: PostsDeps
): Promise<StoryVerse> {
  try {
    return await deps.buildImageVerse(url);
  } catch (error) {
    throw commandError(errorMessage(error));
  }
}

async function sendPost(
  parsed: {
    channelId: string;
    message: string;
    imageUrl?: string;
    title?: string;
    blob?: string;
    sentAt?: number;
    botProfile?: BotAuthorProfile;
  },
  deps: PostsDeps
): Promise<void> {
  // The caption is checked first so a refused mention fails before the image
  // fetch.
  const caption = parsed.message
    ? await buildMessageStory(parsed.channelId, parsed.message, deps)
    : [];
  // Image block first, caption after — matches how the apps compose
  // attachment posts.
  const imageVerse = parsed.imageUrl
    ? await buildImageVerse(parsed.imageUrl, deps)
    : undefined;
  const content: Story = [...(imageVerse ? [imageVerse] : []), ...caption];

  await deps.postsApi.sendPost({
    channelId: parsed.channelId,
    authorId: deps.getCurrentUserId(),
    sentAt: parsed.sentAt ?? deps.now(),
    content,
    blob: parsed.blob,
    ...(parsed.title ? { metadata: { title: parsed.title } } : {}),
    ...(parsed.botProfile ? { botProfile: parsed.botProfile } : {}),
  });
}

async function sendReply(
  parsed: {
    channelId: string;
    postId: string;
    message: string;
    parentAuthor?: string;
    blob?: string;
    sentAt?: number;
    botProfile?: BotAuthorProfile;
  },
  deps: PostsDeps
): Promise<void> {
  const content = await buildMessageStory(
    parsed.channelId,
    parsed.message,
    deps
  );
  const authorId = deps.getCurrentUserId();
  await deps.postsApi.sendReply({
    channelId: parsed.channelId,
    parentId: formatPostId(parsed.postId),
    parentAuthor: defaultReplyParentAuthor(
      parsed.channelId,
      authorId,
      parsed.parentAuthor
    ),
    content,
    sentAt: parsed.sentAt ?? deps.now(),
    authorId,
    blob: parsed.blob,
    ...(parsed.botProfile ? { botProfile: parsed.botProfile } : {}),
  });
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
    throw commandError(
      `Could not read ${formatPostId(parsed.postId)} in ${parsed.channelId} to preserve its authorship and metadata; the post may not be readable yet. Retry the edit.`
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

type ReplyCheck = (observed: ExistingReply | undefined) => string | null;

// Poll the parent's replies until `check` passes (returns null). One raw read
// per attempt; a thrown read is "not yet" and its message is kept, so a read
// error can never be mistaken for the requested state.
async function confirmReply(
  channelId: string,
  parentId: string,
  replyId: string,
  check: ReplyCheck,
  deps: PostsDeps
): Promise<{ confirmed: true } | { confirmed: false; reason: string }> {
  let reason = 'the reply could not be read back';
  for (let attempt = 1; attempt <= REPLY_CONFIRM_ATTEMPTS; attempt += 1) {
    try {
      const thread = await deps.postsApi.getPostWithReplies({
        channelId,
        postId: parentId,
      });
      const observed = thread.replies.find(
        (candidate) => formatPostId(candidate.id) === replyId
      );
      const failure = check(observed);
      if (failure === null) {
        return { confirmed: true };
      }
      reason = failure;
    } catch (error) {
      reason = `the thread could not be read back (${errorMessage(error)})`;
    }
    if (attempt < REPLY_CONFIRM_ATTEMPTS) {
      await sleepFor(deps)(REPLY_CONFIRM_DELAY_MS);
    }
  }
  return { confirmed: false, reason };
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

    await deps.authenticate(postTargetApps(parsed.kind, parsed.channelId));

    switch (parsed.kind) {
      case 'send':
        await sendPost(parsed, deps);
        writeLine(deps.stdout, '✓ Message sent');
        writePostRefHint(parsed.channelId, deps);
        return 0;
      case 'reply':
        await sendReply(parsed, deps);
        writeLine(deps.stdout, '✓ Reply sent');
        writePostRefHint(parsed.channelId, deps, formatPostId(parsed.postId));
        return 0;
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
