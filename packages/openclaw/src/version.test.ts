import { describe, expect, it } from 'vitest';

import { formatTlonVersionIdentity } from './version.js';

describe('formatTlonVersionIdentity', () => {
  it.each([
    { markdown: true, expected: '*Harness Version*: **2026.9.4**' },
    { markdown: false, expected: 'Harness Version: 2026.9.4' },
  ])('includes the OpenClaw core version when markdown=$markdown', (test) => {
    const output = formatTlonVersionIdentity({
      markdown: test.markdown,
      harnessVersion: '2026.9.4',
      tlonSkillVersion: '0.3.2',
    });

    expect(output.split('\n')).toContain(test.expected);
  });
});
