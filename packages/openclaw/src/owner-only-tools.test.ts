import { describe, expect, it } from 'vitest';

import {
  OWNER_ONLY_BLOCK_REASON_MAX_CHARS,
  OWNER_ONLY_TOOLS,
  formatOwnerOnlyToolBlockReason,
  resolveOwnerOnlyToolBlock,
} from './owner-only-tools.js';
import type { SenderRole } from './session-roles.js';

const EXPECTED_OWNER_ONLY_TOOLS = ['tlon', 'cron', 'read'] as const;

describe('OWNER_ONLY_TOOLS', () => {
  it('contains exactly the expected tools in advertised order', () => {
    expect([...OWNER_ONLY_TOOLS]).toEqual([...EXPECTED_OWNER_ONLY_TOOLS]);
  });
});

describe('resolveOwnerOnlyToolBlock', () => {
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
