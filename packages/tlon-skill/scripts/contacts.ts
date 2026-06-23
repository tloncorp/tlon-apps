#!/usr/bin/env npx ts-node

/**
 * Contacts management for Tlon/Urbit
 *
 * Usage:
 *   npx ts-node contacts.ts list                      # List all contacts
 *   npx ts-node contacts.ts get ~ship                 # Get a contact's profile
 *   npx ts-node contacts.ts update-profile [options]  # Update your profile
 */
import {
  getContacts,
  getCurrentUserId,
  poke,
  syncUserProfiles,
  updateContactMetadata,
} from '@tloncorp/api';
import type { Contact } from '@tloncorp/api';

import { ensureClient, normalizeShip } from './api-client';
import {
  hasOptionValue,
  isHelpArg,
  isSubcommandHelpRequest,
  printErrorAndExit,
  printHelpAndExit,
  printUsageAndExit,
} from './cli-utils';

interface ContactEditField {
  nickname?: string;
  bio?: string;
  status?: string;
  avatar?: string;
  cover?: string;
}

const PROFILE_UPDATE_FLAGS = [
  'nickname',
  'bio',
  'status',
  'avatar',
  'cover',
] as const;

const CONTACTS_HELP = `Usage: tlon contacts <command>

Commands:
  list                     List all contacts
  self                     Show your profile
  get ~ship                Get a contact's profile
  sync ~ship [~ship2 ...]  Sync profiles
  add ~ship                Add a contact
  remove ~ship             Remove a contact
  update ~ship --nickname <name> --avatar <url>
                           Update a contact's metadata
  update-profile [options] Update your profile

Examples:
  tlon contacts list
  tlon contacts get ~sampel-palnet
  tlon contacts update-profile --nickname "New Name"`;

const CONTACTS_COMMAND_HELP: Record<string, string> = {
  list: 'Usage: tlon contacts list',
  self: 'Usage: tlon contacts self',
  get: 'Usage: tlon contacts get ~ship',
  sync: 'Usage: tlon contacts sync ~ship [~ship2 ...]',
  add: 'Usage: tlon contacts add ~ship',
  remove: 'Usage: tlon contacts remove ~ship',
  del: 'Usage: tlon contacts remove ~ship',
  update:
    'Usage: tlon contacts update ~ship [--nickname <name>] [--avatar <url>]',
  'update-profile':
    'Usage: tlon contacts update-profile [--nickname <name>] [--bio <text>] [--status <text>] [--avatar <url>] [--cover <url>]',
};

function getContactsHelp(command?: string): string {
  return command
    ? CONTACTS_COMMAND_HELP[command] ?? CONTACTS_HELP
    : CONTACTS_HELP;
}

function validateContactsArgs(args: string[]): void {
  const command = args[0];
  if (!command || !CONTACTS_COMMAND_HELP[command]) {
    printUsageAndExit(CONTACTS_HELP);
  }

  switch (command) {
    case 'list':
    case 'self':
      return;
    case 'get':
    case 'sync':
    case 'add':
    case 'remove':
    case 'del':
    case 'update': {
      if (!args[1]) printUsageAndExit(CONTACTS_COMMAND_HELP[command]);
      return;
    }
    case 'update-profile': {
      if (
        !PROFILE_UPDATE_FLAGS.some((flag) =>
          hasOptionValue(args, flag, PROFILE_UPDATE_FLAGS)
        )
      ) {
        printUsageAndExit(CONTACTS_COMMAND_HELP['update-profile']);
      }
      return;
    }
  }
}

// Helper to extract profile values
// Contact has both direct fields (nickname, avatarImage) and peer fields (peerNickname, peerAvatarImage)
function extractProfile(contact: Contact | null) {
  if (!contact) return null;
  return {
    nickname: contact.nickname ?? contact.peerNickname ?? null,
    bio: contact.bio ?? null,
    status: contact.status ?? null,
    avatar: contact.avatarImage ?? contact.peerAvatarImage ?? null,
    cover: contact.coverImage ?? null,
    color: contact.color ?? null,
  };
}

// List all contacts and peers
async function listContacts() {
  const contacts = await getContacts();

  return contacts.map((contact) => ({
    ship: contact.id,
    isContact: !!contact.isContact,
    profile: extractProfile(contact),
  }));
}

// Get a specific contact's profile
async function getContact(ship: string) {
  const normalizedShip = normalizeShip(ship);
  const contacts = await getContacts();
  const contact = contacts.find((c) => c.id === normalizedShip) || null;

  if (contact) {
    return {
      ship: normalizedShip,
      isContact: !!contact.isContact,
      profile: extractProfile(contact),
    };
  }

  return {
    ship: normalizedShip,
    isContact: false,
    profile: null,
    note: "Ship not in local contacts. Use 'sync' to fetch their profile.",
  };
}

// Sync (fetch) profiles for ships
async function syncProfiles(ships: string[]) {
  const normalizedShips = ships.map(normalizeShip);
  await syncUserProfiles(normalizedShips);
  return { synced: normalizedShips };
}

