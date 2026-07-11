import { describe, expect, it } from 'vitest';

import { probeWebSearchBootStatus } from './web-search-status.js';

describe('probeWebSearchBootStatus', () => {
  it('reports available when enabled and a provider is registered', () => {
    const status = probeWebSearchBootStatus({
      searchConfig: { provider: 'brave' },
      listProviders: () => [{ id: 'brave' }],
    });

    expect(status).toEqual({
      webSearchEnabled: true,
      webSearchConfiguredProvider: 'brave',
      webSearchProviders: ['brave'],
      webSearchProviderCount: 1,
      webSearchAvailable: true,
      webSearchProbeError: null,
    });
  });

  it('reports unavailable when the registry has no providers', () => {
    const status = probeWebSearchBootStatus({
      searchConfig: { provider: 'brave' },
      listProviders: () => [],
    });

    expect(status.webSearchAvailable).toBe(false);
    expect(status.webSearchProviderCount).toBe(0);
    expect(status.webSearchProbeError).toBeNull();
  });

  it('defaults enabled to true and configured provider to null when config is absent', () => {
    const status = probeWebSearchBootStatus({
      searchConfig: undefined,
      listProviders: () => [{ id: 'perplexity' }],
    });

    expect(status.webSearchEnabled).toBe(true);
    expect(status.webSearchConfiguredProvider).toBeNull();
    expect(status.webSearchAvailable).toBe(true);
  });

  it('reports unavailable when web search is explicitly disabled', () => {
    const status = probeWebSearchBootStatus({
      searchConfig: { enabled: false },
      listProviders: () => [{ id: 'brave' }],
    });

    expect(status.webSearchEnabled).toBe(false);
    expect(status.webSearchAvailable).toBe(false);
    expect(status.webSearchProviders).toEqual(['brave']);
  });

  it('dedupes and sorts registered provider ids', () => {
    const status = probeWebSearchBootStatus({
      searchConfig: undefined,
      listProviders: () => [
        { id: 'perplexity' },
        { id: 'brave' },
        { id: 'brave' },
      ],
    });

    expect(status.webSearchProviders).toEqual(['brave', 'perplexity']);
    expect(status.webSearchProviderCount).toBe(2);
  });

  it('captures a probe error when listProviders throws', () => {
    const status = probeWebSearchBootStatus({
      searchConfig: undefined,
      listProviders: () => {
        throw new Error('registry not loaded');
      },
    });

    expect(status.webSearchAvailable).toBe(false);
    expect(status.webSearchProviders).toEqual([]);
    expect(status.webSearchProbeError).toBe('registry not loaded');
  });

  it('captures a probe error when the runtime lacks listProviders', () => {
    const status = probeWebSearchBootStatus({
      searchConfig: undefined,
      listProviders: undefined,
    });

    expect(status.webSearchAvailable).toBe(false);
    expect(status.webSearchProbeError).toMatch(/listProviders missing/);
  });

  it('normalizes the configured provider id', () => {
    const status = probeWebSearchBootStatus({
      searchConfig: { provider: ' Brave ' },
      listProviders: () => [],
    });

    expect(status.webSearchConfiguredProvider).toBe('brave');
  });
});
