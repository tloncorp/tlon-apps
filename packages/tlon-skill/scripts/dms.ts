#!/usr/bin/env npx ts-node

/**
 * Direct Message management for Tlon
 *
 * Note: 1:1 DM send/reply is handled by the openclaw-tlon channel plugin.
 * This script handles club (group DM) messaging and DM management ops only.
 *
 * Usage:
 *   npx ts-node scripts/dms.ts send <club-id> <message> [--bot]        (group DMs only)
 *   npx ts-node scripts/dms.ts reply <club-id> <post-id> <msg> [--bot] (group DMs only)
 *   npx ts-node scripts/dms.ts react <ship> <post-id> <emoji> [--parent <post-id>]
 *   npx ts-node scripts/dms.ts unreact <ship> <post-id> [--parent <post-id>]
 *   npx ts-node scripts/dms.ts delete <ship> <post-id>
 *   npx ts-node scripts/dms.ts accept <ship>
 *   npx ts-node scripts/dms.ts decline <ship>
 */
import {
  addReaction,
  addVouchedDmReaction,
  deletePost,
  deleteVouchedDmPost,
  getCurrentUserId,
  removeReaction,
  removeVouchedDmReaction,
  respondToDMInvite,
  sendPost,
  sendReply,
} from '@tloncorp/api';
import type { Channel } from '@tloncorp/api';

import { ensureClient, normalizeShip } from './api-client';
import {
  type BotAuthorProfile,
  botProfileFlagIndex,
  parseBotProfileFlags,
} from './bot-profile-flags';
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
import { type Story, type StoryVerse, markdownToStory } from './markdown';
import { botMoon } from './moon';

const DMS_HELP = `Usage: tlon dms <command>

Commands:
  send <club-id> [message]        Send a message to a group DM [--image <url>] [--bot]
  reply <club-id> <post-id> <msg> Reply in a group DM (post-id must include author) [--bot]
  react <ship> <post-id> <emoji>  React to a DM (post-id must include author) [--parent <post-id>]
  unreact <ship> <post-id>        Remove reaction from a DM (post-id must include author) [--parent <post-id>]
  delete <ship> <post-id>         Delete a DM (post-id may include author)
  accept <ship>                   Accept a DM invite
  decline <ship>                  Decline a DM invite

Send options:
  --bot                  Author the message as a bot (renders the "Bot" tag)`;

const DMS_COMMAND_HELP: Record<string, string> = {
  send: 'Usage: tlon dms send <club-id> [message] [--image <url>] [--bot] (message optional with --image)',
  reply: 'Usage: tlon dms reply <club-id> <post-id> <message> [--bot]',
  react: 'Usage: tlon dms react <ship> <post-id> <emoji> [--parent <post-id>]',
  unreact: 'Usage: tlon dms unreact <ship> <post-id> [--parent <post-id>]',
  delete: 'Usage: tlon dms delete <ship> <post-id>',
  accept: 'Usage: tlon dms accept <ship>',
  decline: 'Usage: tlon dms decline <ship>',
};

function getDmsHelp(command?: string): string {
  return command ? (DMS_COMMAND_HELP[command] ?? DMS_HELP) : DMS_HELP;
}

// Option-flag boundary for the message slice: everything from the first flag on
// is options, not message text.
function firstBotProfileFlagIndex(args: string[]): number {
  const idx = botProfileFlagIndex(args);
  return idx === -1 ? args.length : idx;
}

function firstDmSendFlagIndex(args: string[]): number {
  const image = imageFlagIndex(args);
  return Math.min(
    image !== -1 ? image : args.length,
    firstBotProfileFlagIndex(args)
  );
}

export function getDmSendMessage(args: string[]): string {
  return args.slice(2, firstDmSendFlagIndex(args)).join(' ');
}

export function getDmReplyMessage(args: string[]): string {
  return args.slice(3, firstBotProfileFlagIndex(args)).join(' ');
}

