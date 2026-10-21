import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createConnectableServicesToolExecutor,
  findConnectableService,
  loadConnectableServices,
  parseConnectableServices,
  resetConnectableServicesCache,
  resolveConnectableServicesUrl,
} from './connectable-services.js';

const catalog = {
  providers: [
    { id: 'github', displayName: 'GitHub', kind: 'mcp_remote' },
    { id: 'google-calendar', displayName: 'Google Calendar' },
    { id: 'supabase', displayName: 'Supabase' },
    { id: 'clickup', displayName: 'ClickUp' },
    { id: '  ', displayName: 'Blank' },
    { displayName: 'No id' },
    'not an object',
  ],
};

const services = parseConnectableServices(catalog);

afterEach(() => {
  resetConnectableServicesCache();
});

describe('resolveConnectableServicesUrl', () => {
  it('uses the relay for the hosted environment', () => {
    expect(resolveConnectableServicesUrl({ PIONEER_ENV: 'prod' })).toBe(
      'https://oauth.tlon.io/v1/providers'
    );
    expect(resolveConnectableServicesUrl({ PIONEER_ENV: ' Test ' })).toBe(
      'https://oauth.test.tlon.systems/v1/providers'
    );
  });

  it('has no catalog outside Tlon hosting', () => {
    expect(resolveConnectableServicesUrl({})).toBeNull();
    expect(resolveConnectableServicesUrl({ PIONEER_ENV: 'local' })).toBeNull();
  });
});

describe('parseConnectableServices', () => {
  it('keeps valid services the app shows, sorted by name', () => {
    expect(services).toEqual([
      { id: 'clickup', name: 'ClickUp' },
      { id: 'github', name: 'GitHub' },
      { id: 'google-calendar', name: 'Google Calendar' },
    ]);
  });

  it('rejects a response without a provider list', () => {
    expect(() => parseConnectableServices({})).toThrow();
    expect(() => parseConnectableServices(null)).toThrow();
  });
});

describe('findConnectableService', () => {
  it('matches an id or display name, ignoring case and punctuation', () => {
    expect(findConnectableService(services, 'google-calendar')?.id).toBe(
      'google-calendar'
    );
    expect(findConnectableService(services, 'Google Calendar')?.id).toBe(
      'google-calendar'
    );
    expect(findConnectableService(services, 'GITHUB')?.id).toBe('github');
  });

  it('finds nothing for a service that is not listed', () => {
    expect(findConnectableService(services, 'asana')).toBeNull();
    expect(findConnectableService(services, 'supabase')).toBeNull();
    expect(findConnectableService(services, ' - ')).toBeNull();
  });
});

describe('loadConnectableServices', () => {
  const url = 'https://oauth.tlon.io/v1/providers';

  it('does not fetch without a hosted catalog', async () => {
    const fetchJson = vi.fn();
    await expect(
      loadConnectableServices({ url: null, fetchJson })
    ).resolves.toBeNull();
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('caches the list for an hour', async () => {
    let now = 0;
    const fetchJson = vi.fn(async () => catalog);
    const load = () =>
      loadConnectableServices({ url, fetchJson, now: () => now });

    await expect(load()).resolves.toEqual(services);
    now = 59 * 60_000;
    await load();
    expect(fetchJson).toHaveBeenCalledTimes(1);

    now = 61 * 60_000;
    await load();
    expect(fetchJson).toHaveBeenCalledTimes(2);
    expect(fetchJson).toHaveBeenCalledWith(url);
  });

  it('keeps the last good list and backs off when a refresh fails', async () => {
    let now = 0;
    const fetchJson = vi
      .fn<(url: string) => Promise<unknown>>()
      .mockResolvedValueOnce(catalog)
      .mockRejectedValue(new Error('relay down'));
    const load = () =>
      loadConnectableServices({ url, fetchJson, now: () => now });

    await load();
    now = 2 * 60 * 60_000;
    await expect(load()).resolves.toEqual(services);

    // The failed refresh backs off instead of retrying on every turn.
    now += 60_000;
    await expect(load()).resolves.toEqual(services);
    expect(fetchJson).toHaveBeenCalledTimes(2);
    now += 5 * 60_000;
    await load();
    expect(fetchJson).toHaveBeenCalledTimes(3);
  });

  it('reports unknown, then backs off, when the list never loaded', async () => {
    let now = 0;
    const fetchJson = vi.fn(async () => {
      throw new Error('relay down');
    });
    const load = () =>
      loadConnectableServices({ url, fetchJson, now: () => now });

    await expect(load()).resolves.toBeNull();
    now = 60_000;
    await expect(load()).resolves.toBeNull();
    expect(fetchJson).toHaveBeenCalledTimes(1);

    now = 6 * 60_000;
    await load();
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });
});

describe('connectable services tool', () => {
  it('lists every service with its id', async () => {
    const result = await createConnectableServicesToolExecutor({
      listServices: async () => services,
    })();

    expect(result.details).toBeUndefined();
    expect(result.content[0]!.text).toContain(
      'ClickUp (clickup), GitHub (github), Google Calendar (google-calendar).'
    );
    expect(result.content[0]!.text).toContain(
      'A service not on this list cannot be connected yet.'
    );
  });

  it('tells the model not to guess when the list is unavailable', async () => {
    const result = await createConnectableServicesToolExecutor({
      listServices: async () => null,
    })();

    expect(result.details).toEqual({ error: true });
    expect(result.content[0]!.text).toContain("Don't guess");
  });
});
