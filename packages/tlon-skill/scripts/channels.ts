#!/usr/bin/env npx ts-node

/**
 * Channel listing and management for Tlon/Urbit
 *
 * Usage:
 *   npx ts-node channels.ts dms        # List DMs
 *   npx ts-node channels.ts group-dms  # List group DMs (clubs)
 *   npx ts-node channels.ts groups     # List subscribed groups
 *   npx ts-node channels.ts all        # List all channels
 *   npx ts-node channels.ts info <nest>   # Get channel info
 *   npx ts-node channels.ts create <group-id> "Channel Name" [--kind chat|heap|notes] [--description "..."]
 *   npx ts-node channels.ts rename <nest> "New Title"
 *   npx ts-node channels.ts update <nest> --title "..." [--description "..."]
 *   npx ts-node channels.ts delete <nest> # Delete a channel (must be group admin)
 *   npx ts-node channels.ts add-writers <nest> <role1> [role2...]
 *   npx ts-node channels.ts del-writers <nest> <role1> [role2...]
 *   npx ts-node channels.ts add-readers <group-flag> <nest> <role1> [role2...]
 *   npx ts-node channels.ts del-readers <group-flag> <nest> <role1> [role2...]
 */
import {
  addChannelWriters as apiAddWriters,
  removeChannelWriters as apiRemoveWriters,
  createChannel,
  deleteChannel,
  deleteNotesNotebookBestEffort,
  getGroups,
  getInitData,
  poke,
  updateChannel,
} from '@tloncorp/api';
import type { Channel as ApiChannel, Group as ApiGroup } from '@tloncorp/api';

import { ensureClient, getCurrentShip } from './api-client';
import {
  assertKnownChannelKind,
  getOption,
  hasOptionValue,
  isHelpArg,
  isNotesNest,
  isSubcommandHelpRequest,
  looksLikePositionalChannelKind,
  printErrorAndExit,
  printHelpAndExit,
  printUsageAndExit,
  refuseDiaryNest,
  refuseNotesChannelDescription,
  refuseNotesChannelMetadataUpdate,
  refuseNotesWriters,
  refuseRemovedChannelKind,
} from './cli-utils';
import { createNotesChannelInGroup } from './notes-channel';
import { createNotesChannelDeps } from './notes-channel-runtime';

function generateChannelSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const alphanumeric = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = chars[Math.floor(Math.random() * chars.length)];
  for (let i = 0; i < 7; i++) {
    slug += alphanumeric[Math.floor(Math.random() * alphanumeric.length)];
  }
  return slug;
}

const CHANNELS_HELP = `Usage: tlon channels <command>

Commands:
  dms
  group-dms
  groups
  all
  info <nest>
  create <group-id> "Channel Name" [--kind chat|heap|notes] [--description "..."]
  update <nest> (--title "..." | --description "...")
  rename <nest> "New Title"
  delete <nest>
  add-writers <nest> <role1> [role2...]
  del-writers <nest> <role1> [role2...]
  add-readers <group-flag> <nest> <role1> [role2...]
  del-readers <group-flag> <nest> <role1> [role2...]

Examples:
  tlon channels create ~host/group-slug "Projects" --kind chat
  tlon channels rename chat/~host/project-updates "Team Updates"`;

const CHANNELS_COMMAND_HELP: Record<string, string> = {
  dms: `Usage: tlon channels dms`,
  'group-dms': `Usage: tlon channels group-dms`,
  groups: `Usage: tlon channels groups`,
  all: `Usage: tlon channels all`,
  info: `Usage: tlon channels info <nest>\nExample: tlon channels info chat/~host/slug`,
  create: `Usage: tlon channels create <group-id> "Channel Name" [--kind chat|heap|notes] [--description "..."]\nExample: tlon channels create ~host/group-slug "Projects" --kind chat`,
  update: `Usage: tlon channels update <nest> (--title "..." | --description "...")\nExample: tlon channels update chat/~host/slug --title "New Title"`,
  rename: `Usage: tlon channels rename <nest> "New Title"\nExample: tlon channels rename chat/~host/slug "Project Updates"`,
  delete: `Usage: tlon channels delete <nest>\nExample: tlon channels delete chat/~host/slug`,
  'add-writers': `Usage: tlon channels add-writers <nest> <role1> [role2...]\nExample: tlon channels add-writers chat/~host/slug admin`,
  'del-writers': `Usage: tlon channels del-writers <nest> <role1> [role2...]\nExample: tlon channels del-writers chat/~host/slug member`,
  'add-readers': `Usage: tlon channels add-readers <group-flag> <nest> <role1> [role2...]\nExample: tlon channels add-readers ~host/group-slug chat/~host/slug admin`,
  'del-readers': `Usage: tlon channels del-readers <group-flag> <nest> <role1> [role2...]\nExample: tlon channels del-readers ~host/group-slug chat/~host/slug admin`,
};

