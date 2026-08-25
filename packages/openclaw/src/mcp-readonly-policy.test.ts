import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearCronJobForSession,
  cronJobForSession,
  mayCallDescribedReadOnlyMcpTool,
  mayDescribeMcpTool,
  mcpReadOnlyPolicyTesting,
  rememberDescribedReadOnlyMcpTool,
  rememberCronJobForSession,
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

  it('clears cron attribution and described tools at the run boundary', () => {
    rememberCronJobForSession('main-session', 'onboarding-job');
    rememberDescribedReadOnlyMcpTool(
      'main-session',
      { name: 'gmail.search_messages' },
      {
        name: 'gmail.search_messages',
        annotations: { readOnlyHint: true },
      },
      ['gmail']
    );

    clearCronJobForSession('main-session', 'onboarding-job');

    expect(cronJobForSession('main-session')).toBeUndefined();
    expect(
      mayCallDescribedReadOnlyMcpTool(
        'main-session',
        { name: 'gmail.search_messages' },
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
