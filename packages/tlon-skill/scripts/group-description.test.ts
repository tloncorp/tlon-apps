import { describe, expect, it } from 'bun:test';

import {
  configDescriptionError,
  verifiedGroupMetaWrite,
} from './group-description';

const validConfig = JSON.stringify([
  {
    type: 'tlon-group-agent-config',
    version: 1,
    templateId: 'agent-research',
    purpose: 'Daily research updates.',
    instructions: '',
    agents: ['~pinser-botter-sampel-palnet'],
    jobs: [{ id: 'agent-research', prompt: 'Search the web.' }],
    updatedAt: 1,
  },
]);

describe('configDescriptionError', () => {
  it('passes prose descriptions untouched', () => {
    expect(configDescriptionError('a group about bread')).toBeNull();
    expect(configDescriptionError('')).toBeNull();
  });

  it('passes a valid config array', () => {
    expect(configDescriptionError(validConfig)).toBeNull();
  });

  it('refuses the observed live failure: unescaped inner quotes', () => {
    // The exact class of breakage seen in the pool: the job prompt's inner
    // quotes were stored unescaped, terminating the JSON string early.
    const broken = validConfig.replace(
      '"prompt":"Search the web."',
      '"prompt":"create <flag> "<Title>" --kind notes"'
    );
    const problem = configDescriptionError(broken);
    expect(problem).not.toBeNull();
    expect(problem!).toContain('not valid JSON');
    expect(problem!).toContain('--description-stdin');
  });

  it('refuses a non-array and a wrong version', () => {
    expect(configDescriptionError('[')).toContain('not valid JSON');
    expect(
      configDescriptionError(
        JSON.stringify([
          { type: 'tlon-group-agent-config', version: '1', agents: ['~zod'] },
        ])
      )
    ).toContain('version');
  });

  it('refuses a config with no usable agents list', () => {
    expect(
      configDescriptionError(
        JSON.stringify([{ type: 'tlon-group-agent-config', version: 1 }])
      )
    ).toContain('agents');
    expect(
      configDescriptionError(
        JSON.stringify([
          { type: 'tlon-group-agent-config', version: 1, agents: [] },
        ])
      )
    ).toContain('agents');
  });

  it('ignores non-config entries in an otherwise valid array', () => {
    expect(
      configDescriptionError(JSON.stringify([{ type: 'something-else' }]))
    ).toBeNull();
  });
});

describe('verifiedGroupMetaWrite', () => {
  const meta = {
    title: 'T',
    description: validConfig,
    image: '',
    cover: '',
  };
  const noSleep = () => Promise.resolve();

  it('succeeds when the write lands and reads back', async () => {
    let wrote = 0;
    await verifiedGroupMetaWrite(
      {
        updateGroupMeta: async () => {
          wrote += 1;
        },
        getGroup: async () => ({ title: 'T', description: validConfig }),
        sleep: noSleep,
        warn: () => {},
      },
      '~zod/g',
      meta,
      { pollMs: 0 }
    );
    expect(wrote).toBe(1);
  });

  it('treats a write that errored but landed as success', async () => {
    // Observed live: the meta poke throws a TimeoutError for a write that
    // actually took effect, and a writer that trusts the error routes
    // around a success.
    const warnings: string[] = [];
    await verifiedGroupMetaWrite(
      {
        updateGroupMeta: async () => {
          throw new Error('TimeoutError: active');
        },
        getGroup: async () => ({ title: 'T', description: validConfig }),
        sleep: noSleep,
        warn: (m) => warnings.push(m),
      },
      '~zod/g',
      meta,
      { pollMs: 0 }
    );
    expect(warnings.some((w) => w.includes('did land'))).toBe(true);
  });

  it('retries a write that reported success but never materialized', async () => {
    let wrote = 0;
    await verifiedGroupMetaWrite(
      {
        updateGroupMeta: async () => {
          wrote += 1;
        },
        // The store only reflects the write on the second attempt.
        getGroup: async () =>
          wrote >= 2
            ? { title: 'T', description: validConfig }
            : { title: 'old', description: '' },
        sleep: noSleep,
        warn: () => {},
      },
      '~zod/g',
      meta,
      { pollMs: 0, verifyPolls: 1 }
    );
    expect(wrote).toBe(2);
  });

  it('throws when the stored meta never matches', async () => {
    await expect(
      verifiedGroupMetaWrite(
        {
          updateGroupMeta: async () => {},
          getGroup: async () => ({ title: 'old', description: 'stale' }),
          sleep: noSleep,
          warn: () => {},
        },
        '~zod/g',
        meta,
        { pollMs: 0, verifyPolls: 1, writeAttempts: 2 }
      )
    ).rejects.toThrow('could not be verified');
  });
});
