import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createMemoryBootstrapHandler,
  encodeNestForFilename,
  selectMemoryFilePaths,
} from './bootstrap-loader.js';
import { recordSpeakerForSession } from './speaker-bridge.js';

let workspaceDir: string;

async function writeMemoryFile(relPath: string, content: string) {
  const absPath = path.join(workspaceDir, relPath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, content, 'utf8');
}

function bootstrapEvent(sessionKey: string, files: unknown[] = []) {
  return {
    type: 'agent',
    action: 'bootstrap',
    context: {
      workspaceDir,
      bootstrapFiles: files as {
        name: string;
        path: string;
        content?: string;
        missing: boolean;
      }[],
      sessionKey,
    },
  };
}

beforeEach(async () => {
  workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tlon-memory-'));
});

afterEach(async () => {
  await fs.rm(workspaceDir, { recursive: true, force: true });
});

describe('encodeNestForFilename', () => {
  it('encodes a nest as a flat filename', () => {
    expect(encodeNestForFilename('chat/~zod/general')).toBe(
      'chat.~zod.general'
    );
  });

  it('rejects malformed nests', () => {
    expect(encodeNestForFilename('chat/~zod')).toBeNull();
    expect(encodeNestForFilename('chat/~zod/../escape')).toBeNull();
    expect(encodeNestForFilename('notes/~zod/book')).toBeNull();
  });
});

describe('selectMemoryFilePaths', () => {
  it('selects public and private person files for a DM', () => {
    expect(selectMemoryFilePaths('agent:main:tlon:direct:~nec')).toEqual([
      path.join('memory', 'person', '~nec.md'),
      path.join('memory', 'person', '~nec.private.md'),
    ]);
  });

  it('selects place plus the speaker public tier for a channel', () => {
    const sessionKey = 'agent:main:tlon:channel:chat/~zod/general';
    recordSpeakerForSession(sessionKey, '~nec');
    expect(selectMemoryFilePaths(sessionKey)).toEqual([
      path.join('memory', 'place', 'chat.~zod.general.md'),
      path.join('memory', 'person', '~nec.md'),
    ]);
  });

  it('never selects a private tier for a channel', () => {
    const sessionKey = 'agent:main:tlon:channel:chat/~zod/general';
    recordSpeakerForSession(sessionKey, '~nec');
    for (const selected of selectMemoryFilePaths(sessionKey)) {
      expect(selected).not.toContain('.private.');
    }
  });

  it('selects nothing for non-tlon sessions', () => {
    expect(selectMemoryFilePaths('agent:main:main')).toEqual([]);
    expect(selectMemoryFilePaths('agent:main:cron:job')).toEqual([]);
  });
});

describe('createMemoryBootstrapHandler', () => {
  it('appends existing files and skips missing ones', async () => {
    await writeMemoryFile(
      path.join('memory', 'person', '~nec.md'),
      '## Public\nGoes by Nec.'
    );
    const handler = createMemoryBootstrapHandler();
    const event = bootstrapEvent('agent:main:tlon:direct:~nec');
    await handler(event);
    const files = event.context.bootstrapFiles;
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      name: path.join('memory', 'person', '~nec.md'),
      content: '## Public\nGoes by Nec.',
      missing: false,
    });
  });

  it('loads the private tier only in that ship DM', async () => {
    await writeMemoryFile(
      path.join('memory', 'person', '~nec.md'),
      'public fact'
    );
    await writeMemoryFile(
      path.join('memory', 'person', '~nec.private.md'),
      'private fact'
    );
    await writeMemoryFile(
      path.join('memory', 'place', 'chat.~zod.general.md'),
      'room facts'
    );

    const handler = createMemoryBootstrapHandler();

    const dmEvent = bootstrapEvent('agent:main:tlon:direct:~nec');
    await handler(dmEvent);
    const dmContents = dmEvent.context.bootstrapFiles.map((f) => f.content);
    expect(dmContents).toContain('public fact');
    expect(dmContents).toContain('private fact');

    const channelKey = 'agent:main:tlon:channel:chat/~zod/general';
    recordSpeakerForSession(channelKey, '~nec');
    const channelEvent = bootstrapEvent(channelKey);
    await handler(channelEvent);
    const channelContents = channelEvent.context.bootstrapFiles.map(
      (f) => f.content
    );
    expect(channelContents).toContain('room facts');
    expect(channelContents).toContain('public fact');
    expect(channelContents).not.toContain('private fact');
  });

  it('inherits the channel surface for threads', async () => {
    await writeMemoryFile(
      path.join('memory', 'place', 'chat.~zod.general.md'),
      'room facts'
    );
    const handler = createMemoryBootstrapHandler();
    const event = bootstrapEvent(
      'agent:main:tlon:channel:chat/~zod/general:thread:170.141.184'
    );
    await handler(event);
    expect(event.context.bootstrapFiles.map((f) => f.content)).toContain(
      'room facts'
    );
  });

  it('does not duplicate files already present', async () => {
    await writeMemoryFile(
      path.join('memory', 'person', '~nec.md'),
      'public fact'
    );
    const handler = createMemoryBootstrapHandler();
    const event = bootstrapEvent('agent:main:tlon:direct:~nec');
    await handler(event);
    await handler(event);
    expect(event.context.bootstrapFiles).toHaveLength(1);
  });

  it('ignores empty files and non-bootstrap events', async () => {
    await writeMemoryFile(path.join('memory', 'person', '~nec.md'), '   \n');
    const handler = createMemoryBootstrapHandler();
    const event = bootstrapEvent('agent:main:tlon:direct:~nec');
    await handler(event);
    expect(event.context.bootstrapFiles).toHaveLength(0);

    const other = {
      type: 'message',
      action: 'received',
      context: event.context,
    };
    await expect(handler(other)).resolves.toBeUndefined();
  });
});
