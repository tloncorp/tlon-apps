#!/usr/bin/env npx ts-node

/**
 * Messages API for Tlon
 *
 * Usage:
 *   npx ts-node scripts/messages.ts dm ~sampel-palnet [--limit N] [--resolve-cites]
 *   npx ts-node scripts/messages.ts channel chat/~host/channel-slug [--limit N] [--resolve-cites]
 *   npx ts-node scripts/messages.ts history "chat/~host/channel-slug" [--limit N] [--resolve-cites]
 *   npx ts-node scripts/messages.ts search "query" --channel chat/~host/channel-slug
 *   npx ts-node scripts/messages.ts search "query" [--limit N] [--per-channel N]
 *   npx ts-node scripts/messages.ts context <channel|~ship> <postId> [--limit N] [--resolve-cites]
 *   npx ts-node scripts/messages.ts post <channel|~ship> <postId> [--author ~ship] [--resolve-cites]
 *
 * Options:
 *   --resolve-cites, --quotes   Fetch and display quoted/cited message content
 *   --json                      Emit one NDJSON record per post instead of
 *                               plain text
 */
import {
  getChannelPosts,
  getInitData,
  getPostReference,
  getPostWithReplies,
  searchChannel,
} from '@tloncorp/api';
import type { Post } from '@tloncorp/api';

import { ensureClient, normalizeShip } from './api-client';
import {
  errorMessage,
  formatPostId,
  isHelpArg,
  mapWithConcurrency,
  parsePositiveInteger,
  printErrorAndExit,
  printHelpAndExit,
  printUsageAndExit,
  refuseDiaryNest,
  refuseNotesContentTarget,
  wantsHelp,
} from './cli-utils';
import { renderPostJsonLine, renderPostListJsonLines } from './message-content';
import { writePostBody } from './post-render';

const SEARCH_ALL_DEFAULT_LIMIT = 20;
const SEARCH_ALL_DEFAULT_PER_CHANNEL = 5;
// Each search scans up to 500 posts on the ship; a bot can sit in hundreds of
// channels, so don't scan them all at once.
const SEARCH_ALL_CONCURRENCY = 8;
const SEARCH_LIMIT_OPTIONS = ['--limit', '--per-channel'] as const;

const MESSAGES_HELP = `Usage: tlon messages <command>

Commands:
  dm ~ship                                    Show DM history
  channel <nest>                              Show channel messages
  history <nest>                              Alias for channel
  search "query" [--channel <nest>]           Search one channel, or every chat and DM
  context <channel|~ship> <postId>            Show messages around a post
  post <channel|~ship> <postId>               Fetch a single post with replies

Examples:
  tlon messages dm ~sampel-palnet --limit 10
  tlon messages channel chat/~host/channel-slug --limit 20
  tlon messages channel chat/~host/channel-slug --json
  tlon messages search "hello" --channel chat/~host/slug
  tlon messages search "hello" --per-channel 3
  tlon messages context chat/~host/slug 170.141.184... --limit 5
  tlon messages post chat/~host/slug 170.141.184...`;

const MESSAGES_COMMAND_HELP: Record<string, string> = {
  dm: 'Usage: tlon messages dm ~ship [--limit N] [--resolve-cites] [--json]',
  channel:
    'Usage: tlon messages channel chat/~host/slug [--limit N] [--resolve-cites] [--json]',
  history:
    'Usage: tlon messages history "chat/~host/channel-slug" [--limit N] [--resolve-cites] [--json]',
  search: `Usage: tlon messages search "query" [--channel chat/~host/slug [--json]] [--limit N] [--per-channel N]

Without --channel, searches every DM, group DM, and joined chat and gallery
channel, grouping results by channel. --per-channel (default ${SEARCH_ALL_DEFAULT_PER_CHANNEL}) and --limit
(default ${SEARCH_ALL_DEFAULT_LIMIT}) keep the newest results from each channel and overall.
--json needs --channel.`,
  context:
    'Usage: tlon messages context <channel|~ship> <postId> [--limit N] [--resolve-cites] [--json]',
  post: 'Usage: tlon messages post <channel|~ship> <postId> [--author ~ship] [--resolve-cites] [--json]',
};

