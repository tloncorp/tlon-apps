import { describe, expect, it } from 'vitest';

import { toClientSettings } from './settingsApi';

describe('toClientSettings showDeleteMarkers', () => {
  it('defaults delete markers off when the setting has never been saved', () => {
    expect(toClientSettings({ desk: {} }).showDeleteMarkers).toBe(false);
  });

  it('preserves an enabled delete marker preference', () => {
    expect(
      toClientSettings({
        desk: { display: { showDeleteMarkers: true } },
      }).showDeleteMarkers
    ).toBe(true);
  });
});
