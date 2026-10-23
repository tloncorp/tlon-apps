#!/usr/bin/env npx ts-node

/**
 * Groups API for Tlon
 *
 * Usage:
 *   npx ts-node scripts/groups.ts list
 *   npx ts-node scripts/groups.ts create "Group Name" [--description "..."]
 *   npx ts-node scripts/groups.ts create-owned "Group Name" --admin <ship> [--description "..."]
 *   npx ts-node scripts/groups.ts invite <group-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts info <group-id>
 *   npx ts-node scripts/groups.ts leave <group-id>
 *   npx ts-node scripts/groups.ts join <group-id>
 *   npx ts-node scripts/groups.ts request-invite <group-id>
 *   npx ts-node scripts/groups.ts accept-invite <group-id>
 *   npx ts-node scripts/groups.ts reject-invite <group-id>
 *   npx ts-node scripts/groups.ts cancel-join <group-id>
 *   npx ts-node scripts/groups.ts rescind-request <group-id>
 *   npx ts-node scripts/groups.ts revoke-invite <group-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts delete <group-id>
 *   npx ts-node scripts/groups.ts update <group-id> --title "..." [--description "..."] [--image "..."]
 *   npx ts-node scripts/groups.ts kick <group-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts ban <group-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts unban <group-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts add-role <group-id> <role-id> --title "..." [--description "..."]
 *   npx ts-node scripts/groups.ts delete-role <group-id> <role-id>
 *   npx ts-node scripts/groups.ts update-role <group-id> <role-id> --title "..." [--description "..."]
 *   npx ts-node scripts/groups.ts assign-role <group-id> <role-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts remove-role <group-id> <role-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts set-privacy <group-id> <public|private|secret>
 *   npx ts-node scripts/groups.ts accept-join <group-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts reject-join <group-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts promote <group-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts demote <group-id> <ship> [<ship2> ...]
 *   npx ts-node scripts/groups.ts add-channel <group-id> "Channel Name" [--kind chat|heap|notes] [--description "..."]
 *   npx ts-node scripts/groups.ts add-section <group-id> "<title>"
 *   npx ts-node scripts/groups.ts rename-section <group-id> <section> "<title>"
 *   npx ts-node scripts/groups.ts delete-section <group-id> <section>
 *   npx ts-node scripts/groups.ts move-channel <group-id> <channel-nest> --section <section> [--index N]
 *   npx ts-node scripts/groups.ts order-sections <group-id> <section> [<section> ...]
 */
import {
  acceptGroupJoin,
  addGroupRole,
  addMembersToRole,
  cancelGroupJoin as apiCancelGroupJoin,
  joinGroup as apiJoinGroup,
  banUsersFromGroup,
  createChannel,
  createGroup,
  deleteGroup,
  deleteGroupRole,
  getContacts,
  getCurrentUserId,
  getGroup,
  getGroupPreview,
  getGroups,
  inviteGroupMembers,
  kickUsersFromGroup,
  leaveGroup,
  poke,
  rejectGroupInvitation,
  rejectGroupJoin,
  removeMembersFromRole,
  requestGroupInvitation,
  rescindGroupInvitationRequest,
  revokeGroupMemberInvites,
  scry,
  toClientGroupsFromForeigns,
  unbanUsersFromGroup,
  updateGroupMeta,
  updateGroupPrivacy,
  updateGroupRole,
} from '@tloncorp/api';
import type { Group } from '@tloncorp/api';
import type { GroupNavSection } from '@tloncorp/api/types/groups';

import { ensureClient, getCurrentShip, normalizeShip } from './api-client';
import {
  assertKnownChannelKind,
  canonicalizeNest,
  getOption,
  hasOptionValue,
  isHelpArg,
  isSubcommandHelpRequest,
  looksLikePositionalChannelKind,
  printErrorAndExit,
  channelCreateUsage,
  printHelpAndExit,
  printUsageAndExit,
  refShareHint,
  refuseDiaryNest,
  refuseNotesChannelDescription,
  refuseRemovedChannelKind,
} from './cli-utils';
import {
  addSection,
  deleteSection,
  isBlankTitle,
  moveChannel,
  orderSections,
  renameSection,
} from './commands/group-sections';
import {
  type RawGroupForAdminVerification,
  getShipRecordValue,
  seatHasAdminRole,
  seatHasRole,
  shipIsBanned,
  shipIsSeated,
} from './commands/groups-verification';
import { INVITE_LINK_HELP } from './commands/invite-link';
import {
  VERIFY_ATTEMPTS,
  VERIFY_DELAY_MS,
  assertActingShipCanAdminister,
  getGroupHost,
  getRawGroupForAdminVerification,
} from './group-admin';
import { createGroupSectionsDeps } from './group-sections-runtime';
import { runInviteLinkCommand } from './invite-link-runtime';
import { createNotesChannelInGroup } from './notes-channel';
import { createNotesChannelDeps } from './notes-channel-runtime';
import { sleep } from './runtime-deps';

const ADMIN_ROLE_ID = 'admin';
const GROUP_UPDATE_FLAGS = ['title', 'description', 'image', 'cover'] as const;

// Generate a random short ID for the group
function generateGroupSlug(): string {
  // Must be valid @tas: lowercase letters, numbers, hyphens, must start with letter
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const alphanumeric = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = chars[Math.floor(Math.random() * chars.length)];
  for (let i = 0; i < 7; i++) {
    slug += alphanumeric[Math.floor(Math.random() * alphanumeric.length)];
  }
  return slug;
}

const CREATE_OWNED_VALUE_OPTIONS = new Set([
  '--admin',
  '--owner',
  '--description',
]);

/**
 * create-owned's admin ship. Its options follow the title and each takes the
 * next token as its value, so a description of "--admin" is not an option;
 * `--admin` wins over its legacy alias `--owner`. When the options read that
 * way name no admin, the first `--owner` value anywhere still counts, as it
 * did before `--admin` existed. The tlon tool adapters find it the same way.
 */
function getCreateOwnedAdmin(args: string[]): string | undefined {
  let admin: string | undefined;
  let owner: string | undefined;
  for (let i = 2; i < args.length; i += 1) {
    if (!CREATE_OWNED_VALUE_OPTIONS.has(args[i])) continue;
    if (args[i] === '--admin') admin ??= args[i + 1];
    if (args[i] === '--owner') owner ??= args[i + 1];
    i += 1;
  }
  return admin ?? owner ?? getOption(args, 'owner', 2);
}

const GROUPS_HELP = `Usage: tlon groups <command>

The Tlon Messenger app calls groups "workspaces".

Commands:
  list
  create "Group Name" [--description "..."]
  create-owned "Group Name" --admin <ship> [--description "..."]
  invite <group-id> <ship> [<ship2> ...]
  info <group-id>
  invite-link <group-id> [--self]
  leave <group-id>
  join <group-id>
  request-invite <group-id>
  accept-invite <group-id>
  reject-invite <group-id>
  cancel-join <group-id>
  rescind-request <group-id>
  revoke-invite <group-id> <ship> [<ship2> ...]
  delete <group-id>
  update <group-id> --title "..." [--description "..."] [--image "..."] [--cover "..."]
  kick <group-id> <ship> [<ship2> ...]
  ban <group-id> <ship> [<ship2> ...]
  unban <group-id> <ship> [<ship2> ...]
  add-role <group-id> <role-id> --title "..." [--description "..."]
  delete-role <group-id> <role-id>
  update-role <group-id> <role-id> --title "..." [--description "..."]
  assign-role <group-id> <role-id> <ship> [<ship2> ...]
  remove-role <group-id> <role-id> <ship> [<ship2> ...]
  set-privacy <group-id> <public|private|secret>
  accept-join <group-id> <ship> [<ship2> ...]
  reject-join <group-id> <ship> [<ship2> ...]
  promote <group-id> <ship> [<ship2> ...]
  demote <group-id> <ship> [<ship2> ...]
  ${channelCreateUsage('add-channel')}
  add-section <group-id> "<title>"
  rename-section <group-id> <section> "<title>"
  delete-section <group-id> <section>
  move-channel <group-id> <channel-nest> --section <section> [--index N]
  order-sections <group-id> <section> [<section> ...]

A <section> is a section id or title; \`groups info\` lists them.

Examples:
  tlon groups info ~host/group-slug
  tlon groups add-channel ~host/group-slug "Projects" --kind chat
  tlon groups move-channel ~host/group-slug chat/~host/general --section Archive`;

