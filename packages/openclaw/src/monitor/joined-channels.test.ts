import { describe, expect, it } from 'vitest';

import { createJoinedChannels } from './joined-channels.js';

const general = 'chat/~zod/general';
const random = 'chat/~zod/random';
// Literal `%channels` `/v4` response shapes (desk/lib/channel-json.hoon).
const join = (nest: string) => ({ nest, response: { join: '~zod/test' } });
const create = (nest: string) => ({
  nest,
  response: { create: { group: '~zod/test', writers: [] } },
});
const leave = (nest: string) => ({ nest, response: { leave: null } });

const known = (...nests: string[]) => {
  const joined = createJoinedChannels();
  joined.applySync(joined.beginSync(), new Set(nests));
  return joined;
};

describe('joined channels transitions', () => {
  it('reports a join only when the nest was absent', () => {
    const joined = known();
    expect(joined.observe(join(general))).toBe('became-joined');
    // %channels re-sends %join for an already-joined channel.
    expect(joined.observe(join(general))).toBeNull();
    expect(joined.observe(create(general))).toBeNull();
    expect(joined.observe(create(random))).toBe('became-joined');
    expect(joined.isKnownNotJoined(general)).toBe(false);
    expect(joined.isKnownNotJoined(random)).toBe(false);
  });

  it('reports a leave and marks the nest not joined', () => {
    const joined = known(general);
    expect(joined.observe(leave(general))).toBe('left');
    expect(joined.isKnownNotJoined(general)).toBe(true);
    expect(joined.observe(join(general))).toBe('became-joined');
    expect(joined.isKnownNotJoined(general)).toBe(false);
  });

  it('ignores events that are not membership facts', () => {
    const joined = known();
    expect(
      joined.observe({ nest: general, response: { post: { id: '1' } } })
    ).toBeNull();
    expect(joined.observe({ nest: general, response: undefined })).toBeNull();
    expect(joined.isKnownNotJoined(general)).toBe(true);
  });
});

describe('joined channels while unknown', () => {
  it('suppresses nothing, and a join does not make it known', () => {
    const joined = createJoinedChannels();
    expect(joined.isKnownNotJoined(general)).toBe(false);
    expect(joined.observe(join(general))).toBe('became-joined');
    expect(joined.isKnownNotJoined(random)).toBe(false);
    expect(joined.observe(leave(general))).toBe('left');
    expect(joined.isKnownNotJoined(general)).toBe(false);
  });
});

describe('joined channels after a failed fetch', () => {
  it('keeps the set and a left nest stays not joined', () => {
    const joined = known(general, random);
    joined.observe(leave(random));
    joined.applySync(joined.beginSync(), null);
    expect(joined.isKnownNotJoined(general)).toBe(false);
    expect(joined.isKnownNotJoined(random)).toBe(true);
    expect(joined.isKnownNotJoined('chat/~zod/other')).toBe(true);
  });

  it('stays unknown when it never had a snapshot', () => {
    const joined = createJoinedChannels();
    joined.applySync(joined.beginSync(), null);
    expect(joined.isKnownNotJoined(general)).toBe(false);
  });
});

describe('joined channels recently joined', () => {
  const clock = (start = 1_000_000) => {
    const time = { now: start };
    return { time, now: () => time.now };
  };
  const knownAt = (now: () => number, ...nests: string[]) => {
    const joined = createJoinedChannels({ now });
    joined.applySync(joined.beginSync(), new Set(nests));
    return joined;
  };

  it('records a join fact', () => {
    const { now } = clock();
    const joined = knownAt(now);
    joined.observe(join(general));
    joined.observe(create(random));
    expect(joined.recentlyJoined(60_000)).toEqual([general, random]);
  });

  it('records a nest that first appears in a snapshot', () => {
    const { now } = clock();
    const joined = knownAt(now, general);
    // The join fact was missed; only the next snapshot shows it.
    joined.applySync(joined.beginSync(), new Set([general, random]));
    expect(joined.recentlyJoined(60_000)).toEqual([random]);
  });

  it('does not count the first snapshot as joins', () => {
    const { now } = clock();
    expect(knownAt(now, general).recentlyJoined(60_000)).toEqual([]);
  });

  it('drops a nest once it leaves', () => {
    const { now } = clock();
    const joined = knownAt(now);
    joined.observe(join(general));
    joined.observe(join(random));
    joined.observe(leave(general));
    // Gone from the snapshot too.
    joined.applySync(joined.beginSync(), new Set());
    expect(joined.recentlyJoined(60_000)).toEqual([]);
  });

  it('forgets joins older than the window', () => {
    const { time, now } = clock();
    const joined = knownAt(now);
    joined.observe(join(general));
    time.now += 30_000;
    joined.observe(join(random));
    time.now += 40_000;
    expect(joined.recentlyJoined(60_000)).toEqual([random]);
    // Pruned, so a wider window no longer finds it.
    expect(joined.recentlyJoined(600_000)).toEqual([random]);
  });
});

describe('joined channels sync ordering', () => {
  it('keeps a join and a leave that overtook the snapshot', () => {
    const joined = known(general);
    const token = joined.beginSync();
    joined.observe(join(random));
    joined.observe(leave(general));
    // Fetched before both facts.
    joined.applySync(token, new Set([general]));
    expect(joined.isKnownNotJoined(random)).toBe(false);
    expect(joined.isKnownNotJoined(general)).toBe(true);
  });

  it('does not replay facts from before the sync began', () => {
    const joined = known(general);
    joined.observe(leave(general));
    const token = joined.beginSync();
    // The ship rejoined before this fetch; its join fact was missed.
    joined.applySync(token, new Set([general]));
    expect(joined.isKnownNotJoined(general)).toBe(false);
  });

  it('ignores an older snapshot that lands after a newer one', () => {
    const joined = createJoinedChannels();
    const older = joined.beginSync();
    const newer = joined.beginSync();
    joined.applySync(newer, new Set([general]));
    joined.applySync(older, new Set([random]));
    expect(joined.isKnownNotJoined(general)).toBe(false);
    expect(joined.isKnownNotJoined(random)).toBe(true);
  });

  it('replays facts for a sync still in flight when an older one lands', () => {
    const joined = createJoinedChannels();
    const older = joined.beginSync();
    const newer = joined.beginSync();
    joined.observe(leave(general));
    joined.applySync(older, new Set([general]));
    expect(joined.isKnownNotJoined(general)).toBe(true);
    joined.applySync(newer, new Set([general]));
    expect(joined.isKnownNotJoined(general)).toBe(true);
  });
});
