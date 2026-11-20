import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildHeartbeatEvidence,
  renderHeartbeatEvidence,
  setHeartbeatSetupReader,
} from './heartbeat-evidence.js';

describe('heartbeat evidence packet', () => {
  let workspaceDir: string;
  const now = new Date('2026-12-01T01:00:00Z');
  const build = async () =>
    renderHeartbeatEvidence(
      await buildHeartbeatEvidence({
        workspaceDir,
        now,
        timezone: 'America/Chicago',
      })
    );

  beforeEach(async () => {
    workspaceDir = await fs.mkdtemp(path.join(tmpdir(), 'heartbeat-evidence-'));
    await fs.mkdir(path.join(workspaceDir, 'memory'));
  });

  afterEach(async () => {
    setHeartbeatSetupReader(null);
    await fs.rm(workspaceDir, { recursive: true, force: true });
  });

  it('provides the current setup, outside preferences, last 100 records and owner-local notes', async () => {
    setHeartbeatSetupReader(() => true);
    const ledger = Array.from(
      { length: 101 },
      (_, i) => `record ${i.toString().padStart(3, '0')}`
    );
    await Promise.all([
      fs.writeFile(
        path.join(workspaceDir, 'PROACTIVE_LEDGER.md'),
        [...ledger, '<!-- ledger-end -->', ''].join('\n')
      ),
      fs.writeFile(
        path.join(workspaceDir, 'PROACTIVE_PREFERENCES.md'),
        [
          '## Bring me',
          'project updates',
          '<!-- idempotency-marker:tlon-proactive-preferences:v2 -->',
          'managed instructions',
          '<!-- /idempotency-marker -->',
          '## When',
          'after lunch',
        ].join('\r\n')
      ),
      fs.writeFile(
        path.join(workspaceDir, 'memory/2026-11-30.md'),
        'today in Chicago'
      ),
    ]);
    const packet = await build();
    expect(packet).toContain('bootstrapComplete: true');
    expect(packet).toContain('project updates');
    expect(packet).toContain('after lunch');
    expect(packet).not.toContain('managed instructions');
    expect(packet).not.toContain('record 000');
    expect(packet).toContain('record 001');
    expect(packet).toContain('record 100');
    expect(packet).not.toContain('<!-- ledger-end -->');
    expect(packet).toContain(
      'memory/2026-11-30.md (current)\ntoday in Chicago'
    );
    expect(packet).toContain('memory/2026-11-29.md (absent)');
  });

  it('keeps the newest end of oversized sections and falls back per file', async () => {
    await fs.mkdir(path.join(workspaceDir, 'PROACTIVE_LEDGER.md'));
    await fs.writeFile(
      path.join(workspaceDir, 'memory/2026-11-30.md'),
      'old content\n' + '雪'.repeat(3_000) + '\nnewest content'
    );
    const packet = await build();
    expect(packet).toContain('Setup (unavailable)');
    expect(packet).toContain('PROACTIVE_LEDGER.md (unavailable)');
    expect(packet).toContain('PROACTIVE_PREFERENCES.md (absent)');
    expect(packet).toContain('memory/2026-11-30.md (truncated)');
    expect(packet).toContain('newest content');
    expect(packet).not.toContain('old content');
    expect(packet).not.toContain('\ufffd');
    expect(Buffer.byteLength(packet)).toBeLessThan(8_600);
  });
});
