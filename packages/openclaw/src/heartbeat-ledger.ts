import { constants, promises as fs } from 'node:fs';
import path from 'node:path';

import { enqueueKeyedTask } from 'openclaw/plugin-sdk/core';
import { z } from 'zod';

import { sharedMap } from './shared-state.js';
import { replaceWorkspaceFile } from './workspace-file.js';

export const HEARTBEAT_LEDGER_TOOL = 'tlon_heartbeat_ledger';
const LEDGER_NAME = 'PROACTIVE_LEDGER.md';
const END_MARKER = '<!-- ledger-end -->';
const ARCHIVE_NAME = /^PROACTIVE_LEDGER-\d{4}-(?:0[1-9]|1[0-2])\.md$/;
const ROTATE_ABOVE = 500;
const KEEP_RECORDS = 100;
const FILE_LIMIT = 8 * 1024 * 1024;
const LINE_LIMIT = 4 * 1024;
const SUBMISSION_LIMIT = 64 * 1024;
const outcomeSchema = z.enum(['selected', 'held', 'silenced']);
const inputSchema = z.object({
  sources: z.string(),
  candidates: z.array(
    z.object({
      outcome: outcomeSchema,
      what: z.string(),
      source: z.string(),
      why: z.string(),
    })
  ),
  delivered: z.array(z.string()).optional(),
});

export const heartbeatLedgerToolDefinition = {
  name: HEARTBEAT_LEDGER_TOOL,
  label: 'Record heartbeat decisions',
  description:
    'Record what the scheduled heartbeat checked, its candidate decisions, and any earlier deliveries confirmed in the owner DM. The ledger renders pipes inside fields as ¦ to preserve columns. Each rendered line is limited to 4 KiB and the batch to 64 KiB.',
  parameters: z.toJSONSchema(inputSchema, { target: 'draft-07' }),
};

export type HeartbeatLedgerReceipt = {
  selected: number;
  held: number;
  silenced: number;
  confirmedDeliveries: number;
  liveRecords: number;
  rotated: boolean;
};

type Counts = Omit<HeartbeatLedgerReceipt, 'liveRecords' | 'rotated'>;

export type HeartbeatLedgerRun = {
  receipt?: HeartbeatLedgerReceipt;
  // An append can succeed even when the ensuing archive or trim fails.
  appended?: { counts: Counts; rotated: boolean };
};

export class HeartbeatLedgerError extends Error {}
export class HeartbeatLedgerInputError extends Error {}

function field(value: string): string {
  if (value.includes(END_MARKER)) {
    throw new HeartbeatLedgerInputError(
      'Ledger fields cannot contain the end marker.'
    );
  }
  // Keep fields in their original columns, including when source text has pipes.
  return value.replace(/[\r\n\u2028\u2029]+/gu, ' ').replaceAll('|', '¦');
}

function formatSubmission(params: unknown, timestamp: string) {
  const input = inputSchema.safeParse(params);
  if (!input.success) {
    throw new HeartbeatLedgerInputError('Invalid heartbeat ledger submission.');
  }
  const { sources, candidates, delivered = [] } = input.data;
  const counts: Counts = {
    selected: 0,
    held: 0,
    silenced: 0,
    confirmedDeliveries: delivered.length,
  };
  const lines = [
    `${timestamp} | run | ${field(sources)} | ${candidates.length}`,
  ];
  for (const what of delivered) {
    lines.push(`${timestamp} | delivered | ${field(what)}`);
  }
  for (const candidate of candidates) {
    counts[candidate.outcome]++;
    lines.push(
      `${timestamp} | ${candidate.outcome} | ${field(candidate.what)} | ${field(candidate.source)} | ${field(candidate.why)}`
    );
  }
  if (counts.selected > 1) {
    throw new HeartbeatLedgerInputError(
      'At most one candidate can be selected.'
    );
  }
  let size = 0;
  for (const line of lines) {
    const bytes = Buffer.byteLength(line);
    size += bytes + 1;
    if (bytes > LINE_LIMIT || size > SUBMISSION_LIMIT) {
      throw new HeartbeatLedgerInputError(
        'Heartbeat ledger submission exceeds its byte limit.'
      );
    }
  }
  return { lines, counts };
}

async function readLedgerFile(file: string): Promise<string> {
  const handle = await fs
    .open(
      file,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
    )
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
  if (!handle) return '';
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1) {
      throw new HeartbeatLedgerError(
        'Ledger paths must be singly linked regular files.'
      );
    }
    if (stat.size > FILE_LIMIT) {
      throw new HeartbeatLedgerError('Ledger file exceeds 8 MiB.');
    }
    // Read one extra byte so growth after stat cannot look like a complete file.
    const buffer = Buffer.alloc(stat.size + 1);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        size,
        buffer.length - size,
        null
      );
      if (bytesRead === 0) break;
      size += bytesRead;
    }
    if (size > stat.size) {
      throw new HeartbeatLedgerError(
        'Ledger file grew while it was being read.'
      );
    }
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      buffer.subarray(0, size)
    );
  } finally {
    await handle.close();
  }
}

