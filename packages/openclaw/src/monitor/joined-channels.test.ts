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

  it('becomes unknown again when a sync has no snapshot', () => {
    const joined = known(general);
    joined.applySync(joined.beginSync(), null);
    expect(joined.isKnownNotJoined(random)).toBe(false);
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