const GROUPS_COMMAND_HELP: Record<string, string> = {
  list: `Usage: tlon groups list`,
  create: `Usage: tlon groups create "Group Name" [--description "..."]\nExample: tlon groups create "Projects" --description "Shared work"`,
  'create-owned': `Usage: tlon groups create-owned "Group Name" --admin <ship> [--description "..."]\nCreates a group hosted by the current ship and makes --admin its admin. --owner is a legacy alias for --admin.\nExample: tlon groups create-owned "Projects" --admin ~nec --description "Shared work"`,
  invite: `Usage: tlon groups invite <group-id> <ship> [<ship2> ...]\nExample: tlon groups invite ~host/group-slug ~nec ~bud`,
  info: `Usage: tlon groups info <group-id>\nExample: tlon groups info ~host/group-slug`,
  'invite-link': INVITE_LINK_HELP,
  leave: `Usage: tlon groups leave <group-id>\nExample: tlon groups leave ~host/group-slug`,
  join: `Usage: tlon groups join <group-id>\nJoins public or invited groups. For private groups without an invite, requests an invite.\nExample: tlon groups join ~host/group-slug`,
  'request-invite': `Usage: tlon groups request-invite <group-id>\nExample: tlon groups request-invite ~host/group-slug`,
  'accept-invite': `Usage: tlon groups accept-invite <group-id>\nExample: tlon groups accept-invite ~host/group-slug`,
  'reject-invite': `Usage: tlon groups reject-invite <group-id>\nExample: tlon groups reject-invite ~host/group-slug`,
  'cancel-join': `Usage: tlon groups cancel-join <group-id>\nExample: tlon groups cancel-join ~host/group-slug`,
  'rescind-request': `Usage: tlon groups rescind-request <group-id>\nExample: tlon groups rescind-request ~host/group-slug`,
  'revoke-invite': `Usage: tlon groups revoke-invite <group-id> <ship> [<ship2> ...]\nExample: tlon groups revoke-invite ~host/group-slug ~nec`,
  delete: `Usage: tlon groups delete <group-id>\nExample: tlon groups delete ~host/group-slug`,
  update: `Usage: tlon groups update <group-id> --title "..." [--description "..."] [--image "..."] [--cover "..."]\nExample: tlon groups update ~host/group-slug --title "New Title"`,
  kick: `Usage: tlon groups kick <group-id> <ship> [<ship2> ...]\nExample: tlon groups kick ~host/group-slug ~nec`,
  ban: `Usage: tlon groups ban <group-id> <ship> [<ship2> ...]\nExample: tlon groups ban ~host/group-slug ~nec`,
  unban: `Usage: tlon groups unban <group-id> <ship> [<ship2> ...]\nExample: tlon groups unban ~host/group-slug ~nec`,
  'add-role': `Usage: tlon groups add-role <group-id> <role-id> --title "..." [--description "..."]\nExample: tlon groups add-role ~host/group-slug editors --title "Editors"`,
  'delete-role': `Usage: tlon groups delete-role <group-id> <role-id>\nExample: tlon groups delete-role ~host/group-slug editors`,
  'update-role': `Usage: tlon groups update-role <group-id> <role-id> --title "..." [--description "..."]\nExample: tlon groups update-role ~host/group-slug editors --title "Writers"`,
  'assign-role': `Usage: tlon groups assign-role <group-id> <role-id> <ship> [<ship2> ...]\nExample: tlon groups assign-role ~host/group-slug editors ~nec`,
  'remove-role': `Usage: tlon groups remove-role <group-id> <role-id> <ship> [<ship2> ...]\nExample: tlon groups remove-role ~host/group-slug editors ~nec`,
  'set-privacy': `Usage: tlon groups set-privacy <group-id> <public|private|secret>\nExample: tlon groups set-privacy ~host/group-slug private`,
  'accept-join': `Usage: tlon groups accept-join <group-id> <ship> [<ship2> ...]\nExample: tlon groups accept-join ~host/group-slug ~nec`,
  'reject-join': `Usage: tlon groups reject-join <group-id> <ship> [<ship2> ...]\nExample: tlon groups reject-join ~host/group-slug ~nec`,
  promote: `Usage: tlon groups promote <group-id> <ship> [<ship2> ...]\nExample: tlon groups promote ~host/group-slug ~nec`,
  demote: `Usage: tlon groups demote <group-id> <ship> [<ship2> ...]\nExample: tlon groups demote ~host/group-slug ~nec`,
  'add-channel': `Usage: ${channelCreateUsage('tlon groups add-channel')}\nExample: tlon groups add-channel ~host/group-slug "Projects" --kind chat`,
  'add-section': `Usage: tlon groups add-section <group-id> "<title>"\nAdds an empty channel section at the bottom of the group. Admin only.\nExample: tlon groups add-section ~host/group-slug "Archive"`,
  'rename-section': `Usage: tlon groups rename-section <group-id> <section> "<title>"\n<section> is a section id or title. Admin only.\nExample: tlon groups rename-section ~host/group-slug Archive "Old stuff"`,
  'delete-section': `Usage: tlon groups delete-section <group-id> <section>\nMoves the section's channels to the top of the default section, then deletes it. The default section can't be deleted. Each step is checked before the next, but this is not atomic: on a partial failure, run the command it prints. Admin only.\nExample: tlon groups delete-section ~host/group-slug Archive`,
  'move-channel': `Usage: tlon groups move-channel <group-id> <channel-nest> --section <section> [--index N]\n--index is the channel's final 0-based position in the section; without it, the channel goes to the end (or stays put if it is already there). Admin only.\nExample: tlon groups move-channel ~host/group-slug chat/~host/general --section Archive --index 0`,
  'order-sections': `Usage: tlon groups order-sections <group-id> <section> [<section> ...]\nList every section exactly once, default included, in the new order. Admin only.\nExample: tlon groups order-sections ~host/group-slug Archive default`,
};

function getGroupsHelp(command?: string) {
  return command ? (GROUPS_COMMAND_HELP[command] ?? GROUPS_HELP) : GROUPS_HELP;
}

