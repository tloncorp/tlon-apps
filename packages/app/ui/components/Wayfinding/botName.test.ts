import { describe, expect, it } from 'vitest';

import { getDefaultBotName } from './botName';

describe('getDefaultBotName', () => {
  it('derives the initial bot name from the user nickname', () => {
    expect(getDefaultBotName('Daniel')).toBe("Daniel's Tlonbot 🌱");
  });

  it('trims the nickname and falls back when it is empty', () => {
    expect(getDefaultBotName('  Dan  ')).toBe("Dan's Tlonbot 🌱");
    expect(getDefaultBotName('  ')).toBe('Tlonbot');
    expect(getDefaultBotName(null)).toBe('Tlonbot');
  });
});
