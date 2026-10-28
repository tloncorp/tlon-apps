import { describe, expect, it } from 'vitest';

import { getVolumeMap } from '../urbit/activity';
import { extractClientVolumes } from './activity';

const hush = getVolumeMap('hush', true);
const medium = getVolumeMap('medium', true);

describe('extractClientVolumes', () => {
  it('maps every source kind the ship emits to its client volume row', () => {
    const rows = extractClientVolumes({
      base: medium,
      'group/~zod/garden': getVolumeMap('soft', true),
      'channel/chat/~zod/general': hush,
      'ship/~pinser-botter-malmur-halmex': hush,
      'club/0v4.00000.qd4mk.d4htu.er4b2.3dr97': hush,
      'notebook/~zod/journal': hush,
      'thread/chat/~zod/general/170.141.184.506.853.323.579.606.989.072.752.443.392':
        hush,
      'dm-thread/ship/~zod/170.141.184.506.853.323.579.606.989.072.752.443.393':
        hush,
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        { itemId: 'base', itemType: 'base', level: 'medium' },
        { itemId: '~zod/garden', itemType: 'group', level: 'soft' },
        { itemId: 'chat/~zod/general', itemType: 'channel', level: 'hush' },
        {
          itemId: '~pinser-botter-malmur-halmex',
          itemType: 'channel',
          level: 'hush',
        },
        {
          itemId: '0v4.00000.qd4mk.d4htu.er4b2.3dr97',
          itemType: 'channel',
          level: 'hush',
        },
        { itemId: 'notes/~zod/journal', itemType: 'channel', level: 'hush' },
        {
          itemId: '170.141.184.506.853.323.579.606.989.072.752.443.392',
          itemType: 'thread',
          level: 'hush',
        },
        {
          itemId: '170.141.184.506.853.323.579.606.989.072.752.443.393',
          itemType: 'thread',
          level: 'hush',
        },
      ])
    );
    expect(rows).toHaveLength(8);
  });

  it('skips null entries', () => {
    expect(extractClientVolumes({ 'ship/~zod': null })).toEqual([]);
  });
});