const CHANNEL_UPDATE_FLAGS = ['title', 'description'] as const;

function getChannelsHelp(command?: string) {
  return command
    ? (CHANNELS_COMMAND_HELP[command] ?? CHANNELS_HELP)
    : CHANNELS_HELP;
}

function validateChannelsArgs(args: string[]): void {
  const command = args[0];
  if (!command || !CHANNELS_COMMAND_HELP[command]) {
    printUsageAndExit(CHANNELS_HELP);
  }

  switch (command) {
    case 'dms':
    case 'group-dms':
    case 'groups':
    case 'all':
      return;
    case 'info':
    case 'delete': {
      if (!args[1]) printUsageAndExit(CHANNELS_COMMAND_HELP[command]);
      refuseDiaryNest(args[1]);
      return;
    }
    case 'create': {
      if (!args[1] || args[2] === undefined) {
        printUsageAndExit(CHANNELS_COMMAND_HELP.create);
      }
      refuseRemovedChannelKind(args, 2);
      assertKnownChannelKind(args, 2, CHANNELS_COMMAND_HELP.create);
      refuseNotesChannelDescription(args, 2, CHANNELS_COMMAND_HELP.create);
      if (looksLikePositionalChannelKind(args, 2)) {
        printUsageAndExit(
          `Error: channel kind must be passed with --kind, not as a positional argument.\n${CHANNELS_COMMAND_HELP.create}`
        );
      }
      return;
    }
    case 'update': {
      if (!args[1]) printUsageAndExit(CHANNELS_COMMAND_HELP.update);
      refuseDiaryNest(args[1]);
      refuseNotesChannelMetadataUpdate(args[1]);
      if (
        !CHANNEL_UPDATE_FLAGS.some((flag) =>
          hasOptionValue(args, flag, CHANNEL_UPDATE_FLAGS)
        )
      ) {
        printUsageAndExit(
          `Error: At least one of --title or --description is required\n${CHANNELS_COMMAND_HELP.update}`
        );
      }
      return;
    }
    case 'rename': {
      if (!args[1] || !args[2]) {
        printUsageAndExit(CHANNELS_COMMAND_HELP.rename);
      }
      refuseDiaryNest(args[1]);
      refuseNotesChannelMetadataUpdate(args[1]);
      return;
    }
    case 'add-writers':
    case 'del-writers': {
      if (!args[1] || args.slice(2).length === 0) {
        printUsageAndExit(CHANNELS_COMMAND_HELP[command]);
      }
      refuseDiaryNest(args[1]);
      refuseNotesWriters(args[1]);
      return;
    }
    case 'add-readers':
    case 'del-readers': {
      if (!args[1] || !args[2] || args.slice(3).length === 0) {
        printUsageAndExit(CHANNELS_COMMAND_HELP[command]);
      }
      refuseDiaryNest(args[2]);
      return;
    }
  }
}

// Get DMs
async function getDms() {
  const init = await getInitData();
  const dms = init.channels.filter((channel) => channel.type === 'dm');
  return dms.map((dm) => ({
    type: 'dm',
    id: dm.id,
    contact: dm.contactId || dm.id,
  }));
}

// Get group DMs (clubs)
async function getGroupDms() {
  const currentShip = await getCurrentShip();
  const init = await getInitData();
  const groupDms = init.channels.filter(
    (channel) => channel.type === 'groupDm'
  );

  return groupDms.map((dm) => {
    const members = dm.members || [];
    const joined = members.filter((member) => member.status === 'joined');
    const invited = members.filter((member) => member.status === 'invited');
    const isJoined = joined.some((member) => member.contactId === currentShip);
    const isInvited = invited.some(
      (member) => member.contactId === currentShip
    );

    return {
      type: 'groupDm',
      id: dm.id,
      title: dm.title || 'Untitled',
      description: dm.description || '',
      members: joined.map((member) => member.contactId),
      invited: invited.map((member) => member.contactId),
      status: isJoined ? 'joined' : isInvited ? 'invited' : 'unknown',
    };
  });
}

