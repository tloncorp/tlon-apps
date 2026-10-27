import { describe, expect, it } from 'vitest';

import {
  DELEGATION_TOOL_NAMES,
  OWNER_ONLY_BLOCK_REASON_MAX_CHARS,
  OWNER_ONLY_TOOLS,
  LOCAL_FILE_BLOCK_REASON,
  MESSAGE_MEDIA_BLOCK_REASON,
  SESSION_ACCESS_BLOCK_REASON,
  SESSION_ACCESS_TOOL_NAMES,
  formatMessageOptionBlockReason,
  formatOwnerOnlyDelegationBlockReason,
  formatOwnerOnlyToolBlockReason,
  resolveOwnerOnlyToolBlock,
} from './owner-only-tools.js';
import { CRON_TOOL_NAMES } from './cron-tool-args-guard.js';
import {
  MCP_BROKER_TOOL_NAMES,
  MCP_READ_TOOL_NAMES,
} from './mcp-readonly-policy.js';
import type { SenderRole } from './session-roles.js';

const EXPECTED_OWNER_ONLY_TOOLS = [
  'tlon',
  'cron',
  'automations',
  'read',
  'tlon_agent_choice',
  'tlon_agent_task_plan',
  'tlon_agent_service_setup',
  'set_timezone',
  'mcp__list_upstreams',
  'mcp__search',
  'mcp__describe',
  'mcp__call',
  'mcp__resources_list',
  'mcp__resources_read',
  'mcp__prompts_list',
  'mcp__prompts_get',
  'sessions_spawn',
  'sessions_send',
  'openclaw',
  'gateway',
  'plugins',
  'secrets',
  'nodes',
  'personal_instructions',
  'skill_workshop',
  'sessions',
  'github_publish',
  'presence',
  'terminal',
  'mobile_ui',
  'transcripts',
  'pdf',
  'view_image',
  'image_generate',
  'video_generate',
  'music_generate',
  'sessions_list',
  'sessions_history',
  'sessions_search',
] as const;

const DELEGATION_TOOLS: readonly string[] = [
  'sessions_spawn',
  'sessions_send',
  'openclaw',
];

function expectedReason(tool: string) {
  if (DELEGATION_TOOLS.includes(tool)) {
    return formatOwnerOnlyDelegationBlockReason(tool);
  }
  if (tool.startsWith('sessions_')) return SESSION_ACCESS_BLOCK_REASON;
  return formatOwnerOnlyToolBlockReason(tool);
}

describe('OWNER_ONLY_TOOLS', () => {
  it('contains exactly the expected tools in advertised order', () => {
    expect([...OWNER_ONLY_TOOLS]).toEqual([...EXPECTED_OWNER_ONLY_TOOLS]);
  });

  it('covers every tool core can register for the MCP broker', () => {
    // Pinned from openclaw 2026.9.33 src/agents/agent-bundle-mcp-materialize.ts:
    // the broker's upstream tools plus the resources/prompts utility tools.
    expect([...MCP_BROKER_TOOL_NAMES]).toEqual([
      'mcp__list_upstreams',
      'mcp__search',
      'mcp__describe',
      'mcp__call',
      'mcp__resources_list',
      'mcp__resources_read',
      'mcp__prompts_list',
      'mcp__prompts_get',
    ]);
    for (const name of [...MCP_BROKER_TOOL_NAMES, ...MCP_READ_TOOL_NAMES]) {
      expect(OWNER_ONLY_TOOLS.has(name)).toBe(true);
    }
  });

  it('covers every session tool that creates, drives, or reads another session', () => {
    for (const name of [
      ...DELEGATION_TOOL_NAMES,
      ...SESSION_ACCESS_TOOL_NAMES,
    ]) {
      expect(OWNER_ONLY_TOOLS.has(name)).toBe(true);
    }
    for (const name of [
      'sessions_yield',
      'session_status',
      'agents_list',
      'agents_wait',
      'subagents',
      'github_identity_status',
      'theme',
    ]) {
      expect(OWNER_ONLY_TOOLS.has(name)).toBe(false);
    }
  });

  it('covers the scheduler under every name the cron guard knows', () => {
    for (const name of CRON_TOOL_NAMES) {
      expect(OWNER_ONLY_TOOLS.has(name)).toBe(true);
    }
  });
});

