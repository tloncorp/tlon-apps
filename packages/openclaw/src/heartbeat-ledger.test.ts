import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type HeartbeatLedgerRun,
  recordHeartbeatLedger,
} from './heartbeat-ledger.js';
import * as workspaceFile from './workspace-file.js';

const marker = '<!-- ledger-end -->';
const november = new Date('2026-12-01T01:00:00Z');
const december = new Date('2026-12-01T09:00:00Z');
const silent = { sources: 'memory', candidates: [] };

function numberedRecords(count: number, padding = '') {
  return Array.from({ length: count }, (_, i) => `prior ${i} ${padding}`);
}

describe('heartbeat ledger', () => {
  let workspaceDir: string;
  let live: string;
  let archive: string;
  beforeEach(async () => {
    workspaceDir = await fs.realpath(
      await fs.mkdtemp(path.join(tmpdir(), 'heartbeat-ledger-'))
    );
    live = path.join(workspaceDir, 'PROACTIVE_LEDGER.md');
    archive = path.join(workspaceDir, 'PROACTIVE_LEDGER-2026-11.md');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(workspaceDir, { recursive: true, force: true });
  });

  const read = (file: string) => fs.readFile(file, 'utf8');
  const submit = (
    options: Partial<Parameters<typeof recordHeartbeatLedger>[0]> = {}
  ) =>
    recordHeartbeatLedger({
      workspaceDir,
      run: {},
      params: silent,
      now: november,
      timezone: 'America/New_York',
      ...options,
    });
  const seed = (lines: string[]) =>
    fs.writeFile(live, [...lines, marker, ''].join('\n'));

  it('repairs a missing marker and records confirmations independently of candidates', async () => {
    await fs.writeFile(live, '2026-11-30T15:00:00Z | delivered | earlier');
    const onRecorded = vi.fn();
    const receipt = await submit({
      params: {
        sources: 'memory\nand DM',
        delivered: ['previously selected'],
        candidates: [
          {
            outcome: 'selected',
            what: 'deadline | renewal',
            source: 'DM',
            why: 'tomorrow',
          },
          {
            outcome: 'silenced',
            what: 'irrelevant',
            source: 'notes',
            why: 'excluded',
          },
        ],
      },
      onRecorded,
    });
    expect(await read(live)).toBe(
      [
        '2026-11-30T15:00:00Z | delivered | earlier',
        `${november.toISOString()} | run | memory and DM | 2`,
        `${november.toISOString()} | delivered | previously selected`,
        `${november.toISOString()} | selected | deadline ¦ renewal | DM | tomorrow`,
        `${november.toISOString()} | silenced | irrelevant | notes | excluded`,
        marker,
        '',
      ].join('\n')
    );
    expect(receipt).toEqual({
      selected: 1,
      silenced: 1,
      held: 0,
      confirmedDeliveries: 1,
      liveRecords: 5,
      rotated: false,
    });
    expect(onRecorded).toHaveBeenCalledOnce();
    expect(onRecorded).toHaveBeenCalledWith(receipt);
  });

  it('refuses to overwrite a ledger that grows after stat', async () => {
    await fs.writeFile(live, 'previous record\n');
    const open = fs.open.bind(fs);
    vi.spyOn(fs, 'open').mockImplementationOnce(async (...args) => {
      const handle = await open(...args);
      const stat = handle.stat.bind(handle);
      vi.spyOn(handle, 'stat').mockImplementationOnce(async () => {
        const info = await stat();
        await fs.appendFile(live, 'concurrent record\n');
        return info;
      });
      return handle;
    });
    await expect(submit()).rejects.toThrow('grew while it was being read');
    expect(await read(live)).toBe('previous record\nconcurrent record\n');
  });

  it('rotates at 501, preserving duplicate records and archives over 64 KiB', async () => {
    const large = 'x'.repeat(160);
    const original = numberedRecords(497, large);
    original.splice(100, 0, original[0], original[0]);
    await seed(original);
    const archiveContents = numberedRecords(499, large).join('\n') + '\n';
    await fs.writeFile(archive, archiveContents);
    await expect(submit()).resolves.toMatchObject({
      liveRecords: 500,
      rotated: false,
    });
    expect(await read(archive)).toBe(archiveContents);
    await expect(submit()).resolves.toMatchObject({
      liveRecords: 100,
      rotated: true,
    });
    expect(await read(archive)).toBe(
      archiveContents + original.slice(0, 401).join('\n') + '\n'
    );
    expect((await read(live)).split('\n').slice(0, 98)).toEqual(
      original.slice(401)
    );
    expect((await read(live)).match(/\| run \| memory \| 0/g)).toHaveLength(2);
  });

  it('trims a 959-record ledger before appending and resumes a partial archive copy', async () => {
    const original = numberedRecords(959, 'x'.repeat(240));
    await seed(original);
    await fs.writeFile(
      archive,
      'existing\n' + original.slice(0, 143).join('\n') + '\n'
    );
    await expect(submit()).resolves.toMatchObject({
      liveRecords: 101,
      rotated: true,
    });
    expect(await read(archive)).toBe(
      'existing\n' + original.slice(0, 859).join('\n') + '\n'
    );
    expect((await read(live)).split('\n').slice(0, 100)).toEqual(
      original.slice(859)
    );
  });

  it.each([false, true])(
    'recovers across a month boundary with archive copied: %s',
    async (copied) => {
      const original = numberedRecords(500);
      await seed(original);
      const replace = workspaceFile.replaceWorkspaceFile;
      vi.spyOn(workspaceFile, 'replaceWorkspaceFile').mockImplementation(
        async (file, text, newMode) => {
          if (
            (!copied && file === archive) ||
            (copied && file === live && !text.startsWith(original[0]))
          ) {
            throw new Error('interrupted');
          }
          await replace(file, text, newMode);
        }
      );
      await expect(submit()).rejects.toThrow('interrupted');
      expect((await read(live)).split('\n').slice(0, 500)).toEqual(original);
      expect(await read(live)).toContain(
        `${november.toISOString()} | run | memory | 0`
      );
      vi.restoreAllMocks();
      await expect(submit({ now: december })).resolves.toMatchObject({
        liveRecords: 101,
        rotated: true,
      });
      const decemberArchive = path.join(
        workspaceDir,
        'PROACTIVE_LEDGER-2026-12.md'
      );
      const target = copied ? archive : decemberArchive;
      expect(await read(target)).toBe(original.slice(0, 401).join('\n') + '\n');
      await expect(
        fs.stat(copied ? decemberArchive : archive)
      ).rejects.toMatchObject({ code: 'ENOENT' });
    }
  );

  it('retries an interrupted trim in the same run without appending again', async () => {
    const run: HeartbeatLedgerRun = {};
    const onRecorded = vi.fn();
    await seed(numberedRecords(500));
    const replace = workspaceFile.replaceWorkspaceFile;
    vi.spyOn(workspaceFile, 'replaceWorkspaceFile').mockImplementation(
      async (file, text, newMode) => {
        if (file === archive) throw new Error('interrupted');
        await replace(file, text, newMode);
      }
    );
    await expect(submit({ run, onRecorded })).rejects.toThrow('interrupted');
    expect(onRecorded).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    await expect(submit({ run, onRecorded })).resolves.toMatchObject({
      liveRecords: 100,
    });
    expect((await read(live)).match(/\| run \| memory \| 0/g)).toHaveLength(1);
    expect(onRecorded).toHaveBeenCalledOnce();
  });

  it('allows corrected input and serializes overlapping submissions from the same run', async () => {
    const run: HeartbeatLedgerRun = {};
    const onRecorded = vi.fn();
    const selected = {
      outcome: 'selected',
      what: 'x',
      source: 'DM',
      why: 'due',
    };
    for (const params of [
      { ...silent, candidates: [selected, selected] },
      { ...silent, sources: marker },
      { ...silent, sources: 'x'.repeat(4096) },
      { ...silent, delivered: Array(64).fill('x'.repeat(1024)) },
    ]) {
      await expect(submit({ run, params, onRecorded })).rejects.toThrow();
      await expect(fs.stat(live)).rejects.toMatchObject({ code: 'ENOENT' });
    }
    const opts = { run, onRecorded };
    const [first, second] = await Promise.all([
      submit(opts),
      submit({ ...opts, params: { ...silent, sources: 'changed' } }),
    ]);
    expect(second).toEqual(first);
    expect(onRecorded).toHaveBeenCalledOnce();
    expect((await read(live)).split('\n')).toHaveLength(3);
  });

  it.each(['symlink', 'hard link', 'directory', 'over cap'])(
    'preserves the live ledger when the archive is a %s',
    async (kind) => {
      await seed(numberedRecords(500));
      const original = await read(live);
      const target = path.join(workspaceDir, 'original.md');
      await fs.writeFile(target, 'private');
      switch (kind) {
        case 'symlink':
          await fs.symlink(target, archive);
          break;
        case 'hard link':
          await fs.link(target, archive);
          break;
        case 'directory':
          await fs.mkdir(archive);
          break;
        case 'over cap': {
          const file = await fs.open(archive, 'wx');
          await file.truncate(8 * 1024 * 1024 + 1);
          await file.close();
          break;
        }
      }
      await expect(submit()).rejects.toThrow();
      expect(await read(live)).toBe(original);
      expect(await read(target)).toBe('private');
    }
  );
});