// Get subscribed groups
async function getGroupsList() {
  const groups = await getGroupsApi();

  return groups.map((group) => {
    const channelList = (group.channels || []).map((channel) => ({
      nest: channel.id,
      title: channel.title || channel.id,
      zone: findChannelSectionId(group, channel.id),
    }));

    return {
      type: 'group',
      id: group.id,
      title: group.title,
      description: group.description,
      image: group.iconImage,
      secret: group.privacy === 'secret',
      memberCount: group.memberCount ?? (group.members || []).length,
      channels: channelList,
    };
  });
}

// Get all channels combined
async function getAll() {
  const [dms, groupDms, groups] = await Promise.all([
    getDms(),
    getGroupDms(),
    getGroupsList(),
  ]);

  return {
    dms,
    groupDms,
    groups,
  };
}

// Parse nest into components: kind/~host/name -> { kind, host, name, group }
function parseNest(nest: string): { kind: string; host: string; name: string } {
  const parts = nest.split('/');
  if (parts.length !== 3) {
    throw new Error(`Invalid nest format: ${nest}. Expected: kind/~host/name`);
  }
  return {
    kind: parts[0],
    host: parts[1].startsWith('~') ? parts[1] : `~${parts[1]}`,
    name: parts[2],
  };
}

// Find which group a channel belongs to
async function findChannelGroup(
  nest: string
): Promise<{ group: ApiGroup; channel: ApiChannel } | null> {
  const groups = await getGroupsApi();
  for (const group of groups) {
    const channel = (group.channels || []).find((c) => c.id === nest);
    if (channel) {
      return { group, channel };
    }
  }
  return null;
}

// Get channel info
async function getChannelInfo(nest: string) {
  const { kind, name } = parseNest(nest);

  // Find the group this channel belongs to
  const match = await findChannelGroup(nest);
  if (!match) {
    throw new Error(`Channel ${nest} not found in any group`);
  }

  const { group, channel } = match;

  console.log(`\n=== ${channel.title || name} ===\n`);
  console.log(`Nest: ${nest}`);
  console.log(`Kind: ${kind}`);
  console.log(`Group: ${group.title} (${group.id})`);
  console.log(`Zone: ${findChannelSectionId(group, channel.id)}`);
  console.log(`Description: ${channel.description || '(none)'}`);
  const readerRoles = (channel.readerRoles || []).map((r) => r.roleId);
  console.log(
    `Readers: ${readerRoles.length > 0 ? readerRoles.join(', ') : '(all members)'}`
  );

  return {
    nest,
    kind,
    group: group.id,
    groupTitle: group.title,
    title: channel.title,
    description: channel.description,
    zone: findChannelSectionId(group, channel.id),
    readers: readerRoles,
  };
}

