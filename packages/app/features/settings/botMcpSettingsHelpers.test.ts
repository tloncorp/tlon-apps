import type { TlawnOAuthProvider } from '@tloncorp/api';
import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

import { prioritizeMcpMenuProviders } from '../../lib/mcpProviders';
import { buildProviderRows } from './botMcpSettingsHelpers';

vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: {
    TlonbotMcpConnected: 'connected',
    TlonbotMcpDisconnected: 'disconnected',
    TlonbotMcpError: 'error',
    TlonbotMcpInitiatedOAuth: 'initiated',
  },
  createDevLogger: () => ({ trackEvent: vi.fn() }),
}));

describe('buildProviderRows', () => {
  it('preserves Hosting-provided provider logos', () => {
    const provider = {
      displayName: 'Example',
      id: 'example',
      kind: 'mcp_remote',
      logoUrl: 'https://assets.example.com/example.png',
      scopes: '',
      suggestedUpstream: {
        mode: 'proxy',
        name: 'Example',
        url: 'https://mcp.example.com/mcp',
      },
      template: 'example',
    } satisfies TlawnOAuthProvider;

    expect(buildProviderRows([provider], [])).toEqual([
      {
        displayName: 'Example',
        id: 'example',
        logoUrl: 'https://assets.example.com/example.png',
        status: 'not-connected',
      },
    ]);
  });

  it('puts connected providers first and keeps Gmail in the default menu', () => {
    expect(
      prioritizeMcpMenuProviders([
        { displayName: 'A', id: 'a', status: 'not-connected' },
        { displayName: 'B', id: 'b', status: 'connected' },
        { displayName: 'Gmail', id: 'gmail', status: 'not-connected' },
        { displayName: 'D', id: 'd', status: 'connected' },
      ]).map((provider) => provider.id)
    ).toEqual(['b', 'd', 'gmail', 'a']);
  });
});
