#!/usr/bin/env npx ts-node

/**
 * Channel post management for Tlon
 *
 * Usage:
 *   npx ts-node scripts/posts.ts send <channel> <message>
 *   npx ts-node scripts/posts.ts reply <channel> <post-id> <message> [--author ~ship]
 *   npx ts-node scripts/posts.ts react <channel> <post-id> <emoji>
 *   npx ts-node scripts/posts.ts unreact <channel> <post-id>
 *   npx ts-node scripts/posts.ts edit <channel> <post-id> <message>
 *   npx ts-node scripts/posts.ts delete <channel> <post-id>
 *
 * Channel format: chat/~host/channel-name, diary/~host/channel-name, heap/~host/channel-name
 */
import {
  addReaction,
  deletePost,
  editPost,
  getChannelPosts,
  getCurrentUserId,
  removeReaction,
  sendPost,
  sendReply,
} from '@tloncorp/api';
import type { Post } from '@tloncorp/api';
import * as fs from 'fs';

import { ensureClient } from './api-client';
import {
  hasOptionValue,
  isHelpArg,
  printErrorAndExit,
  printHelpAndExit,
  printUsageAndExit,
  wantsHelp,
} from './cli-utils';
import { type Story, markdownToStory } from './story';

const POSTS_HELP = `Usage: tlon posts <command>

Commands:
  send <channel> <message>                 Send a message to a channel [--blob <json>]
  reply <channel> <post-id> <message>      Reply to a channel post [--author ~ship]
  react <channel> <post-id> <emoji>     React to a post with an emoji
  unreact <channel> <post-id>           Remove your reaction from a post
  edit <channel> <post-id> <message>    Edit a post [--title <t>] [--image <url>] [--content <json>]
  delete <channel> <post-id>            Delete a post

Send options:
  --blob <json>        Attach a post-blob JSON array (e.g. an a2ui entry)

Edit options:
  --title <title>      Set/update notebook post title
  --image <url>        Set/update cover image (notebooks)
  --content <file>     Use Story JSON file for rich content (notebooks)

Examples:
  tlon posts send chat/~host/channel "Hello from tlon"
  tlon posts reply chat/~host/channel 170.141... "Thread reply"
  tlon posts edit chat/~host/channel 170.141... "Updated message"
  tlon posts edit diary/~host/notes 170.141... --title "New Title" --image https://example.com/cover.jpg --content article.json

Channel format: chat/~host/channel-name, diary/~host/name, heap/~host/name
Use 'tlon messages channel <nest> --limit N' to see post IDs.`;

const POSTS_COMMAND_HELP: Record<string, string> = {
  send: 'Usage: tlon posts send <channel> <message> [--blob <json>]',
  reply: 'Usage: tlon posts reply <channel> <post-id> <message> [--author ~ship]',
  react: 'Usage: tlon posts react <channel> <post-id> <emoji>',
  unreact: 'Usage: tlon posts unreact <channel> <post-id>',
  edit: 'Usage: tlon posts edit <channel> <post-id> <message> [--title <title>] [--image <url>] [--content <json-file>]',
  delete: 'Usage: tlon posts delete <channel> <post-id>',
};

const POST_EDIT_OPTION_FLAGS = ['title', 'content', 'image'] as const;
const POST_REPLY_OPTION_FLAGS = ['author'] as const;
const POST_SEND_OPTION_FLAGS = ['blob'] as const;