// Update current user's profile
async function updateProfile(updates: {
  nickname?: string | null;
  bio?: string;
  status?: string;
  avatar?: string | null;
  cover?: string;
}) {
  const editFields: ContactEditField[] = [];

  if (updates.nickname !== undefined) {
    editFields.push({ nickname: updates.nickname ?? '' });
  }
  if (updates.bio !== undefined) {
    editFields.push({ bio: updates.bio });
  }
  if (updates.status !== undefined) {
    editFields.push({ status: updates.status });
  }
  if (updates.avatar !== undefined) {
    editFields.push({ avatar: updates.avatar ?? '' });
  }
  if (updates.cover !== undefined) {
    editFields.push({ cover: updates.cover });
  }

  if (editFields.length === 0) {
    throw new Error('No profile fields to update');
  }

  await poke({
    app: 'contacts',
    mark: 'contact-action',
    json: { edit: editFields },
  });

  return { updated: Object.keys(updates), ship: getCurrentUserId() };
}

// Get own profile
async function getSelf() {
  const currentUserId = getCurrentUserId();
  const contacts = await getContacts();
  const contact = contacts.find((c) => c.id === currentUserId) || null;

  return {
    ship: currentUserId,
    profile: extractProfile(contact),
  };
}

// Add a contact
async function addContact(ship: string) {
  const normalizedShip = normalizeShip(ship);
  await poke({
    app: 'contacts',
    mark: 'contact-action-1',
    json: { page: { kip: normalizedShip, contact: {} } },
  });
  return { added: normalizedShip };
}

// Remove a contact
async function removeContact(ship: string) {
  const normalizedShip = normalizeShip(ship);
  await poke({
    app: 'contacts',
    mark: 'contact-action-1',
    json: { wipe: [normalizedShip] },
  });
  return { removed: normalizedShip };
}

// Update a contact's metadata (nickname/avatar)
async function updateContact(
  ship: string,
  updates: { nickname?: string; avatar?: string }
) {
  const normalizedShip = normalizeShip(ship);
  await updateContactMetadata(normalizedShip, {
    nickname: updates.nickname,
    avatarImage: updates.avatar,
  });
  return { updated: normalizedShip };
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    if (isHelpArg(command)) {
      printHelpAndExit(CONTACTS_HELP);
    }

    if (isSubcommandHelpRequest(args)) {
      printHelpAndExit(getContactsHelp(command));
    }

    validateContactsArgs(args);

    await ensureClient();
    let result: any;

    switch (command) {
      case 'list':
        result = await listContacts();
        break;

      case 'self':
        result = await getSelf();
        break;

      case 'get':
        if (!args[1]) {
          printUsageAndExit(CONTACTS_COMMAND_HELP.get);
        }
        result = await getContact(args[1]);
        break;

      case 'sync':
        if (!args[1]) {
          printUsageAndExit(CONTACTS_COMMAND_HELP.sync);
        }
        result = await syncProfiles(args.slice(1));
        break;

      case 'add':
        if (!args[1]) {
          printUsageAndExit(CONTACTS_COMMAND_HELP.add);
        }
        result = await addContact(args[1]);
        break;

      case 'remove':
      case 'del':
        if (!args[1]) {
          printUsageAndExit(CONTACTS_COMMAND_HELP.remove);
        }
        result = await removeContact(args[1]);
        break;

      case 'update': {
        const ship = args[1];
        if (!ship) {
          printUsageAndExit(CONTACTS_COMMAND_HELP.update);
        }
        const nicknameIdx = args.indexOf('--nickname');
        const avatarIdx = args.indexOf('--avatar');
        const nickname = nicknameIdx !== -1 ? args[nicknameIdx + 1] : undefined;
        const avatar = avatarIdx !== -1 ? args[avatarIdx + 1] : undefined;
        result = await updateContact(ship, { nickname, avatar });
        break;
      }

      case 'update-profile': {
        const nicknameIdx = args.indexOf('--nickname');
        const bioIdx = args.indexOf('--bio');
        const statusIdx = args.indexOf('--status');
        const avatarIdx = args.indexOf('--avatar');
        const coverIdx = args.indexOf('--cover');

        const updates = {
          nickname: nicknameIdx !== -1 ? args[nicknameIdx + 1] : undefined,
          bio: bioIdx !== -1 ? args[bioIdx + 1] : undefined,
          status: statusIdx !== -1 ? args[statusIdx + 1] : undefined,
          avatar: avatarIdx !== -1 ? args[avatarIdx + 1] : undefined,
          cover: coverIdx !== -1 ? args[coverIdx + 1] : undefined,
        };

        result = await updateProfile(updates);
        break;
      }

      default:
        printUsageAndExit(CONTACTS_HELP);
    }

    if (result) {
      console.log(JSON.stringify(result, null, 2));
    }
    process.exit(0);
  } catch (error) {
    printErrorAndExit(error);
  }
}

main();