function getMessagesHelp(command?: string): string {
  return command
    ? (MESSAGES_COMMAND_HELP[command] ?? MESSAGES_HELP)
    : MESSAGES_HELP;
}

function getSearchChannel(args: string[]): string | undefined {
  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--channel') {
      const channel = args[i + 1];
      return channel && !channel.startsWith('--') ? channel : undefined;
    }
  }
  return undefined;
}

// The query is always args[1], so `search --channel <nest>` lacks one rather
// than searching everywhere for "--channel".
function isSearchMissingQuery(args: string[]): boolean {
  return (
    !args[1] ||
    (!getSearchChannel(args) &&
      ['--channel', ...SEARCH_LIMIT_OPTIONS].includes(args[1]))
  );
}

function getSearchLimits(
  args: string[]
): { limit: number; perChannel: number } | null {
  const limits = {
    limit: SEARCH_ALL_DEFAULT_LIMIT,
    perChannel: SEARCH_ALL_DEFAULT_PER_CHANNEL,
  };
  for (const option of SEARCH_LIMIT_OPTIONS) {
    const idx = args.indexOf(option, 2);
    if (idx === -1) continue;
    const parsed = parsePositiveInteger(args[idx + 1] ?? '');
    if (parsed === null) return null;
    limits[option === '--limit' ? 'limit' : 'perChannel'] = parsed;
  }
  return limits;
}

function isSearchQueryHelpLiteral(args: string[]): boolean {
  return args[0] === 'search' && isHelpArg(args[1]) && !!getSearchChannel(args);
}

function validateMessagesArgs(args: string[]): void {
  const command = args[0];
  if (!command || !MESSAGES_COMMAND_HELP[command]) {
    printUsageAndExit(MESSAGES_HELP);
  }

  switch (command) {
    case 'dm':
    case 'channel':
    case 'history': {
      if (!args[1]) printUsageAndExit(MESSAGES_COMMAND_HELP[command]);
      // `dm` targets a ~ship, not a nest, so nest-specific refusals apply only
      // to channel/history.
      if (command !== 'dm') {
        refuseDiaryNest(args[1]);
        refuseNotesContentTarget(args[1]);
      }
      return;
    }
    case 'search': {
      const channelGiven = args.indexOf('--channel', 2) !== -1;
      if (
        isSearchMissingQuery(args) ||
        (channelGiven && !getSearchChannel(args)) ||
        (!channelGiven && !getSearchLimits(args))
      ) {
        printUsageAndExit(MESSAGES_COMMAND_HELP.search);
      }
      refuseDiaryNest(getSearchChannel(args));
      refuseNotesContentTarget(getSearchChannel(args));
      return;
    }
    case 'context':
    case 'post': {
      if (!args[1] || !args[2])
        printUsageAndExit(MESSAGES_COMMAND_HELP[command]);
      // The target may be a ~ship DM or a channel nest; nest-specific refusals
      // are no-ops for DMs.
      refuseDiaryNest(args[1]);
      refuseNotesContentTarget(args[1]);
      return;
    }
  }
}

