import { beforeEach, expect, test, vi } from 'vitest';

import * as settingsApi from './settingsApi';
import * as urbitApi from './urbit';

vi.mock('./urbit', () => ({
  poke: vi.fn().mockResolvedValue(0),
  scry: vi.fn().mockResolvedValue({
    desk: {
      display: {
        theme: 'dracula',
      },
    },
  }),
  subscribe: vi.fn().mockReturnValue({ id: '1' }),
  getCurrentUserId: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test('setSetting should handle theme "dracula" correctly', async () => {
  await settingsApi.setSetting('theme', 'dracula');

  expect(urbitApi.poke).toHaveBeenCalledWith({
    app: 'settings',
    mark: 'settings-event',
    json: {
      'put-entry': {
        desk: 'groups',
        'bucket-key': 'display',
        'entry-key': 'theme',
        value: 'dracula',
      },
    },
  });
});

test('setSetting should clearing the theme when the user selects "auto"', async () => {
  await settingsApi.setSetting('theme', '');

  expect(urbitApi.poke).toHaveBeenCalledWith({
    app: 'settings',
    mark: 'settings-event',
    json: {
      'put-entry': {
        desk: 'groups',
        'bucket-key': 'display',
        'entry-key': 'theme',
        value: '',
      },
    },
  });
});

test('toClientSettings should transform settings with theme "dracula" correctly', () => {
  const urbitSettings = {
    desk: {
      display: {
        theme: 'dracula',
      },
    },
  };

  const clientSettings = settingsApi.toClientSettings(urbitSettings);
  expect(clientSettings.theme).toBe('dracula');
});

test('toClientSettings should transform settings with undefined theme correctly', () => {
  const urbitSettings = {
    desk: {
      display: {},
    },
  };

  const clientSettings = settingsApi.toClientSettings(urbitSettings);
  expect(clientSettings.theme).toBeUndefined();
});

test('getSettings should fetch and transform settings', async () => {
  const settings = await settingsApi.getSettings();

  expect(urbitApi.scry).toHaveBeenCalledWith({
    app: 'settings',
    path: '/desk/groups',
  });

  expect(settings.theme).toBe('dracula');
});

test('subscribeToSettings should register a handler', async () => {
  const mockHandler = vi.fn();

  settingsApi.subscribeToSettings(mockHandler);

  expect(urbitApi.subscribe).toHaveBeenCalledWith(
    {
      app: 'settings',
      path: '/desk/groups',
    },
    expect.any(Function)
  );
});
