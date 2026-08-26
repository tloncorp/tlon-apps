import { beforeEach, describe, expect, it } from 'vitest';

import {
  MCP_READ_TOOL_NAMES,
  clearCronJobForSession,
  cronJobForSession,
  isMcpCallToolName,
  isMcpDescribeToolName,
  mayCallDescribedReadOnlyMcpTool,
  mayDescribeMcpTool,
  mcpReadOnlyPolicyTesting,
  rememberDescribedReadOnlyMcpTool,
  rememberCronJobForSession,
} from './mcp-readonly-policy.js';

describe('MCP read-only policy', () => {
  beforeEach(() => mcpReadOnlyPolicyTesting.clear());

  it('supports the OpenClaw MCP tool names for the configured mcp server', () => {
    expect(MCP_READ_TOOL_NAMES).toEqual([
      'mcp__list_upstreams',
      'mcp__search',
      'mcp__describe',
      'mcp__call',
    ]);
    expect(isMcpDescribeToolName('mcp__describe')).toBe(true);
    expect(isMcpCallToolName('mcp__call')).toBe(true);
    expect(isMcpDescribeToolName('mcp_describe')).toBe(false);
    expect(isMcpCallToolName('mcp_call')).toBe(false);
    expect(isMcpDescribeToolName('other__describe')).toBe(false);
    expect(isMcpCallToolName('other__call')).toBe(false);
  });

  it('allows only the exact tool described as read-only in the same session', () => {
    rememberDescribedReadOnlyMcpTool(
      'cron-session',
      { name: 'gmail_search_messages' },
      {
        tool: {
          name: 'gmail_search_messages',
          annotations: { readOnlyHint: true },
        },
      },
      ['gmail']
    );

    expect(
      mayCallDescribedReadOnlyMcpTool(
        'cron-session',
        { name: 'gmail_search_messages' },
        ['gmail']
      )
    ).toBe(true);
    expect(
      mayCallDescribedReadOnlyMcpTool(
        'other-session',
        { name: 'gmail_search_messages' },
        ['gmail']
      )
    ).toBe(false);
    expect(
      mayCallDescribedReadOnlyMcpTool(
        'cron-session',
        { name: 'gmail_send_message' },
        ['gmail']
      )
    ).toBe(false);
  });

  it('rejects tools without an explicit read-only annotation', () => {
    rememberDescribedReadOnlyMcpTool(
      'cron-session',
      { name: 'gmail_send_message' },
      JSON.stringify({
        name: 'gmail_send_message',
        annotations: { readOnlyHint: false },
      }),
      ['gmail']
    );

    expect(
      mayCallDescribedReadOnlyMcpTool(
        'cron-session',
        { name: 'gmail_send_message' },
        ['gmail']
      )
    ).toBe(false);
  });

  it('revokes an earlier grant when the same tool is re-described as mutating', () => {
    const params = { name: 'gmail_search_messages' };
    rememberDescribedReadOnlyMcpTool(
      'cron-session',
      params,
      {
        name: 'gmail_search_messages',
        annotations: { readOnlyHint: true },
      },
      ['gmail']
    );
    expect(
      mayCallDescribedReadOnlyMcpTool('cron-session', params, ['gmail'])
    ).toBe(true);

    rememberDescribedReadOnlyMcpTool(
      'cron-session',
      params,
      {
        name: 'gmail_search_messages',
        annotations: { readOnlyHint: false },
      },
      ['gmail']
    );

    expect(
      mayCallDescribedReadOnlyMcpTool('cron-session', params, ['gmail'])
    ).toBe(false);
  });

  it('rejects a nested decoy annotation and a mismatched described name', () => {
    rememberDescribedReadOnlyMcpTool(
      'cron-session',
      { name: 'gmail_send_message' },
      {
        tool: {
          name: 'gmail_send_message',
          inputSchema: {
            annotations: { readOnlyHint: true },
          },
          annotations: { readOnlyHint: false },
        },
        unrelated: {
          name: 'gmail_search_messages',
          annotations: { readOnlyHint: true },
        },
      },
      ['gmail']
    );

    expect(
      mayCallDescribedReadOnlyMcpTool(
        'cron-session',
        { name: 'gmail_send_message' },
        ['gmail']
      )
    ).toBe(false);
  });

  it('enforces the selected provider for describe and call', () => {
    expect(
      mayDescribeMcpTool({ name: 'github_search_issues' }, ['gmail'])
    ).toBe(false);
    rememberDescribedReadOnlyMcpTool(
      'cron-session',
      { name: 'github_search_issues' },
      {
        name: 'github_search_issues',
        annotations: { readOnlyHint: true },
      },
      ['gmail']
    );
    expect(
      mayCallDescribedReadOnlyMcpTool(
        'cron-session',
        { name: 'github_search_issues' },
        ['gmail']
      )
    ).toBe(false);
  });

  it('does not reuse a same-name grant for a different provider', () => {
    rememberDescribedReadOnlyMcpTool(
      'cron-session',
      { name: 'search', upstreamId: 'allowed' },
      {
        name: 'search',
        upstreamId: 'allowed',
        annotations: { readOnlyHint: true },
      },
      ['allowed']
    );

    expect(
      mayCallDescribedReadOnlyMcpTool(
        'cron-session',
        { name: 'search', upstreamId: 'allowed' },
        ['allowed']
      )
    ).toBe(true);
    expect(
      mayCallDescribedReadOnlyMcpTool(
        'cron-session',
        { name: 'search', upstreamId: 'unselected' },
        ['allowed']
      )
    ).toBe(false);
  });

  it('does not authorize a longer provider id through a selected prefix', () => {
    expect(
      mayDescribeMcpTool({ name: 'google-drive_search_files' }, ['google'])
    ).toBe(false);
    expect(
      mayDescribeMcpTool({ name: 'google-drive_search_files' }, [
        'google-drive',
      ])
    ).toBe(true);
  });

  it('clears cron attribution and described tools at the run boundary', () => {
    rememberCronJobForSession('main-session', 'onboarding-job');
    rememberDescribedReadOnlyMcpTool(
      'main-session',
      { name: 'gmail_search_messages' },
      {
        name: 'gmail_search_messages',
        annotations: { readOnlyHint: true },
      },
      ['gmail']
    );

    clearCronJobForSession('main-session', 'onboarding-job');

    expect(cronJobForSession('main-session')).toBeUndefined();
    expect(
      mayCallDescribedReadOnlyMcpTool(
        'main-session',
        { name: 'gmail_search_messages' },
        ['gmail']
      )
    ).toBe(false);
  });

  it('does not let an older run clear newer cron attribution', () => {
    rememberCronJobForSession('main-session', 'newer-job');
    clearCronJobForSession('main-session', 'older-job');
    expect(cronJobForSession('main-session')).toBe('newer-job');
  });
});
