import { describe, expect, it } from 'vitest';

import {
  type ChannelOrder,
  channelReorderItems,
  moveChannels,
  reorder,
} from './channelReorder';

// As the list shows it: 0 Indoors, 1 Garden talk, 2 Outdoors, 3 Plant pics,
// 4 No section, 5 Tips, 6 Lounge.
const order: ChannelOrder = [
  { sectionId: 'indoors', title: 'Indoors', channelIds: ['garden'] },
  { sectionId: 'outdoors', title: 'Outdoors', channelIds: ['plants'] },
  { sectionId: 'default', title: '', channelIds: ['tips', 'lounge'] },
];

const channelsBySection = (next: ChannelOrder | null) =>
  next?.map((section) => `${section.sectionId}: ${section.channelIds}`);

describe('reorder', () => {
  it('moves items down and up as SwiftUI counts them', () => {
    expect(reorder(['a', 'b', 'c', 'd'], [0], 3)).toEqual(['b', 'c', 'a', 'd']);
    expect(reorder(['a', 'b', 'c', 'd'], [3], 1)).toEqual(['a', 'd', 'b', 'c']);
  });
});

describe('moveChannels', () => {
  it('lists each section’s name above its channels', () => {
    expect(channelReorderItems(order)).toEqual([
      { kind: 'heading', sectionId: 'indoors' },
      { kind: 'channel', id: 'garden' },
      { kind: 'heading', sectionId: 'outdoors' },
      { kind: 'channel', id: 'plants' },
      { kind: 'heading', sectionId: 'default' },
      { kind: 'channel', id: 'tips' },
      { kind: 'channel', id: 'lounge' },
    ]);
  });

  it('moves a channel into the section it’s dropped under', () => {
    expect(channelsBySection(moveChannels(order, [5], 3))).toEqual([
      'indoors: garden',
      'outdoors: tips,plants',
      'default: lounge',
    ]);
  });

  it('moves a channel into an empty section', () => {
    const withEmpty: ChannelOrder = [
      { sectionId: 'empty', title: 'Empty', channelIds: [] },
      ...order,
    ];
    expect(channelsBySection(moveChannels(withEmpty, [6], 1))).toEqual([
      'empty: tips',
      'indoors: garden',
      'outdoors: plants',
      'default: lounge',
    ]);
  });

  it('puts a channel dropped above every name in the first section', () => {
    expect(channelsBySection(moveChannels(order, [6], 0))).toEqual([
      'indoors: lounge,garden',
      'outdoors: plants',
      'default: tips',
    ]);
  });

  it('moves a channel to the end of the last section', () => {
    expect(channelsBySection(moveChannels(order, [1], 7))).toEqual([
      'indoors: ',
      'outdoors: plants',
      'default: tips,lounge,garden',
    ]);
  });

  it('keeps a move within a section in that section', () => {
    expect(channelsBySection(moveChannels(order, [6], 5))).toEqual([
      'indoors: garden',
      'outdoors: plants',
      'default: lounge,tips',
    ]);
  });

  it('never moves a section’s name', () => {
    expect(moveChannels(order, [2], 0)).toBeNull();
    expect(channelsBySection(moveChannels(order, [2, 3], 0))).toEqual([
      'indoors: plants,garden',
      'outdoors: ',
      'default: tips,lounge',
    ]);
  });
});