describe('resolveOwnerOnlyToolBlock', () => {
  it.each([
    'browser_browser_login',
    'browser_browser_snapshot',
    'browser_browser_act',
    'browser_browser_session_create',
    'browser_browser_session_list',
    'browser_login',
    'browser_snapshot',
    'browser_act',
    'browser_session_create',
    'browser_session_list',
  ])('protects shared browser operation %s from non-owner sessions', (name) => {
    expect(
      resolveOwnerOnlyToolBlock('mcp__call', 'user', { name })
    ).toMatchObject({
      ownerOnly: true,
      gate: 'tool',
      blocked: true,
    });
    for (const role of ['owner', undefined] as const)
      expect(resolveOwnerOnlyToolBlock('mcp__call', role, { name })).toEqual({
        ownerOnly: true,
        gate: 'tool',
        blocked: false,
      });
  });

  it('blocks a non-browser MCP call for a non-owner under the mcp__call reason', () => {
    expect(
      resolveOwnerOnlyToolBlock('mcp__call', 'user', {
        name: 'weather_forecast',
      })
    ).toEqual({
      ownerOnly: true,
      gate: 'tool',
      blocked: true,
      reason: formatOwnerOnlyToolBlockReason('mcp__call'),
    });
  });

  it.each(EXPECTED_OWNER_ONLY_TOOLS)(
    'blocks %s for a non-owner user session with the policy reason',
    (tool) => {
      expect(resolveOwnerOnlyToolBlock(tool, 'user')).toEqual({
        ownerOnly: true,
        gate: 'tool',
        blocked: true,
        reason: expectedReason(tool),
      });
    }
  );

  it.each(EXPECTED_OWNER_ONLY_TOOLS)(
    'allows %s for the owner session',
    (tool) => {
      expect(resolveOwnerOnlyToolBlock(tool, 'owner')).toEqual({
        ownerOnly: true,
        gate: 'tool',
        blocked: false,
      });
    }
  );

  it.each(EXPECTED_OWNER_ONLY_TOOLS)(
    'allows %s for internal sessions without a stored role',
    (tool) => {
      expect(resolveOwnerOnlyToolBlock(tool, undefined)).toEqual({
        ownerOnly: true,
        gate: 'tool',
        blocked: false,
      });
    }
  );

  it.each([['user'], ['owner'], [undefined]] as [SenderRole | undefined][])(
    'does not treat web_search as owner-only for role %s',
    (role) => {
      expect(resolveOwnerOnlyToolBlock('web_search', role)).toEqual({
        ownerOnly: false,
        blocked: false,
      });
    }
  );
});

describe('formatOwnerOnlyToolBlockReason', () => {
  it.each(EXPECTED_OWNER_ONLY_TOOLS)(
    'states the owner-only policy for %s',
    (tool) => {
      const reason = formatOwnerOnlyToolBlockReason(tool);
      expect(reason.startsWith('Blocked by policy:')).toBe(true);
      expect(reason).toContain(`the ${tool} tool is owner-only`);
      expect(reason).toContain('not the owner');
      expect(reason).toContain('Tell them you cannot do this for them');
      expect(reason).toContain('do not retry for them');
      expect(reason).toContain(
        'do not blame a reload, outage, or missing tool'
      );
    }
  );

  it.each(EXPECTED_OWNER_ONLY_TOOLS)(
    'never claims %s is "not available" (TLON-6363 regression guard)',
    (tool) => {
      expect(formatOwnerOnlyToolBlockReason(tool).toLowerCase()).not.toContain(
        'not available'
      );
    }
  );

  it.each(EXPECTED_OWNER_ONLY_TOOLS)(
    'keeps the %s reason on one line within the owner-notice cap',
    (tool) => {
      const reason = formatOwnerOnlyToolBlockReason(tool);
      expect(reason).not.toMatch(/\r/);
      expect(reason).not.toMatch(/\n/);
      // Literal oracle: silent-failure-notice.ts MAX_ERROR_TEXT_LENGTH (the
      // owner notice truncates the reason beyond this), kept independent of
      // the module's own constant so both cannot drift together.
      expect(OWNER_ONLY_BLOCK_REASON_MAX_CHARS).toBe(200);
      expect(reason.length).toBeLessThanOrEqual(200);
    }
  );
});