function validateGroupsArgs(args: string[]): void {
  const command = args[0];
  if (!command || !GROUPS_COMMAND_HELP[command]) {
    printUsageAndExit(GROUPS_HELP);
  }

  switch (command) {
    case 'list':
      return;
    case 'create': {
      const title = args[1];
      if (title === undefined) {
        printUsageAndExit(GROUPS_COMMAND_HELP.create);
      }
      return;
    }
    case 'create-owned': {
      const title = args[1];
      const admin = getCreateOwnedAdmin(args);
      if (title === undefined || !admin || admin.startsWith('--')) {
        printUsageAndExit(GROUPS_COMMAND_HELP['create-owned']);
      }
      return;
    }
    case 'info':
    case 'invite-link':
    case 'leave':
    case 'join':
    case 'request-invite':
    case 'accept-invite':
    case 'reject-invite':
    case 'cancel-join':
    case 'rescind-request':
    case 'delete': {
      if (!args[1]) printUsageAndExit(GROUPS_COMMAND_HELP[command]);
      return;
    }
    case 'update': {
      if (!args[1]) printUsageAndExit(GROUPS_COMMAND_HELP.update);
      if (
        !GROUP_UPDATE_FLAGS.some((flag) =>
          hasOptionValue(args, flag, GROUP_UPDATE_FLAGS)
        )
      ) {
        printUsageAndExit(
          `Error: At least one of --title, --description, --image, or --cover is required\n${GROUPS_COMMAND_HELP.update}`
        );
      }
      return;
    }
    case 'invite':
    case 'revoke-invite':
    case 'kick':
    case 'ban':
    case 'unban':
    case 'accept-join':
    case 'reject-join':
    case 'promote':
    case 'demote': {
      if (!args[1] || args.slice(2).length === 0) {
        printUsageAndExit(GROUPS_COMMAND_HELP[command]);
      }
      return;
    }
    case 'add-role':
    case 'delete-role':
    case 'update-role': {
      if (!args[1] || !args[2]) printUsageAndExit(GROUPS_COMMAND_HELP[command]);
      return;
    }
    case 'assign-role':
    case 'remove-role': {
      if (!args[1] || !args[2] || args.slice(3).length === 0) {
        printUsageAndExit(GROUPS_COMMAND_HELP[command]);
      }
      return;
    }
    case 'set-privacy': {
      const privacy = args[2];
      if (
        !args[1] ||
        !privacy ||
        !['public', 'private', 'secret'].includes(privacy)
      ) {
        printUsageAndExit(GROUPS_COMMAND_HELP['set-privacy']);
      }
      return;
    }
    case 'add-channel': {
      if (!args[1] || args[2] === undefined) {
        printUsageAndExit(GROUPS_COMMAND_HELP['add-channel']);
      }
      refuseRemovedChannelKind(args, 2);
      assertKnownChannelKind(args, 2, GROUPS_COMMAND_HELP['add-channel']);
      refuseNotesChannelDescription(
        args,
        2,
        GROUPS_COMMAND_HELP['add-channel']
      );
      if (looksLikePositionalChannelKind(args, 2)) {
        printUsageAndExit(
          `Error: channel kind must be passed with --kind, not as a positional argument.\n${GROUPS_COMMAND_HELP['add-channel']}`
        );
      }
      return;
    }
    case 'add-section':
    case 'rename-section': {
      const title = command === 'add-section' ? args[2] : args[3];
      if (!args[1] || (command === 'rename-section' && !args[2])) {
        printUsageAndExit(GROUPS_COMMAND_HELP[command]);
      }
      if (title === undefined || isBlankTitle(title)) {
        printUsageAndExit(
          `Error: a non-blank section title is required\n${GROUPS_COMMAND_HELP[command]}`
        );
      }
      return;
    }
    case 'delete-section': {
      if (!args[1] || !args[2]) printUsageAndExit(GROUPS_COMMAND_HELP[command]);
      return;
    }
    case 'order-sections': {
      if (!args[1] || args.slice(2).length === 0) {
        printUsageAndExit(GROUPS_COMMAND_HELP[command]);
      }
      return;
    }
    case 'move-channel': {
      const help = GROUPS_COMMAND_HELP['move-channel'];
      const section = getOption(args, 'section', 3);
      if (!args[1] || !args[2] || args[2].startsWith('--')) {
        printUsageAndExit(help);
      }
      if (!section || section.startsWith('--')) printUsageAndExit(help);
      if (args.includes('--index', 3)) {
        const index = getOption(args, 'index', 3);
        if (index === undefined || !/^\d+$/.test(index)) {
          printUsageAndExit(
            `Error: --index requires a non-negative integer\n${help}`
          );
        }
      }
      refuseDiaryNest(args[2]);
      try {
        canonicalizeNest(args[2]);
      } catch (error) {
        printErrorAndExit(error);
      }
      return;
    }
  }
}

// List all groups
async function listGroups() {
  const groups = await getGroups();

  console.log('\n=== YOUR GROUPS ===\n');

  for (const group of groups) {
    const memberCount = group.memberCount ?? (group.members || []).length;
    const channelCount = (group.channels || []).length;
    const privacy = group.privacy || 'unknown';

    console.log(`📁 ${group.title || group.id}`);
    console.log(`   ID: ${group.id}`);
    console.log(`   Privacy: ${privacy}`);
    console.log(`   Members: ${memberCount}, Channels: ${channelCount}`);
    if (group.description) {
      console.log(`   Description: ${group.description}`);
    }
    console.log('');
  }
}

// Build a map of ship -> nickname from contacts
async function buildNicknameMap(): Promise<Map<string, string>> {
  const nicknameMap = new Map<string, string>();
  try {
    const contacts = await getContacts();
    for (const contact of contacts) {
      const nickname = contact.nickname ?? contact.peerNickname;
      if (nickname) {
        nicknameMap.set(contact.id, nickname);
      }
    }
  } catch {
    // Contacts unavailable, continue without nicknames
  }
  return nicknameMap;
}

// Format a ship with optional nickname
function formatShipWithNickname(
  ship: string,
  nicknameMap: Map<string, string>
): string {
  const nickname = nicknameMap.get(ship);
  return nickname ? `${ship} (${nickname})` : ship;
}

type CreatedGroup = {
  groupId: string;
  channelId: string;
  group: Group;
};

type CreateGroupWithChannelOptions = {
  memberIds?: string[];
};

type SeatAdminVerification =
  | { status: 'verified' }
  | { status: 'missing'; reason: string };

function groupHasRole(group: Group, roleId: string): boolean {
  return (group.roles || []).some((role) => role.id === roleId);
}

function hasSeat(
  rawGroup: RawGroupForAdminVerification,
  ship: string
): boolean {
  return getShipRecordValue(rawGroup.seats, ship, normalizeShip) !== undefined;
}

async function getRawGroupWithSeat(
  groupId: string,
  ship: string
): Promise<RawGroupForAdminVerification> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt += 1) {
    try {
      const rawGroup = await getRawGroupForAdminVerification(groupId);
      if (hasSeat(rawGroup, ship)) {
        return rawGroup;
      }
    } catch (err) {
      lastError = err;
    }

    if (attempt < VERIFY_ATTEMPTS) {
      await sleep(VERIFY_DELAY_MS);
    }
  }

  const suffix = lastError ? `: ${lastError}` : '';
  throw new Error(
    `Admin ${ship} was not created as an invited member seat in ${groupId}${suffix}`
  );
}

async function getRawAdminVerification(
  groupId: string,
  ship: string
): Promise<SeatAdminVerification> {
  const rawGroup = await getRawGroupForAdminVerification(groupId);

  if (!rawGroup.admins?.includes(ADMIN_ROLE_ID)) {
    return {
      status: 'missing',
      reason: `Group ${groupId} has an "${ADMIN_ROLE_ID}" role, but it is not marked as an admin role.`,
    };
  }

  const seat = getShipRecordValue(rawGroup.seats, ship, normalizeShip);
  if (seat) {
    if (seat.roles?.includes(ADMIN_ROLE_ID)) {
      return { status: 'verified' };
    }

    return {
      status: 'missing',
      reason: `Admin ${ship} is a member of ${groupId}, but does not have the "${ADMIN_ROLE_ID}" role.`,
    };
  }

  const pendingRoles = getShipRecordValue(
    rawGroup.admissions?.pending,
    ship,
    normalizeShip
  );
  if (pendingRoles) {
    if (pendingRoles.includes(ADMIN_ROLE_ID)) {
      return {
        status: 'missing',
        reason: `Admin ${ship} has a pending invite for ${groupId} with the "${ADMIN_ROLE_ID}" role, but is not a group member seat yet.`,
      };
    }

    return {
      status: 'missing',
      reason: `Admin ${ship} has a pending invite for ${groupId}, but not with the "${ADMIN_ROLE_ID}" role.`,
    };
  }

  const invite = getShipRecordValue(
    rawGroup.admissions?.invited,
    ship,
    normalizeShip
  );
  if (invite) {
    return {
      status: 'missing',
      reason: `Admin ${ship} is invited to ${groupId}, but no pending "${ADMIN_ROLE_ID}" role assignment was found.`,
    };
  }

  return {
    status: 'missing',
    reason: `Admin ${ship} was not found in members or pending invites for ${groupId}.`,
  };
}

