import { describe, expect, test } from 'vitest';

import {
  NotificationLevel,
  getLevelFromVolumeMap,
  getUnreadsFromVolumeMap,
  getVolumeMap,
} from '../urbit';

// 'default' and 'medium' produce the same map, which infers back to 'medium'.
const LEVELS: NotificationLevel[] = ['loud', 'medium', 'soft', 'hush'];

describe('getVolumeMap includes react keys', () => {
  test.each(LEVELS)(
    'always writes react and dm-react keys (level=%s)',
    (level) => {
      const map = getVolumeMap(level, true);
      expect(map).toHaveProperty('react');
      expect(map).toHaveProperty('dm-react');
    }
  );

  test.each(LEVELS)(
    'reacts never contribute to unread badges (level=%s)',
    (level) => {
      const map = getVolumeMap(level, true);
      expect(map.react?.unreads).toBe(false);
      expect(map['dm-react']?.unreads).toBe(false);
    }
  );

  test('muting a source silences reacts', () => {
    const map = getVolumeMap('hush', true);
    expect(map.react?.notify).toBe(false);
    expect(map['dm-react']?.notify).toBe(false);
  });

  test('reacts notify at loud and medium/default, off at soft', () => {
    expect(getVolumeMap('loud', false).react?.notify).toBe(true);
    expect(getVolumeMap('medium', false).react?.notify).toBe(true);
    expect(getVolumeMap('default', false).react?.notify).toBe(true);
    expect(getVolumeMap('soft', false).react?.notify).toBe(false);
  });
});

describe('react keys do not disturb level inference', () => {
  test.each(LEVELS)('round-trips level=%s', (level) => {
    const map = getVolumeMap(level, true);
    expect(getLevelFromVolumeMap(map)).toBe(level);
  });

  test('react unreads=false does not hide a badged source', () => {
    // even though reacts are unreads=false, other events carry the flag
    expect(getUnreadsFromVolumeMap(getVolumeMap('medium', true))).toBe(true);
    expect(getUnreadsFromVolumeMap(getVolumeMap('medium', false))).toBe(false);
  });
});
