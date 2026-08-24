import { WORKSPACE_CAPABILITIES } from '@tloncorp/api';
import { describe, expect, test } from 'vitest';

import {
  isWorkspace,
  isWorkspaceConversation,
  isWorkspaceSetupComplete,
  isWorkspaceSetupUnderway,
  readWorkspaceDescriptor,
  updateWorkspaceDescriptor,
  workspaceAgents,
  workspaceConversation,
  workspaceHasCapability,
  workspacePlace,
} from './workspaceDescriptor';

const ENTRY = {
  installId: 'meal-plan-0',
  kit: { id: 'meal-plan', version: '0.1.0', publisher: '~sampel-palnet' },
  places: {
    conversation: 'chat/~host/meals-1234',
    artifacts: 'notes/~host/meal-plans-1234',
  },
  // `enabled` is defaulted by the parser (TASK-13), so a descriptor read back
  // always carries it even when the stored blob does not.
  schedules: [{ id: 'weekly-plan', cron: '0 17 * * 5', enabled: false }],
  agents: ['~sampel-palnet'],
  setup: 'pending',
  permissions: ['postToPlaces', 'runSchedules'],
  installedAt: 1786149333904,
};

function blobOf(value: unknown): string {
  return JSON.stringify(value);
}

function group(blob: unknown) {
  return { blob: typeof blob === 'string' ? blob : blobOf(blob) };
}

const WORKSPACE = group({ version: 1, kits: [ENTRY] });

describe('detection', () => {
  test('a group carrying a kit install is a workspace', () => {
    expect(isWorkspace(WORKSPACE)).toBe(true);
  });

  // The whole point of putting detection in the blob: every group that predates
  // this feature carries none, so nothing about it changes.
  test('a group with no blob is not a workspace', () => {
    expect(isWorkspace({ blob: null })).toBe(false);
    expect(isWorkspace({ blob: undefined })).toBe(false);
    expect(isWorkspace({})).toBe(false);
    expect(isWorkspace(null)).toBe(false);
    expect(isWorkspace(undefined)).toBe(false);
  });

  test('a blob carrying no kit install is not a workspace', () => {
    expect(isWorkspace(group({ version: 1, kits: [] }))).toBe(false);
  });

  test('a blob that is not a kits payload is not a workspace', () => {
    expect(isWorkspace(group({ hello: 'world' }))).toBe(false);
  });
});

describe('reading the descriptor', () => {
  test('round-trips every field', () => {
    expect(readWorkspaceDescriptor(WORKSPACE)).toEqual(ENTRY);
  });

  test('resolves an abstract place to a nest', () => {
    const descriptor = readWorkspaceDescriptor(WORKSPACE);
    expect(workspacePlace(descriptor, 'conversation')).toBe(
      'chat/~host/meals-1234'
    );
    expect(workspacePlace(descriptor, 'artifacts')).toBe(
      'notes/~host/meal-plans-1234'
    );
    expect(workspacePlace(descriptor, 'nonexistent')).toBeNull();
    expect(workspacePlace(null, 'conversation')).toBeNull();
  });

  test('reads setup status and agents', () => {
    const descriptor = readWorkspaceDescriptor(WORKSPACE);
    expect(isWorkspaceSetupComplete(descriptor)).toBe(false);
    expect(isWorkspaceSetupUnderway(descriptor)).toBe(false);
    expect(workspaceAgents(descriptor)).toEqual(['~sampel-palnet']);
    expect(workspaceAgents(null)).toEqual([]);
  });

  // TASK-31: 'fired' means the setup conversation was scheduled and may
  // still be running — the agent is working, and nothing may read that as
  // either "complete" or "not started".
  test('a fired setup reads as underway, not complete', () => {
    const descriptor = readWorkspaceDescriptor(
      group({ version: 1, kits: [{ ...ENTRY, setup: 'fired' }] })
    );
    expect(descriptor?.setup).toBe('fired');
    expect(isWorkspaceSetupComplete(descriptor)).toBe(false);
    expect(isWorkspaceSetupUnderway(descriptor)).toBe(true);
  });

  test('is null for a group that is not a workspace', () => {
    expect(readWorkspaceDescriptor({ blob: null })).toBeNull();
  });
});