async function assignAdminRole(groupId: string, ship: string) {
  const rawGroup = await getRawGroupWithSeat(groupId, ship);
  const seat = getShipRecordValue(rawGroup.seats, ship, normalizeShip);

  if (seat?.roles?.includes(ADMIN_ROLE_ID)) {
    console.log(`✅ Admin already has "${ADMIN_ROLE_ID}" role.`);
    return;
  }

  console.log(`Assigning admin ${ship} to "${ADMIN_ROLE_ID}" role...`);
  await addMembersToRole({
    groupId,
    roleId: ADMIN_ROLE_ID,
    ships: [ship],
  });
  console.log(`✅ Admin assigned to "${ADMIN_ROLE_ID}" role.`);
}

async function getGroupWithRetry(groupId: string): Promise<Group> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt += 1) {
    try {
      return await getGroup(groupId);
    } catch (err) {
      lastError = err;
      if (attempt < VERIFY_ATTEMPTS) {
        await sleep(VERIFY_DELAY_MS);
      }
    }
  }

  throw new Error(
    `Could not fetch group ${groupId} for verification: ${lastError}`
  );
}

async function verifyGroupCreated(groupId: string): Promise<Group> {
  console.log(`Verifying group ${groupId}...`);
  const group = await getGroupWithRetry(groupId);

  if (group.id && group.id !== groupId) {
    throw new Error(
      `Created group verification returned ${group.id}, expected ${groupId}.`
    );
  }

  console.log(`✅ Group verified.`);
  return group;
}

async function setAdminRole(groupId: string, roleId: string) {
  await poke({
    app: 'groups',
    mark: 'group-action-5',
    json: {
      group: {
        flag: groupId,
        'a-group': {
          role: {
            roles: [roleId],
            'a-role': {
              'set-admin': null,
            },
          },
        },
      },
    },
  });
}

async function ensureAdminRole(groupId: string, group?: Group) {
  const currentGroup = group ?? (await getGroup(groupId));

  if (!groupHasRole(currentGroup, ADMIN_ROLE_ID)) {
    console.log(`Creating "${ADMIN_ROLE_ID}" role in ${groupId}...`);
    await addGroupRole({
      groupId,
      roleId: ADMIN_ROLE_ID,
      meta: { title: 'Admin', description: 'Group administrator' },
    });

    await setAdminRole(groupId, ADMIN_ROLE_ID);
    return;
  }

  // The role already exists. It must already be an admin role — do NOT silently
  // mark it, since `setAdminRole` would grant admin to every existing holder of
  // the role, not just the promote target. A role named `admin` that the group
  // intentionally does not mark admin is a collision we refuse rather than
  // repurpose.
  const rawGroup = await getRawGroupForAdminVerification(groupId);
  if (!rawGroup.admins?.includes(ADMIN_ROLE_ID)) {
    throw new Error(
      `Group ${groupId} has an "${ADMIN_ROLE_ID}" role that is not configured as an admin role. ` +
        `Refusing to promote — marking it admin would grant admin to all existing holders. ` +
        `Resolve the role configuration first.`
    );
  }
}

async function verifyAdmin(groupId: string, ship: string): Promise<void> {
  console.log(`Verifying ${ship} admin assignment in ${groupId}...`);

  let lastVerification: SeatAdminVerification | null = null;
  let lastError: unknown;

  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt += 1) {
    try {
      const rawVerification = await getRawAdminVerification(groupId, ship);
      if (rawVerification.status === 'verified') {
        console.log(`✅ Admin assignment verified.`);
        return;
      }
      lastVerification = rawVerification;
    } catch (err) {
      lastError = err;
    }

    if (attempt < VERIFY_ATTEMPTS) {
      await sleep(VERIFY_DELAY_MS);
    }
  }

  if (lastVerification) {
    throw new Error(lastVerification.reason);
  }

  throw new Error(
    `Could not verify the admin assignment for ${ship}: ${lastError}`
  );
}

/**
 * Scry-poll the group's actual state until every target ship satisfies `isSatisfied`,
 * or attempts are exhausted. One scry per attempt covers all ships — never poll per
 * ship. On exhaustion, throws naming the still-unverified ships via `describeFailure`.
 */
async function verifyShips(
  groupId: string,
  ships: string[],
  isSatisfied: (
    rawGroup: RawGroupForAdminVerification,
    ship: string
  ) => boolean,
  describeFailure: (unverified: string[]) => string
): Promise<void> {
  let unverified = [...ships];
  let lastError: unknown;

  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt += 1) {
    try {
      const rawGroup = await getRawGroupForAdminVerification(groupId);
      unverified = ships.filter((ship) => !isSatisfied(rawGroup, ship));
      if (unverified.length === 0) {
        return;
      }
    } catch (err) {
      lastError = err;
    }

    if (attempt < VERIFY_ATTEMPTS) {
      await sleep(VERIFY_DELAY_MS);
    }
  }

  const suffix = lastError ? ` (last error: ${lastError})` : '';
  throw new Error(`${describeFailure(unverified)}${suffix}`);
}

async function verifyShipsHaveRole(
  groupId: string,
  ships: string[],
  roleId: string,
  expect: 'present' | 'absent'
): Promise<void> {
  await verifyShips(
    groupId,
    ships,
    (rawGroup, ship) =>
      seatHasRole(rawGroup, ship, roleId, normalizeShip) ===
      (expect === 'present'),
    (unverified) =>
      expect === 'present'
        ? `Could not verify ${unverified.join(', ')} gained role ${roleId} in ${groupId}`
        : `Could not verify ${unverified.join(', ')} lost role ${roleId} in ${groupId} (still present)`
  );
}

// Verify admin status by the group's actual `admins` markings, not the literal
// `admin` role id — assigning a role named `admin` that the group doesn't mark as
// admin grants no privileges, and we must not report that as success.
async function verifyShipsAreAdmin(
  groupId: string,
  ships: string[],
  expect: 'present' | 'absent'
): Promise<void> {
  await verifyShips(
    groupId,
    ships,
    (rawGroup, ship) =>
      seatHasAdminRole(rawGroup, ship, normalizeShip) ===
      (expect === 'present'),
    (unverified) =>
      expect === 'present'
        ? `Could not verify ${unverified.join(', ')} gained admin in ${groupId}`
        : `Could not verify ${unverified.join(', ')} lost admin in ${groupId} (still admin)`
  );
}

async function verifyShipsRemoved(
  groupId: string,
  ships: string[]
): Promise<void> {
  await verifyShips(
    groupId,
    ships,
    (rawGroup, ship) => !shipIsSeated(rawGroup, ship, normalizeShip),
    (unverified) =>
      `Could not verify ${unverified.join(', ')} were removed from ${groupId} (still members)`
  );
}

async function verifyShipsBanned(
  groupId: string,
  ships: string[],
  expect: 'present' | 'absent'
): Promise<void> {
  await verifyShips(
    groupId,
    ships,
    (rawGroup, ship) =>
      shipIsBanned(rawGroup, ship, normalizeShip) === (expect === 'present'),
    (unverified) =>
      expect === 'present'
        ? `Could not verify ${unverified.join(', ')} were banned from ${groupId}`
        : `Could not verify ${unverified.join(', ')} were unbanned from ${groupId} (still banned)`
  );
}

