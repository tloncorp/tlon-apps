import {
  BOT_PROFILE_OPTION_FLAGS,
  type BotAuthorProfile,
  botProfileFlagIndex,
  parseBotProfileFlags,
} from '../bot-profile-flags';
import {
  DIARY_REMOVED,
  NOTES_CHANNEL_CONTENT_UNSUPPORTED,
  isDiaryNest,
  isNotesNest,
} from '../cli-utils';
import { type Story, type StoryVerse, markdownToStory } from '../markdown';
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
  edit <channel> <post-id> [message]    Edit a post's message text and/or blob
                                        [--blob <json>] [--expected-revision <n>] [--force]
  delete <channel> <post-id>            Delete a post

Send options:
  --blob <json>        Attach a post-blob JSON array (e.g. an a2ui entry)
  --image <url>        Attach an image (direct png/jpeg/gif/webp URL, e.g. from
                       'tlon upload'); message becomes an optional caption
  --title <text>       Set a title on a gallery (heap/) post
  --sent-at <ms>       Override the send timestamp (unix ms); the post id
                       derives from it. Applies to send and reply.
  --bot                Author the message as a bot (renders the "Bot" tag).
                       Applies to send and reply.

Edit options:
  --blob <json>        Replace the post's blob with this post-blob JSON array.
                       Omit to keep the existing blob; pass '[]' to clear it.
  --expected-revision <n>
                       Only apply if the post's interactive-surface entry is
                       still at revision n. Requires --blob. Advisory: it is
                       checked against a fresh read, not held as a lock.
  --force              Allow a --blob that drops the post's a2ui entry, which
                       otherwise deletes the card for everyone.

Examples:
  tlon posts send chat/~host/channel "Hello from tlon"
  tlon posts send chat/~host/channel "Look at this" --image https://storage.../tree.png
  tlon posts send heap/~host/gallery "A link or caption" --title "Gallery item"
  tlon posts reply chat/~host/channel 170.141... "Thread reply"
  tlon posts edit chat/~host/channel 170.141... "Updated message"
  tlon posts edit chat/~host/channel 170.141... --blob "$(cat card.json)" --expected-revision 3