describe('capabilities', () => {
  test('reports a granted capability', () => {
    const descriptor = readWorkspaceDescriptor(WORKSPACE);
    expect(
      workspaceHasCapability(descriptor, WORKSPACE_CAPABILITIES.postToPlaces)
    ).toBe(true);
    expect(
      workspaceHasCapability(descriptor, WORKSPACE_CAPABILITIES.runSchedules)
    ).toBe(true);
  });

  test('a capability not in the list is not granted', () => {
    const descriptor = readWorkspaceDescriptor(WORKSPACE);
    expect(
      workspaceHasCapability(descriptor, WORKSPACE_CAPABILITIES.editOwnPosts)
    ).toBe(false);
  });

  // A descriptor written by a newer client can name a capability this build has
  // never heard of. That must read as "not granted", never as an error, and it
  // must not make the rest of the descriptor unreadable.
  test('an unrecognized capability is carried but not granted', () => {
    const descriptor = readWorkspaceDescriptor(
      group({
        version: 1,
        kits: [{ ...ENTRY, permissions: ['postToPlaces', 'timeTravel'] }],
      })
    );
    expect(descriptor?.permissions).toEqual(['postToPlaces', 'timeTravel']);
    expect(workspaceHasCapability(descriptor, 'timeTravel')).toBe(true);
    expect(workspaceHasCapability(descriptor, 'somethingElse')).toBe(false);
  });

  test('defaults to no capabilities when the field is absent', () => {
    const { permissions: _omitted, ...withoutPermissions } = ENTRY;
    const descriptor = readWorkspaceDescriptor(
      group({ version: 1, kits: [withoutPermissions] })
    );
    expect(descriptor?.permissions).toEqual([]);
    expect(
      workspaceHasCapability(descriptor, WORKSPACE_CAPABILITIES.postToPlaces)
    ).toBe(false);
  });

  test('nothing is granted without a descriptor', () => {
    expect(workspaceHasCapability(null, 'postToPlaces')).toBe(false);
  });
});

// AC #4. Each of these is a plain group, never a broken workspace, and none
// throws.
describe('failing safe', () => {
  test.each([
    ['not json', 'not json'],
    ['an empty string', ''],
    ['whitespace', '   '],
    ['a bare array', '[]'],
    ['a JSON scalar', '42'],
  ])('%s reads as a plain group', (_label, blob) => {
    expect(isWorkspace({ blob })).toBe(false);
    expect(readWorkspaceDescriptor({ blob })).toBeNull();
  });

  test('an unsupported blob version reads as a plain group', () => {
    expect(isWorkspace(group({ version: 9, kits: [ENTRY] }))).toBe(false);
  });

  test('a non-array kits field reads as a plain group', () => {
    expect(isWorkspace(group({ version: 1, kits: 'nope' }))).toBe(false);
  });

  // A malformed entry is skipped individually rather than failing the config,
  // so one bad entry cannot hide a good sibling.
  test('a malformed entry is skipped, leaving its siblings readable', () => {
    const descriptor = readWorkspaceDescriptor(
      group({ version: 1, kits: [{ installId: '' }, ENTRY] })
    );
    expect(descriptor).toEqual(ENTRY);
  });

  test('an entry with a garbage setup value reads as done, not as broken', () => {
    const descriptor = readWorkspaceDescriptor(
      group({ version: 1, kits: [{ ...ENTRY, setup: 'sideways' }] })
    );
    // 'done' rather than 'pending': firing setup posts a conversation and
    // writes scaffolds, so an unreadable value must not re-run it.
    expect(descriptor?.setup).toBe('done');
    expect(isWorkspaceSetupComplete(descriptor)).toBe(true);
  });
});