// Get info about a specific group
async function getGroupInfo(groupId: string) {
  const [group, nicknameMap] = await Promise.all([
    getGroup(groupId),
    buildNicknameMap(),
  ]);

  console.log(`\n=== ${group.title || groupId} ===\n`);
  console.log(`ID: ${groupId}`);
  console.log(`Privacy: ${group.privacy || 'unknown'}`);
  console.log(`Description: ${group.description || '(none)'}`);

  if (group.iconImage) {
    console.log(`Icon: ${group.iconImage}`);
  }

  console.log('\n--- Members ---');
  for (const member of group.members || []) {
    const roles = (member.roles || []).map((r: { roleId: string }) => r.roleId);
    const roleList = roles.length > 0 ? ` [${roles.join(', ')}]` : '';
    const displayName = formatShipWithNickname(member.contactId, nicknameMap);
    console.log(`  ${displayName}${roleList}`);
  }

  if (group.roles && group.roles.length > 0) {
    console.log('\n--- Roles ---');
    for (const role of group.roles) {
      console.log(`  ${role.id}: ${role.title || '(untitled)'}`);
    }
  }

  if (group.channels && group.channels.length > 0) {
    console.log('\n--- Channels ---');
    for (const channel of group.channels) {
      const title = channel.title || channel.id;
      console.log(`  ${title} (${channel.id})`);
    }
  }

  const navSections: GroupNavSection[] = group.navSections ?? [];
  const listed = new Set<string>();
  if (navSections.length > 0) {
    const channelTitles = new Map(
      (group.channels ?? []).map((channel) => [channel.id, channel.title])
    );
    console.log('\n--- Sections ---');
    for (const section of navSections) {
      console.log(
        `  ${section.title || section.sectionId} (${section.sectionId})`
      );
      // 0-based, matching `move-channel --index`.
      (section.channels ?? []).forEach(({ channelId }, i) => {
        if (!channelId) return;
        listed.add(channelId);
        const title = channelTitles.get(channelId) || channelId;
        console.log(`    ${i}. ${title} (${channelId})`);
      });
    }
  }
  const unlisted = (group.channels ?? []).filter(
    (channel) => !listed.has(channel.id)
  );
  if (unlisted.length > 0) {
    console.log('\n--- Channels in no section ---');
    for (const channel of unlisted) {
      console.log(`  ${channel.title || channel.id} (${channel.id})`);
    }
  }

  if (group.pendingMembers && group.pendingMembers.length > 0) {
    console.log('\n--- Pending Invites ---');
    for (const member of group.pendingMembers) {
      console.log(`  ${formatShipWithNickname(member.contactId, nicknameMap)}`);
    }
  }

  if (group.joinRequests && group.joinRequests.length > 0) {
    console.log('\n--- Join Requests ---');
    for (const request of group.joinRequests) {
      console.log(
        `  ${formatShipWithNickname(request.contactId, nicknameMap)}`
      );
    }
  }

  if (group.bannedMembers && group.bannedMembers.length > 0) {
    console.log('\n--- Banned Ships ---');
    for (const ban of group.bannedMembers) {
      console.log(`  ${formatShipWithNickname(ban.contactId, nicknameMap)}`);
    }
  }
}

// Create a new group
async function createGroupWithChannel(
  title: string,
  description: string = '',
  options: CreateGroupWithChannelOptions = {}
): Promise<CreatedGroup> {
  const ship = await getCurrentShip();
  const slug = generateGroupSlug();
  const groupId = `${ship}/${slug}`;
  const channelSlug = `${slug}-general`;
  const channelId = `chat/${ship}/${channelSlug}`;

  console.log(`Creating group "${title}" with ID: ${groupId}...`);

  const group: Group = {
    id: groupId,
    title,
    description,
    hostUserId: getCurrentUserId(),
    currentUserIsHost: true,
    currentUserIsMember: true,
    channels: [
      {
        id: channelId,
        title: 'General',
        description: 'General chat',
        type: 'chat',
        groupId,
      },
    ],
  };

  await createGroup({
    group,
    memberIds: options.memberIds,
  });

  const createdGroup = await verifyGroupCreated(groupId);

  console.log(`✅ Group created successfully!`);
  console.log(`   ID: ${groupId}`);
  console.log(`   Title: ${title}`);
  console.log(`   Description: ${description || '(none)'}`);
  console.log(`   Channel: ${channelId}`);

  return { groupId, channelId, group: createdGroup };
}

/**
 * Creates a group hosted by the current ship and makes `admin` its admin, as
 * the app's New Workspace does with the user's bot. A moon cannot create a
 * group on its parent planet, so a bot makes one for its owner by running
 * this as the owner with itself as the admin.
 */
