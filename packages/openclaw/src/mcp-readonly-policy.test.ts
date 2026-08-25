import { beforeEach, describe, expect, it } from 'vitest';

import {
  mayCallDescribedReadOnlyMcpTool,
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
      }
    );

    expect(
      mayCallDescribedReadOnlyMcpTool('cron-session', {
        name: 'gmail.search_messages',
      })
    ).toBe(true);
    expect(
      mayCallDescribedReadOnlyMcpTool('other-session', {
        name: 'gmail.search_messages',
      })
    ).toBe(false);
    expect(
      mayCallDescribedReadOnlyMcpTool('cron-session', {
        name: 'gmail.send_message',
      })
    ).toBe(false);
  });

  it('rejects tools without an explicit read-only annotation', () => {
    rememberDescribedReadOnlyMcpTool(
      'cron-session',
      { name: 'gmail.send_message' },
      JSON.stringify({
        name: 'gmail.send_message',
        annotations: { readOnlyHint: false },
      })
    );

    expect(
      mayCallDescribedReadOnlyMcpTool('cron-session', {
        name: 'gmail.send_message',
      })
    ).toBe(false);
  });
});
