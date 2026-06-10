import { type Story, markdownToStory } from '../story';
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

Note: Sending and replying to posts is handled by the Tlon channel plugin.

Commands:
  react <channel> <post-id> <emoji>     React to a post with an emoji
  unreact <channel> <post-id>           Remove your reaction from a post
  edit <channel> <post-id> <message>    Edit a post [--title <t>] [--image <url>] [--content <json>]
  delete <channel> <post-id>            Delete a post

Edit options:
  --title <title>      Set/update notebook post title
  --image <url>        Set/update cover image (notebooks)
  --content <file>     Use Story JSON file for rich content (notebooks)

Examples:
  tlon posts edit chat/~host/channel 170.141... "Updated message"
  tlon posts edit diary/~host/notes 170.141... --title "New Title" --image https://example.com/cover.jpg --content article.json

Channel format: chat/~host/channel-name, diary/~host/name, heap/~host/name
Use 'tlon messages channel <nest> --limit N' to see post IDs.`;

export const POSTS_COMMAND_HELP: Record<string, string> = {
  react: 'Usage: tlon posts react <channel> <post-id> <emoji>',
  unreact: 'Usage: tlon posts unreact <channel> <post-id>',
  edit: 'Usage: tlon posts edit <channel> <post-id> <message> [--title <title>] [--image <url>] [--content <json-file>]',
  delete: 'Usage: tlon posts delete <channel> <post-id>',
};

// Retained for back-compat with existing imports; the canonical source is the
// command help map above. The react usage line must stay byte-identical.
export const POSTS_REACT_HELP = POSTS_COMMAND_HELP.react;

const POSTS_UNSUPPORTED_COMMAND_ERRORS: Record<string, string> = {
  send: 'Channel post send is handled by the Tlon channel plugin.\nUse the channel message tool with channel=tlon instead.',
  reply:
    'Channel post reply is handled by the Tlon channel plugin.\nUse the channel message tool with channel=tlon and replyTo instead.',
};

const POST_EDIT_OPTION_FLAGS = ['title', 'content', 'image'] as const;

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
  getChannelPosts: (query: PostLookupQuery) => Promise<PostLookupResult>;
}

export interface PostsDeps extends CommandDeps {
  authenticate: () => Promise<void>;
  getCurrentUserId: () => string;
  now: () => number;
  readFile: (path: string) => string;
  postsApi: PostsApi;
}

type ParsedPostsArgs =
  | { kind: 'help'; help: string }
  | { kind: 'react'; channelId: string; postId: string; emoji: string }
  | { kind: 'unreact'; channelId: string; postId: string }
  | { kind: 'delete'; channelId: string; postId: string }
  | {
      kind: 'edit';
      channelId: string;
      postId: string;
      message: string;
      title?: string;
      image?: string;
      contentFile?: string;
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

function wantsHelp(args: string[]): boolean {
  return args.some(isHelpArg);
}

function getPostsHelp(command: string | undefined): string {
  return command && POSTS_COMMAND_HELP[command]
    ? POSTS_COMMAND_HELP[command]
    : POSTS_HELP;
}

function firstPostEditFlagIndex(args: string[]): number {
  const flagIndexes = POST_EDIT_OPTION_FLAGS.map((flag) =>
    args.indexOf(`--${flag}`)
  ).filter((idx) => idx !== -1);
  return flagIndexes.length > 0 ? Math.min(...flagIndexes) : args.length;
}

function getPostEditMessage(args: string[]): string {
  return args.slice(3, firstPostEditFlagIndex(args)).join(' ');
}

// The edit message slice can legitimately contain `--help`/`-h` as literal
// message content. When it does, help is suppressed and the token is treated
// as the message, matching legacy behavior.
function isPostEditMessageHelpLiteral(args: string[]): boolean {
  return (
    args[0] === 'edit' &&
    !!args[1] &&
    !!args[2] &&
    wantsHelp(args.slice(3, firstPostEditFlagIndex(args)))
  );
}

// Legacy `hasOptionValue(args, 'content', POST_EDIT_OPTION_FLAGS)`: true only
// when `--content` is followed by a value that is not itself an edit flag.
function hasContentOptionValue(args: string[]): boolean {
  const idx = args.indexOf('--content');
  const value = idx !== -1 ? args[idx + 1] : undefined;
  if (value === undefined) {
    return false;
  }
  return !POST_EDIT_OPTION_FLAGS.some((flag) => value === `--${flag}`);
}

function parseArgs(args: string[]): ParsedPostsArgs {
  const command = args[0];

  if (isHelpArg(command)) {
    return { kind: 'help', help: POSTS_HELP };
  }

  if (wantsHelp(args.slice(1)) && !isPostEditMessageHelpLiteral(args)) {
    return { kind: 'help', help: getPostsHelp(command) };
  }

  if (!command) {
    throw usageError(POSTS_HELP);
  }

  if (POSTS_UNSUPPORTED_COMMAND_ERRORS[command]) {
    throw commandError(POSTS_UNSUPPORTED_COMMAND_ERRORS[command]);
  }

  if (!POSTS_COMMAND_HELP[command]) {
    throw usageError(POSTS_HELP);
  }

  switch (command) {
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
      const message = getPostEditMessage(args);
      if (!message && !hasContentOptionValue(args)) {
        throw usageError(POSTS_COMMAND_HELP.edit);
      }
      // Flag values are read positionally with no validation, matching legacy:
      // `--title --image url` takes `--image` as the title.
      const titleIdx = args.indexOf('--title');
      const contentIdx = args.indexOf('--content');
      const imageIdx = args.indexOf('--image');
      return {
        kind: 'edit',
        channelId,
        postId,
        message,
        title: titleIdx !== -1 ? args[titleIdx + 1] : undefined,
        image: imageIdx !== -1 ? args[imageIdx + 1] : undefined,
        contentFile: contentIdx !== -1 ? args[contentIdx + 1] : undefined,
      };
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

function readContentFile(path: string, deps: PostsDeps): Story {
  try {
    return JSON.parse(deps.readFile(path)) as Story;
  } catch (error) {
    throw commandError(errorMessage(error));
  }
}

async function editPost(
  parsed: {
    channelId: string;
    postId: string;
    message: string;
    title?: string;
    image?: string;
    contentFile?: string;
  },
  deps: PostsDeps
): Promise<void> {
  const existing = await fetchExistingPost(
    parsed.channelId,
    parsed.postId,
    deps
  );

  const metadata: PostEditMetadata = {
    title: parsed.title ?? existing?.title ?? undefined,
    image: parsed.image ?? existing?.image ?? undefined,
    description: existing?.description ?? undefined,
    cover: existing?.cover ?? undefined,
  };

  const content =
    parsed.contentFile !== undefined
      ? readContentFile(parsed.contentFile, deps)
      : markdownToStory(parsed.message);

  await deps.postsApi.editPost({
    channelId: parsed.channelId,
    postId: formatPostId(parsed.postId),
    authorId: deps.getCurrentUserId(),
    sentAt: deps.now(),
    content,
    metadata,
  });
}

export async function run(args: string[], deps: PostsDeps): Promise<number> {
  try {
    const parsed = parseArgs(args);

    if (parsed.kind === 'help') {
      return writeHelp(deps, parsed.help);
    }

    await deps.authenticate();

    switch (parsed.kind) {
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