// Format a timestamp
function formatTime(timeVal: string | number): string {
  try {
    const num = typeof timeVal === 'number' ? timeVal : parseInt(timeVal, 10);
    if (!isNaN(num) && num > 1600000000000) {
      const date = new Date(num);
      return date.toLocaleString();
    }
    const timeStr = String(timeVal);
    const daNum = BigInt(timeStr.replace(/\./g, ''));
    const DA_SECOND = BigInt('18446744073709551616');
    const DA_UNIX_EPOCH = BigInt('170141184475152167957503069145530368000');
    const offset = DA_SECOND / BigInt(2000);
    const epochAdjusted = offset + (daNum - DA_UNIX_EPOCH);
    const unixMs = Math.round(
      Number((epochAdjusted * BigInt(1000)) / DA_SECOND)
    );

    const date = new Date(unixMs);
    if (date.getFullYear() > 2020 && date.getFullYear() < 2100) {
      return date.toLocaleString();
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

interface PrintPostsOptions {
  highlightId?: string;
  /** Emit NDJSON records only: no headers, no cite resolution. */
  json?: boolean;
}

async function printPosts(
  posts: Post[],
  resolve: boolean,
  { highlightId, json }: PrintPostsOptions = {}
) {
  if (json) {
    for (const line of renderPostListJsonLines(posts)) {
      console.log(line);
    }
    return;
  }

  if (!posts.length) {
    console.log('No messages found.');
    return;
  }

  const sorted = [...posts].sort((a, b) => a.sentAt - b.sentAt);

  for (const post of sorted) {
    const author = post.authorId || 'unknown';
    const time = formatTime(post.sentAt);
    const replySuffix = post.parentId ? ` (reply to ${post.parentId})` : '';
    const marker = highlightId && post.id === highlightId ? ' ◀ TARGET' : '';

    console.log(`- ${author} @ ${time}${replySuffix}${marker}`);
    console.log(`  ID: ${post.id}`);
    await writePostBody(post, {
      write: (line) => console.log(line),
      indent: '  ',
      getPostReference: resolve ? getPostReference : undefined,
    });

    console.log('');
  }
}

// Fetch DM messages via the chat agent (not channels)
async function fetchDmMessages(
  ship: string,
  limit: number = 20,
  resolveCites: boolean = false,
  json: boolean = false
): Promise<void> {
  const normalizedShip = normalizeShip(ship);

  if (!json) {
    console.log(`Fetching DMs with: ${normalizedShip}`);
    console.log(
      `Limit: ${limit}${resolveCites ? ' (resolving quotes)' : ''}\n`
    );
  }

  const data = await getChannelPosts({
    channelId: normalizedShip,
    mode: 'newest',
    count: limit,
    includeReplies: true,
  });

  if (!json) {
    console.log(`=== DMs with ${normalizedShip} (${data.posts.length}) ===\n`);
  }
  await printPosts(data.posts, resolveCites, { json });
}

// Fetch messages from a channel
async function fetchMessages(
  channel: string,
  limit: number = 20,
  resolveCites: boolean = false,
  json: boolean = false
): Promise<void> {
  if (!json) {
    console.log(`Fetching messages from: ${channel}`);
    console.log(
      `Limit: ${limit}${resolveCites ? ' (resolving quotes)' : ''}\n`
    );
  }

  const data = await getChannelPosts({
    channelId: channel,
    mode: 'newest',
    count: limit,
    includeReplies: true,
  }).catch((error: unknown) => {
    throw new Error(
      `Failed to fetch messages from ${channel}: ${errorMessage(error)}. Check that the channel path is correct (e.g., chat/~host/slug)`,
      { cause: error }
    );
  });

  if (!json) {
    console.log(`=== Messages in ${channel} (${data.posts.length}) ===\n`);
  }
  await printPosts(data.posts, resolveCites, { json });
}

// Search messages in a channel
async function searchMessages(
  query: string,
  channel: string,
  json: boolean = false
): Promise<void> {
  if (!json) {
    console.log(`Searching "${query}" in: ${channel}\n`);
  }

  const results = await searchChannel({
    channelId: channel,
    query,
  });

  if (!results.posts.length) {
    if (!json) {
      console.log('No results found.');
    }
    return;
  }

  if (!json) {
    console.log(`Found ${results.posts.length} results:\n`);
  }
  await printPosts(results.posts, false, { json });
}

type SearchTarget = { id: string; label: string };
type SearchResult = { target: SearchTarget; posts: Post[]; error?: string };

// What the account can read: accepted DMs and group DMs, and the group
// channels it has joined. Notes channels are searched with `tlon notes`.
async function getSearchTargets(): Promise<SearchTarget[]> {
  const init = await getInitData();
  const chats = init.channels
    .filter((chat) => !chat.isDmInvite)
    .map((chat) => ({
      id: chat.id,
      label:
        chat.type === 'dm' ? 'DM' : `Group DM: ${chat.title || 'Untitled'}`,
    }));
  const channelLabels = new Map<string, string>();
  for (const group of init.groups) {
    for (const channel of group.channels ?? []) {
      channelLabels.set(
        channel.id,
        `${group.title || group.id} › ${channel.title || channel.id}`
      );
    }
  }
  const groupChannels = init.joinedGroupChannels
    .filter((nest) => nest.startsWith('chat/') || nest.startsWith('heap/'))
    .map((nest) => ({ id: nest, label: channelLabels.get(nest) ?? nest }));
  return [...chats, ...groupChannels];
}

// Search every chat and DM, keeping the newest `perChannel` hits from each
// channel and the newest `limit` overall, grouped by channel.
async function searchAllMessages(
  query: string,
  limit: number,
  perChannel: number
): Promise<void> {
  const targets = await getSearchTargets();
  console.log(`Searching "${query}" in ${targets.length} channels and DMs\n`);

  const results = await mapWithConcurrency(
    targets,
    SEARCH_ALL_CONCURRENCY,
    async (target): Promise<SearchResult> => {
      try {
        const { posts } = await searchChannel({ channelId: target.id, query });
        return { target, posts };
      } catch (error: any) {
        return { target, posts: [], error: error.message };
      }
    }
  );

  // The bot's tool runner returns only stdout on success, so a partial failure
  // is reported there; a search that failed everywhere exits non-zero.
  const failures = results.filter((result) => result.error !== undefined);
  const failed = failures.map(
    ({ target, error }) => `  ${target.id}: ${error}`
  );
  if (failures.length && failures.length === targets.length) {
    throw new Error(
      [`Could not search any of ${targets.length} channels:`, ...failed].join(
        '\n'
      )
    );
  }
  if (failures.length) {
    console.log(
      [
        `Results are incomplete: could not search ${failures.length} of ${targets.length} channels:`,
        ...failed,
        '',
      ].join('\n')
    );
  }

  const matches = results.filter((result) => result.posts.length);
  const total = matches.reduce((sum, match) => sum + match.posts.length, 0);
  if (!total) {
    console.log('No results found.');
    return;
  }

  const kept = matches
    .flatMap((match) =>
      [...match.posts]
        .sort((a, b) => b.sentAt - a.sentAt)
        .slice(0, perChannel)
        .map((post) => ({ match, post }))
    )
    .sort((a, b) => b.post.sentAt - a.post.sentAt)
    .slice(0, limit);

  // Map keeps insertion order, so the channel with the newest hit comes first.
  const shown = new Map<SearchResult, Post[]>();
  for (const { match, post } of kept) {
    shown.set(match, [...(shown.get(match) ?? []), post]);
  }

  const truncated = kept.length < total;
  console.log(
    `Found ${total} results in ${matches.length} channels` +
      (truncated
        ? `; showing the newest ${kept.length} (at most ${perChannel} per channel, ${limit} in all).`
        : '.') +
      '\n'
  );
  for (const [{ target, posts: found }, posts] of shown) {
    const count =
      posts.length < found.length
        ? `${posts.length} of ${found.length}`
        : `${posts.length}`;
    console.log(`=== ${target.id} — ${target.label} (${count}) ===\n`);
    await printPosts(posts, false);
  }
  if (truncated) {
    console.log(
      `For every result in one channel: tlon messages search "${query}" --channel <nest>`
    );
  }
}

// Fetch context around a specific post (messages before and after)
// Uses the backend's native %around scry which fetches N posts in each
// direction plus the target post itself in a single request.
async function fetchContext(
  channelId: string,
  postId: string,
  limit: number = 10,
  resolve: boolean = false,
  json: boolean = false
): Promise<void> {
  postId = formatPostId(postId);
  if (!json) {
    console.log(`Fetching context around post ${postId} in ${channelId}`);
    console.log(
      `Limit: ${limit} messages each direction${resolve ? ' (resolving quotes)' : ''}\n`
    );
  }

  // The backend supports %around mode which fetches N older + N newer + the
  // target post in one scry. The JS API types only declare "older"|"newer"
  // but the path builder is generic, so "around" just works at runtime.
  const data = await getChannelPosts({
    channelId,
    cursor: postId,
    mode: 'around' as any,
    count: limit,
    includeReplies: true,
  });

  if (!json) {
    console.log(
      `=== Context around ${postId} (${data.posts.length} messages) ===\n`
    );
  }

  await printPosts(data.posts, resolve, { highlightId: postId, json });
}

async function getPostWithOptionalAuthor({
  channelId,
  postId,
  authorId,
}: {
  channelId: string;
  postId: string;
  authorId?: string;
}) {
  return getPostWithReplies({
    channelId,
    postId,
    authorId: authorId ?? '',
  });
}

// Fetch a single post (with replies if it's a thread)
async function fetchPost(
  channelId: string,
  postId: string,
  authorId?: string,
  resolve: boolean = false,
  json: boolean = false
): Promise<void> {
  postId = formatPostId(postId);
  if (!json) {
    console.log(`Fetching post ${postId} from ${channelId}\n`);
  }

  const post = await getPostWithOptionalAuthor({
    channelId,
    postId,
    authorId,
  });

  if (!post) {
    if (!json) {
      console.log('Post not found.');
    }
    return;
  }

  if (json) {
    console.log(renderPostJsonLine(post));
    if (post.replies && post.replies.length > 0) {
      await printPosts(post.replies, resolve, { json });
    }
    return;
  }

  const author = post.authorId || 'unknown';
  const time = formatTime(post.sentAt);

  console.log(`=== Post ${postId} ===\n`);
  console.log(`Author: ${author}`);
  console.log(`Time: ${time}`);
  console.log(`ID: ${post.id}`);
  console.log('');
  await writePostBody(post, {
    write: (line) => console.log(line),
    getPostReference: resolve ? getPostReference : undefined,
  });

  if (post.replies && post.replies.length > 0) {
    console.log(`\n--- Replies (${post.replies.length}) ---\n`);
    await printPosts(post.replies, resolve);
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (isHelpArg(command)) {
    printHelpAndExit(MESSAGES_HELP);
  }

  if (wantsHelp(args.slice(1)) && !isSearchQueryHelpLiteral(args)) {
    printHelpAndExit(getMessagesHelp(command));
  }

  validateMessagesArgs(args);

  await ensureClient();

  // Parse --limit flag
  let limit = 20;
  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10);
  }

  const resolveCites =
    args.includes('--resolve-cites') || args.includes('--quotes');

  // NDJSON mode. The search query may itself be an option-like literal (see
  // isSearchQueryHelpLiteral) and must not flip modes.
  const flagArgs = command === 'search' ? [args[0], ...args.slice(2)] : args;
  const json = flagArgs.includes('--json');

  try {
    switch (command) {
      case 'dm': {
        const ship = args[1];
        if (!ship) {
          printUsageAndExit(MESSAGES_COMMAND_HELP.dm);
        }
        await fetchDmMessages(ship, limit, resolveCites, json);
        break;
      }

      case 'channel': {
        const channelPath = args[1];
        if (!channelPath) {
          printUsageAndExit(MESSAGES_COMMAND_HELP.channel);
        }
        await fetchMessages(channelPath, limit, resolveCites, json);
        break;
      }

      case 'history': {
        const channelPath = args[1];
        if (!channelPath) {
          printUsageAndExit(MESSAGES_COMMAND_HELP.history);
        }
        await fetchMessages(channelPath, limit, resolveCites, json);
        break;
      }

      case 'search': {
        const query = args[1];
        const channel = getSearchChannel(args);
        if (channel) {
          await searchMessages(query, channel, json);
          break;
        }
        const limits = getSearchLimits(args);
        if (!limits || json) {
          printUsageAndExit(MESSAGES_COMMAND_HELP.search);
        }
        await searchAllMessages(query, limits.limit, limits.perChannel);
        break;
      }

      case 'context': {
        const target = args[1];
        const postId = args[2];
        if (!target || !postId) {
          printUsageAndExit(MESSAGES_COMMAND_HELP.context);
        }
        await fetchContext(target, postId, limit, resolveCites, json);
        break;
      }

      case 'post': {
        const target = args[1];
        const postId = args[2];
        if (!target || !postId) {
          printUsageAndExit(MESSAGES_COMMAND_HELP.post);
        }
        let author: string | undefined;
        const authorIdx = args.indexOf('--author');
        if (authorIdx !== -1 && args[authorIdx + 1]) {
          author = normalizeShip(args[authorIdx + 1]);
        }
        await fetchPost(target, postId, author, resolveCites, json);
        break;
      }

      default:
        printUsageAndExit(MESSAGES_HELP);
    }
    process.exit(0);
  } catch (error) {
    printErrorAndExit(error);
  }
}

main();
