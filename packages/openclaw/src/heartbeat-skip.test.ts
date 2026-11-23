import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  decideHeartbeatSkip,
  getHeartbeatTick,
  HEARTBEAT_SKIP_MAX_MS,
  heartbeatFilesKey,
  type HeartbeatLastRun,
  heartbeatSkipRequested,
  isPlainHeartbeatTick,
  noteHeartbeatTick,
  _testing,
} from './heartbeat-skip.js';

const HOUR = 60 * 60 * 1000;
const quietRun: HeartbeatLastRun = {
  checkedAt: 1_000,
  endedAt: 2_000,
  quiet: true,
  filesKey: 'files',
  activityKey: 'activity',
  skippedTicks: 0,
};
const unchanged = {
  lastRun: quietRun,
  now: quietRun.endedAt + HOUR,
  ownerMessageAt: 0,
  filesKey: 'files',
  activityKey: 'activity',
};

describe('heartbeat skip decision', () => {
  it('skips when the last run was quiet and nothing it watches changed', () => {
    expect(decideHeartbeatSkip(unchanged)).toEqual({
      skip: true,
      sinceLastRunMs: HOUR,
    });
  });

  it.each([
    ['no_previous_run', { lastRun: undefined }],
    ['previous_run_not_quiet', { lastRun: { ...quietRun, quiet: false } }],
    ['max_interval', { now: quietRun.endedAt + HEARTBEAT_SKIP_MAX_MS }],
    // A clock that moved backwards proves nothing about elapsed time.
    ['max_interval', { now: quietRun.endedAt - 1 }],
    ['owner_message_unknown', { ownerMessageAt: undefined }],
    // Sent while the last run was reading or working.
    ['owner_message', { ownerMessageAt: quietRun.checkedAt }],
    ['owner_message', { ownerMessageAt: quietRun.endedAt + 1 }],
    ['files_changed', { filesKey: 'other' }],
    ['files_unknown', { filesKey: undefined }],
    ['files_unknown', { lastRun: { ...quietRun, filesKey: undefined } }],
    ['activity_changed', { activityKey: 'other' }],
    ['activity_unknown', { activityKey: undefined }],
    ['activity_unknown', { lastRun: { ...quietRun, activityKey: undefined } }],
  ] as const)('runs with %s', (blockedBy, change) => {
    expect(decideHeartbeatSkip({ ...unchanged, ...change })).toEqual({
      skip: false,
      blockedBy,
    });
  });

  it('skips when the owner last wrote before the last run began', () => {
    expect(
      decideHeartbeatSkip({
        ...unchanged,
        ownerMessageAt: quietRun.checkedAt - 1,
      }).skip
    ).toBe(true);
  });

  it('still skips just under the limit', () => {
    expect(
      decideHeartbeatSkip({
        ...unchanged,
        now: quietRun.endedAt + HEARTBEAT_SKIP_MAX_MS - 1,
      }).skip
    ).toBe(true);
  });
});

describe('plain heartbeat tick', () => {
  const prompt =
    '# Heartbeat\n<!-- tlon-uses: heartbeat-skip-v1 -->\n\nDo the work.\n';
  const time =
    'Current time: Friday, November 20th, 2026 - 10:00 AM (America/New_York)\nReference UTC: 2026-11-20 15:00 UTC';

  it('recognises the opt-in line only on a line of its own', () => {
    expect(heartbeatSkipRequested(prompt)).toBe(true);
    expect(
      heartbeatSkipRequested('see <!-- tlon-uses: heartbeat-skip-v1 --> here')
    ).toBe(false);
  });

  it('matches the configured prompt with or without the time block', () => {
    expect(isPlainHeartbeatTick(prompt.trimEnd(), prompt)).toBe(true);
    expect(isPlainHeartbeatTick(`${prompt.trimEnd()}\n${time}`, prompt)).toBe(
      true
    );
  });

  it.each([
    [
      'monitor scratch',
      `${prompt}\nHeartbeat monitor scratch:\ncheck x\n${time}`,
    ],
    ['a queued event', `System: a command finished\n\n${prompt}\n${time}`],
    ['a prompt core built itself', `A scheduled reminder fired.\n${time}`],
    ['text after the time block', `${prompt.trimEnd()}\n${time}\nmore`],
  ])('does not match %s', (_name, body) => {
    expect(isPlainHeartbeatTick(body, prompt)).toBe(false);
  });

  it('never matches an empty configured prompt', () => {
    expect(isPlainHeartbeatTick('', '')).toBe(false);
  });
});

describe('heartbeat files key', () => {
  let workspaceDir: string;
  const now = new Date('2026-12-01T01:00:00Z');
  const key = () =>
    heartbeatFilesKey({ workspaceDir, now, timezone: 'America/Chicago' });

  beforeEach(async () => {
    workspaceDir = await fs.mkdtemp(path.join(tmpdir(), 'heartbeat-skip-'));
    await fs.mkdir(path.join(workspaceDir, 'memory'));
  });

  afterEach(async () => {
    await fs.rm(workspaceDir, { recursive: true, force: true });
  });

  it('changes when a watched file changes and not otherwise', async () => {
    const empty = await key();
    expect(await key()).toBe(empty);
    await fs.writeFile(path.join(workspaceDir, 'memory/2026-11-28.md'), 'old');
    await fs.writeFile(path.join(workspaceDir, 'PROACTIVE_LEDGER.md'), 'x');
    expect(await key()).toBe(empty);

    const seen = new Set([empty]);
    for (const name of [
      'PROACTIVE_PREFERENCES.md',
      'MEMORY.md',
      'memory/2026-11-30.md',
      'memory/2026-11-29.md',
    ]) {
      await fs.writeFile(path.join(workspaceDir, name), `note in ${name}`);
      const next = await key();
      expect(seen.has(next)).toBe(false);
      seen.add(next);
    }
  });

  it('fails instead of following a linked memory directory', async () => {
    const outside = await fs.mkdtemp(path.join(tmpdir(), 'heartbeat-out-'));
    try {
      await fs.rm(path.join(workspaceDir, 'memory'), { recursive: true });
      await fs.symlink(outside, path.join(workspaceDir, 'memory'));
      await expect(key()).rejects.toThrow();
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it('fails instead of following a linked file', async () => {
    const outside = path.join(workspaceDir, 'outside.md');
    await fs.writeFile(outside, 'private');
    await fs.symlink(outside, path.join(workspaceDir, 'MEMORY.md'));
    await expect(key()).rejects.toThrow();
  });
});

describe('heartbeat ticks', () => {
  afterEach(() => _testing.clearAll());

  it('keeps only the newest ticks', () => {
    for (let i = 0; i < 20; i++) {
      noteHeartbeatTick(`run-${i}`, {
        blockedBy: 'no_previous_run',
        skippedTicksBefore: 0,
      });
    }
    expect(getHeartbeatTick('run-0')).toBeUndefined();
    expect(getHeartbeatTick('run-19')).toBeDefined();
  });
});
