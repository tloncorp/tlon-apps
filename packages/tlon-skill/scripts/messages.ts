#!/usr/bin/env npx ts-node

/**
 * Messages API for Tlon
 *
 * Usage:
 *   npx ts-node scripts/messages.ts dm ~sampel-palnet [--limit N] [--resolve-cites]
 *   npx ts-node scripts/messages.ts channel chat/~host/channel-slug [--limit N] [--resolve-cites]
 *   npx ts-node scripts/messages.ts history "chat/~host/channel-slug" [--limit N] [--resolve-cites]
 *   npx ts-node scripts/messages.ts search "query" --channel chat/~host/channel-slug
 *   npx ts-node scripts/messages.ts context <channel|~ship> <postId> [--limit N] [--resolve-cites]
 *   npx ts-node scripts/messages.ts post <channel|~ship> <postId> [--author ~ship] [--resolve-cites]
 *
 * Options:
 *   --resolve-cites, --quotes   Fetch and display quoted/cited message content
 *   --json                      Emit one NDJSON record per post instead of
 *                               framed plaintext
 */
import {
  getCanonicalPostId,
  getChannelPosts,
  getPostReference,
  getPostWithReplies,
  searchChannel,
} from '@tloncorp/api';
import type { Post } from '@tloncorp/api';

import { ensureClient, normalizeShip } from './api-client';
import {
  isHelpArg,
  printErrorAndExit,
  printHelpAndExit,
  printUsageAndExit,
  refuseDiaryNest,
  refuseNotesContentTarget,
  wantsHelp,
} from './cli-utils';
import {
  type FetchRef,
  type RefBudget,
  TARGET_ABSENT_NOTICE,
  createRefBudget,
  extractPostText,
  extractReferences,
  formatTime,
  renderPostJsonLine,
  renderPostListJsonLines,
  renderPostListLines,
  renderRefLines,
  formatQuoteLines,
  formatBodyLines,
} from './message-content';
import {
  type WindowContext,
  hasReceiptOrder,
  windowFromPage,
} from './messages-runtime';

const MESSAGES_HELP = `Usage: tlon messages <command>

Commands:
  dm ~ship                                    Show DM history
  channel <nest>                              Show channel messages
  history <nest>                              Alias for channel
  search "query" --channel <nest>             Search in channel
  context <channel|~ship> <postId>            Show messages around a post
  post <channel|~ship> <postId>               Fetch a single post with replies

Examples:
  tlon messages dm ~sampel-palnet --limit 10
  tlon messages channel chat/~host/channel-slug --limit 20
  tlon messages channel chat/~host/channel-slug --json
  tlon messages search "hello" --channel chat/~host/slug
  tlon messages context chat/~host/slug 170.141.184... --limit 5
  tlon messages post chat/~host/slug 170.141.184...`;

