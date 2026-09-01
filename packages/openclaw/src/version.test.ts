import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { formatTlonVersionIdentity } from './version.js';

describe('formatTlonVersionIdentity', () => {
  it.each([
    { markdown: true, expected: '*Harness Version*: **2026.7.1**' },
    { markdown: false, expected: 'Harness Version: 2026.7.1' },
  ])('includes the OpenClaw core version when markdown=$markdown', (test) => {
    const output = formatTlonVersionIdentity({
      markdown: test.markdown,
      harnessVersion: '2026.7.1',
      tlonSkillVersion: '0.3.2',
    });

    expect(output.split('\n')).toContain(test.expected);
  });

  it('documents conversation-hook access in the normal installation config', () => {
    const readme = readFileSync(
      new URL('../README.md', import.meta.url),
      'utf8'
    );
    const installation = readme.slice(
      readme.indexOf('## Installation'),
      readme.indexOf('## Telemetry')
    );

    expect(installation).toContain('plugins:');
    expect(installation).toContain('allowConversationAccess: true');
    expect(installation).toContain(
      '`plugins.entries.tlon.hooks.allowConversationAccess: true` is required'
    );
  });

  it('keeps workspace Node pins at the supported OpenClaw runtime floor', () => {
    const rootPin = readFileSync(
      new URL('../../../.nvmrc', import.meta.url),
      'utf8'
    ).trim();
    const webPin = readFileSync(
      new URL('../../../apps/tlon-web/.tool-versions', import.meta.url),
      'utf8'
    ).trim();

    expect(rootPin).toBe('22.22.3');
    expect(webPin).toBe('nodejs 22.22.3');
  });
});
