import {
  type CommandDeps,
  handleExpectedCommandError,
  isHelpArg,
  usageError,
  writeHelp,
  writeLine,
} from './command';

export const POSTS_REACT_HELP =
  'Usage: tlon posts react <channel> <post-id> <emoji>';

export interface PostReactionInput {
  channelId: string;
  postId: string;
  emoji: string;
  our: string;
  postAuthor: string;
}

export interface PostsApi {
  addReaction: (input: PostReactionInput) => Promise<void>;
}

export interface PostsDeps extends CommandDeps {
  authenticate: () => Promise<void>;
  getCurrentUserId: () => string;
  postsApi: PostsApi;
}

type ParsedPostsArgs =
  | { kind: 'help' }
  | { kind: 'react'; channelId: string; postId: string; emoji: string };

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

function parseArgs(args: string[]): ParsedPostsArgs {
  const command = args[0];

  if (command !== 'react') {
    throw usageError(POSTS_REACT_HELP);
  }

  if (args.slice(1).some(isHelpArg)) {
    return { kind: 'help' };
  }

  const channelId = args[1];
  const postId = args[2];
  const emoji = args[3];

  if (!channelId || !postId || !emoji) {
    throw usageError(POSTS_REACT_HELP);
  }

  return { kind: 'react', channelId, postId, emoji };
}

async function reactToPost(
  channelId: string,
  postId: string,
  emoji: string,
  deps: PostsDeps
): Promise<void> {
  const our = deps.getCurrentUserId();
  await deps.postsApi.addReaction({
    channelId,
    postId: formatPostId(postId),
    emoji,
    our,
    postAuthor: our,
  });
}

export async function run(args: string[], deps: PostsDeps): Promise<number> {
  try {
    const parsed = parseArgs(args);
    if (parsed.kind === 'help') {
      return writeHelp(deps, POSTS_REACT_HELP);
    }

    await deps.authenticate();
    await reactToPost(parsed.channelId, parsed.postId, parsed.emoji, deps);

    writeLine(deps.stdout, '✓ Reaction added');
    return 0;
  } catch (error) {
    const handled = handleExpectedCommandError(error, deps);
    if (handled !== null) return handled;
    throw error;
  }
}
