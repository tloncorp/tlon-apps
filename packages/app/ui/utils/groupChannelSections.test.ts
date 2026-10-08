import type * as db from '@tloncorp/shared/db';
import { describe, expect, it } from 'vitest';

import {
  getGroupChannelMenu,
  getGroupChannelSections,
} from './groupChannelSections';

function channel(id: string, lastPostAt = 0): db.Channel {
  return { id, lastPostAt } as db.Channel;
}

const general = channel('general', 1);
const random = channel('random', 3);
const lore = channel('lore', 2);

const group = {
  channels: [general, random, lore],
  navSections: [
    {
      id: 'talk',
      title: 'Talk',
      channels: [
        { channelId: 'random', channelIndex: 1 },
        { channelId: 'general', channelIndex: 0 },
      ],
    },
  ],
} as unknown as db.Group;

const ids = (channels: db.Channel[]) => channels.map((c) => c.id);

describe('getGroupChannelSections', () => {
  it('lists every channel newest first under one heading', () => {
    const sections = getGroupChannelSections(group, 'recency');
    expect(sections.map((s) => s.title)).toEqual(['Recent Channels']);
    expect(ids(sections[0].channels)).toEqual(['random', 'lore', 'general']);
  });

  it('follows the arranged sections, then the channels none holds', () => {
    const sections = getGroupChannelSections(group, 'arranged');
    expect(sections.map((s) => s.title)).toEqual(['Talk', 'All Channels']);
    expect(ids(sections[0].channels)).toEqual(['general', 'random']);
    expect(ids(sections[1].channels)).toEqual(['lore']);
  });

  it('is empty for a group without channels', () => {
    expect(getGroupChannelSections({ channels: [] }, 'arranged')).toEqual([]);
  });
});

describe('getGroupChannelMenu', () => {
  it("lists a channel's others in the arranged order", () => {
    expect(getGroupChannelMenu(group, 'arranged', 'random')).toEqual({
      title: 'Other channels in this group',
      channels: [general, lore],
    });
  });

  it("lists all of a group's channels when no channel is open", () => {
    expect(getGroupChannelMenu(group, 'recency')).toEqual({
      title: 'Channels in this group',
      channels: [random, lore, general],
    });
  });

  it('lists them all when the open channel is not among them', () => {
    expect(getGroupChannelMenu(group, 'arranged', 'elsewhere')).toEqual({
      title: 'Channels in this group',
      channels: [general, random, lore],
    });
  });

  it('lists the one channel of a single-channel group, open or not', () => {
    const single = { channels: [general] } as db.Group;
    const expected = {
      title: 'Channels in this group',
      channels: [general],
    };
    expect(getGroupChannelMenu(single, 'arranged', 'general')).toEqual(
      expected
    );
    expect(getGroupChannelMenu(single, 'arranged')).toEqual(expected);
  });
});
