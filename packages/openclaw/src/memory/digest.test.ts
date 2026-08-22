import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearDigestStateForTest,
  recordDigestMessage,
  renderGroupDigestForChannel,
} from './digest.js';
import { clearGroupIndexForTest, updateGroupIndex } from './group-index.js';

const GROUP = '~zod/tlon-core';
const GENERAL = 'chat/~zod/general';
const DEV = 'chat/~zod/dev';
const HIRING = 'chat/~zod/hiring';

function indexGroup(overrides?: { hiringReaders?: string[] }) {
  updateGroupIndex({
    channelToGroup: new Map([
      [GENERAL, GROUP],
      [DEV, GROUP],
      [HIRING, GROUP],
    ]),
    channelReaders: new Map([
      [GENERAL, []],
      [DEV, []],
      [HIRING, overrides?.hiringReaders ?? ['admin']],
    ]),
    channelNames: new Map([
      [GENERAL, 'general'],
      [DEV, 'dev'],
      [HIRING, 'hiring'],
    ]),
    groupNames: new Map([[GROUP, 'Tlon Core']]),
  });
}

beforeEach(() => {
  clearGroupIndexForTest();
  clearDigestStateForTest();
});

describe('renderGroupDigestForChannel', () => {
  it('renders sibling activity with counts and the latest snippet', () => {
    indexGroup();
    recordDigestMessage({ nest: DEV, sender: '~nec', text: 'CI is red' });
    recordDigestMessage({ nest: DEV, sender: '~bus', text: 'looking now' });
    const digest = renderGroupDigestForChannel(GENERAL);
    expect(digest).not.toBeNull();
    expect(digest!.groupFlag).toBe(GROUP);
    expect(digest!.content).toContain('Tlon Core');
    expect(digest!.content).toContain('#dev — 2 msgs from 2 ships');
    expect(digest!.content).toContain('looking now');
  });

  it('omits restricted siblings entirely — no topic, no name', () => {
    indexGroup();
    recordDigestMessage({
      nest: HIRING,
      sender: '~zod',
      text: 'discussing offers',
    });
    const digest = renderGroupDigestForChannel(GENERAL);
    expect(digest).not.toBeNull();
    expect(digest!.content).not.toContain('hiring');
    expect(digest!.content).not.toContain('discussing offers');
  });

  it('always includes the current channel, even when restricted', () => {
    indexGroup();
    recordDigestMessage({
      nest: HIRING,
      sender: '~zod',
      text: 'discussing offers',
    });
    const digest = renderGroupDigestForChannel(HIRING);
    expect(digest).not.toBeNull();
    expect(digest!.content).toContain('#hiring — 1 msg');
  });

  it('fails closed when readers are unknown', () => {
    updateGroupIndex({
      channelToGroup: new Map([
        [GENERAL, GROUP],
        [DEV, GROUP],
      ]),
      channelReaders: new Map([
        [GENERAL, []],
        [DEV, ['__unknown__']],
      ]),
    });
    recordDigestMessage({ nest: DEV, sender: '~nec', text: 'secretish' });
    const digest = renderGroupDigestForChannel(GENERAL);
    expect(digest?.content ?? '').not.toContain('secretish');
  });

  it('returns null for channels with no group mapping', () => {
    expect(renderGroupDigestForChannel('chat/~unknown/where')).toBeNull();
  });

  it('lists open quiet channels', () => {
    indexGroup();
    recordDigestMessage({ nest: GENERAL, sender: '~nec', text: 'hi' });
    const digest = renderGroupDigestForChannel(GENERAL);
    expect(digest!.content).toContain('Quiet:');
    expect(digest!.content).toContain('#dev');
  });

  it('drops events outside the 24h window', () => {
    indexGroup();
    recordDigestMessage({
      nest: DEV,
      sender: '~nec',
      text: 'old news',
      timestamp: Date.now() - 25 * 60 * 60 * 1000,
    });
    const digest = renderGroupDigestForChannel(GENERAL);
    expect(digest!.content).not.toContain('old news');
    expect(digest!.content).toContain('Quiet:');
  });
});