Channel format: chat/~host/channel-name, heap/~host/name
Use 'tlon messages channel <nest> --limit N' to see post IDs.`;

export const POSTS_COMMAND_HELP: Record<string, string> = {
  send: 'Usage: tlon posts send <channel> [message] [--blob <json>] [--image <url>] [--title <text>] [--sent-at <ms>] [--bot] (message optional with --image)',
  reply:
    'Usage: tlon posts reply <channel> <post-id> <message> [--author ~ship] [--blob <json>] [--sent-at <ms>] [--bot]',
  react:
    'Usage: tlon posts react <channel> <post-id> <emoji> [--parent <post-id>]',
  unreact: 'Usage: tlon posts unreact <channel> <post-id> [--parent <post-id>]',
  edit: 'Usage: tlon posts edit <channel> <post-id> [message] [--blob <json>] [--expected-revision <n>] [--force] (message optional with --blob)',
  delete: 'Usage: tlon posts delete <channel> <post-id>',
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
const POST_EDIT_OPTION_FLAGS = ['blob', 'expected-revision', 'force'] as const;
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
  authorId: string;
  sentAt: number;
  content: Story;
  metadata: PostEditMetadata;
  /**
   * The post's blob after the edit.
   *
   * Always populated, because the transport sends `blob ?? null` and %edit
   * stores the essay wholesale — leaving this off erases whatever the post
   * carried. `editPost` defaults it to the existing blob.
   */
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
  title?: string | null;
  image?: string | null;
  description?: string | null;
  cover?: string | null;
  isBot?: boolean | null;
  // Read so an edit can put them back. %edit submits the whole essay, so
  // anything not re-sent is erased — see the comment in editPost.
  blob?: string | null;
  // A JSON column, so it arrives either already parsed or as a string
  // depending on the caller. `existingStory` narrows it.
  content?: unknown;
}

export interface PostLookupResult {
  posts: ExistingPost[];
}

export interface PostsApi {
  addReaction: (input: PostReactionInput) => Promise<void>;
  removeReaction: (input: PostReactionRemoveInput) => Promise<void>;
  deletePost: (input: PostDeleteInput) => Promise<void>;
  editPost: (input: PostEditInput) => Promise<void>;
  sendPost: (input: PostSendInput) => Promise<void>;
  sendReply: (input: PostReplyInput) => Promise<void>;
  getChannelPosts: (query: PostLookupQuery) => Promise<PostLookupResult>;
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
  | { kind: 'delete'; channelId: string; postId: string }
  | {
      kind: 'edit';
      channelId: string;
      postId: string;
      message: string;
      blob?: string;
      expectedRevision?: number;
      force: boolean;
    };

function extractNumericId(id: string): string {
  const slash = id.indexOf('/');
  return slash >= 0 ? id.slice(slash + 1) : id;
}

function formatUd(id: string): string {
  const clean = id.replace(/\./g, '');
  const parts: string[] = [];
  for (let i = clean.length; i > 0; i -= 3) {
    parts.unshift(clean.slice(Math.max(0, i - 3), i));
  }
  return parts.join('.');
}

function formatPostId(postId: string): string {
  return formatUd(extractNumericId(postId));
}

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

// Index of an optional `--image <url>` or `--image=<url>` flag.
function imageFlagIndex(args: string[]): number {
  return args.findIndex(
    (arg) => arg === '--image' || arg.startsWith('--image=')
  );
}

// Value of an optional `--image <url>` / `--image=<url>` flag. Throws a usage
// error when the flag is present but its value is missing.
function imageFlagValue(args: string[], usage: string): string | undefined {
  const idx = imageFlagIndex(args);
  if (idx === -1) {
    return undefined;
  }
  const arg = args[idx];
  const url = arg.startsWith('--image=')
    ? arg.slice('--image='.length)
    : args[idx + 1];
  if (!url) {
    throw usageError(usage);
  }
  return url;
}

// Validate an optional image flag: returns the URL when present and http(s),
// undefined when absent; throws on a malformed flag/value.
function validatedImageFlag(args: string[], usage: string): string | undefined {
  const url = imageFlagValue(args, usage);
  if (!url) {
    return undefined;
  }
  if (!/^https?:\/\//.test(url)) {
    throw commandError(
      '--image must be an http(s) image URL — upload first with `tlon upload`'
    );
  }
  return url;
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

function firstPostEditFlagIndex(args: string[]): number {
  return firstFlagIndex(args, POST_EDIT_OPTION_FLAGS);
}

// The message is everything between the post id and the first option flag. It
// may be empty, but only when --blob is carrying the edit.
function getPostEditMessage(args: string[]): string {
  return args.slice(3, firstPostEditFlagIndex(args)).join(' ');
}

// Parsed as a whole number: a revision is a count, and `--expected-revision 2.5`
// or `-1` is a caller mistake rather than something to round.
function validatedExpectedRevisionFlag(args: string[]): number | undefined {
  const idx = args.indexOf('--expected-revision');
  if (idx === -1) {
    return undefined;
  }
  const raw = args[idx + 1];
  if (!raw) {
    throw usageError(POSTS_COMMAND_HELP.edit);
  }
  if (!/^\d+$/.test(raw)) {
    throw commandError('--expected-revision must be a non-negative integer');
  }
  return Number(raw);
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
    return target.startsWith('~') || target.startsWith('0v')
      ? ['chat']
      : ['channels'];
  }
  return ['channels'];
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
      return {
        kind: 'react',
        channelId,
        postId,
        emoji,
        parentId: optionalReactionParent(args, POSTS_COMMAND_HELP.react),
      };
    }
    case 'unreact': {
      const [, channelId, postId] = args;
      if (!channelId || !postId) {
        throw usageError(POSTS_COMMAND_HELP.unreact);
      }
      if (channelId.startsWith('--') || postId.startsWith('--')) {
        throw usageError(POSTS_COMMAND_HELP.unreact);
      }
      return {
        kind: 'unreact',
        channelId,
        postId,
        parentId: optionalReactionParent(args, POSTS_COMMAND_HELP.unreact),
      };
    }
    case 'delete': {
      const [, channelId, postId] = args;
      if (!channelId || !postId) {
        throw usageError(POSTS_COMMAND_HELP.delete);
      }
      return { kind: 'delete', channelId, postId };
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
      const blob = validatedBlobFlag(args, POSTS_COMMAND_HELP.edit);
      const expectedRevision = validatedExpectedRevisionFlag(args);
      const message = getPostEditMessage(args);
      // A blob-only edit is legitimate: updating a card's state need not
      // change its text. Without --blob there is nothing else to edit.
      if (!message && blob === undefined) {
        throw usageError(POSTS_COMMAND_HELP.edit);
      }
      // Guarding an edit against a revision it does not touch is a mistake
      // worth surfacing rather than a harmless no-op.
      if (expectedRevision !== undefined && blob === undefined) {
        throw commandError('--expected-revision requires --blob');
      }
      return {
        kind: 'edit',
        channelId,
        postId,
        message,
        blob,
        expectedRevision,
        force: args.includes('--force'),
      };
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
  // Image block first, caption after — matches how the apps compose
  // attachment posts.
  const imageVerse = parsed.imageUrl
    ? await buildImageVerse(parsed.imageUrl, deps)
    : undefined;
  const content: Story = [
    ...(imageVerse ? [imageVerse] : []),
    ...(parsed.message ? markdownToStory(parsed.message) : []),
  ];

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
  const authorId = deps.getCurrentUserId();
  await deps.postsApi.sendReply({
    channelId: parsed.channelId,
    parentId: formatPostId(parsed.postId),
    parentAuthor: defaultReplyParentAuthor(
      parsed.channelId,
      authorId,
      parsed.parentAuthor
    ),
    content: markdownToStory(parsed.message),
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
// needs at least a host round trip.
export const EDIT_LOOKUP_RETRY_DELAY_MS = 1_500;

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
  const lookOnce = async (): Promise<ExistingPost | null> => {
    try {
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
    } catch {
      return null;
    }
  };

  const first = await lookOnce();
  if (first) {
    return first;
  }
  const sleep =
    deps.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  await sleep(EDIT_LOOKUP_RETRY_DELAY_MS);
  return lookOnce();
}

async function editPost(
  parsed: {
    channelId: string;
    postId: string;
    message: string;
    blob?: string;
    expectedRevision?: number;
    force?: boolean;
  },
  deps: PostsDeps
): Promise<void> {
  // Existing metadata (e.g. a heap curio's title), authorship, content, and
  // blob are all preserved by reading the post back — the CLI does not override
  // what it was not asked to change, but must not wipe it either.
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

  // Advisory, not a lock: this compares against the read above, and nothing
  // stops another writer between here and the poke. It catches an agent acting
  // on state it fetched a moment ago, which is the case that actually happens.
  if (parsed.expectedRevision !== undefined) {
    const current = findInteractiveSurfaceRevision(
      existing.blob,
      parsed.expectedRevision
    );
    if (current !== parsed.expectedRevision) {
      throw commandError(
        `Expected revision ${parsed.expectedRevision} but ${formatPostId(parsed.postId)} is at ${current}. Re-read the post and retry.`
      );
    }
  }

  // The one guard on --blob, and the mistake it catches is expensive: %edit
  // erases any entry not re-sent, so a replacement carrying only the new
  // surface state deletes the card itself from every member's copy.
  if (
    parsed.blob !== undefined &&
    !parsed.force &&
    blobHasA2UI(existing.blob) &&
    !blobHasA2UI(parsed.blob)
  ) {
    throw commandError(
      "Refusing to edit: --blob drops the post's a2ui entry, which deletes the card for everyone. Re-emit the a2ui entry alongside your changes, or pass --force to remove it deliberately."
    );
  }

  await deps.postsApi.editPost({
    channelId: parsed.channelId,
    postId: formatPostId(parsed.postId),
    authorId: deps.getCurrentUserId(),
    sentAt: deps.now(),
    // A blob-only edit keeps the existing text. Re-deriving it from markdown
    // would not round-trip, so the stored story is passed through untouched.
    content: parsed.message
      ? markdownToStory(parsed.message)
      : existingStory(existing),
    metadata,
    // Default to the existing blob. The transport sends `blob ?? null` and
    // %edit stores the essay wholesale, so omitting this erases whatever the
    // post carried — an attachment, a voice memo, a card.
    blob: parsed.blob ?? existing.blob ?? undefined,
    // Authorship shape comes from the existing post rather than being
    // re-derived: a bot post stays bot-authored, a human post stays bare.
    ...(existing.isBot ? { botProfile: { nickname: null, avatar: null } } : {}),
  });
}

// Blob entries, read shallowly.
//
// This deliberately does not use `parsePostBlob` from @tloncorp/api: command
// modules are contract-tested to hold no value imports from it (see
// command-contract.test.ts), and everything below reads is one `type` tag and
// one number. Validating entries is the writer's job and the renderer's — this
// is a CLI guard, and it must not reject a blob carrying an entry shape this
// build has never heard of.
function blobEntries(blob: string | null | undefined): { type?: unknown }[] {
  if (!blob) {
    return [];
  }
  try {
    const parsed = JSON.parse(blob);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// The revision of the post's interactive surface. A post carrying no surface
// entry is at revision 0 by definition, so `--expected-revision 0` against one
// is a match; any other expectation against one is not, and `-1` never matches.
function findInteractiveSurfaceRevision(
  blob: string | null | undefined,
  fallback: number
): number {
  for (const entry of blobEntries(blob)) {
    if (
      entry.type === 'interactive-surface' &&
      typeof (entry as { revision?: unknown }).revision === 'number'
    ) {
      return (entry as { revision: number }).revision;
    }
  }
  return fallback === 0 ? 0 : -1;
}

function blobHasA2UI(blob: string | null | undefined): boolean {
  return blobEntries(blob).some((entry) => entry.type === 'a2ui');
}

// The post's stored content as a story. Unreadable content is a hard failure
// for the same reason an unreadable post is: editing past it rewrites the
// message into something the author never wrote.
function existingStory(existing: ExistingPost): Story {
  const unreadable = () =>
    commandError(
      'Cannot edit the blob alone: this post has no readable content to preserve. Pass a message.'
    );
  const raw = existing.content;
  if (raw == null) {
    throw unreadable();
  }
  const parsed = (() => {
    if (typeof raw !== 'string') {
      return raw;
    }
    try {
      return JSON.parse(raw);
    } catch {
      throw unreadable();
    }
  })();
  if (!Array.isArray(parsed)) {
    throw unreadable();
  }
  return parsed as Story;
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
        return 0;
      case 'reply':
        await sendReply(parsed, deps);
        writeLine(deps.stdout, '✓ Reply sent');
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
        await deletePost(parsed, deps);
        writeLine(deps.stdout, '✓ Post deleted');
        return 0;
      case 'edit':
        await editPost(parsed, deps);
        writeLine(deps.stdout, '✓ Post edited');
        return 0;
    }
  } catch (error) {
    const handled = handleExpectedCommandError(error, deps);
    if (handled !== null) return handled;
    throw error;
  }
}