// Bot-author flags for a send/reply, or undefined when none are present.
// Malformed flags exit with the subcommand's usage, before any API work.
export function dmBotProfile(
  args: string[],
  help: string
): BotAuthorProfile | undefined {
  const parsed = parseBotProfileFlags(args);
  if (!parsed.ok) {
    return printUsageAndExit(help);
  }
  return parsed.botProfile;
}

function isDmsMessageHelpLiteral(args: string[]): boolean {
  const command = args[0];
  if (command === 'send') {
    return !!args[1] && wantsHelp(args.slice(2, firstDmSendFlagIndex(args)));
  }
  if (command === 'reply') {
    return (
      !!args[1] &&
      !!args[2] &&
      wantsHelp(args.slice(3, firstBotProfileFlagIndex(args)))
    );
  }
  return false;
}

export function validateDmsArgs(args: string[]): void {
  const command = args[0];
  if (!command || !DMS_COMMAND_HELP[command]) {
    printUsageAndExit(DMS_HELP);
  }

  switch (command) {
    case 'send': {
      const clubId = args[1];
      const message = getDmSendMessage(args);
      const image = validatedImageFlag(args, DMS_COMMAND_HELP.send);
      dmBotProfile(args, DMS_COMMAND_HELP.send);
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
      const message = getDmReplyMessage(args);
      dmBotProfile(args, DMS_COMMAND_HELP.reply);
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
      // A positional slot filled by an option token (e.g. `--parent` swallowed
      // into the emoji slot when the emoji is omitted) is a usage error.
      if (positionalIsOption(args, 3))
        printUsageAndExit(DMS_COMMAND_HELP.react);
      reactionParent(args, DMS_COMMAND_HELP.react);
      return;
    }
    case 'unreact':
      if (!args[1] || !args[2]) printUsageAndExit(DMS_COMMAND_HELP.unreact);
      if (positionalIsOption(args, 2))
        printUsageAndExit(DMS_COMMAND_HELP.unreact);
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

// True when any positional slot 1..count is an option token (starts with
// `--`). Guards against a flag being swallowed into a positional slot (e.g.
// an omitted emoji letting `--parent` land in the react slot).
function positionalIsOption(args: string[], count: number): boolean {
  for (let i = 1; i <= count; i += 1) {
    if (args[i]?.startsWith('--')) return true;
  }
  return false;
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

type DmSendDeps = {
  getCurrentUserId: typeof getCurrentUserId;
  sendPost: typeof sendPost;
  sendReply: typeof sendReply;
};

// Everything `run` reaches the network with, so a test can drive the real
// argv -> payload path without a ship.
export type DmDeps = DmSendDeps & {
  ensureClient: typeof ensureClient;
  fetchImageVerse: typeof fetchImageVerse;
};

const DEFAULT_SEND_DEPS: DmSendDeps = {
  getCurrentUserId,
  sendPost,
  sendReply,
};

const DEFAULT_DEPS: DmDeps = {
  ...DEFAULT_SEND_DEPS,
  ensureClient,
  fetchImageVerse,
};

// Send a message to a group DM (club)
export async function sendClubMessage(
  clubId: string,
  message: string,
  imageVerse?: StoryVerse,
  botProfile?: BotAuthorProfile,
  deps: DmSendDeps = DEFAULT_SEND_DEPS
): Promise<{ success: boolean; postId?: string; error?: string }> {
  // clubs have no vouched path yet: posting would be attributed to the HOST
  if (botMoon()) {
    return {
      success: false,
      error: 'group DMs do not support bot identities yet',
    };
  }
  const authorId = deps.getCurrentUserId();
  const sentAt = Date.now();
  // Image block first, caption after — matches app attachment posts.
  const content: Story = [
    ...(imageVerse ? [imageVerse] : []),
    ...(message ? parseContent(message) : []),
  ];

  try {
    await deps.sendPost({
      channelId: clubId,
      authorId,
      sentAt,
      content,
      ...(botProfile ? { botProfile } : {}),
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Reply in a club (group DM)
export async function replyToClub(
  clubId: string,
  postId: string,
  message: string,
  botProfile?: BotAuthorProfile,
  deps: DmSendDeps = DEFAULT_SEND_DEPS
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  if (botMoon()) {
    return {
      success: false,
      error: 'group DMs do not support bot identities yet',
    };
  }
  const authorId = deps.getCurrentUserId();
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
    await deps.sendReply({
      channelId: clubId,
      parentId: parsed.id,
      parentAuthor: parsed.authorId,
      content,
      sentAt,
      authorId,
      ...(botProfile ? { botProfile } : {}),
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

  // acting as a bot moon: the reaction must be attributed to the bot, so it
  // rides the vouched conversation, never the host's own DM store. For a
  // thread reaction, --parent names the parent writ and the post id is the
  // reply being reacted to.
  const moon = botMoon();
  if (moon) {
    try {
      await addVouchedDmReaction({
        as: moon,
        toShip: normalizedShip,
        postId: `${parsed.authorId}/${parsed.id}`,
        emoji: react,
        authorId: moon,
        parentId: parent ? `${parent.authorId}/${parent.id}` : undefined,
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
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

  const moon = botMoon();
  if (moon) {
    try {
      await removeVouchedDmReaction({
        as: moon,
        toShip: normalizedShip,
        postId: `${parsed.authorId}/${parsed.id}`,
        authorId: moon,
        parentId: parent ? `${parent.authorId}/${parent.id}` : undefined,
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
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

  // acting as a bot moon: deletions ride the vouched conversation. The desk
  // only relays deletions the sender may vouch for, so the bot can only
  // delete its own messages.
  const moon = botMoon();
  if (moon) {
    try {
      await deleteVouchedDmPost({
        as: moon,
        toShip: normalizedShip,
        postId: `${parsed.authorId ?? moon}/${parsed.id}`,
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

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
  if (botMoon()) {
    return {
      success: false,
      error:
        'bot DM conversations are auto-accepted; there are no invites to accept',
    };
  }
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
  if (botMoon()) {
    return {
      success: false,
      error:
        'bot DM conversations are auto-accepted; there are no invites to decline',
    };
  }
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

// CLI. `args`/`deps` are injectable so the argv -> API payload path is testable
// end to end; the process entry point below supplies the real ones.
export async function run(
  args: string[],
  deps: DmDeps = DEFAULT_DEPS
): Promise<void> {
  const command = args[0];

  if (isHelpArg(command)) {
    printHelpAndExit(DMS_HELP);
  }

  if (wantsHelp(args.slice(1)) && !isDmsMessageHelpLiteral(args)) {
    printHelpAndExit(getDmsHelp(command));
  }

  validateDmsArgs(args);

  await deps.ensureClient(['chat']);

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
          imageVerse = await deps.fetchImageVerse(imageUrl);
        } catch (error: any) {
          printErrorAndExit(error.message);
        }
      }
      const result = await sendClubMessage(
        clubId,
        message,
        imageVerse,
        dmBotProfile(args, DMS_COMMAND_HELP.send),
        deps
      );
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
      const message = getDmReplyMessage(args);
      if (!clubId || !postId || !message) {
        printUsageAndExit(DMS_COMMAND_HELP.reply);
      }
      if (!isClub(clubId)) {
        printErrorAndExit(
          'reply only supports group DMs (club IDs starting with 0v)'
        );
      }
      const result = await replyToClub(
        clubId,
        postId,
        message,
        dmBotProfile(args, DMS_COMMAND_HELP.reply),
        deps
      );
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

export async function main(): Promise<void> {
  await run(process.argv.slice(2));
}

// The unified CLI dynamically imports this module after setting argv to
// ['tlon', 'dms', ...], while direct legacy `ts-node scripts/dms.ts` execution
// retains the source filename in argv[1]. Keep both entry styles working and
// leave imports side-effect free for the command-level tests.
if (/(?:^|[\\/])dms\.(?:ts|js)$/.test(process.argv[1] ?? '')) {
  main().catch(printErrorAndExit);
}
