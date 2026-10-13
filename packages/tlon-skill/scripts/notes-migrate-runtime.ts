import {
  type Story,
  batchImportNotesV1,
  client,
  getChannelPosts,
  getCurrentUserId,
  notesV1,
  scry,
  toUrbitStory,
  updateChannel,
} from '@tloncorp/api';
import { storyToMarkdown, storyToMdast } from '@tloncorp/api/client/markdown';
import { randomBytes } from 'crypto';

import { getConfig } from './api-client';
import { createNotesChannelInGroup } from './notes-channel';
import { createNotesChannelDeps } from './notes-channel-runtime';
import {
  type ChannelPerm,
  type GroupChannelV7,
  type GroupInfo,
  type MigrationDeps,
  normalizeShip,
} from './notes-migrate';

const UV_ALPHABET = '0123456789abcdefghijklmnopqrstuv';

function renderUv(bytes: Uint8Array): string {
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  bits = bits.replace(/^0+/, '') || '0';
  const padded = bits.padStart(Math.ceil(bits.length / 5) * 5, '0');
  let digits = '';
  for (let i = 0; i < padded.length; i += 5) {
    digits += UV_ALPHABET[Number.parseInt(padded.slice(i, i + 5), 2)];
  }
  const grouped: string[] = [];
  for (let i = digits.length; i > 0; i -= 5) {
    grouped.unshift(digits.slice(Math.max(0, i - 5), i));
  }
  return `0v${grouped.join('.')}`;
}

export function generateRequestId(
  draw: (size: number) => Uint8Array = randomBytes
): string {
  let bytes: Uint8Array;
  do {
    bytes = draw(16);
    if (bytes.length !== 16) {
      throw new Error(
        'Request-id entropy source returned the wrong byte count'
      );
    }
  } while (!bytes.some((byte) => byte !== 0));

  const requestId = renderUv(bytes);
  if (requestId === '0v0') {
    throw new Error('Request-id generator produced the forbidden zero atom');
  }
  return requestId;
}

function requireStringArray(value: unknown, context: string): string[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string')
  ) {
    throw new Error(`${context}: expected an array of strings`);
  }
  return [...value];
}

