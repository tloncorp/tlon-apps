import { describe, expect, it } from 'vitest';

import {
  DELEGATION_TOOL_NAMES,
  OWNER_ONLY_BLOCK_REASON_MAX_CHARS,
  OWNER_ONLY_TOOLS,
  LOCAL_FILE_BLOCK_REASON,
  MESSAGE_MEDIA_BLOCK_REASON,
  NON_OWNER_ALLOWED_TOOLS,
  NON_OWNER_DISPATCH_CONTROLS,
  SESSION_ACCESS_BLOCK_REASON,
  SESSION_ACCESS_TOOL_NAMES,
  formatMessageOptionBlockReason,
  formatOwnerOnlyDelegationBlockReason,
  formatOwnerOnlyToolBlockReason,
  normalizePolicyToolName,
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
    ['web_fetch', { text: 'x', voiceFile: './frame.png' }],
    ['web_fetch', { text: 'hi', outputPath: '/tmp/out.mp3' }],
    ['web_fetch', { text: 'x', voice: 'private.png' }],
    ['web_fetch', { text: 'x', voice: '@private' }],
    ['web_fetch', { text: 'x', voice: 'MEDIA: /etc/passwd' }],
    ['web_fetch', { text: 'x', voice: 'C:\\Users\\a.txt' }],
    ['web_fetch', { text: 'x', voice: '\\\\host\\share\\a.txt' }],
    ['web_fetch', { text: 'x', voice: 'file:///etc/passwd' }],
    // The `query` exemption is web_search's alone.
    ['web_fetch', { query: 'notes/a.pdf' }],
    ['web_fetch', { query: 'My Docs/a.pdf' }],
    ['web_fetch', { query: 'workspace/secret' }],
    ['web_fetch', { url: 'file:///etc/passwd' }],
    ['web_fetch', { url: '/etc/passwd' }],
    // web_search keys other than `query` still get the check.
    ['web_search', { query: 'x', path: '~/notes/a.pdf' }],
    ['web_search', { query: 'x', file: '/etc/hosts' }],
    // Exemptions are bound to their keys.
    ['web_fetch', { text: 'x', voice: 'text/private.txt' }],
    ['web_fetch', { text: 'x', mimeType: 'text/../../private' }],
    ['web_fetch', { text: 'x', voice: 'chat/~zod/general' }],
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
    ['web_fetch', { text: 'x', contentType: 'audio/mpeg' }],
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
      resolveOwnerOnlyToolBlock('web_fetch', 'user', { text: '/etc/hosts' })
        .blocked
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

  it('lets a non-owner send public https media under a URL media key', () => {
    const cfg = { channels: { tlon: { url: 'https://zod.tlon.network' } } };
    const decide = (params: Record<string, unknown>) =>
      resolveOwnerOnlyToolBlock('message', 'user', params, cfg as never);
    for (const params of [
      { action: 'send', media: 'https://a.example/c.png' },
      { action: 'send', mediaUrl: 'https://a.example/c.png', message: 'hi' },
      { message: 'hi', mediaUrls: ['https://a.example/c.png'] },
    ]) {
      expect(decide(params)).toEqual({ ownerOnly: false, blocked: false });
    }
    for (const params of [
      { action: 'send', media: 'https://zod.tlon.network/c.png' },
      { action: 'send', mediaUrls: ['https://a.example/c.png', '/x.png'] },
      { action: 'send', mediaUrls: [{ url: 'https://a.example/c.png' }] },
      { action: 'reply', messageId: '~zod/1', media: 'https://a.example/c' },
      { action: 'send', path: 'https://a.example/c.png' },
    ]) {
      expect(decide(params)).toMatchObject({
        blocked: true,
        reason: MESSAGE_MEDIA_BLOCK_REASON,
      });
    }
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

describe('NON_OWNER_ALLOWED_TOOLS', () => {
  it('contains exactly the tools a non-owner may call', () => {
    expect([...NON_OWNER_ALLOWED_TOOLS]).toEqual([
      'web_search',
      'web_fetch',
      'message',
      'session_status',
      'sessions_yield',
      'agents_wait',
      'progress_card',
      'lcm_grep',
    ]);
    expect([...NON_OWNER_DISPATCH_CONTROLS]).toEqual([
      'tool_search',
      'tool_describe',
      'tool_call',
    ]);
    for (const name of [
      ...NON_OWNER_ALLOWED_TOOLS,
      ...NON_OWNER_DISPATCH_CONTROLS,
    ]) {
      expect(OWNER_ONLY_TOOLS.has(name)).toBe(false);
    }
  });

  it.each([...NON_OWNER_ALLOWED_TOOLS, ...NON_OWNER_DISPATCH_CONTROLS])(
    'lets a non-owner call %s and blocks its near neighbours',
    (tool) => {
      expect(resolveOwnerOnlyToolBlock(tool, 'user', {})).toEqual({
        ownerOnly: false,
        blocked: false,
      });
      for (const neighbour of [`${tool}s`, `${tool}_all`, `x${tool}`]) {
        expect(resolveOwnerOnlyToolBlock(neighbour, 'user', {}).blocked).toBe(
          true
        );
      }
    }
  );

  it.each(['exec', 'wait', 'openclawexec'])(
    'keeps Code Mode %s owner-only for a non-owner',
    (tool) => {
      const params = { title: 'skills', code: 'return await skills.list()' };
      expect(resolveOwnerOnlyToolBlock(tool, 'user', params)).toEqual({
        ownerOnly: true,
        gate: 'tool',
        blocked: true,
        reason: formatOwnerOnlyToolBlockReason(normalizePolicyToolName(tool)),
      });
      for (const role of ['owner', undefined] as const) {
        expect(resolveOwnerOnlyToolBlock(tool, role, params).blocked).toBe(
          false
        );
      }
    }
  );

  it('skips the local-file rule for dispatch controls only', () => {
    expect(
      resolveOwnerOnlyToolBlock('tool_call', 'user', {
        id: 'web_fetch',
        args: { url: '/workspace/a.png' },
      }).blocked
    ).toBe(false);
    expect(
      resolveOwnerOnlyToolBlock('web_fetch', 'user', {
        url: '/workspace/a.png',
      }).blocked
    ).toBe(true);
  });

  // Every tool non-owner turns called in production over 90 days, and the
  // owner-only tools the allowlist replaces as the deciding rule.
  const PRODUCTION_DECISIONS: [string, boolean][] = [
    ['web_search', true],
    ['web_fetch', true],
    ['message', true],
    ['sessions_yield', true],
    ['lcm_grep', true],
    ['session_status', true],
    ['agents_wait', true],
    ['progress_card', true],
    ['tool_search', true],
    ['tool_describe', true],
    ['tool_call', true],
    ['wait', false],
    ['mcp__call', false],
    ['mcp__search', false],
    ['tlon', false],
    ['read', false],
    ['write', false],
    ['edit', false],
    ['exec', false],
    ['sandbox_exec', false],
    ['cron', false],
    ['automations', false],
    ['pdf', false],
    ['image', false],
    ['view_image', false],
    ['memory_search', false],
    ['memory_get', false],
    ['lcm_expand', false],
    ['lcm_expand_query', false],
    ['lcm_describe', false],
    ['sessions_search', false],
    ['sessions_history', false],
    ['sessions_list', false],
    ['sessions_spawn', false],
    ['subagents', false],
    ['agents_list', false],
    ['tlon_connectable_services', false],
  ];

  it.each(PRODUCTION_DECISIONS)(
    'decides %s for a non-owner (allowed: %s), bare and Codex-namespaced',
    (tool, allowed) => {
      for (const name of [tool, `openclaw${tool}`, `openclaw_direct${tool}`]) {
        const decision = resolveOwnerOnlyToolBlock(name, 'user');
        expect(decision.blocked).toBe(!allowed);
        expect(decision).toEqual(resolveOwnerOnlyToolBlock(tool, 'user'));
      }
    }
  );

  it.each(PRODUCTION_DECISIONS)(
    'leaves %s open to owner and role-less sessions',
    (tool) => {
      for (const role of ['owner', undefined] as const) {
        expect(resolveOwnerOnlyToolBlock(tool, role).blocked).toBe(false);
        expect(resolveOwnerOnlyToolBlock(`openclaw${tool}`, role).blocked).toBe(
          false
        );
      }
    }
  );

  it.each(['foo__bar', 'some_new_core_tool', 'Some_New_Core_Tool'])(
    'blocks a tool outside the allowed set (%s) for a non-owner',
    (tool) => {
      expect(resolveOwnerOnlyToolBlock(tool, 'user')).toEqual({
        ownerOnly: true,
        gate: 'tool',
        blocked: true,
        reason: formatOwnerOnlyToolBlockReason(tool.toLowerCase()),
      });
      for (const role of ['owner', undefined] as const) {
        expect(resolveOwnerOnlyToolBlock(tool, role)).toEqual({
          ownerOnly: true,
          gate: 'tool',
          blocked: false,
        });
      }
    }
  );

  it('keeps the reason for a long unknown tool name within the cap', () => {
    const reason = resolveOwnerOnlyToolBlock(
      `server__${'x'.repeat(200)}`,
      'user'
    ).reason;
    expect(reason).toContain('this tool is owner-only');
    expect(reason?.length).toBeLessThanOrEqual(
      OWNER_ONLY_BLOCK_REASON_MAX_CHARS
    );
  });

  it('keeps the specific reasons for namespaced owner-only tools', () => {
    expect(resolveOwnerOnlyToolBlock('openclawsessions_spawn', 'user')).toEqual(
      {
        ownerOnly: true,
        gate: 'tool',
        blocked: true,
        reason: formatOwnerOnlyDelegationBlockReason('sessions_spawn'),
      }
    );
    expect(
      resolveOwnerOnlyToolBlock('openclawsessions_history', 'user').reason
    ).toBe(SESSION_ACCESS_BLOCK_REASON);
  });

  it.each([
    ['openclaw', 'openclaw'],
    ['openclawweb_search', 'web_search'],
    ['openclaw_directsessions_yield', 'sessions_yield'],
    [' OpenClawMessage ', 'message'],
    ['web_search', 'web_search'],
  ])('normalizes %j to %j', (raw, expected) => {
    expect(normalizePolicyToolName(raw)).toBe(expected);
  });

  it.each([
    [{ pattern: 'deadline' }],
    [{ pattern: 'deadline', mode: 'full_text', scope: 'both', limit: 10 }],
    [{ pattern: 'deadline', allConversations: false }],
  ])('lets a non-owner grep the current conversation with %j', (params) => {
    expect(resolveOwnerOnlyToolBlock('lcm_grep', 'user', params)).toEqual({
      ownerOnly: false,
      blocked: false,
    });
  });

  it.each([
    [{ pattern: 'deadline', conversationId: 3 }],
    [{ pattern: 'deadline', allConversations: true }],
    [{ pattern: 'deadline', sessionKey: 'agent:main:main' }],
  ])(
    'blocks a non-owner lcm_grep beyond the conversation with %j',
    (params) => {
      expect(resolveOwnerOnlyToolBlock('lcm_grep', 'user', params)).toEqual({
        ownerOnly: true,
        gate: 'tool',
        blocked: true,
        reason: SESSION_ACCESS_BLOCK_REASON,
      });
      expect(
        resolveOwnerOnlyToolBlock('lcm_grep', 'owner', params).blocked
      ).toBe(false);
    }
  );
});