function records(text: string): string[] {
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

function liveText(lines: readonly string[]): string {
  return [...lines, END_MARKER, ''].join('\n');
}

function checkSize(text: string): string {
  if (Buffer.byteLength(text) > FILE_LIMIT) {
    throw new HeartbeatLedgerError('Ledger file would exceed 8 MiB.');
  }
  return text;
}

/** Longest prefix of the move batch that is already a suffix of the archive. */
function archivedPrefix(archive: string[], moving: string[]): number {
  const fallback = new Uint32Array(moving.length);
  for (let i = 1, length = 0; i < moving.length; i++) {
    while (length > 0 && moving[i] !== moving[length])
      length = fallback[length - 1];
    if (moving[i] === moving[length]) length++;
    fallback[i] = length;
  }
  let length = 0;
  for (const line of archive.slice(-moving.length)) {
    while (length > 0 && line !== moving[length]) length = fallback[length - 1];
    if (line === moving[length]) length++;
  }
  return length;
}

function localMonth(date: Date, timezone?: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: '2-digit',
    timeZone: timezone,
  }).formatToParts(date);
  return `${parts.find((p) => p.type === 'year')?.value}-${parts.find((p) => p.type === 'month')?.value}`;
}

type Replacement = { file: string; text: string };

async function planRotation(
  workspace: string,
  live: string,
  lines: string[],
  month: string,
  plannedArchives: Map<string, string>
): Promise<Replacement[]> {
  const moving = lines.slice(0, -KEEP_RECORDS);
  const names = (await fs.readdir(workspace)).filter((name) =>
    ARCHIVE_NAME.test(name)
  );
  const newest = [...names, ...plannedArchives.keys()].sort().at(-1);
  const readArchive = (name: string) =>
    plannedArchives.get(name) ?? readLedgerFile(path.join(workspace, name));
  const newestText = newest ? await readArchive(newest) : '';
  const copied = archivedPrefix(records(newestText), moving);
  const name = copied && newest ? newest : `PROACTIVE_LEDGER-${month}.md`;
  const writes: Replacement[] = [];
  if (copied < moving.length) {
    const original = name === newest ? newestText : await readArchive(name);
    const separator = original && !original.endsWith('\n') ? '\n' : '';
    const text = checkSize(
      original + separator + moving.slice(copied).join('\n') + '\n'
    );
    plannedArchives.set(name, text);
    writes.push({ file: path.join(workspace, name), text });
  }
  writes.push({ file: live, text: liveText(lines.slice(-KEEP_RECORDS)) });
  return writes;
}

const workspaceWrites = sharedMap<string, Promise<void>>(
  'heartbeat-ledger-writes'
);

export async function recordHeartbeatLedger(opts: {
  workspaceDir: string;
  run: HeartbeatLedgerRun;
  params: unknown;
  timezone?: string;
  now?: Date;
  onRecorded?: (receipt: HeartbeatLedgerReceipt) => void;
}): Promise<HeartbeatLedgerReceipt> {
  if (opts.run.receipt) return opts.run.receipt;
  const workspace = await fs.realpath(opts.workspaceDir);
  return enqueueKeyedTask({
    tails: workspaceWrites,
    key: workspace,
    task: async () => {
      if (opts.run.receipt) return opts.run.receipt;
      const now = opts.now ?? new Date();
      const submission = opts.run.appended
        ? undefined
        : formatSubmission(opts.params, now.toISOString());
      const live = path.join(workspace, LEDGER_NAME);
      const lines = records(await readLedgerFile(live)).filter(
        (line) => line !== END_MARKER
      );
      const month = localMonth(now, opts.timezone);
      const archives = new Map<string, string>();
      const before =
        lines.length > ROTATE_ABOVE
          ? await planRotation(workspace, live, lines, month, archives)
          : [];
      const retained = before.length ? lines.slice(-KEEP_RECORDS) : lines;
      const next = submission ? [...retained, ...submission.lines] : retained;
      const appendedText = submission ? checkSize(liveText(next)) : undefined;
      const after =
        next.length > ROTATE_ABOVE
          ? await planRotation(workspace, live, next, month, archives)
          : [];

      // Preflight both rotations so a cap or unsafe path cannot leave a partial write.
      for (const replacement of before) {
        await replaceWorkspaceFile(replacement.file, replacement.text, 0o600);
      }
      if (submission && appendedText !== undefined) {
        await replaceWorkspaceFile(live, appendedText, 0o600);
        opts.run.appended = {
          counts: submission.counts,
          rotated: before.length > 0 || after.length > 0,
        };
      }
      for (const replacement of after) {
        await replaceWorkspaceFile(replacement.file, replacement.text, 0o600);
      }
      const appended = opts.run.appended!;
      const receipt = {
        ...appended.counts,
        liveRecords: after.length ? KEEP_RECORDS : next.length,
        rotated: appended.rotated,
      };
      opts.run.receipt = receipt;
      opts.onRecorded?.(receipt);
      return receipt;
    },
  });
}