async function createChannelInGroup(
  groupId: string,
  title: string,
  kind: 'chat' | 'heap' = 'chat',
  description = ''
) {
  const ship = await getCurrentShip();
  const name = generateChannelSlug();
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

// Create a %notes group channel. %notes assigns the flag and registers the
// %groups listing itself; the skill only POSTs to the v1 API and verifies the
// listing appeared (see notes-channel.ts).
async function createNotesChannel(groupId: string, title: string) {
  const nest = await createNotesChannelInGroup(
    { groupId, title },
    createNotesChannelDeps()
  );

  console.log(`✅ Notes channel created!`);
  console.log(`   Nest: ${nest}`);
  console.log(`   Title: ${title}`);
  console.log(`   Group: ${groupId}`);
  return nest;
}

// Update channel metadata
async function updateChannelMeta(
  nest: string,
  options: { title?: string; description?: string }
) {
  const match = await findChannelGroup(nest);
  if (!match) {
    throw new Error(`Channel ${nest} not found in any group`);
  }

  const { group, channel } = match;
  const sectionId = findChannelSectionId(group, channel.id) || 'default';
  const description = options.description ?? channel.description ?? '';
  const channelContentConfiguration = channel.contentConfiguration ?? undefined;
  const encodedDescription = JSON.stringify({
    description,
    channelContentConfiguration,
  });

  const channelUpdate = {
    added: channel.addedToGroupAt ?? Date.now(),
    meta: {
      title: options.title ?? channel.title ?? '',
      description: encodedDescription,
      image: channel.iconImage || '',
      cover: channel.coverImage || '',
    },
    section: sectionId,
    readers: (channel.readerRoles || []).map((r) => r.roleId),
    join: channel.currentUserIsMember ?? true,
  };

  console.log(`Updating channel ${nest}...`);

  await updateChannel({
    groupId: group.id,
    channelId: nest,
    channel: channelUpdate,
  });

  console.log(`✅ Channel updated.`);
  console.log(`   Title: ${channelUpdate.meta.title}`);
  console.log(`   Description: ${description || '(none)'}`);
}

// Delete a channel
async function deleteChannelByNest(nest: string) {
  const match = await findChannelGroup(nest);
  if (!match) {
    throw new Error(`Channel ${nest} not found in any group`);
  }

  console.log(`Deleting channel ${nest} from group ${match.group.id}...`);

  await deleteChannel({
    groupId: match.group.id,
    channelId: nest,
  });

  // For a %notes channel, remove the underlying notebook after the listing is
  // gone. Best-effort: the helper swallows errors (e.g. when we are not the
  // host), which is harmless — the listing is already removed from the group.
  if (isNotesNest(nest)) {
    await deleteNotesNotebookBestEffort(nest);
  }

  console.log(`✅ Channel deleted.`);
}

async function getGroupsApi(): Promise<ApiGroup[]> {
  return getGroups();
}

type GroupNavSection = {
  sectionId?: string;
  channels?: Array<{ channelId?: string }>;
};

function findChannelSectionId(group: ApiGroup, channelId: string): string {
  const navSections = (group.navSections || []) as GroupNavSection[];
  const section = navSections.find((nav) =>
    (nav.channels || []).some((channel) => channel.channelId === channelId)
  );
  return section?.sectionId || 'default';
}

// Add writers to a channel
async function addWriters(nest: string, roles: string[]) {
  console.log(`Adding writers to ${nest}: ${roles.join(', ')}...`);
  await apiAddWriters({ channelId: nest, writers: roles });
  console.log(`✅ Writers added: ${roles.join(', ')}`);
}

// Remove writers from a channel
async function removeWriters(nest: string, roles: string[]) {
  console.log(`Removing writers from ${nest}: ${roles.join(', ')}...`);
  await apiRemoveWriters({ channelId: nest, writers: roles });
  console.log(`✅ Writers removed: ${roles.join(', ')}`);
}

// Add readers to a channel (requires group context)
async function addReaders(groupFlag: string, nest: string, roles: string[]) {
  console.log(
    `Adding readers to ${nest} in group ${groupFlag}: ${roles.join(', ')}...`
  );
  await poke({
    app: 'groups',
    mark: 'group-action-4',
    json: {
      group: {
        flag: groupFlag,
        'a-group': {
          channel: {
            nest,
            'a-channel': {
              'add-readers': roles,
            },
          },
        },
      },
    },
  });
  console.log(`✅ Readers added: ${roles.join(', ')}`);
}

// Remove readers from a channel (requires group context)
async function removeReaders(groupFlag: string, nest: string, roles: string[]) {
  console.log(
    `Removing readers from ${nest} in group ${groupFlag}: ${roles.join(', ')}...`
  );
  await poke({
    app: 'groups',
    mark: 'group-action-4',
    json: {
      group: {
        flag: groupFlag,
        'a-group': {
          channel: {
            nest,
            'a-channel': {
              'del-readers': roles,
            },
          },
        },
      },
    },
  });
  console.log(`✅ Readers removed: ${roles.join(', ')}`);
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (isHelpArg(command)) {
    printHelpAndExit(CHANNELS_HELP);
  }

  if (isSubcommandHelpRequest(args)) {
    printHelpAndExit(getChannelsHelp(command));
  }

  validateChannelsArgs(args);

  try {
    await ensureClient(['channels']);
    switch (command) {
      case 'dms': {
        const dms = await getDms();
        console.log(JSON.stringify(dms, null, 2));
        break;
      }

      case 'group-dms': {
        const dms = await getGroupDms();
        console.log(JSON.stringify(dms, null, 2));
        break;
      }

      case 'groups': {
        const groups = await getGroupsList();
        console.log(JSON.stringify(groups, null, 2));
        break;
      }

      case 'all': {
        const all = await getAll();
        console.log(JSON.stringify(all, null, 2));
        break;
      }

      case 'info': {
        const nest = args[1];
        if (!nest) {
          console.error(CHANNELS_COMMAND_HELP.info);
          process.exit(1);
        }
        await getChannelInfo(nest);
        break;
      }

      case 'create': {
        const groupId = args[1];
        const title = args[2];
        if (!groupId || title === undefined) {
          console.error(CHANNELS_COMMAND_HELP.create);
          process.exit(1);
        }
        refuseRemovedChannelKind(args, 2);
        assertKnownChannelKind(args, 2, CHANNELS_COMMAND_HELP.create);
        refuseNotesChannelDescription(args, 2, CHANNELS_COMMAND_HELP.create);
        if (looksLikePositionalChannelKind(args, 2)) {
          console.error(
            'Error: channel kind must be passed with --kind, not as a positional argument.'
          );
          console.error(CHANNELS_COMMAND_HELP.create);
          process.exit(1);
        }
        const kind =
          (getOption(args, 'kind', 3) as 'chat' | 'heap' | 'notes') || 'chat';
        // %notes group channels are created by %notes itself (it registers the
        // %groups listing) — never via createChannel/%channels.
        if (kind === 'notes') {
          await createNotesChannel(groupId, title);
          break;
        }
        const description = getOption(args, 'description', 3) || '';
        await createChannelInGroup(groupId, title, kind, description);
        break;
      }

      case 'update': {
        const nest = args[1];
        if (!nest) {
          console.error(CHANNELS_COMMAND_HELP.update);
          process.exit(1);
        }

        const title = getOption(args, 'title');
        const description = getOption(args, 'description');

        if (!title && !description) {
          console.error(
            'Error: At least one of --title or --description is required'
          );
          console.error(CHANNELS_COMMAND_HELP.update);
          process.exit(1);
        }

        await updateChannelMeta(nest, { title, description });
        break;
      }

      case 'rename': {
        const nest = args[1];
        const title = args[2];
        if (!nest || !title) {
          console.error(CHANNELS_COMMAND_HELP.rename);
          process.exit(1);
        }
        await updateChannelMeta(nest, { title });
        break;
      }

      case 'delete': {
        const nest = args[1];
        if (!nest) {
          console.error(CHANNELS_COMMAND_HELP.delete);
          process.exit(1);
        }
        await deleteChannelByNest(nest);
        break;
      }

      case 'add-writers': {
        const nest = args[1];
        const roles = args.slice(2);
        if (!nest || roles.length === 0) {
          console.error(CHANNELS_COMMAND_HELP['add-writers']);
          process.exit(1);
        }
        await addWriters(nest, roles);
        break;
      }

      case 'del-writers': {
        const nest = args[1];
        const roles = args.slice(2);
        if (!nest || roles.length === 0) {
          console.error(CHANNELS_COMMAND_HELP['del-writers']);
          process.exit(1);
        }
        await removeWriters(nest, roles);
        break;
      }

      case 'add-readers': {
        const groupFlag = args[1];
        const nest = args[2];
        const roles = args.slice(3);
        if (!groupFlag || !nest || roles.length === 0) {
          console.error(CHANNELS_COMMAND_HELP['add-readers']);
          process.exit(1);
        }
        await addReaders(groupFlag, nest, roles);
        break;
      }

      case 'del-readers': {
        const groupFlag = args[1];
        const nest = args[2];
        const roles = args.slice(3);
        if (!groupFlag || !nest || roles.length === 0) {
          console.error(CHANNELS_COMMAND_HELP['del-readers']);
          process.exit(1);
        }
        await removeReaders(groupFlag, nest, roles);
        break;
      }

      default:
        printUsageAndExit(CHANNELS_HELP);
    }
    process.exit(0);
  } catch (error) {
    printErrorAndExit(error);
  }
}

main();