function getPostsHelp(command?: string): string {
  return command ? POSTS_COMMAND_HELP[command] ?? POSTS_HELP : POSTS_HELP;
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

function firstPostReplyFlagIndex(args: string[]): number {
  const flagIndexes = POST_REPLY_OPTION_FLAGS.map((flag) =>
    args.indexOf(`--${flag}`)
  ).filter((idx) => idx !== -1);
  return flagIndexes.length > 0 ? Math.min(...flagIndexes) : args.length;
}

function getPostReplyMessage(args: string[]): string {
  return args.slice(3, firstPostReplyFlagIndex(args)).join(' ');
}

function firstPostSendFlagIndex(args: string[]): number {
  const flagIndexes = POST_SEND_OPTION_FLAGS.map((flag) =>
    args.indexOf(`--${flag}`)
  ).filter((idx) => idx !== -1);
  return flagIndexes.length > 0 ? Math.min(...flagIndexes) : args.length;
}

function getPostSendMessage(args: string[]): string {
  return args.slice(2, firstPostSendFlagIndex(args)).join(' ');
}

function validatedSendBlob(args: string[]): string | undefined {
  const blobIdx = args.indexOf('--blob');
  if (blobIdx === -1) {
    return undefined;
  }
  const blob = args[blobIdx + 1];
  if (!blob) {
    printUsageAndExit(POSTS_COMMAND_HELP.send);
  }
  try {
    if (!Array.isArray(JSON.parse(blob))) {
      throw new Error('not an array');
    }
  } catch {
    printErrorAndExit('--blob must be a JSON array of post-blob entries');
  }
  return blob;
}

function isPostEditMessageHelpLiteral(args: string[]): boolean {
  return (
    args[0] === 'edit' &&
    !!args[1] &&
    !!args[2] &&
    wantsHelp(args.slice(3, firstPostEditFlagIndex(args)))
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

function validatePostsArgs(args: string[]): void {
  const command = args[0];
  if (!command) {
    printUsageAndExit(POSTS_HELP);
  }
  if (!POSTS_COMMAND_HELP[command]) {
    printUsageAndExit(POSTS_HELP);
  }

  switch (command) {
    case 'send': {
      if (!args[1] || !getPostSendMessage(args)) {
        printUsageAndExit(POSTS_COMMAND_HELP.send);
      }
      validatedSendBlob(args);
      return;
    }
    case 'reply': {
      if (!args[1] || !args[2] || !getPostReplyMessage(args)) {
        printUsageAndExit(POSTS_COMMAND_HELP.reply);
      }
      const authorIdx = args.indexOf('--author');
      if (authorIdx !== -1 && !args[authorIdx + 1]) {
        printUsageAndExit(POSTS_COMMAND_HELP.reply);
      }
      return;
    }
    case 'react': {
      if (!args[1] || !args[2] || !args[3])
        printUsageAndExit(POSTS_COMMAND_HELP.react);
      return;
    }
    case 'unreact':
    case 'delete': {
      if (!args[1] || !args[2]) printUsageAndExit(POSTS_COMMAND_HELP[command]);
      return;
    }
    case 'edit': {
      if (!args[1] || !args[2]) printUsageAndExit(POSTS_COMMAND_HELP.edit);
      const message = getPostEditMessage(args);
      if (
        !message &&
        !hasOptionValue(args, 'content', POST_EDIT_OPTION_FLAGS)
      ) {
        printUsageAndExit(POSTS_COMMAND_HELP.edit);
      }
      return;
    }
  }
}

// Strip optional ~ship/ prefix from a post ID, returning just the numeric part
function extractNumericId(id: string): string {
  const slash = id.indexOf('/');
  return slash >= 0 ? id.slice(slash + 1) : id;
}

// Format a post ID as @ud (with dots every 3 digits)
// This is required for reactions to work properly
function formatUd(id: string): string {
  const clean = id.replace(/\./g, '');
  const parts: string[] = [];
  for (let i = clean.length; i > 0; i -= 3) {
    parts.unshift(clean.slice(Math.max(0, i - 3), i));
  }
  return parts.join('.');
}

// Parse content into Story format with rich markdown support
function parseContent(message: string): Story {
  return markdownToStory(message);
}

function postTargetApps(command: string | undefined, target: string | undefined) {
  if ((command === 'send' || command === 'reply') && target) {
    return target.startsWith('~') || target.startsWith('0v')
      ? ['chat' as const]
      : ['channels' as const];
  }
  return ['channels' as const];
}

// Fetch existing post to preserve metadata during edits
async function fetchExistingPost(
  nest: string,
  postId: string
): Promise<Post | null> {
  const formattedId = formatUd(extractNumericId(postId));
  try {
    const data = await getChannelPosts({
      channelId: nest,
      mode: 'around',
      cursor: formattedId,
      count: 1,
      includeReplies: false,
    });

    // Find the exact post by ID
    const post = data.posts.find(
      (p) => formatUd(extractNumericId(p.id)) === formattedId
    );
    return post || null;
  } catch (error) {
    return null;
  }
}

// React to a post
async function reactToPost(
  nest: string,
  postId: string,
  react: string
): Promise<{ success: boolean; error?: string }> {
  const our = getCurrentUserId();
  const formattedId = formatUd(extractNumericId(postId));

  try {
    await addReaction({
      channelId: nest,
      postId: formattedId,
      emoji: react,
      our,
      postAuthor: our,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Remove reaction from a post
async function unreactToPost(
  nest: string,
  postId: string
): Promise<{ success: boolean; error?: string }> {
  const our = getCurrentUserId();
  const formattedId = formatUd(extractNumericId(postId));

  try {
    await removeReaction({
      channelId: nest,
      postId: formattedId,
      our,
      postAuthor: our,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function sendChannelPost(
  nest: string,
  message: string,
  blob?: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const authorId = getCurrentUserId();
    const sentAt = Date.now();
    const content = parseContent(message);

    await sendPost({
      channelId: nest,
      authorId,
      sentAt,
      content,
      blob,
    });

    return { success: true, postId: String(sentAt) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function replyToChannelPost(
  nest: string,
  postId: string,
  message: string,
  parentAuthor?: string
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  try {
    const authorId = getCurrentUserId();
    const sentAt = Date.now();
    const content = parseContent(message);

    await sendReply({
      channelId: nest,
      parentId: formatUd(extractNumericId(postId)),
      parentAuthor: parentAuthor ?? authorId,
      content,
      sentAt,
      authorId,
    });

    return { success: true, replyId: String(sentAt) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Edit a post (channels only, not DMs)
// Note: postId must be in @da format
async function editChannelPost(
  nest: string,
  postId: string,
  newContent: string,
  metadata?: {
    title?: string;
    image?: string;
    description?: string;
    cover?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const authorId = getCurrentUserId();
    const sentAt = Date.now();
    const content = parseContent(newContent);

    await editPost({
      channelId: nest,
      postId: formatUd(extractNumericId(postId)),
      authorId,
      sentAt,
      content,
      metadata,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Edit a post with pre-parsed Story content (for rich notebook editing)
async function editChannelPostWithContent(
  nest: string,
  postId: string,
  content: Story,
  metadata?: {
    title?: string;
    image?: string;
    description?: string;
    cover?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const authorId = getCurrentUserId();
    const sentAt = Date.now();

    await editPost({
      channelId: nest,
      postId: formatUd(extractNumericId(postId)),
      authorId,
      sentAt,
      content,
      metadata,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Delete a post
// Note: postId must be in @da format (e.g., "170.141.184.507.800.833.818.237.178.278.053.937.152")
async function deleteChannelPost(
  nest: string,
  postId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await deletePost(
      nest,
      formatUd(extractNumericId(postId)),
      getCurrentUserId()
    );
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (isHelpArg(command)) {
    printHelpAndExit(POSTS_HELP);
  }

  if (
    wantsHelp(args.slice(1)) &&
    !isPostEditMessageHelpLiteral(args) &&
    !isPostSendMessageHelpLiteral(args) &&
    !isPostReplyMessageHelpLiteral(args)
  ) {
    printHelpAndExit(getPostsHelp(command));
  }

  validatePostsArgs(args);

  await ensureClient(postTargetApps(command, args[1]));

  try {
    switch (command) {
      case 'send': {
        const channel = args[1];
        const message = getPostSendMessage(args);
        if (!channel || !message) {
          printUsageAndExit(POSTS_COMMAND_HELP.send);
        }
        const blob = validatedSendBlob(args);
        const result = await sendChannelPost(channel, message, blob);
        if (!result.success) {
          console.error(`Error: ${result.error}`);
          process.exit(1);
        }
        console.log('✓ Message sent');
        break;
      }

      case 'reply': {
        const channel = args[1];
        const postId = args[2];
        const authorIdx = args.indexOf('--author');
        const parentAuthor = authorIdx !== -1 ? args[authorIdx + 1] : undefined;
        const message = getPostReplyMessage(args);
        if (!channel || !postId || !message) {
          printUsageAndExit(POSTS_COMMAND_HELP.reply);
        }
        if (authorIdx !== -1 && !parentAuthor) {
          printUsageAndExit(POSTS_COMMAND_HELP.reply);
        }
        const result = await replyToChannelPost(
          channel,
          postId,
          message,
          parentAuthor
        );
        if (!result.success) {
          console.error(`Error: ${result.error}`);
          process.exit(1);
        }
        console.log('✓ Reply sent');
        break;
      }

      case 'react': {
        const [_, channel, postId, emoji] = args;
        if (!channel || !postId || !emoji) {
          printUsageAndExit(POSTS_COMMAND_HELP.react);
        }
        const result = await reactToPost(channel, postId, emoji);
        if (!result.success) {
          console.error(`Error: ${result.error}`);
          process.exit(1);
        }
        console.log('✓ Reaction added');
        break;
      }

      case 'unreact': {
        const [_, channel, postId] = args;
        if (!channel || !postId) {
          printUsageAndExit(POSTS_COMMAND_HELP.unreact);
        }
        const result = await unreactToPost(channel, postId);
        if (!result.success) {
          console.error(`Error: ${result.error}`);
          process.exit(1);
        }
        console.log('✓ Reaction removed');
        break;
      }

      case 'edit': {
        const channel = args[1];
        const postId = args[2];
        const titleIdx = args.indexOf('--title');
        const contentIdx = args.indexOf('--content');
        const imageIdx = args.indexOf('--image');

        const newTitle = titleIdx !== -1 ? args[titleIdx + 1] : undefined;
        const contentFile =
          contentIdx !== -1 ? args[contentIdx + 1] : undefined;
        const newImage = imageIdx !== -1 ? args[imageIdx + 1] : undefined;

        if (!channel || !postId) {
          printUsageAndExit(POSTS_COMMAND_HELP.edit);
        }

        // Fetch existing post to preserve metadata not being explicitly changed
        const existingPost = await fetchExistingPost(channel, postId);

        // Merge: new values override existing, existing values preserved if not specified
        const metadata: {
          title?: string;
          image?: string;
          description?: string;
          cover?: string;
        } = {
          title: newTitle ?? existingPost?.title ?? undefined,
          image: newImage ?? existingPost?.image ?? undefined,
          description: existingPost?.description ?? undefined,
          cover: existingPost?.cover ?? undefined,
        };

        let result;
        if (contentFile) {
          // Rich content from JSON file
          const jsonContent = fs.readFileSync(contentFile, 'utf-8');
          const content = JSON.parse(jsonContent) as Story;
          result = await editChannelPostWithContent(
            channel,
            postId,
            content,
            metadata
          );
        } else {
          // Plain text/markdown message
          const message = getPostEditMessage(args);
          if (!message) {
            printUsageAndExit(POSTS_COMMAND_HELP.edit);
          }
          result = await editChannelPost(channel, postId, message, metadata);
        }

        if (!result.success) {
          console.error(`Error: ${result.error}`);
          process.exit(1);
        }
        console.log('✓ Post edited');
        break;
      }

      case 'delete': {
        const channel = args[1];
        const postId = args[2];
        if (!channel || !postId) {
          printUsageAndExit(POSTS_COMMAND_HELP.delete);
        }
        const result = await deleteChannelPost(channel, postId);
        if (!result.success) {
          console.error(`Error: ${result.error}`);
          process.exit(1);
        }
        console.log('✓ Post deleted');
        break;
      }
    }
    process.exit(0);
  } catch (error) {
    printErrorAndExit(error);
  }
}

main();
