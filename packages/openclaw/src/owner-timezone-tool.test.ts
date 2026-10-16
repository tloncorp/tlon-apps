import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  OWNER_TIMEZONE_FILE,
  validTimezone,
  createOwnerTimezoneToolExecutor,
  ownerTimezonePath,
} from './owner-timezone-tool.js';

describe('validTimezone', () => {
  it.each([
    ['Asia/Tokyo', 'Asia/Tokyo'],
    ['  Europe/Berlin ', 'Europe/Berlin'],
    ['America/Argentina/Buenos_Aires', 'America/Argentina/Buenos_Aires'],
    ['Asia/Kolkata', 'Asia/Kolkata'],
    ['UTC', 'UTC'],
  ])('accepts %j', (input, expected) => {
    expect(validTimezone(input)).toBe(expected);
  });

  it.each(['PST', 'EST', '+09:00', 'GMT+9', 'Tokyo', '', 'Mars/Olympus_Mons'])(
    'rejects %j',
    (input) => {
      expect(() => validTimezone(input)).toThrow();
    }
  );
});

describe('ownerTimezonePath', () => {
  it('lives in the state dir, which tlawn reads it from', () => {
    expect(ownerTimezonePath({ OPENCLAW_STATE_DIR: '/pier/.openclaw' })).toBe(
      `/pier/.openclaw/${OWNER_TIMEZONE_FILE}`
    );
  });

  it('is null without a state dir', () => {
    expect(ownerTimezonePath({})).toBeNull();
  });
});

describe('set_timezone executor', () => {
  let dir: string;
  const now = new Date('2026-10-16T18:00:00Z');

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tlon-tz-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const execute = (path: string | null = join(dir, OWNER_TIMEZONE_FILE)) =>
    createOwnerTimezoneToolExecutor({ path: () => path, now: () => now });

  it('records the zone and reports the local time there', async () => {
    const result = await execute()('call-1', { timezone: 'Asia/Tokyo' });

    expect(result.details).toEqual({ timezone: 'Asia/Tokyo' });
    expect(result.content[0].text).toContain('Timezone set to Asia/Tokyo');
    expect(result.content[0].text).toContain('03:00 GMT+09:00');
    expect(
      JSON.parse(await readFile(join(dir, OWNER_TIMEZONE_FILE), 'utf8'))
    ).toEqual({ timezone: 'Asia/Tokyo', setAt: now.toISOString() });
    expect(await readdir(dir)).toEqual([OWNER_TIMEZONE_FILE]);
  });

  it('replaces an earlier choice', async () => {
    await execute()('call-1', { timezone: 'Asia/Tokyo' });
    await execute()('call-2', { timezone: 'Europe/Berlin' });

    expect(
      JSON.parse(await readFile(join(dir, OWNER_TIMEZONE_FILE), 'utf8'))
        .timezone
    ).toBe('Europe/Berlin');
  });

  it('rejects an invalid zone without writing', async () => {
    const result = await execute()('call-1', { timezone: 'PST' });

    expect(result.details).toEqual({ error: true });
    expect(result.content[0].text).toMatch(/^Error: .*IANA/);
    expect(await readdir(dir)).toEqual([]);
  });

  it('errors when there is nowhere to save the zone', async () => {
    const result = await execute(null)('call-1', { timezone: 'Asia/Tokyo' });

    expect(result.details).toEqual({ error: true });
  });
});