async function createOwnedGroup(
  title: string,
  admin: string,
  description: string = ''
) {
  const adminShip = normalizeShip(admin);
  const host = await getCurrentShip();
  if (adminShip.toLowerCase() === host.toLowerCase()) {
    throw new Error(
      `${host} runs this command, so it hosts the group already; name another ship with --admin.`
    );
  }

  const { groupId, channelId, group } = await createGroupWithChannel(
    title,
    description,
    {
      memberIds: [adminShip],
    }
  );

  try {
    await ensureAdminRole(groupId, group);
    await assignAdminRole(groupId, adminShip);
    await verifyAdmin(groupId, adminShip);
  } catch (err) {
    // The group exists now. Name it, so the grant is finished rather than a
    // second group created; a failed command's stdout does not reach the
    // caller. Only the host can finish it: the admin may be the one asking.
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Created ${groupId} (Ref: /1/group/${groupId}), but making ${adminShip} its admin failed: ${reason} The group exists, so do not create it again. Its host, ${host}, can finish the grant with: groups promote ${groupId} ${adminShip}`
    );
  }

  console.log(`✅ Owned group created successfully!`);
  console.log(`   ID: ${groupId}`);
  console.log(`   Title: ${title}`);
  console.log(`   Description: ${description || '(none)'}`);
  console.log(`   Host: ${getGroupHost(groupId)}`);
  console.log(`   Admin: ${adminShip} (invited; joins when it accepts)`);
  console.log(`   Channel: ${channelId}`);
  console.log(`   Ref: /1/group/${groupId}`);
  console.log(`   ${refShareHint('group')}`);

  return { groupId, channelId, adminShip };
}

// Invite ships to a group
async function inviteToGroup(groupId: string, ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);
  // Any member may invite to a public group. For a private or secret one our
  // ship asks the host for an invite token, which the host gives only to an
  // admin.
  const { admissions } = await getRawGroupForAdminVerification(groupId);
  if (admissions?.privacy !== 'public') {
    await assertActingShipCanAdminister(
      groupId,
      'invite to a private or secret group'
    );
  }

  console.log(`Inviting ${normalizedShips.join(', ')} to ${groupId}...`);

  await inviteGroupMembers({
    groupId,
    contactIds: normalizedShips,
  });

  console.log(`✅ Invitations sent!`);
}

// Leave a group
async function leaveGroupById(groupId: string) {
  console.log(`Leaving group ${groupId}...`);

  await leaveGroup(groupId);

  console.log(`✅ Left group.`);
}

// Join a group
async function joinGroupById(groupId: string) {
  const joinedGroup = await getJoinedGroupState(groupId);
  if (joinedGroup?.currentUserIsMember) {
    console.log(`Already a member of ${groupId}.`);
    return;
  }

  const foreignGroup = await getForeignGroupState(groupId);
  if (foreignGroup?.haveInvite) {
    await acceptInvite(groupId);
    return;
  }

  if (foreignGroup?.haveRequestedInvite) {
    console.log(`Invite already requested for ${groupId}.`);
    return;
  }

  const group = foreignGroup ?? (await getGroupPreviewState(groupId));

  if (group?.privacy === 'public') {
    await joinNow(groupId);
    return;
  }

  if (group?.privacy === 'private') {
    await requestInvite(groupId);
    return;
  }

  if (group?.privacy === 'secret') {
    throw new Error(`Cannot join secret group ${groupId} without an invite.`);
  }

  console.log(`Group privacy unknown for ${groupId}; attempting join...`);
  await joinNow(groupId);
}

async function getJoinedGroupState(groupId: string): Promise<Group | null> {
  try {
    return await getGroup(groupId);
  } catch {
    return null;
  }
}

async function getForeignGroupState(groupId: string): Promise<Group | null> {
  try {
    const foreigns = await scry<Record<string, unknown>>({
      app: 'groups',
      path: '/v1/foreigns',
    });
    const groups = toClientGroupsFromForeigns(foreigns as any);
    return groups.find((group: Group) => group.id === groupId) ?? null;
  } catch {
    return null;
  }
}

async function getGroupPreviewState(groupId: string): Promise<Group | null> {
  try {
    return await getGroupPreview(groupId);
  } catch {
    try {
      const groups = await getGroups();
      return groups.find((group) => group.id === groupId) ?? null;
    } catch {
      return null;
    }
  }
}

async function joinNow(groupId: string) {
  console.log(`Joining group ${groupId}...`);
  await apiJoinGroup(groupId);
  console.log(`✅ Join requested. Sync may take a moment to show membership.`);
}

async function requestInvite(groupId: string) {
  console.log(`Requesting invite to ${groupId}...`);
  await requestGroupInvitation(groupId);
  console.log(`✅ Invite requested.`);
}

async function acceptInvite(groupId: string) {
  console.log(`Accepting invite to ${groupId}...`);
  await apiJoinGroup(groupId);
  console.log(
    `✅ Invite accepted, joining group. Sync may take a moment to show membership.`
  );
}

async function rejectInvite(groupId: string) {
  console.log(`Rejecting invite to ${groupId}...`);
  await rejectGroupInvitation(groupId);
  console.log(`✅ Invite rejected.`);
}

async function cancelJoin(groupId: string) {
  console.log(`Canceling join for ${groupId}...`);
  await apiCancelGroupJoin(groupId);
  console.log(`✅ Join canceled.`);
}

async function rescindInviteRequest(groupId: string) {
  console.log(`Rescinding invite request for ${groupId}...`);
  await rescindGroupInvitationRequest(groupId);
  console.log(`✅ Invite request rescinded.`);
}

async function revokeInvites(groupId: string, ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);
  await assertActingShipCanAdminister(groupId, 'revoke invites');

  console.log(
    `Revoking invites for ${normalizedShips.join(', ')} from ${groupId}...`
  );

  await revokeGroupMemberInvites({
    groupId,
    contactIds: normalizedShips,
  });

  console.log(`✅ Invites revoked.`);
}

// Delete a group (must be host)
async function deleteGroupById(groupId: string) {
  // The host takes %delete only from itself (`from-self` in `se-c-group`), so
  // an admin is refused like any other ship.
  const actingShip = normalizeShip(getCurrentUserId());
  const hostShip = getGroupHost(groupId);
  if (actingShip !== hostShip) {
    throw new Error(
      `Can't delete ${groupId}: only its host (${hostShip}) can delete it, and you are ${actingShip}.`
    );
  }

  console.log(`Deleting group ${groupId}...`);

  await deleteGroup(groupId);

  console.log(`✅ Group deleted.`);
}

// Update group metadata
async function updateGroup(
  groupId: string,
  options: {
    title?: string;
    description?: string;
    image?: string;
    cover?: string;
  }
) {
  await assertActingShipCanAdminister(groupId, 'update');
  // The raw meta, not getGroup's: that one moves a color image or cover to
  // separate fields and blanks an oversized one, so falling back to it would
  // clear them.
  const { meta: current } = await getRawGroupForAdminVerification(groupId);

  const meta = {
    title: options.title ?? current?.title ?? '',
    description: options.description ?? current?.description ?? '',
    image: options.image ?? current?.image ?? '',
    cover: options.cover ?? current?.cover ?? '',
  };

  // The host sends no update for an unchanged %meta, so the tracked poke
  // could only time out.
  if (
    GROUP_UPDATE_FLAGS.every((flag) => meta[flag] === (current?.[flag] ?? ''))
  ) {
    console.log(
      `Nothing to update: ${groupId} already has that title, description, image and cover.`
    );
    return;
  }

  console.log(`Updating group ${groupId}...`);

  await updateGroupMeta({
    groupId,
    meta,
  });

  console.log(`✅ Group updated.`);
  console.log(`   Title: ${meta.title}`);
  console.log(`   Description: ${meta.description || '(none)'}`);
}

// Kick members from a group
async function kickMembers(groupId: string, ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);
  await assertActingShipCanAdminister(groupId, 'kick');

  console.log(`Kicking ${normalizedShips.join(', ')} from ${groupId}...`);

  await kickUsersFromGroup({
    groupId,
    contactIds: normalizedShips,
  });

  await verifyShipsRemoved(groupId, normalizedShips);
  console.log(`✅ Members kicked.`);
}

// Ban members from a group
async function banMembers(groupId: string, ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);
  await assertActingShipCanAdminister(groupId, 'ban');

  console.log(`Banning ${normalizedShips.join(', ')} from ${groupId}...`);

  await banUsersFromGroup({
    groupId,
    contactIds: normalizedShips,
  });

  await verifyShipsBanned(groupId, normalizedShips, 'present');
  console.log(`✅ Members banned.`);
}

// Unban members from a group
async function unbanMembers(groupId: string, ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);
  await assertActingShipCanAdminister(groupId, 'unban');

  console.log(`Unbanning ${normalizedShips.join(', ')} from ${groupId}...`);

  await unbanUsersFromGroup({
    groupId,
    contactIds: normalizedShips,
  });

  await verifyShipsBanned(groupId, normalizedShips, 'absent');
  console.log(`✅ Members unbanned.`);
}

// Add a role to a group
async function addRole(
  groupId: string,
  roleId: string,
  options: { title?: string; description?: string }
) {
  await assertActingShipCanAdminister(groupId, 'add roles');
  const title = options.title || roleId;
  const description = options.description || '';

  console.log(`Adding role "${roleId}" to ${groupId}...`);

  await addGroupRole({
    groupId,
    roleId,
    meta: { title, description },
  });

  console.log(`✅ Role "${roleId}" added.`);
  console.log(`   Title: ${title}`);
}

// Delete a role from a group
async function deleteRole(groupId: string, roleId: string) {
  await assertActingShipCanAdminister(groupId, 'delete roles');

  console.log(`Deleting role "${roleId}" from ${groupId}...`);

  await deleteGroupRole({ groupId, roleId });

  console.log(`✅ Role "${roleId}" deleted.`);
}

// Update a role's metadata
async function updateRole(
  groupId: string,
  roleId: string,
  options: { title?: string; description?: string }
) {
  await assertActingShipCanAdminister(groupId, 'update roles');
  const group = await getGroup(groupId);
  const currentRole = (group.roles || []).find((role) => role.id === roleId);
  if (!currentRole) {
    throw new Error(`Role "${roleId}" not found in group ${groupId}`);
  }

  const meta = {
    title: options.title ?? currentRole.title ?? '',
    description: options.description ?? currentRole.description ?? '',
  };

  console.log(`Updating role "${roleId}" in ${groupId}...`);

  await updateGroupRole({ groupId, roleId, meta });

  console.log(`✅ Role "${roleId}" updated.`);
  console.log(`   Title: ${meta.title}`);
}

