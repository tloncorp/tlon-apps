import {
  DIARY_REMOVED,
  NOTES_CHANNEL_CONTENT_UNSUPPORTED,
  isDiaryNest,
  isNotesNest,
} from '../cli-utils';
import { defaultReplyParentAuthor } from '../post-targets';
import { type Story, type StoryVerse, markdownToStory } from '../story';
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
  send <channel> [message]                 Send a message to a channel [--blob <json>] [--image <url>]
  reply <channel> <post-id> <message>      Reply to a channel post [--author ~ship] [--blob <json>]
  react <channel> <post-id> <emoji>     React to a post with an emoji
  unreact <channel> <post-id>           Remove your reaction from a post
  edit <channel> <post-id> <message>    Edit a post's message text
  delete <channel> <post-id>            Delete a post

Send options:
  --blob <json>        Attach a post-blob JSON array (e.g. an a2ui entry)
  --image <url>        Attach an image (direct png/jpeg/gif/webp URL, e.g. from
                       'tlon upload'); message becomes an optional caption
  --sent-at <ms>       Override the send timestamp (unix ms); the post id
                       derives from it. Applies to send and reply.

Examples:
  tlon posts send chat/~host/channel "Hello from tlon"
  tlon posts send chat/~host/channel "Look at this" --image https://storage.../tree.png
  tlon posts reply chat/~host/channel 170.141... "Thread reply"
  tlon posts edit chat/~host/channel 170.141... "Updated message"

Channel format: chat/~host/channel-name, heap/~host/name
Use 'tlon messages channel <nest> --limit N' to see post IDs.`;

export const POSTS_COMMAND_HELP: Record<string, string> = {
  send: 'Usage: tlon posts send <channel> [message] [--blob <json>] [--image <url>] [--sent-at <ms>] (message optional with --image)',
  reply:
    'Usage: tlon posts reply <channel> <post-id> <message> [--author ~ship] [--blob <json>] [--sent-at <ms>]',
  react: 'Usage: tlon posts react <channel> <post-id> <emoji>',
  unreact: 'Usage: tlon posts unreact <channel> <post-id>',
  edit: 'Usage: tlon posts edit <channel> <post-id> <message>',
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

const POST_REPLY_OPTION_FLAGS = ['author', 'blob', 'sent-at'] as const;
const POST_SEND_OPTION_FLAGS = ['blob', 'image', 'sent-at'] as const;

export interface PostReactionInput {
  channelId: string;
  postId: string;
  emoji: string;
  our: string;
  postAuthor: string;
}

export interface PostReactionRemoveInput {
  channelId: string;
  postId: string;
  our: string;
  postAuthor: string;
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
}

export interface PostSendInput {
  channelId: string;
  authorId: string;
  sentAt: number;
  content: Story;
  blob?: string;
}

export interface PostReplyInput {
  channelId: string;
  parentId: string;
  parentAuthor: string;
  content: Story;
  sentAt: number;
  authorId: string;
  blob?: string;
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
      blob?: string;
      sentAt?: number;
    }
  | {
      kind: 'reply';
      channelId: string;
      postId: string;
      message: string;
      parentAuthor?: string;
      blob?: string;
      sentAt?: number;
    }
  | { kind: 'react'; channelId: string; postId: string; emoji: string }
  | { kind: 'unreact'; channelId: string; postId: string }
  | { kind: 'delete'; channelId: string; postId: string }
  | { kind: 'edit'; channelId: string; postId: string; message: string };

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
  const indexes = POST_SEND_OPTION_FLAGS.map((flag) =>
    flag === 'image' ? imageFlagIndex(args) : args.indexOf(`--${flag}`)
  ).filter((idx) => idx !== -1);
  return indexes.length > 0 ? Math.min(...indexes) : args.length;
}

// Edit has no option flags any more (the notebook-only ones are removed), so the
// message is everything after the post id.
function getPostEditMessage(args: string[]): string {
  return args.slice(3).join(' ');
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
  return args.slice(3, firstFlagIndex(args, POST_REPLY_OPTION_FLAGS)).join(' ');
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
    wantsHelp(args.slice(3, firstFlagIndex(args, POST_REPLY_OPTION_FLAGS)))
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
      const sentAt = validatedSentAt(args, POSTS_COMMAND_HELP.send);
      return {
        kind: 'send',
        channelId: args[1],
        message,
        imageUrl,
        blob,
        sentAt,
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
      return {
        kind: 'reply',
        channelId,
        postId,
        message,
        parentAuthor,
        blob,
        sentAt,
      };
    }
    case 'react': {
      const [, channelId, postId, emoji] = args;
      if (!channelId || !postId || !emoji) {
        throw usageError(POSTS_COMMAND_HELP.react);
      }
      return { kind: 'react', channelId, postId, emoji };
    }
    case 'unreact': {
      const [, channelId, postId] = args;
      if (!channelId || !postId) {
        throw usageError(POSTS_COMMAND_HELP.unreact);
      }
      return { kind: 'unreact', channelId, postId };
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
      const message = getPostEditMessage(args);
      if (!message) {
        throw usageError(POSTS_COMMAND_HELP.edit);
      }
      return { kind: 'edit', channelId, postId, message };
    }
  }

  // Unreachable: command is validated against POSTS_COMMAND_HELP above.
  throw usageError(POSTS_HELP);
}

async function reactToPost(
  parsed: { channelId: string; postId: string; emoji: string },
  deps: PostsDeps
): Promise<void> {
  const our = deps.getCurrentUserId();
  await deps.postsApi.addReaction({
    channelId: parsed.channelId,
    postId: formatPostId(parsed.postId),
    emoji: parsed.emoji,
    our,
    postAuthor: our,
  });
}

async function unreactToPost(
  parsed: { channelId: string; postId: string },
  deps: PostsDeps
): Promise<void> {
  const our = deps.getCurrentUserId();
  await deps.postsApi.removeReaction({
    channelId: parsed.channelId,
    postId: formatPostId(parsed.postId),
    our,
    postAuthor: our,
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
    blob?: string;
    sentAt?: number;
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
  });
}

// Fetch existing post to preserve metadata during edits. Returns null on any
// lookup error, matching legacy behavior.
async function fetchExistingPost(
  channelId: string,
  postId: string,
  deps: PostsDeps
): Promise<ExistingPost | null> {
  const formattedId = formatPostId(postId);
  try {
    const data = await deps.postsApi.getChannelPosts({
      channelId,
      cursor: formattedId,
      mode: 'around',
      count: 1,
      includeReplies: false,
    });
    const post = data.posts.find(
      (candidate) => formatPostId(candidate.id) === formattedId
    );
    return post ?? null;
  } catch {
    return null;
  }
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

  const metadata: PostEditMetadata = {
    title: existing?.title ?? undefined,
    image: existing?.image ?? undefined,
    description: existing?.description ?? undefined,
    cover: existing?.cover ?? undefined,
  };

  await deps.postsApi.editPost({
    channelId: parsed.channelId,
    postId: formatPostId(parsed.postId),
    authorId: deps.getCurrentUserId(),
    sentAt: deps.now(),
    content: markdownToStory(parsed.message),
    metadata,
  });
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
