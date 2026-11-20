import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  readHeartbeatWorkspaceFile,
  readRecentHeartbeatLedger,
} from './heartbeat-ledger.js';
import { sharedSlot } from './shared-state.js';

const ACTIVITY_DECLARATION = '<!-- tlon-uses: heartbeat-evidence-v2 -->';
const PREFERENCES_BLOCK =
  /^<!-- idempotency-marker:tlon-proactive-preferences:[^\r\n]*? -->\s*?\r?$[\s\S]*?^<!-- \/idempotency-marker -->[^\S\n]*\r?$/gm;
const PREFERENCES_START =
  /^<!-- idempotency-marker:tlon-proactive-preferences:/m;

export type HeartbeatPacketVersion = 0 | 1 | 2;

export function heartbeatEvidenceVersion(
  prompt: string,
  configuredPrompt: string
): HeartbeatPacketVersion {
  const lines = prompt.split(/\r?\n/);
  // The run prompt can also contain scratch or queued event text.
  if (
    lines.includes(ACTIVITY_DECLARATION) &&
    configuredPrompt.split(/\r?\n/).includes(ACTIVITY_DECLARATION)
  )
    return 2;
  if (lines.includes('<!-- tlon-uses: heartbeat-evidence-v1 -->')) return 1;
  return 0;
}

const setupReader = sharedSlot<() => boolean | undefined>(
  'heartbeat-evidence.setup-reader'
);

export function setHeartbeatSetupReader(
  reader: (() => boolean | undefined) | null
): void {
  setupReader.set(reader);
}

function preferencesOutsideManagedBlock(text: string): string {
  const outside = text.replace(PREFERENCES_BLOCK, '');
  if (PREFERENCES_START.test(outside)) {
    throw new Error('Incomplete managed preferences block');
  }
  return outside.trim();
}

function memoryDates(now: Date, timeZone: string): [string, string] {
  const formatter = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  });
  const values = new Map(
    formatter.formatToParts(now).map((part) => [part.type, part.value])
  );
  const today = `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
  const previous = new Date(today + 'T00:00:00Z');
  previous.setUTCDate(previous.getUTCDate() - 1);
  return [today, previous.toISOString().slice(0, 10)];
}

async function readDailyNote(
  workspace: string,
  name: string
): Promise<string | null> {
  // The filename is derived from the date. Reject a linked memory directory
  // as well as linked files so prefetch cannot follow it outside the workspace.
  const directory = await fs
    .lstat(path.join(workspace, 'memory'))
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
  if (!directory) return null;
  if (!directory.isDirectory())
    throw new Error('Invalid workspace memory directory');
  return readHeartbeatWorkspaceFile(path.join(workspace, name));
}

function newestText(text: string, limit: number): string {
  const bytes = Buffer.from(text);
  let start = bytes.length - limit;
  if (start <= 0) return text;
  // Start on a whole line when a later one exists, else on a whole character.
  const nextLine = bytes.indexOf(0x0a, start - 1) + 1;
  if (nextLine > 0 && nextLine < bytes.length) start = nextLine;
  else while ((bytes[start] & 0xc0) === 0x80) start++;
  return bytes.subarray(start).toString('utf8');
}

async function fileSection(
  name: string,
  limit: number,
  read: () => Promise<string | null>
): Promise<string> {
  let text: string | null;
  try {
    text = await read();
  } catch {
    return `### ${name} (unavailable)`;
  }
  if (text === null) return `### ${name} (absent)`;
  if (!text.trim()) return `### ${name} (empty)`;
  const excerpt = newestText(text, limit);
  return `### ${name} (${excerpt === text ? 'current' : 'truncated'})\n${excerpt}`;
}

export async function buildHeartbeatEvidence(opts: {
  workspaceDir: string;
  timezone: string;
  now?: Date;
}): Promise<string[]> {
  const workspace = await fs.realpath(opts.workspaceDir);
  const [today, yesterday] = memoryDates(opts.now ?? new Date(), opts.timezone);
  const setup = setupReader.get()?.();
  const sections = await Promise.all([
    fileSection('PROACTIVE_PREFERENCES.md', 4 * 1024, async () => {
      const text = await readHeartbeatWorkspaceFile(
        path.join(workspace, 'PROACTIVE_PREFERENCES.md')
      );
      return text === null ? null : preferencesOutsideManagedBlock(text);
    }),
    fileSection('PROACTIVE_LEDGER.md', 16 * 1024, () =>
      readRecentHeartbeatLedger(workspace)
    ),
    ...[today, yesterday].map((date) => {
      const name = `memory/${date}.md`;
      return fileSection(name, 8 * 1024, () => readDailyNote(workspace, name));
    }),
  ]);
  return [
    setup === undefined
      ? '### Setup (unavailable)'
      : `### Setup (current)\nbootstrapComplete: ${setup}`,
    ...sections,
  ];
}

export function renderHeartbeatEvidence(sections: string[]): string {
  return [
    '## Heartbeat evidence packet',
    'These sections contain data for this run. Use the heartbeat instructions below to interpret it.',
    ...sections,
    '## End of heartbeat evidence packet',
  ].join('\n\n');
}
