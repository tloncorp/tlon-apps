#!/usr/bin/env npx ts-node

/**
 * Direct Message management for Tlon
 *
 * Note: 1:1 DM send/reply is handled by the openclaw-tlon channel plugin.
 * This script handles club (group DM) messaging and DM management ops only.
 *
 * Usage:
 *   npx ts-node scripts/dms.ts send <club-id> <message>        (group DMs only)
 *   npx ts-node scripts/dms.ts reply <club-id> <post-id> <msg> (group DMs only)
 *   npx ts-node scripts/dms.ts react <ship> <post-id> <emoji> [--parent <post-id>]
 *   npx ts-node scripts/dms.ts unreact <ship> <post-id> [--parent <post-id>]
 *   npx ts-node scripts/dms.ts delete <ship> <post-id>
 *   npx ts-node scripts/dms.ts accept <ship>
 *   npx ts-node scripts/dms.ts decline <ship>
 */
import {
  addReaction,
  deletePost,
  getCurrentUserId,
  removeReaction,
  respondToDMInvite,
  sendPost,
  sendReply,
} from '@tloncorp/api';
import type { Channel } from '@tloncorp/api';

import { ensureClient, normalizeShip } from './api-client';
import {
  isHelpArg,
  printErrorAndExit,
  printHelpAndExit,
  printUsageAndExit,
  wantsHelp,
} from './cli-utils';
import {
  fetchImageVerse,
  imageFlagIndex,
  validatedImageFlag,
} from './image-attach';
import { type Story, type StoryVerse, markdownToStory } from './story';

const DMS_HELP = `Usage: tlon dms <command>

Commands:
  send <club-id> [message]        Send a message to a group DM [--image <url>]
  reply <club-id> <post-id> <msg> Reply in a group DM (post-id must include author)
  react <ship> <post-id> <emoji>  React to a DM (post-id must include author) [--parent <post-id>]
  unreact <ship> <post-id>        Remove reaction from a DM (post-id must include author) [--parent <post-id>]
  delete <ship> <post-id>         Delete a DM (post-id may include author)
  accept <ship>                   Accept a DM invite
  decline <ship>                  Decline a DM invite`;

const DMS_COMMAND_HELP: Record<string, string> = {
  send: 'Usage: tlon dms send <club-id> [message] [--image <url>] (message optional with --image)',
  reply: 'Usage: tlon dms reply <club-id> <post-id> <message>',
  react: 'Usage: tlon dms react <ship> <post-id> <emoji> [--parent <post-id>]',
  unreact: 'Usage: tlon dms unreact <ship> <post-id> [--parent <post-id>]',
  delete: 'Usage: tlon dms delete <ship> <post-id>',
  accept: 'Usage: tlon dms accept <ship>',
  decline: 'Usage: tlon dms decline <ship>',
};

function getDmsHelp(command?: string): string {
  return command ? DMS_COMMAND_HELP[command] ?? DMS_HELP : DMS_HELP;
}

function firstDmSendFlagIndex(args: string[]): number {
  const idx = imageFlagIndex(args);
  return idx !== -1 ? idx : args.length;
}

function getDmSendMessage(args: string[]): string {
  return args.slice(2, firstDmSendFlagIndex(args)).join(' ');
}

function isDmsMessageHelpLiteral(args: string[]): boolean {
  const command = args[0];
  if (command === 'send') {
    return !!args[1] && wantsHelp(args.slice(2, firstDmSendFlagIndex(args)));
  }
  if (command === 'reply') {
    return !!args[1] && !!args[2] && wantsHelp(args.slice(3));
  }
  return false;
}

function validateDmsArgs(args: string[]): void {
  const command = args[0];
  if (!command || !DMS_COMMAND_HELP[command]) {
    printUsageAndExit(DMS_HELP);
  }

  switch (command) {
    case 'send': {
      const clubId = args[1];
      const message = getDmSendMessage(args);
      const image = validatedImageFlag(args, DMS_COMMAND_HELP.send);
      if (!clubId || (!message && !image)) {
        printUsageAndExit(DMS_COMMAND_HELP.send);
      }
      if (!isClub(clubId)) {
        printErrorAndExit(
          'send only supports group DMs (club IDs starting with 0v)'
        );
      }
      return;
    }
    case 'reply': {
      const clubId = args[1];
      const postId = args[2];
      const message = args.slice(3).join(' ');
      if (!clubId || !postId || !message)
        printUsageAndExit(DMS_COMMAND_HELP.reply);
      if (!isClub(clubId)) {
        printErrorAndExit(
          'reply only supports group DMs (club IDs starting with 0v)'
        );
      }
      return;
    }
    case 'react': {
      if (!args[1] || !args[2] || !args[3])
        printUsageAndExit(DMS_COMMAND_HELP.react);
      reactionParent(args, DMS_COMMAND_HELP.react);
      return;
    }
    case 'unreact':
      if (!args[1] || !args[2]) printUsageAndExit(DMS_COMMAND_HELP.unreact);
      reactionParent(args, DMS_COMMAND_HELP.unreact);
      return;
    case 'delete': {
      if (!args[1] || !args[2]) printUsageAndExit(DMS_COMMAND_HELP[command]);
      return;
    }
    case 'accept':
    case 'decline': {
      if (!args[1]) printUsageAndExit(DMS_COMMAND_HELP[command]);
      return;
    }
  }
}