const MESSAGES_COMMAND_HELP: Record<string, string> = {
  dm: 'Usage: tlon messages dm ~ship [--limit N] [--resolve-cites] [--json]',
  channel:
    'Usage: tlon messages channel chat/~host/slug [--limit N] [--resolve-cites] [--json]',
  history:
    'Usage: tlon messages history "chat/~host/channel-slug" [--limit N] [--resolve-cites] [--json]',
  search:
    'Usage: tlon messages search "query" --channel chat/~host/slug [--json]',
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
      if (!args[1] || !getSearchChannel(args)) {
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

const fetchRef: FetchRef = (ref) => getPostReference(ref);

interface PrintPostsOptions {
  highlightId?: string;
  budget?: RefBudget;
  /** Emit NDJSON records only: no framing, no headers, no cite resolution. */
  json?: boolean;
  /** Opt in to receipt/sent divergence analysis (history commands only). */
  window?: WindowContext;
  displayLimit?: number;
}

async function printPosts(
  posts: Post[],
  resolve: boolean,
  { highlightId, budget, json, window, displayLimit }: PrintPostsOptions = {}
) {
  if (json) {
    for (const line of renderPostListJsonLines(posts, {
      window,
      displayLimit,
      highlightId,
    })) {
      console.log(line);
    }
    return;
  }

  if (!posts.length) {
    // An empty %around page still means the requested target was not found.
    if (highlightId) {
      console.log(TARGET_ABSENT_NOTICE);
      console.log('');
    }
    console.log('No messages found.');
    return;
  }

  const lines = await renderPostListLines(posts, {
    resolve,
    fetchRef,
    highlightId,
    budget,
    window,
    displayLimit,
  });
  for (const line of lines) {
    console.log(line);
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

  try {
    // Fetch one extra post as an analysis-only boundary probe: skew that
    // crosses the window edge (a delivery burst wider than the limit) is
    // detectable only by comparing against the next post beyond it.
    const data = await getChannelPosts({
      channelId: normalizedShip,
      mode: 'newest',
      count: limit + 1,
      includeReplies: true,
      skipGapFill: true,
    });

    if (!json) {
      const shown =
        data.posts.length > limit && hasReceiptOrder(data.posts)
          ? data.posts.length - 1
          : data.posts.length;
      console.log(`=== DMs with ${normalizedShip} (${shown}) ===\n`);
    }
    await printPosts(data.posts, resolveCites, {
      json,
      window: windowFromPage(data, limit),
      displayLimit: limit,
    });
  } catch (error: any) {
    console.error(`Error fetching DMs: ${error.message}`);
  }
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

  try {
    // One extra post as an analysis-only boundary probe; see fetchDmMessages.
    const data = await getChannelPosts({
      channelId: channel,
      mode: 'newest',
      count: limit + 1,
      includeReplies: true,
      skipGapFill: true,
    });

    if (!json) {
      const shown =
        data.posts.length > limit && hasReceiptOrder(data.posts)
          ? data.posts.length - 1
          : data.posts.length;
      console.log(`=== Messages in ${channel} (${shown}) ===\n`);
    }
    await printPosts(data.posts, resolveCites, {
      json,
      window: windowFromPage(data, limit),
      displayLimit: limit,
    });
  } catch (error: any) {
    console.error(`Error fetching messages: ${error.message}`);
    if (!json) {
      console.log(
        'Note: Check that the channel path is correct (e.g., chat/~host/slug)'
      );
    }
  }
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

  try {
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
  } catch (error: any) {
    console.error(`Error searching messages: ${error.message}`);
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
  if (!json) {
    console.log(`Fetching context around post ${postId} in ${channelId}`);
    console.log(
      `Limit: ${limit} messages each direction${resolve ? ' (resolving quotes)' : ''}\n`
    );
  }

  try {
    // The backend supports %around mode which fetches N older + N newer + the
    // target post in one scry. The JS API types only declare "older"|"newer"
    // but the path builder is generic, so "around" just works at runtime.
    const data = await getChannelPosts({
      channelId,
      cursor: postId,
      mode: 'around' as any,
      count: limit,
      includeReplies: true,
      skipGapFill: true,
    });

    if (!json) {
      console.log(
        `=== Context around ${postId} (${data.posts.length} messages) ===\n`
      );
    }

    await printPosts(data.posts, resolve, {
      highlightId: postId,
      json,
      window: windowFromPage(data),
    });
  } catch (error: any) {
    console.error(`Error fetching context: ${error.message}`);
  }
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
  if (!json) {
    console.log(`Fetching post ${postId} from ${channelId}\n`);
  }

  try {
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
    const text = extractPostText(post.content);
    // One budget for the whole command, shared with the replies below.
    const budget = createRefBudget();

    console.log(`=== Post ${postId} ===\n`);
    console.log(`Author: ${author}`);
    console.log(`Time: ${time}`);
    console.log(`ID: ${post.id}`);
    if (text) {
      console.log('');
      for (const line of formatBodyLines(text)) {
        console.log(line);
      }
    }

    const refLines = await renderRefLines(extractReferences(post.content), {
      resolve,
      fetchRef,
      budget,
    });
    for (const ref of refLines) {
      console.log('');
      for (const line of formatQuoteLines(ref)) {
        console.log(line);
      }
    }

    if (post.replies && post.replies.length > 0) {
      console.log(`\n--- Replies (${post.replies.length}) ---\n`);
      await printPosts(post.replies, resolve, { budget });
    }
  } catch (error: any) {
    console.error(`Error fetching post: ${error.message}`);
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

        if (!query || !channel) {
          printUsageAndExit(MESSAGES_COMMAND_HELP.search);
        }
        await searchMessages(query, channel, json);
        break;
      }

      case 'context': {
        const target = args[1];
        const postId = args[2];
        if (!target || !postId) {
          printUsageAndExit(MESSAGES_COMMAND_HELP.context);
        }
        // Users paste undotted ids from ship logs; returned posts carry
        // canonical dotted ids. Normalize once so the cursor, the target
        // marker, and the absent-target checks all agree.
        await fetchContext(
          target,
          getCanonicalPostId(postId),
          limit,
          resolveCites,
          json
        );
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
        await fetchPost(
          target,
          getCanonicalPostId(postId),
          author,
          resolveCites,
          json
        );
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