// Assign a role to members
async function assignRole(groupId: string, roleId: string, ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);
  await assertActingShipCanAdminister(groupId, 'assign roles');

  console.log(
    `Assigning role "${roleId}" to ${normalizedShips.join(', ')} in ${groupId}...`
  );

  await addMembersToRole({
    groupId,
    roleId,
    ships: normalizedShips,
  });

  await verifyShipsHaveRole(groupId, normalizedShips, roleId, 'present');
  console.log(`✅ Role assigned.`);
}

// Remove a role from members
async function removeRole(groupId: string, roleId: string, ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);
  await assertActingShipCanAdminister(groupId, 'remove roles');

  console.log(
    `Removing role "${roleId}" from ${normalizedShips.join(', ')} in ${groupId}...`
  );

  await removeMembersFromRole({
    groupId,
    roleId,
    ships: normalizedShips,
  });

  await verifyShipsHaveRole(groupId, normalizedShips, roleId, 'absent');
  console.log(`✅ Role removed.`);
}

// Update group privacy
async function setGroupPrivacy(
  groupId: string,
  privacy: 'public' | 'private' | 'secret'
) {
  await assertActingShipCanAdminister(groupId, 'change privacy');
  const group = await getGroup(groupId);
  const oldPrivacy = (group.privacy ?? 'private') as
    | 'public'
    | 'private'
    | 'secret';

  console.log(`Updating privacy for ${groupId} to ${privacy}...`);

  await updateGroupPrivacy({
    groupId,
    oldPrivacy,
    newPrivacy: privacy,
  });

  console.log(`✅ Privacy updated.`);
}

// Accept join requests
async function acceptJoin(groupId: string, ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);
  await assertActingShipCanAdminister(groupId, 'accept join requests');

  console.log(`Accepting join requests for ${normalizedShips.join(', ')}...`);

  await acceptGroupJoin({
    groupId,
    contactIds: normalizedShips,
  });

  console.log(`✅ Join requests accepted.`);
}

// Reject join requests
async function rejectJoin(groupId: string, ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);
  await assertActingShipCanAdminister(groupId, 'reject join requests');

  console.log(`Rejecting join requests for ${normalizedShips.join(', ')}...`);

  await rejectGroupJoin({
    groupId,
    contactIds: normalizedShips,
  });

  console.log(`✅ Join requests rejected.`);
}

// Add a channel to an existing group
async function addChannel(
  groupId: string,
  title: string,
  kind: 'chat' | 'heap' = 'chat',
  description: string = ''
) {
  const ship = await getCurrentShip();
  const slug = generateGroupSlug();
  const name = slug;
  const nest = `${kind}/${ship}/${name}`;

  console.log(`Adding channel "${title}" to group ${groupId}...`);

  await createChannel({
    id: nest,
    kind,
    group: groupId,
    name,
    title,
    description,
    meta: null,
    readers: [],
    writers: [],
  });

  console.log(`✅ Channel created!`);
  console.log(`   Nest: ${nest}`);
  console.log(`   Title: ${title}`);
  console.log(`   Group: ${groupId}`);
  return nest;
}

// Add a %notes group channel. %notes assigns the flag and registers the %groups
// listing itself; the skill only POSTs to the v1 API and verifies the listing
// appeared (see notes-channel.ts).
async function addNotesChannel(groupId: string, title: string) {
  const nest = await createNotesChannelInGroup(
    { groupId, title, readers: [] },
    createNotesChannelDeps()
  );

  console.log(`✅ Notes channel created!`);
  console.log(`   Nest: ${nest}`);
  console.log(`   Title: ${title}`);
  console.log(`   Group: ${groupId}`);
  return nest;
}

// Promote a member to admin by assigning them an admin role
async function promoteMemberToAdmin(groupId: string, ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);
  await assertActingShipCanAdminister(groupId, 'promote');
  await ensureAdminRole(groupId);

  console.log(
    `Promoting ${normalizedShips.join(', ')} to admin in ${groupId}...`
  );

  await addMembersToRole({
    groupId,
    roleId: ADMIN_ROLE_ID,
    ships: normalizedShips,
  });

  await verifyShipsAreAdmin(groupId, normalizedShips, 'present');
  console.log(`✅ Members promoted to admin.`);
}

