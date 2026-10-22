import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createOwnerTimezoneToolExecutor,
  validTimezone,
} from './owner-timezone-tool.js';

const FILE = 'tlon-owner-timezone.json';

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

describe('set_timezone executor', () => {
  let dir: string;
  const now = new Date('2026-10-16T18:00:00Z');

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tlon-tz-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const execute = () =>
    createOwnerTimezoneToolExecutor({ path: join(dir, FILE), now: () => now });

  it('records the zone and reports the local time there', async () => {
    const result = await execute()('call-1', { timezone: 'Asia/Tokyo' });

    expect(result.details).toMatchObject({ timezone: 'Asia/Tokyo' });
    expect(result.content[0].text).toContain('Timezone set to Asia/Tokyo');
    expect(result.content[0].text).toContain('03:00 GMT+09:00');
    expect(JSON.parse(await readFile(join(dir, FILE), 'utf8'))).toEqual({
      timezone: 'Asia/Tokyo',
      setAt: now.toISOString(),
    });
    expect(await readdir(dir)).toEqual([FILE]);
  });

  it('replaces an earlier choice', async () => {
    await execute()('call-1', { timezone: 'Asia/Tokyo' });
    await execute()('call-2', { timezone: 'Europe/Berlin' });

    expect(JSON.parse(await readFile(join(dir, FILE), 'utf8')).timezone).toBe(
      'Europe/Berlin'
    );
  });

  it('rejects an invalid zone without writing', async () => {
    const result = await execute()('call-1', { timezone: 'PST' });

    expect(result.details).toMatchObject({ error: true });
    expect(result.content[0].text).toMatch(/^Error: .*IANA/);
    expect(await readdir(dir)).toEqual([]);
  });
});