// Parse content into Story format with rich markdown support
function parseContent(message: string): Story {
  return markdownToStory(message);
}

// Check if the target is a group DM (club)
function isClub(whom: string): boolean {
  return whom.startsWith('0v');
}

export function parsePostId(postId: string): { id: string; authorId?: string } {
  if (postId.includes('/')) {
    const [author, id] = postId.split('/');
    return { id, authorId: normalizeShip(author) };
  }
  return { id: postId };
}

export function reactionParent(
  args: string[],
  help: string
): string | undefined {
  const idx = args.indexOf('--parent');
  if (idx === -1) return undefined;
  // Reject a duplicate `--parent` and a value that is itself an option
  // token (e.g. `--parent --bogus` reading the next flag as the id).
  if (args.indexOf('--parent', idx + 1) !== -1) {
    printUsageAndExit(help);
  }
  const parentId = args[idx + 1];
  if (!parentId || parentId.startsWith('--')) {
    printUsageAndExit(help);
  }
  return parentId;
}

// Send a message to a group DM (club)
async function sendClubMessage(
  clubId: string,
  message: string,
  imageVerse?: StoryVerse
): Promise<{ success: boolean; postId?: string; error?: string }> {
  const authorId = getCurrentUserId();
  const sentAt = Date.now();
  // Image block first, caption after — matches app attachment posts.
  const content: Story = [
    ...(imageVerse ? [imageVerse] : []),
    ...(message ? parseContent(message) : []),
  ];

  try {
    await sendPost({
      channelId: clubId,
      authorId,
      sentAt,
      content,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Reply in a club (group DM)
async function replyToClub(
  clubId: string,
  postId: string,
  message: string
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  const authorId = getCurrentUserId();
  const sentAt = Date.now();
  const content = parseContent(message);
  const parsed = parsePostId(postId);

  if (!parsed.authorId) {
    return {
      success: false,
      error: 'Post ID must include author (e.g., ~ship/123.456)',
    };
  }

  try {
    await sendReply({
      channelId: clubId,
      parentId: parsed.id,
      parentAuthor: parsed.authorId,
      content,
      sentAt,
      authorId,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// React to a DM
type DmReactionDeps = {
  addReaction: typeof addReaction;
  getCurrentUserId: typeof getCurrentUserId;
  normalizeShip: typeof normalizeShip;
  removeReaction: typeof removeReaction;
};

const DEFAULT_REACTION_DEPS: DmReactionDeps = {
  addReaction,
  getCurrentUserId,
  normalizeShip,
  removeReaction,
};

export async function reactToDM(
  ship: string,
  postId: string,
  react: string,
  parentId?: string,
  deps: DmReactionDeps = DEFAULT_REACTION_DEPS
): Promise<{ success: boolean; error?: string }> {
  const normalizedShip = deps.normalizeShip(ship);
  const our = deps.getCurrentUserId();
  const parsed = parsePostId(postId);

  if (!parsed.authorId) {
    return {
      success: false,
      error: 'Post ID must include author (e.g., ~ship/123.456)',
    };
  }
  const parent = parentId ? parsePostId(parentId) : undefined;
  if (parentId && !parent?.authorId) {
    return {
      success: false,
      error: 'Parent ID must include author (e.g., ~ship/123.456)',
    };
  }

  try {
    await deps.addReaction({
      channelId: normalizedShip,
      postId: parsed.id,
      emoji: react,
      our,
      postAuthor: parsed.authorId,
      ...(parent
        ? { parentId: parent.id, parentAuthorId: parent.authorId }
        : {}),
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Remove reaction from a DM
export async function unreactToDM(
  ship: string,
  postId: string,
  parentId?: string,
  deps: DmReactionDeps = DEFAULT_REACTION_DEPS
): Promise<{ success: boolean; error?: string }> {
  const normalizedShip = deps.normalizeShip(ship);
  const our = deps.getCurrentUserId();
  const parsed = parsePostId(postId);

  if (!parsed.authorId) {
    return {
      success: false,
      error: 'Post ID must include author (e.g., ~ship/123.456)',
    };
  }
  const parent = parentId ? parsePostId(parentId) : undefined;
  if (parentId && !parent?.authorId) {
    return {
      success: false,
      error: 'Parent ID must include author (e.g., ~ship/123.456)',
    };
  }

  try {
    await deps.removeReaction({
      channelId: normalizedShip,
      postId: parsed.id,
      our,
      postAuthor: parsed.authorId,
      ...(parent
        ? { parentId: parent.id, parentAuthorId: parent.authorId }
        : {}),
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Delete a DM
async function deleteDM(
  ship: string,
  postId: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedShip = normalizeShip(ship);
  const authorId = getCurrentUserId();
  const parsed = parsePostId(postId);

  try {
    await deletePost(normalizedShip, parsed.id, parsed.authorId ?? authorId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Accept a DM invite
async function acceptDM(
  ship: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedShip = normalizeShip(ship);
  const channel: Channel = {
    id: normalizedShip,
    type: 'dm',
    currentUserIsMember: false,
    currentUserIsHost: false,
    contactId: normalizedShip,
  };

  try {
    await respondToDMInvite({ channel, accept: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Decline a DM invite
async function declineDM(
  ship: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedShip = normalizeShip(ship);
  const channel: Channel = {
    id: normalizedShip,
    type: 'dm',
    currentUserIsMember: false,
    currentUserIsHost: false,
    contactId: normalizedShip,
  };

  try {
    await respondToDMInvite({ channel, accept: false });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// CLI
export async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (isHelpArg(command)) {
    printHelpAndExit(DMS_HELP);
  }

  if (wantsHelp(args.slice(1)) && !isDmsMessageHelpLiteral(args)) {
    printHelpAndExit(getDmsHelp(command));
  }

  validateDmsArgs(args);

  await ensureClient(['chat']);

  switch (command) {
    case 'send': {
      const clubId = args[1];
      const message = getDmSendMessage(args);
      const imageUrl = validatedImageFlag(args, DMS_COMMAND_HELP.send);
      if (!clubId || (!message && !imageUrl)) {
        printUsageAndExit(DMS_COMMAND_HELP.send);
      }
      if (!isClub(clubId)) {
        printErrorAndExit(
          'send only supports group DMs (club IDs starting with 0v)'
        );
      }
      let imageVerse: StoryVerse | undefined;
      if (imageUrl) {
        try {
          imageVerse = await fetchImageVerse(imageUrl);
        } catch (error: any) {
          printErrorAndExit(error.message);
        }
      }
      const result = await sendClubMessage(clubId, message, imageVerse);
      if (result.success) {
        console.log('✓ Message sent!');
      } else {
        console.error(`✗ Failed: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case 'reply': {
      const clubId = args[1];
      const postId = args[2];
      const message = args.slice(3).join(' ');
      if (!clubId || !postId || !message) {
        printUsageAndExit(DMS_COMMAND_HELP.reply);
      }
      if (!isClub(clubId)) {
        printErrorAndExit(
          'reply only supports group DMs (club IDs starting with 0v)'
        );
      }
      const result = await replyToClub(clubId, postId, message);
      if (result.success) {
        console.log('✓ Reply sent!');
      } else {
        console.error(`✗ Failed: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case 'react': {
      const ship = args[1];
      const postId = args[2];
      const react = args[3];
      if (!ship || !postId || !react) {
        printUsageAndExit(DMS_COMMAND_HELP.react);
      }
      const result = await reactToDM(
        ship,
        postId,
        react,
        reactionParent(args, DMS_COMMAND_HELP.react)
      );
      if (result.success) {
        console.log('✓ Reaction added!');
      } else {
        console.error(`✗ Failed: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case 'unreact': {
      const ship = args[1];
      const postId = args[2];
      if (!ship || !postId) {
        printUsageAndExit(DMS_COMMAND_HELP.unreact);
      }
      const result = await unreactToDM(
        ship,
        postId,
        reactionParent(args, DMS_COMMAND_HELP.unreact)
      );
      if (result.success) {
        console.log('✓ Reaction removed!');
      } else {
        console.error(`✗ Failed: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case 'delete': {
      const ship = args[1];
      const postId = args[2];
      if (!ship || !postId) {
        printUsageAndExit(DMS_COMMAND_HELP.delete);
      }
      const result = await deleteDM(ship, postId);
      if (result.success) {
        console.log('✓ DM deleted!');
      } else {
        console.error(`✗ Failed: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case 'accept': {
      const ship = args[1];
      if (!ship) {
        printUsageAndExit(DMS_COMMAND_HELP.accept);
      }
      const result = await acceptDM(ship);
      if (result.success) {
        console.log('✓ DM invite accepted!');
      } else {
        console.error(`✗ Failed: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    case 'decline': {
      const ship = args[1];
      if (!ship) {
        printUsageAndExit(DMS_COMMAND_HELP.decline);
      }
      const result = await declineDM(ship);
      if (result.success) {
        console.log('✓ DM invite declined!');
      } else {
        console.error(`✗ Failed: ${result.error}`);
        process.exit(1);
      }
      break;
    }

    default:
      printUsageAndExit(DMS_HELP);
  }
  process.exit(0);
}

// The unified CLI dynamically imports this module after setting argv to
// ['tlon', 'dms', ...], while direct legacy `ts-node scripts/dms.ts` execution
// retains the source filename in argv[1]. Keep both entry styles working and
// leave imports side-effect free for the command-level tests.
if (/(?:^|[\\/])dms\.(?:ts|js)$/.test(process.argv[1] ?? '')) {
  main().catch(printErrorAndExit);
}