// Demote a member from admin by removing them from every admin-marked role
async function demoteMemberFromAdmin(groupId: string, ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);
  await assertActingShipCanAdminister(groupId, 'demote');

  // The host is an admin unconditionally, so it can't be demoted. Refuse up front
  // rather than strip its roles and falsely report success on a no-op.
  const hostShip = getGroupHost(groupId);
  if (normalizedShips.includes(hostShip)) {
    throw new Error(
      `Cannot demote the host (${hostShip}) of ${groupId} — the host is always an admin.`
    );
  }

  // Remove every role the group marks as admin (`rawGroup.admins`), not just the
  // literal `admin` role — otherwise a member with a custom admin role stays an
  // admin and verification below would fail on a partial mutation.
  const rawGroup = await getRawGroupForAdminVerification(groupId);
  const adminRoles = rawGroup.admins ?? [];

  if (adminRoles.length === 0) {
    throw new Error(`No admin roles found in ${groupId}.`);
  }

  console.log(
    `Removing admin roles (${adminRoles.join(', ')}) from ${normalizedShips.join(', ')}...`
  );
  // Send all role removals as one seat action. The host checks `se-src-is-admin`
  // once, while the acting ship is still an admin, so a self-demotion can't revoke
  // our own permission part-way through and get the remaining removals rejected.
  await poke({
    app: 'groups',
    mark: 'group-action-5',
    json: {
      group: {
        flag: groupId,
        'a-group': {
          seat: {
            ships: normalizedShips,
            'a-seat': { 'del-roles': adminRoles },
          },
        },
      },
    },
  });

  await verifyShipsAreAdmin(groupId, normalizedShips, 'absent');
  console.log(`✅ Members demoted from admin.`);
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (isHelpArg(command)) {
    printHelpAndExit(GROUPS_HELP);
  }

  if (isSubcommandHelpRequest(args)) {
    printHelpAndExit(getGroupsHelp(command));
  }

  validateGroupsArgs(args);

  // invite-link owns its whole flow: a global deadline around a single
  // authenticate-then-act sequence. Dispatching before the family-wide
  // ensureClient keeps that flow intact (and its subscriptions unopened).
  // Which ship it acts as is the resolver's answer — owner selection belongs
  // to the bot harnesses, which inject credentials before invoking the CLI.
  if (command === 'invite-link') {
    process.exit(await runInviteLinkCommand(args.slice(1)));
  }

  await ensureClient(['groups', 'channels']);

  switch (command) {
    case 'list':
      await listGroups();
      break;

    case 'create': {
      const title = args[1];
      if (title === undefined) {
        printUsageAndExit(GROUPS_COMMAND_HELP.create);
      }
      const description = getOption(args, 'description', 2) || '';
      const { groupId } = await createGroupWithChannel(title, description);
      console.log(`   Ref: /1/group/${groupId}`);
      console.log(`   ${refShareHint('group')}`);
      break;
    }

    case 'create-owned': {
      const title = args[1];
      const admin = getCreateOwnedAdmin(args);
      if (title === undefined || !admin || admin.startsWith('--')) {
        console.error(GROUPS_COMMAND_HELP['create-owned']);
        process.exit(1);
      }
      const description = getOption(args, 'description', 2) || '';
      await createOwnedGroup(title, admin, description);
      break;
    }

    case 'invite': {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        printUsageAndExit(GROUPS_COMMAND_HELP.invite);
      }
      await inviteToGroup(groupId, ships);
      break;
    }

    case 'info': {
      const groupId = args[1];
      if (!groupId) {
        printUsageAndExit(GROUPS_COMMAND_HELP.info);
      }
      await getGroupInfo(groupId);
      break;
    }

    case 'leave': {
      const groupId = args[1];
      if (!groupId) {
        printUsageAndExit(GROUPS_COMMAND_HELP.leave);
      }
      await leaveGroupById(groupId);
      break;
    }

    case 'join': {
      const groupId = args[1];
      if (!groupId) {
        console.error(GROUPS_COMMAND_HELP.join);
        process.exit(1);
      }
      await joinGroupById(groupId);
      break;
    }

    case 'request-invite': {
      const groupId = args[1];
      if (!groupId) {
        console.error(GROUPS_COMMAND_HELP['request-invite']);
        process.exit(1);
      }
      await requestInvite(groupId);
      break;
    }

    case 'accept-invite': {
      const groupId = args[1];
      if (!groupId) {
        console.error(GROUPS_COMMAND_HELP['accept-invite']);
        process.exit(1);
      }
      await acceptInvite(groupId);
      break;
    }

    case 'reject-invite': {
      const groupId = args[1];
      if (!groupId) {
        console.error(GROUPS_COMMAND_HELP['reject-invite']);
        process.exit(1);
      }
      await rejectInvite(groupId);
      break;
    }

    case 'cancel-join': {
      const groupId = args[1];
      if (!groupId) {
        console.error(GROUPS_COMMAND_HELP['cancel-join']);
        process.exit(1);
      }
      await cancelJoin(groupId);
      break;
    }

    case 'rescind-request': {
      const groupId = args[1];
      if (!groupId) {
        console.error(GROUPS_COMMAND_HELP['rescind-request']);
        process.exit(1);
      }
      await rescindInviteRequest(groupId);
      break;
    }

    case 'revoke-invite': {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        console.error(GROUPS_COMMAND_HELP['revoke-invite']);
        process.exit(1);
      }
      await revokeInvites(groupId, ships);
      break;
    }

    case 'delete': {
      const groupId = args[1];
      if (!groupId) {
        printUsageAndExit(GROUPS_COMMAND_HELP.delete);
      }
      await deleteGroupById(groupId);
      break;
    }

    case 'update': {
      const groupId = args[1];
      if (!groupId) {
        printUsageAndExit(GROUPS_COMMAND_HELP.update);
      }
      const title = getOption(args, 'title');
      const description = getOption(args, 'description');
      const image = getOption(args, 'image');
      const cover = getOption(args, 'cover');
      await updateGroup(groupId, { title, description, image, cover });
      break;
    }

    case 'kick': {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        printUsageAndExit(GROUPS_COMMAND_HELP.kick);
      }
      await kickMembers(groupId, ships);
      break;
    }

    case 'ban': {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        printUsageAndExit(GROUPS_COMMAND_HELP.ban);
      }
      await banMembers(groupId, ships);
      break;
    }

    case 'unban': {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        printUsageAndExit(GROUPS_COMMAND_HELP.unban);
      }
      await unbanMembers(groupId, ships);
      break;
    }

    case 'add-role': {
      const groupId = args[1];
      const roleId = args[2];
      if (!groupId || !roleId) {
        printUsageAndExit(GROUPS_COMMAND_HELP['add-role']);
      }
      const title = getOption(args, 'title');
      const description = getOption(args, 'description');
      await addRole(groupId, roleId, { title, description });
      break;
    }

    case 'delete-role': {
      const groupId = args[1];
      const roleId = args[2];
      if (!groupId || !roleId) {
        printUsageAndExit(GROUPS_COMMAND_HELP['delete-role']);
      }
      await deleteRole(groupId, roleId);
      break;
    }

    case 'update-role': {
      const groupId = args[1];
      const roleId = args[2];
      if (!groupId || !roleId) {
        printUsageAndExit(GROUPS_COMMAND_HELP['update-role']);
      }
      const title = getOption(args, 'title');
      const description = getOption(args, 'description');
      await updateRole(groupId, roleId, { title, description });
      break;
    }

    case 'assign-role': {
      const groupId = args[1];
      const roleId = args[2];
      const ships = args.slice(3);
      if (!groupId || !roleId || ships.length === 0) {
        printUsageAndExit(GROUPS_COMMAND_HELP['assign-role']);
      }
      await assignRole(groupId, roleId, ships);
      break;
    }

    case 'remove-role': {
      const groupId = args[1];
      const roleId = args[2];
      const ships = args.slice(3);
      if (!groupId || !roleId || ships.length === 0) {
        printUsageAndExit(GROUPS_COMMAND_HELP['remove-role']);
      }
      await removeRole(groupId, roleId, ships);
      break;
    }

    case 'set-privacy': {
      const groupId = args[1];
      const privacy = args[2] as 'public' | 'private' | 'secret';
      if (
        !groupId ||
        !privacy ||
        !['public', 'private', 'secret'].includes(privacy)
      ) {
        printUsageAndExit(GROUPS_COMMAND_HELP['set-privacy']);
      }
      await setGroupPrivacy(groupId, privacy);
      break;
    }

    case 'accept-join': {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        printUsageAndExit(GROUPS_COMMAND_HELP['accept-join']);
      }
      await acceptJoin(groupId, ships);
      break;
    }

    case 'reject-join': {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        printUsageAndExit(GROUPS_COMMAND_HELP['reject-join']);
      }
      await rejectJoin(groupId, ships);
      break;
    }

    case 'promote': {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        printUsageAndExit(GROUPS_COMMAND_HELP.promote);
      }
      await promoteMemberToAdmin(groupId, ships);
      break;
    }

    case 'demote': {
      const groupId = args[1];
      const ships = args.slice(2);
      if (!groupId || ships.length === 0) {
        printUsageAndExit(GROUPS_COMMAND_HELP.demote);
      }
      await demoteMemberFromAdmin(groupId, ships);
      break;
    }

    case 'add-channel': {
      const groupId = args[1];
      const title = args[2];
      if (!groupId || title === undefined) {
        console.error(GROUPS_COMMAND_HELP['add-channel']);
        process.exit(1);
      }
      refuseRemovedChannelKind(args, 2);
      assertKnownChannelKind(args, 2, GROUPS_COMMAND_HELP['add-channel']);
      refuseNotesChannelDescription(
        args,
        2,
        GROUPS_COMMAND_HELP['add-channel']
      );
      if (looksLikePositionalChannelKind(args, 2)) {
        console.error(
          'Error: channel kind must be passed with --kind, not as a positional argument.'
        );
        console.error(GROUPS_COMMAND_HELP['add-channel']);
        process.exit(1);
      }
      const kind =
        (getOption(args, 'kind', 3) as 'chat' | 'heap' | 'notes') || 'chat';
      await assertActingShipCanAdminister(groupId, 'add channels');
      // %notes group channels are created by %notes itself (it registers the
      // %groups listing) — never via createChannel/%channels.
      if (kind === 'notes') {
        await addNotesChannel(groupId, title);
        break;
      }
      const description = getOption(args, 'description', 3) || '';
      await addChannel(groupId, title, kind, description);
      break;
    }

    case 'add-section':
      await addSection(args[1], args[2], createGroupSectionsDeps());
      break;

    case 'rename-section':
      await renameSection(args[1], args[2], args[3], createGroupSectionsDeps());
      break;

    case 'delete-section':
      await deleteSection(args[1], args[2], createGroupSectionsDeps());
      break;

    case 'move-channel': {
      const index = getOption(args, 'index', 3);
      await moveChannel(
        args[1],
        canonicalizeNest(args[2]),
        getOption(args, 'section', 3)!,
        index === undefined ? undefined : Number(index),
        createGroupSectionsDeps()
      );
      break;
    }

    case 'order-sections':
      await orderSections(args[1], args.slice(2), createGroupSectionsDeps());
      break;

    default:
      printUsageAndExit(GROUPS_HELP);
  }
  process.exit(0);
}

main().catch(printErrorAndExit);