describe('formatOwnerOnlyDelegationBlockReason', () => {
  it.each(DELEGATION_TOOL_NAMES)(
    'states delegation is owner-only for %s on one line within the cap',
    (tool) => {
      const reason = formatOwnerOnlyDelegationBlockReason(tool);
      expect(reason.startsWith('Blocked by policy:')).toBe(true);
      expect(reason).toContain(`delegation via ${tool} is owner-only`);
      expect(reason).toContain('not the owner');
      expect(reason).toContain('Tell them you cannot do this for them');
      expect(reason).not.toMatch(/[\r\n]/);
      expect(reason.length).toBeLessThanOrEqual(200);
    }
  );
});

describe('argument-gated tools', () => {
  it.each([
    ['web_fetch', { url: '/workspace/photo.png' }],
    ['tts', { text: 'x', voiceFile: './frame.png' }],
    ['tts', { text: 'hi', outputPath: '/tmp/out.mp3' }],
    ['tts', { text: 'x', voice: 'private.png' }],
    ['tts', { text: 'x', voice: '@private' }],
    ['tts', { text: 'x', voice: 'MEDIA: /etc/passwd' }],
    ['tts', { text: 'x', voice: 'C:\\Users\\a.txt' }],
    ['tts', { text: 'x', voice: '\\\\host\\share\\a.txt' }],
    ['tts', { text: 'x', voice: 'file:///etc/passwd' }],
    // The `query` exemption is web_search's alone.
    ['some_plugin_search', { query: 'notes/a.pdf' }],
    ['some_plugin_search', { query: 'My Docs/a.pdf' }],
    ['some_plugin_search', { query: 'workspace/secret' }],
    ['web_fetch', { url: 'file:///etc/passwd' }],
    ['web_fetch', { url: '/etc/passwd' }],
    ['web_fetch', { query: 'notes/a.pdf' }],
    // web_search keys other than `query` still get the check.
    ['web_search', { query: 'x', path: '~/notes/a.pdf' }],
    ['web_search', { query: 'x', file: '/etc/hosts' }],
    // Exemptions are bound to their keys.
    ['tts', { text: 'x', voice: 'text/private.txt' }],
    ['tts', { text: 'x', mimeType: 'text/../../private' }],
    ['tts', { text: 'x', voice: 'chat/~zod/general' }],
  ])('blocks a non-owner %s call with a local path', (tool, params) => {
    expect(resolveOwnerOnlyToolBlock(tool, 'user', params)).toEqual({
      ownerOnly: true,
      gate: 'arguments',
      blocked: true,
      reason: LOCAL_FILE_BLOCK_REASON,
    });
    for (const role of ['owner', undefined] as const) {
      expect(resolveOwnerOnlyToolBlock(tool, role, params)).toEqual({
        ownerOnly: true,
        gate: 'arguments',
        blocked: false,
      });
    }
  });

  it.each([
    ['web_search', { query: '1/2 cup flour' }],
    ['web_search', { query: 'what does either/or mean' }],
    ['web_search', { query: 'what is a hosts file' }],
    ['web_search', { query: 'what goes in package.json' }],
    ['web_search', { query: 'github.com/tloncorp/tlon-apps' }],
    ['web_search', { query: 'notes/a.pdf' }],
    ['web_search', { query: 'My Docs/a.pdf', count: 5, country: 'US' }],
    ['web_fetch', { url: 'https://example.com/a.pdf' }],
    ['tts', { text: 'x', contentType: 'audio/mpeg' }],
  ])('lets a non-owner call %s without a local path', (tool, params) => {
    expect(resolveOwnerOnlyToolBlock(tool, 'user', params)).toEqual({
      ownerOnly: false,
      blocked: false,
    });
  });

  it('still blocks a non-owner mcp__call that nests a local path', () => {
    expect(
      resolveOwnerOnlyToolBlock('mcp__call', 'user', {
        name: 'notes_read',
        arguments: { doc: { path: '~/notes/a.pdf' } },
      })
    ).toMatchObject({ ownerOnly: true, blocked: true });
  });

  it('applies the local-file rule to body-named keys of other tools', () => {
    expect(
      resolveOwnerOnlyToolBlock('tts', 'user', { text: '/etc/hosts' }).blocked
    ).toBe(true);
  });

  it.each([
    [{ action: 'send', target: '~sampel-palnet', message: 'hi' }],
    [{ action: 'send', message: '/etc/hosts maps names' }],
    [{ action: 'send', text: '~/notes is where I keep it' }],
    [{ action: 'send', SendMessage: 'hi\nsee /etc/hosts and notes.md' }],
    [
      {
        action: 'reply',
        to: 'chat/~zod/general',
        messageId: '170.141.184.507',
      },
    ],
    [
      {
        action: 'react',
        target: 'chat/~zod/general',
        messageId: '~zod/170.141',
        emoji: '👍',
        remove: false,
      },
    ],
    [{ action: 'send', to: 'dm/~zod', replyTo: '~zod/170.141', message: 'ok' }],
    [{ action: 'delete', target: 'heap/~zod/links', messageId: '170.1' }],
    [{ action: 'read', target: 'dm/~zod', limit: 20, before: '170.1' }],
    [{ action: 'react', messageId: '170.1', emoji: '👍', final: true }],
    [{ action: 'send', message: 'working on it', final: false }],
    [{ action: 'send', message: 'shh', silent: true }],
    [
      {
        action: 'react',
        messageId: '170.1',
        emoji: '\u{1F44D}',
        trackToolCalls: true,
        track_tool_calls: true,
      },
    ],
    [{ action: 'send', message: 'nice 👍🏽 work — café' }],
  ])('lets a non-owner send text-only message %j', (params) => {
    expect(resolveOwnerOnlyToolBlock('message', 'user', params)).toEqual({
      ownerOnly: false,
      blocked: false,
    });
  });

  it.each([
    [{ action: 'send', message: 'hi', media: 'https://a.b/c.png' }],
    [{ action: 'send', media: 'data:image/png;base64,AAAA' }],
    [{ action: 'send', attachments: [{ media: 'https://a.b/c.png' }] }],
    [{ action: 'send', attachments: [] }],
    [{ action: 'send', attachments: [{ media: 'My Docs/secret' }] }],
    [{ action: 'send', media: 'secret' }],
    [{ action: 'send', media: 'text/private.txt' }],
    [{ action: 'send', media: 'chat/~zod/general' }],
    [{ action: 'send', message: 'hi', filename: 'a.txt' }],
    [{ action: 'send', message: 'hi', buffer: 'AAAA' }],
    [{ action: 'send', message: 'hi', media_url: 'x' }],
    [{ action: 'send', message: 'hi', filePath: 'notes.txt' }],
    [{ action: 'send', message: 'hi', path: 'x' }],
    [{ action: 'send', message: 'hi', asVoice: true }],
    [{ action: 'send', fileUrl: '/workspace/private.txt' }],
    [{ action: 'send', file_url: '/workspace/private.txt' }],
    [{ action: 'send', message: 'hi', as_video_note: true }],
    // A media key wins over another non-allowlisted option.
    [{ action: 'send', poll: { question: 'q' }, media: 'x' }],
    [{ action: 'send', message: { text: 'hi' } }],
    [{ action: 'send', target: { id: 'x' }, message: 'hi' }],
  ])('blocks a non-owner message with media %j', (params) => {
    expect(resolveOwnerOnlyToolBlock('message', 'user', params)).toEqual({
      ownerOnly: true,
      gate: 'arguments',
      blocked: true,
      reason: MESSAGE_MEDIA_BLOCK_REASON,
    });
    for (const role of ['owner', undefined] as const) {
      expect(resolveOwnerOnlyToolBlock('message', role, params).blocked).toBe(
        false
      );
    }
  });

  it.each([
    ['poll', { action: 'poll', poll: { question: 'q', options: ['a'] } }],
    ['buttons', { action: 'send', message: 'hi', buttons: [] }],
    ['accountId', { action: 'send', message: 'hi', accountId: 'other' }],
    ['gatewayUrl', { action: 'send', message: 'hi', gatewayUrl: 'wss://x' }],
    ['presentation', { action: 'send', presentation: { blocks: [] } }],
  ])(
    'names the non-media message option %s in the block reason',
    (key, params) => {
      const decision = resolveOwnerOnlyToolBlock('message', 'user', params);
      expect(decision).toEqual({
        ownerOnly: true,
        gate: 'arguments',
        blocked: true,
        reason: formatMessageOptionBlockReason(key),
      });
      expect(decision.reason).toContain(`the ${key} message option`);
      expect(decision.reason).not.toContain('attachments');
      expect(
        resolveOwnerOnlyToolBlock('message', 'owner', params).blocked
      ).toBe(false);
    }
  );

  it.each(['poll', 'pollOptionIndexes', 'x'.repeat(300), 'a\nb'])(
    'keeps the message option reason for %j on one line within the cap',
    (key) => {
      const reason = formatMessageOptionBlockReason(key);
      expect(reason.startsWith('Blocked by policy:')).toBe(true);
      expect(reason).not.toMatch(/[\r\n]/);
      expect(reason.length).toBeLessThanOrEqual(200);
    }
  );

  it('leaves MEDIA: directives in the body to core', () => {
    expect(
      resolveOwnerOnlyToolBlock('message', 'user', {
        action: 'send',
        message: 'the MEDIA: prefix tells core to attach a file',
      })
    ).toEqual({ ownerOnly: false, blocked: false });
  });

  it('blocks a local path in an allowed message addressing key', () => {
    expect(
      resolveOwnerOnlyToolBlock('message', 'user', {
        action: 'send',
        target: '/etc/hosts',
        message: 'hi',
      })
    ).toEqual({
      ownerOnly: true,
      gate: 'arguments',
      blocked: true,
      reason: LOCAL_FILE_BLOCK_REASON,
    });
  });

  it.each([[{}], [{ changesSince: 3 }]])(
    'lets a non-owner read the current session status with %j',
    (params) => {
      expect(
        resolveOwnerOnlyToolBlock('session_status', 'user', params)
      ).toEqual({ ownerOnly: false, blocked: false });
    }
  );

  it.each([
    [{ sessionKey: 'agent:main:main' }],
    [{ sessionKey: 'current' }],
    [{ sessionKey: 'agent:main:main', changesSince: 0 }],
    [{ model: 'anthropic/claude' }],
    [{ session_key: 'agent:main:main' }],
  ])('blocks a non-owner session_status call with %j', (params) => {
    expect(resolveOwnerOnlyToolBlock('session_status', 'user', params)).toEqual(
      {
        ownerOnly: true,
        gate: 'tool',
        blocked: true,
        reason: SESSION_ACCESS_BLOCK_REASON,
      }
    );
    expect(
      resolveOwnerOnlyToolBlock('session_status', 'owner', params).blocked
    ).toBe(false);
  });

  it.each([
    SESSION_ACCESS_BLOCK_REASON,
    LOCAL_FILE_BLOCK_REASON,
    MESSAGE_MEDIA_BLOCK_REASON,
  ])('keeps the reason %s on one line within the cap', (reason) => {
    expect(reason.startsWith('Blocked by policy:')).toBe(true);
    expect(reason).toContain('not the owner');
    expect(reason).not.toMatch(/[\r\n]/);
    expect(reason.length).toBeLessThanOrEqual(200);
  });
});
