import { describe, expect, it } from 'vitest';

import {
  OWNER_ONLY_BLOCK_REASON_MAX_CHARS,
  OWNER_ONLY_TOOLS,
  formatOwnerOnlyToolBlockReason,
  resolveOwnerOnlyToolBlock,
} from './owner-only-tools.js';
import { CRON_TOOL_NAMES } from './cron-tool-args-guard.js';
import type { SenderRole } from './session-roles.js';

const EXPECTED_OWNER_ONLY_TOOLS = [
  'tlon',
  'cron',
  'automations',
  'read',
  'write',
  'edit',
  'apply_patch',
  'skill_workshop',
  'exec',
  'process',
  'sandbox_exec',
  'sandbox_process',
  'gateway_exec',
  'gateway_process',
  'node_exec',
  'terminal',
  'tlon_agent_choice',
  'tlon_agent_task_plan',
  'tlon_agent_service_setup',
  'set_timezone',
  'sessions_spawn',
  'sessions_send',
  'openclaw',
] as const;

describe('OWNER_ONLY_TOOLS', () => {
  it('contains exactly the expected tools in advertised order', () => {
    expect([...OWNER_ONLY_TOOLS]).toEqual([...EXPECTED_OWNER_ONLY_TOOLS]);
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
      blocked: true,
    });
    for (const role of ['owner', undefined] as const)
      expect(resolveOwnerOnlyToolBlock('mcp__call', role, { name })).toEqual({
        ownerOnly: true,
        blocked: false,
      });
  });

  it('keeps unrelated MCP tools outside the browser policy', () => {
    expect(
      resolveOwnerOnlyToolBlock('mcp__call', 'user', {
        name: 'weather_forecast',
      })
    ).toEqual({
      ownerOnly: false,
      blocked: false,
    });
  });

  it.each(EXPECTED_OWNER_ONLY_TOOLS)(
    'blocks %s for a non-owner user session with the policy reason',
    (tool) => {
      expect(resolveOwnerOnlyToolBlock(tool, 'user')).toEqual({
        ownerOnly: true,
        blocked: true,
        reason: formatOwnerOnlyToolBlockReason(tool),
      });
    }
  );

  it.each(EXPECTED_OWNER_ONLY_TOOLS)(
    'allows %s for the owner session',
    (tool) => {
      expect(resolveOwnerOnlyToolBlock(tool, 'owner')).toEqual({
        ownerOnly: true,
        blocked: false,
      });
    }
  );

  it.each(EXPECTED_OWNER_ONLY_TOOLS)(
    'allows %s for internal sessions without a stored role',
    (tool) => {
      expect(resolveOwnerOnlyToolBlock(tool, undefined)).toEqual({
        ownerOnly: true,
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