function requireRecord(
  value: unknown,
  context: string
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${context}: expected an object`);
  }
  return value as Record<string, unknown>;
}

function requireMeta(value: unknown, context: string): GroupChannelV7['meta'] {
  const meta = requireRecord(value, context);
  for (const field of ['title', 'description', 'image', 'cover'] as const) {
    if (typeof meta[field] !== 'string') {
      throw new Error(`${context}.${field}: expected a string`);
    }
  }
  return {
    title: meta.title as string,
    description: meta.description as string,
    image: meta.image as string,
    cover: meta.cover as string,
  };
}

export function parseGroupV7(
  raw: Record<string, unknown>,
  flag: string
): GroupInfo {
  const group = requireRecord(raw, `Group ${flag}`);
  const admins = requireStringArray(group.admins, `Group ${flag}.admins`);
  const admissions = requireRecord(
    group.admissions,
    `Group ${flag}.admissions`
  );
  const privacy = admissions.privacy;
  if (privacy !== 'public' && privacy !== 'private' && privacy !== 'secret') {
    throw new Error(
      `Group ${flag}.admissions.privacy: unrecognized value ${String(privacy)}`
    );
  }

  const channelsRecord = requireRecord(
    group.channels,
    `Group ${flag}.channels`
  );
  const channels: Record<string, GroupChannelV7> = {};
  for (const [nest, rawChannel] of Object.entries(channelsRecord)) {
    const channel = requireRecord(rawChannel, `Group ${flag}.channels.${nest}`);
    if (typeof channel.added !== 'number') {
      throw new Error(
        `Group ${flag}.channels.${nest}.added: expected a number`
      );
    }
    if (typeof channel.section !== 'string') {
      throw new Error(
        `Group ${flag}.channels.${nest}.section: expected a string`
      );
    }
    if (typeof channel.join !== 'boolean') {
      throw new Error(
        `Group ${flag}.channels.${nest}.join: expected a boolean`
      );
    }
    channels[nest] = {
      added: channel.added,
      meta: requireMeta(channel.meta, `Group ${flag}.channels.${nest}.meta`),
      section: channel.section,
      readers: requireStringArray(
        channel.readers,
        `Group ${flag}.channels.${nest}.readers`
      ),
      join: channel.join,
    };
  }

  return {
    privacy,
    admins,
    channels,
  };
}

export interface ServerIdentityInput {
  configuredShip: string;
  url: string;
  cookie?: string;
  fetchFn: (
    input: string | URL | Request,
    init?: RequestInit
  ) => Promise<Response>;
}

export async function assertServerIdentity(
  input: ServerIdentityInput
): Promise<void> {
  const headers: Record<string, string> = {};
  if (input.cookie) headers.Cookie = input.cookie;
  const response = await input.fetchFn(`${input.url}/~/name`, {
    method: 'GET',
    credentials: 'include',
    headers,
  });
  if (!response.ok) {
    throw new Error(
      `Server identity check failed with HTTP ${response.status}`
    );
  }
  const actual = (await response.text()).trim();
  const expected = normalizeShip(input.configuredShip);
  if (!actual || normalizeShip(actual) !== expected) {
    throw new Error(
      `Server identity mismatch: configured ${expected}, authenticated as ${
        actual ? normalizeShip(actual) : '(empty response)'
      }`
    );
  }
}

export function createMigrationDeps(): MigrationDeps {
  return {
    getChannelPerm: async (nest: string): Promise<ChannelPerm> => {
      const perm = await scry<unknown>({
        app: 'channels',
        path: `/${nest}/perm`,
      });
      const record = requireRecord(perm, `Channel ${nest}.perm`);
      const writers = requireStringArray(
        record.writers,
        `Channel ${nest}.perm.writers`
      );
      if (typeof record.group !== 'string' || !record.group) {
        throw new Error(`Channel ${nest}.perm.group: expected a group flag`);
      }
      return { writers, group: record.group };
    },

    getGroup: async (flag: string) => {
      const raw = await scry<Record<string, unknown>>({
        app: 'groups',
        path: `/v2/ui/groups/${flag}`,
      });
      return parseGroupV7(raw, flag);
    },

    getChannelPosts: async (nest, cursor, mode, count) => {
      const result = await getChannelPosts({
        channelId: nest,
        cursor,
        mode,
        count,
        includeReplies: false,
        skipGapFill: true,
      });
      if (typeof result.totalPosts !== 'number') {
        throw new Error(`Channel ${nest}: response omitted totalPosts`);
      }
      const older = result.older;
      if (older !== null && older !== undefined && typeof older !== 'string') {
        throw new Error(`Channel ${nest}: response returned malformed cursor`);
      }
      return {
        posts: result.posts ?? [],
        older: older ?? null,
        totalPosts: result.totalPosts,
      };
    },

    createGroupNotebook: ({ title, groupId, readers, onCreated }) =>
      createNotesChannelInGroup(
        { title, groupId, readers, onCreated },
        createNotesChannelDeps()
      ),

    getNotebookDetail: async (target) => {
      const detail = await notesV1.getNotebook(target);
      return {
        rootFolderId: detail.notebook.rootFolderId,
        host: detail.host,
        flagName: detail.flagName,
      };
    },

    listNotes: (target) => notesV1.listNotes(target),

    batchImport: (input) => batchImportNotesV1(input),

    getRawGroup: (groupId) =>
      scry<Record<string, unknown>>({
        app: 'groups',
        path: `/v2/ui/groups/${groupId}`,
      }),

    updateChannel: async (input) => {
      await updateChannel(input);
    },

    getActingShip: () => getCurrentUserId(),

    assertServerIdentity: async () => {
      const config = getConfig();
      await assertServerIdentity({
        configuredShip: config.ship,
        url: config.url,
        cookie: client.cookie,
        fetchFn: client.fetchFn,
      });
    },

    storyToMarkdown: (story: Story) => storyToMarkdown(story),

    storyToMdastStrict: (story: Story) => {
      storyToMdast(story, { strict: true });
    },

    toUrbitStory: (content: unknown) => toUrbitStory(content as never),

    generateRequestId,

    // CLI-native wording. Bot adapters inject their own slash-command phrasing
    // through this dep rather than reusing this string.
    recoveryInstruction: (targetNest) =>
      `run \`tlon notes notebook-delete ${targetNest} --yes\`, then retry with \`tlon notes migrate-apply <diary-nest> --yes\`.`,

    log: (message) => console.log(message),
  };
}
