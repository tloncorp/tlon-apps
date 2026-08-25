import { beforeEach, describe, expect, it } from 'vitest';

import {
  mayCallDescribedReadOnlyMcpTool,
  mayDescribeMcpTool,
  mcpReadOnlyPolicyTesting,
  rememberDescribedReadOnlyMcpTool,
} from './mcp-readonly-policy.js';

describe('MCP read-only policy', () => {
  beforeEach(() => mcpReadOnlyPolicyTesting.clear());

  it('allows only the exact tool described as read-only in the same session', () => {
    rememberDescribedReadOnlyMcpTool(
      'cron-session',
      { name: 'gmail.search_messages' },
      {
        tool: {
          name: 'gmail.search_messages',
          annotations: { readOnlyHint: true },
        },
      },
      ['gmail']
    );

    expect(
      mayCallDescribedReadOnlyMcpTool(
        'cron-session',
        { name: 'gmail.search_messages' },
        ['gmail']
      )
    ).toBe(true);
    expect(
      mayCallDescribedReadOnlyMcpTool(
        'other-session',
        { name: 'gmail.search_messages' },
        ['gmail']
      )
    ).toBe(false);
    expect(
      mayCallDescribedReadOnlyMcpTool(
        'cron-session',
        { name: 'gmail.send_message' },
        ['gmail']
      )
    ).toBe(false);
  });

  it('rejects tools without an explicit read-only annotation', () => {
    rememberDescribedReadOnlyMcpTool(
      'cron-session',
      { name: 'gmail.send_message' },
      JSON.stringify({
        name: 'gmail.send_message',
        annotations: { readOnlyHint: false },
      }),
      ['gmail']
    );

    expect(
      mayCallDescribedReadOnlyMcpTool(
        'cron-session',
        { name: 'gmail.send_message' },
        ['gmail']
      )
    ).toBe(false);
  });

  it('rejects a nested decoy annotation and a mismatched described name', () => {
    rememberDescribedReadOnlyMcpTool(
      'cron-session',
      { name: 'gmail.send_message' },
      {
        tool: {
          name: 'gmail.send_message',
          inputSchema: {
            annotations: { readOnlyHint: true },
          },
          annotations: { readOnlyHint: false },
        },
        unrelated: {
          name: 'gmail.search_messages',
          annotations: { readOnlyHint: true },
        },
      },
      ['gmail']
    );

    expect(
      mayCallDescribedReadOnlyMcpTool(
        'cron-session',
        { name: 'gmail.send_message' },
        ['gmail']
      )
    ).toBe(false);
  });

  it('enforces the selected provider for describe and call', () => {
    expect(
      mayDescribeMcpTool({ name: 'github.search_issues' }, ['gmail'])
    ).toBe(false);
    rememberDescribedReadOnlyMcpTool(
      'cron-session',
      { name: 'github.search_issues' },
      {
        name: 'github.search_issues',
        annotations: { readOnlyHint: true },
      },
      ['gmail']
    );
    expect(
      mayCallDescribedReadOnlyMcpTool(
        'cron-session',
        { name: 'github.search_issues' },
        ['gmail']
      )
    ).toBe(false);
  });
});