describe('updateWorkspaceDescriptor', () => {
  test('patches only the fields it is given', () => {
    const next = updateWorkspaceDescriptor(WORKSPACE.blob, { setup: 'done' });
    const descriptor = readWorkspaceDescriptor({ blob: next });

    expect(descriptor?.setup).toBe('done');
    expect(descriptor?.places).toEqual(ENTRY.places);
    expect(descriptor?.schedules).toEqual(ENTRY.schedules);
    expect(descriptor?.permissions).toEqual(ENTRY.permissions);
  });

  test('can grant a capability', () => {
    const next = updateWorkspaceDescriptor(WORKSPACE.blob, {
      permissions: [...ENTRY.permissions, 'editOwnPosts'],
    });
    expect(
      workspaceHasCapability(
        readWorkspaceDescriptor({ blob: next }),
        WORKSPACE_CAPABILITIES.editOwnPosts
      )
    ).toBe(true);
  });

  // The load-bearing case, and the one this repo has now got wrong twice with
  // post blobs. The update walks raw JSON rather than reserializing parsed
  // output, so anything a newer client wrote survives byte-for-byte.
  test('preserves keys this build does not understand', () => {
    const blob = blobOf({
      version: 1,
      futureTopLevel: { keep: true },
      kits: [{ ...ENTRY, futureEntryKey: 'keep me' }],
    });

    const next = updateWorkspaceDescriptor(blob, { setup: 'done' });
    const parsed = JSON.parse(next!);

    expect(parsed.futureTopLevel).toEqual({ keep: true });
    expect(parsed.kits[0].futureEntryKey).toBe('keep me');
    expect(parsed.kits[0].setup).toBe('done');
  });

  test('leaves sibling kit entries untouched', () => {
    const other = { ...ENTRY, installId: 'other-0' };
    const blob = blobOf({ version: 1, kits: [ENTRY, other] });

    const parsed = JSON.parse(
      updateWorkspaceDescriptor(blob, { setup: 'done' })!
    );

    expect(parsed.kits[0].setup).toBe('done');
    expect(parsed.kits[1]).toEqual(other);
  });

  // Patching the entry the reader will read, not just the first one present,
  // so the two can never disagree about which kit is the workspace's.
  test('patches the entry the reader resolves', () => {
    const blob = blobOf({ version: 1, kits: [{ nonsense: true }, ENTRY] });
    const parsed = JSON.parse(
      updateWorkspaceDescriptor(blob, { setup: 'done' })!
    );

    expect(parsed.kits[0]).toEqual({ nonsense: true });
    expect(parsed.kits[1].setup).toBe('done');
  });

  // Minting a descriptor from nothing is an install, and that belongs to %kits.
  test('is null when there is nothing to patch', () => {
    expect(updateWorkspaceDescriptor(null, { setup: 'done' })).toBeNull();
    expect(updateWorkspaceDescriptor('', { setup: 'done' })).toBeNull();
    expect(updateWorkspaceDescriptor('not json', { setup: 'done' })).toBeNull();
    expect(
      updateWorkspaceDescriptor(blobOf({ version: 1, kits: [] }), {
        setup: 'done',
      })
    ).toBeNull();
  });
});

describe('the workspace conversation', () => {
  test('is the first chat-backed place', () => {
    expect(workspaceConversation(readWorkspaceDescriptor(WORKSPACE))).toBe(
      'chat/~host/meals-1234'
    );
  });

  // Places are named for what they mean, not typed by their name, so the nest
  // is what identifies the conversation.
  test('ignores the artifact place whatever it is called', () => {
    const descriptor = readWorkspaceDescriptor(
      group({
        version: 1,
        kits: [
          {
            ...ENTRY,
            places: {
              plans: 'notes/~host/plans-1234',
              kitchen: 'chat/~host/kitchen-1234',
            },
          },
        ],
      })
    );
    expect(workspaceConversation(descriptor)).toBe('chat/~host/kitchen-1234');
  });

  test('is null when the workspace declares no chat place', () => {
    const descriptor = readWorkspaceDescriptor(
      group({
        version: 1,
        kits: [{ ...ENTRY, places: { plans: 'notes/~host/plans-1234' } }],
      })
    );
    expect(workspaceConversation(descriptor)).toBeNull();
    expect(workspaceConversation(null)).toBeNull();
  });
});

describe('isWorkspaceConversation', () => {
  // The landing's question: this channel gets the "your agent is starting up"
  // notice, and nothing else does.
  test('matches the conversation and not the artifact place', () => {
    expect(isWorkspaceConversation(WORKSPACE, 'chat/~host/meals-1234')).toBe(
      true
    );
    expect(
      isWorkspaceConversation(WORKSPACE, 'notes/~host/meal-plans-1234')
    ).toBe(false);
  });

  // The property that keeps every existing empty state untouched.
  test('is false for a group that is not a workspace', () => {
    expect(
      isWorkspaceConversation({ blob: null }, 'chat/~host/meals-1234')
    ).toBe(false);
    expect(isWorkspaceConversation(null, 'chat/~host/meals-1234')).toBe(false);
  });

  test('is false without a channel id', () => {
    expect(isWorkspaceConversation(WORKSPACE, null)).toBe(false);
    expect(isWorkspaceConversation(WORKSPACE, undefined)).toBe(false);
    expect(isWorkspaceConversation(WORKSPACE, '')).toBe(false);
  });
});
