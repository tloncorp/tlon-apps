import { describe, expect, it } from 'vitest';
import {
  assessRowMutationWitness,
  rowMutationContractFingerprint,
  type RowMutationContract,
  type RowMutationEvidence,
  type RowMutationSemanticSample,
} from './scrollStabilityMutation';
import type { ScrollSnapshot } from './scrollStabilityTrace';

const sample = (time: number, height: number): ScrollSnapshot => ({
  time,
  scroll: 100,
  contentLength: 2000,
  viewportHeight: 600,
  viewportTop: 100,
  viewportBottom: 600,
  keyboardHeight: 0,
  nearEnd: false,
  rows: [{ key: 'target', y: 200, height }],
  measurement: { valid: true, durationMs: 2 },
});
const evidence = (kind = 'grow'): RowMutationEvidence => ({
  samples: [sample(0, 100), sample(100, 180), sample(200, 180)],
  committedKeys: ['target', 'anchor'],
  events: [
    {
      time: 10,
      name: 'row-mutation-request',
      values: {
        key: 'target',
        kind,
        'previous-content': 'old',
        'expected-content': 'new',
        'previous-reactions': '[]',
        'expected-reactions': kind === 'reaction' ? '["heart"]' : '[]',
        'previous-replies': 0,
        'expected-replies': kind === 'reply' ? 10 : 0,
      },
    },
    {
      time: 30,
      name: 'row-commit',
      values: {
        key: 'target',
        content: 'new',
        reactions: kind === 'reaction' ? '["heart"]' : '[]',
        replies: kind === 'reply' ? 10 : 0,
      },
    },
    { time: 40, name: 'row-layout', values: { key: 'target', height: 180 } },
  ],
});

describe('legacy first-effect diagnostics cannot qualify semantic continuity', () => {
  it.each(['grow', 'shrink', 'media', 'cache', 'reaction', 'reply'])(
    'requires committed content and independently measured size for %s',
    (kind) => {
      expect(assessRowMutationWitness(evidence(kind))).toMatchObject({
        observed: false,
        legacyObserved: true,
        verdict: 'INCOMPLETE',
        evidenceLevel: 'legacy-first-effect',
      });
      const e = evidence(kind);
      e.samples = e.samples.map((s) => ({
        ...s,
        rows: [{ key: 'target', y: 200, height: 100 }],
      }));
      expect(assessRowMutationWitness(e).observed).toBe(false);
    }
  );
  it('does not accept committed IDs alone when the real row skipped rendering', () => {
    const e = evidence();
    e.events = e.events.slice(0, 1);
    expect(assessRowMutationWitness(e).reasons).toContain(
      'expected-row-content-not-committed'
    );
  });
  it.each(['wrong-key', 'stale-content', 'wrong-reactions', 'wrong-replies'])(
    'rejects a %s row commit',
    (corruption) => {
      const e = evidence();
      const values = e.events[1].values!;
      if (corruption === 'wrong-key') values.key = 'other';
      if (corruption === 'stale-content') values.content = 'old';
      if (corruption === 'wrong-reactions') values.reactions = '["wrong"]';
      if (corruption === 'wrong-replies') values.replies = 1;
      expect(assessRowMutationWitness(e).observed).toBe(false);
    }
  );
  it('rejects a layout callback without an independent matching native measurement', () => {
    const e = evidence();
    e.events[2].values!.height = 220;
    expect(assessRowMutationWitness(e).observed).toBe(false);
  });
  it('rejects native height movement without a matching row layout callback', () => {
    const e = evidence();
    e.events = e.events.slice(0, 2);
    expect(assessRowMutationWitness(e).observed).toBe(false);
  });
  it.each(['reference'])(
    'accepts exact %s state commit without inventing a fixed height',
    (kind) => {
      const e = evidence(kind);
      e.events = e.events.slice(0, 2);
      e.samples = e.samples.map((s) => ({
        ...s,
        rows: [{ key: 'target', y: 200, height: 100 }],
      }));
      expect(assessRowMutationWitness(e)).toMatchObject({
        observed: false,
        legacyObserved: true,
        verdict: 'INCOMPLETE',
      });
    }
  );
  it('rejects claiming a reaction change when only the content changed', () => {
    const e = evidence('reaction');
    e.events[0].values!['expected-reactions'] = '[]';
    expect(assessRowMutationWitness(e).reasons).toContain(
      'intended-mutation-field-unchanged'
    );
  });
  it('rejects missing post-commit measurement', () => {
    const e = evidence('reaction');
    e.samples = [sample(0, 100)];
    expect(assessRowMutationWitness(e).observed).toBe(false);
  });
  it('rejects invalid or slow measurements even when layout reports the expected change', () => {
    const e = evidence();
    e.samples = e.samples.map((s) => ({
      ...s,
      measurement: { valid: true, durationMs: 33 },
    }));
    expect(assessRowMutationWitness(e).observed).toBe(false);
  });
  it('rejects duplicate or unmeasured committed data', () => {
    const e = evidence();
    e.committedKeys = undefined;
    expect(assessRowMutationWitness(e).observed).toBe(false);
    e.committedKeys = ['target', 'target'];
    expect(assessRowMutationWitness(e).observed).toBe(false);
  });
  it('rejects a same-value mutation that produced no change', () => {
    const e = evidence();
    e.events[0].values!['expected-content'] = 'old';
    expect(assessRowMutationWitness(e).reasons).toContain(
      'expected-mutation-is-missing-or-unchanged'
    );
  });
  it('rejects a target not independently visible at baseline', () => {
    const e = evidence();
    e.samples[0].rows[0].y = 650;
    expect(assessRowMutationWitness(e).observed).toBe(false);
  });
  it('requires removal detach, committed absence, and measured final absence together', () => {
    const e = evidence('remove');
    e.events = [
      e.events[0],
      { time: 30, name: 'row-detached', values: { key: 'target' } },
    ];
    e.committedKeys = ['anchor'];
    e.samples = [sample(0, 100), { ...sample(100, 100), rows: [] }];
    expect(assessRowMutationWitness(e)).toMatchObject({
      observed: false,
      legacyObserved: true,
      verdict: 'INCOMPLETE',
    });
    e.committedKeys = undefined;
    expect(assessRowMutationWitness(e).observed).toBe(false);
    e.committedKeys = ['anchor'];
    e.events = e.events.slice(0, 1);
    expect(assessRowMutationWitness(e).observed).toBe(false);
  });
  it('rejects stale pre-action commit/layout events', () => {
    const e = evidence();
    e.events = [
      { ...e.events[1], time: 2 },
      { ...e.events[2], time: 3 },
      e.events[0],
    ];
    expect(assessRowMutationWitness(e).observed).toBe(false);
  });
});

function strictEvidence(kind: 'grow' | 'reference' | 'remove' = 'grow') {
  const signature = (content: string) => ({
    content,
    reactions: '[]',
    replies: 0,
  });
  const baseline = {
    requestId: 'initial',
    revision: 'r0',
    state: { presence: 'present' as const, signature: signature('old') },
  };
  const contract: RowMutationContract = {
    version: 1,
    scope: 'channel-A/view-1',
    key: 'target',
    kind,
    declaredAt: 0,
    baseline,
    coverage: {
      startTime: 0,
      endTime: 2200,
      maxGapMs: 125,
      maxMeasurementDurationMs: 32,
    },
    deferredUntil: 1200,
    phases:
      kind === 'remove'
        ? [
            {
              id: 'remove',
              requestId: 'request-1',
              revision: 'r1',
              state: { presence: 'absent' },
              requestWindow: { startTime: 200, endTime: 220 },
              observationWindow: { startTime: 300, endTime: 2200 },
              effect: 'remove',
            },
          ]
        : [0, 1].map((index) => ({
            id: `phase-${index + 1}`,
            requestId: `request-${index + 1}`,
            revision: `r${index + 1}`,
            state: {
              presence: 'present',
              signature: signature(`new-${index + 1}`),
            },
            requestWindow: {
              startTime: index ? 600 : 200,
              endTime: index ? 620 : 220,
            },
            observationWindow: {
              startTime: index ? 700 : 300,
              endTime: index ? 2200 : 600,
            },
            effect: kind === 'reference' ? 'commit' : 'resize',
          })),
  };
  const events: RowMutationEvidence['events'][number][] = [
    {
      time: -10,
      name: 'row-commit',
      values: {
        key: contract.key,
        scope: contract.scope,
        requestId: baseline.requestId,
        revision: baseline.revision,
        commitId: 'commit-0',
        ...baseline.state.signature,
      },
    },
    {
      time: 0,
      name: 'row-mutation-plan',
      values: { contract: rowMutationContractFingerprint(contract) },
    },
  ];
  for (const [index, phase] of contract.phases.entries()) {
    const ownership = {
      key: contract.key,
      scope: contract.scope,
      requestId: phase.requestId,
      revision: phase.revision,
    };
    events.push({
      time: phase.requestWindow.startTime + 10,
      name: 'row-mutation-request',
      values: { ...ownership, phaseId: phase.id, kind },
    });
    const commitId = `commit-${index + 1}`;
    events.push({
      time: phase.requestWindow.startTime + 50,
      name: phase.effect === 'remove' ? 'row-detached' : 'row-commit',
      values: {
        ...ownership,
        commitId,
        ...(phase.state.presence === 'present' ? phase.state.signature : {}),
      },
    });
    if (phase.effect === 'resize')
      events.push({
        time: phase.requestWindow.startTime + 70,
        name: 'row-layout',
        values: { ...ownership, commitId, height: index ? 120 : 180 },
      });
  }
  const samples = Array.from({ length: 45 }, (_, index) => {
    const time = index * 50;
    const height =
      kind === 'reference' || time < 250 ? 100 : time < 650 ? 180 : 120;
    return {
      ...sample(time, height),
      viewportHeight: 500,
      ...(kind === 'remove' && time >= 250 ? { rows: [] } : {}),
    };
  });
  const semanticSamples: RowMutationSemanticSample[] = samples.map(
    ({ time }) => {
      const phase =
        time < 250
          ? undefined
          : contract.phases.at(time < 650 || kind === 'remove' ? 0 : 1);
      const revision = phase ?? baseline;
      return {
        time,
        scope: contract.scope,
        key: contract.key,
        requestId: revision.requestId,
        revision: revision.revision,
        state: structuredClone(revision.state),
        commitId: !phase
          ? 'commit-0'
          : `commit-${contract.phases.indexOf(phase) + 1}`,
        committedKeys:
          revision.state.presence === 'absent'
            ? ['anchor']
            : ['target', 'anchor'],
        measurement: { valid: true, durationMs: 2 },
      };
    }
  );
  return {
    events,
    samples,
    semanticSamples,
    contract,
    committedKeys: [...semanticSamples.at(-1)!.committedKeys],
  };
}
type StrictEvidence = ReturnType<typeof strictEvidence>;
const declare = (e: StrictEvidence) => {
  e.events.find(
    (event) => event.name === 'row-mutation-plan'
  )!.values!.contract = rowMutationContractFingerprint(e.contract);
};
function transientCommit(
  e: StrictEvidence,
  time: number,
  values: Record<string, number | string | boolean>
) {
  const current = e.events
    .filter((event) => event.name === 'row-commit' && event.time < time)
    .at(-1)!;
  e.events.push({
    time,
    name: 'row-commit',
    values: { ...current.values, commitId: `fault-${time}`, ...values },
  });
  e.events.push({
    time: time + 1,
    name: 'row-commit',
    values: { ...current.values, commitId: `restore-${time}` },
  });
  e.events.sort((a, b) => a.time - b.time);
  for (const sample of e.semanticSamples)
    if (sample.time >= time + 1) sample.commitId = `restore-${time}`;
}

describe('predeclared phase and terminal row semantics (sampled evidence only)', () => {
  it.each(['grow', 'reference', 'remove'] as const)(
    'accepts complete %s phases, retaining strict evidence limits',
    (kind) => {
      const result = assessRowMutationWitness(strictEvidence(kind));
      expect(result).toMatchObject({
        observed: true,
        verdict: 'PASS',
        evidenceLevel: 'sampled-row-semantics',
        nativePresentation: 'INCOMPLETE',
        issues: [],
      });
    }
  );

  it('keeps fingerprints independent of object property insertion order', () => {
    const plan = strictEvidence().contract;
    expect(
      rowMutationContractFingerprint({
        ...plan,
        coverage: {
          maxGapMs: 125,
          maxMeasurementDurationMs: 32,
          endTime: 2200,
          startTime: 0,
        },
      })
    ).toBe(rowMutationContractFingerprint(plan));
  });

  it('allows fixed windows to be frozen after baseline acquisition and before any request', () => {
    const e = strictEvidence();
    e.contract.declaredAt = 100;
    e.events.find((event) => event.name === 'row-mutation-plan')!.time = 100;
    e.events.sort((a, b) => a.time - b.time);
    declare(e);
    expect(assessRowMutationWitness(e).verdict).toBe('PASS');
    e.contract.declaredAt = 200;
    e.events.find((event) => event.name === 'row-mutation-plan')!.time = 200;
    declare(e);
    expect(assessRowMutationWitness(e).verdict).toBe('INCOMPLETE');
  });

  it.each([
    [
      'missing semantic samples',
      (e: StrictEvidence) => {
        delete (e as Partial<RowMutationEvidence>).semanticSamples;
      },
    ],
    [
      'posthoc undeclared windows',
      (e: StrictEvidence) => {
        e.contract.phases[0].observationWindow.startTime += 1;
      },
    ],
    [
      'plan declared after the first request',
      (e: StrictEvidence) => {
        e.contract.declaredAt = 211;
        e.events.find((event) => event.name === 'row-mutation-plan')!.time =
          211;
        e.events.sort((a, b) => a.time - b.time);
        declare(e);
      },
    ],
    [
      'missing plan event',
      (e: StrictEvidence) => {
        e.events = e.events.filter(
          (event) => event.name !== 'row-mutation-plan'
        );
      },
    ],
    [
      'duplicate plan',
      (e: StrictEvidence) => {
        e.events.splice(2, 0, structuredClone(e.events[1]));
      },
    ],
    [
      'weakened capture gap',
      (e: StrictEvidence) => {
        e.contract.coverage.maxGapMs = 126;
        declare(e);
      },
    ],
    [
      'weakened acquisition duration',
      (e: StrictEvidence) => {
        e.contract.coverage.maxMeasurementDurationMs = 33;
        declare(e);
      },
    ],
    [
      'short phase hidden by supersession',
      (e: StrictEvidence) => {
        e.contract.phases[0].observationWindow.endTime = 450;
        declare(e);
      },
    ],
    [
      'request supersedes an unobserved phase',
      (e: StrictEvidence) => {
        e.contract.phases[1].requestWindow.startTime = 590;
        declare(e);
      },
    ],
    [
      'quiet tail ends before a known callback deadline',
      (e: StrictEvidence) => {
        e.contract.deferredUntil = 1201;
        declare(e);
      },
    ],
    [
      'reused request identity',
      (e: StrictEvidence) => {
        e.contract.phases[1].requestId = 'request-1';
        declare(e);
      },
    ],
    [
      'reused semantic revision',
      (e: StrictEvidence) => {
        e.contract.phases[1].revision = 'r1';
        declare(e);
      },
    ],
    [
      'undeclared same-state no-op',
      (e: StrictEvidence) => {
        e.contract.phases[0].state = structuredClone(e.contract.baseline.state);
        declare(e);
      },
    ],
    [
      'missing first request',
      (e: StrictEvidence) => {
        e.events = e.events.filter(
          (event) =>
            !(
              event.name === 'row-mutation-request' &&
              event.values?.requestId === 'request-1'
            )
        );
      },
    ],
    [
      'request from another scope',
      (e: StrictEvidence) => {
        e.events.find(
          (event) => event.name === 'row-mutation-request'
        )!.values!.scope = 'channel-B';
      },
    ],
    [
      'request outside predeclared window',
      (e: StrictEvidence) => {
        e.events.find((event) => event.name === 'row-mutation-request')!.time =
          225;
      },
    ],
    [
      'missing terminal samples',
      (e: StrictEvidence) => {
        e.samples.pop();
        e.semanticSamples.pop();
      },
    ],
    [
      'missing aligned semantic sample',
      (e: StrictEvidence) => {
        e.semanticSamples.splice(12, 1);
      },
    ],
    [
      'capture gap',
      (e: StrictEvidence) => {
        e.samples.splice(12, 3);
        e.semanticSamples.splice(12, 3);
      },
    ],
    [
      'duplicate geometry timestamp',
      (e: StrictEvidence) => {
        e.samples[12].time = e.samples[11].time;
        e.semanticSamples[12].time = e.samples[11].time;
      },
    ],
    [
      'invalid native acquisition',
      (e: StrictEvidence) => {
        e.samples[12].measurement!.valid = false;
      },
    ],
    [
      'slow semantic acquisition',
      (e: StrictEvidence) => {
        e.semanticSamples[12].measurement.durationMs = 33;
      },
    ],
    [
      'fabricated latest commit reference',
      (e: StrictEvidence) => {
        e.semanticSamples[20].commitId = 'commit-1';
      },
    ],
    [
      'committed revision without scoped ownership',
      (e: StrictEvidence) => {
        delete e.events.find((event) => event.values?.commitId === 'commit-1')!
          .values!.requestId;
      },
    ],
    [
      'duplicate commit identity',
      (e: StrictEvidence) => {
        e.events.find(
          (event) => event.values?.commitId === 'commit-2'
        )!.values!.commitId = 'commit-1';
      },
    ],
    [
      'unmeasured rendered row',
      (e: StrictEvidence) => {
        e.samples[20].rows = [];
      },
    ],
    [
      'duplicate rendered row',
      (e: StrictEvidence) => {
        e.samples[20].rows.push({ ...e.samples[20].rows[0] });
      },
    ],
    [
      'missing committed membership',
      (e: StrictEvidence) => {
        e.semanticSamples[20].committedKeys = ['anchor'];
      },
    ],
    [
      'contradictory final data',
      (e: StrictEvidence) => {
        e.committedKeys = ['anchor'];
      },
    ],
    [
      'unwitnessed phase layout',
      (e: StrictEvidence) => {
        e.events = e.events.filter(
          (event) =>
            !(event.name === 'row-layout' && event.values?.revision === 'r1')
        );
      },
    ],
    [
      'layout from another request',
      (e: StrictEvidence) => {
        e.events.find(
          (event) => event.name === 'row-layout'
        )!.values!.requestId = 'other';
      },
    ],
    [
      'layout height without independent measurement',
      (e: StrictEvidence) => {
        e.events.find((event) => event.name === 'row-layout')!.values!.height =
          200;
      },
    ],
    [
      'size arrives after stable deadline',
      (e: StrictEvidence) => {
        e.events.find((event) => event.name === 'row-layout')!.time = 301;
        e.events.sort((a, b) => a.time - b.time);
      },
    ],
  ])('cannot pass %s', (_name, corrupt) => {
    const e = strictEvidence();
    corrupt(e);
    expect(assessRowMutationWitness(e).verdict).toBe('INCOMPLETE');
  });

  it.each([
    ['old content between correct commits', { content: 'old' }],
    ['old reactions between correct commits', { reactions: '["stale"]' }],
    ['old replies between correct commits', { replies: 9 }],
    ['stale request with identical pixels', { requestId: 'request-1' }],
    ['stale revision with identical pixels', { revision: 'r1' }],
  ])(
    'rejects %s even without a geometry sample during the fault',
    (_name, values) => {
      const e = strictEvidence();
      transientCommit(e, 1510, values);
      expect(assessRowMutationWitness(e)).toMatchObject({
        observed: false,
        verdict: 'FAIL',
      });
      expect(assessRowMutationWitness(e).reasons).toContain(
        'stale-skipped-or-undeclared-semantic-revision'
      );
    }
  );

  it('rejects an intermediate correct→stale→correct transition before its stable window', () => {
    const e = strictEvidence();
    transientCommit(e, 280, {
      content: 'old',
      requestId: 'initial',
      revision: 'r0',
    });
    // The second phase has its own later commit and must remain its sample source.
    for (const s of e.semanticSamples)
      if (s.time >= 650) s.commitId = 'commit-2';
    expect(assessRowMutationWitness(e).verdict).toBe('FAIL');
  });

  it('does not use a later terminal commit to satisfy a skipped intermediate phase', () => {
    const e = strictEvidence();
    e.events = e.events.filter(
      (event) => event.values?.commitId !== 'commit-1'
    );
    for (const [index, s] of e.semanticSamples.entries())
      if (s.time >= 250 && s.time < 650) {
        Object.assign(s, structuredClone(e.contract.baseline), {
          commitId: 'commit-0',
        });
        e.samples[index].rows[0].height = 100;
      }
    const result = assessRowMutationWitness(e);
    expect(result.verdict).toBe('INCOMPLETE');
    expect(result.reasons).toContain(
      'required-phase-not-observed-before-supersession'
    );
  });

  it('rejects a persistent correct→stale terminal revision with coherent raw measurements', () => {
    const e = strictEvidence();
    e.events.push({
      time: 1500,
      name: 'row-commit',
      values: { ...e.events[0].values, commitId: 'stale-terminal' },
    });
    for (const [index, s] of e.semanticSamples.entries())
      if (s.time >= 1500) {
        Object.assign(s, structuredClone(e.contract.baseline), {
          commitId: 'stale-terminal',
        });
        e.samples[index].rows[0].height = 100;
      }
    expect(assessRowMutationWitness(e).verdict).toBe('FAIL');
  });

  it('requires committed absence throughout removal and rejects later resurrection', () => {
    const e = strictEvidence('remove');
    e.samples[30].rows = [{ key: 'target', y: 200, height: 100 }];
    expect(assessRowMutationWitness(e).verdict).toBe('FAIL');
    e.samples[30].rows = [];
    e.events.push({
      time: 1510,
      name: 'row-commit',
      values: { ...e.events[0].values, commitId: 'resurrected' },
    });
    e.events.push({
      time: 1511,
      name: 'row-detached',
      values: {
        ...e.events.find((event) => event.name === 'row-detached')!.values,
        commitId: 'removed-again',
      },
    });
    for (const s of e.semanticSamples)
      if (s.time >= 1511) s.commitId = 'removed-again';
    expect(assessRowMutationWitness(e).verdict).toBe('FAIL');
  });

  it.each([
    null,
    {},
    { events: null, samples: [] },
    { ...evidence(), contract: {} },
    { ...evidence(), contract: { version: 1 } },
  ])('rejects malformed imported evidence without throwing', (e) => {
    expect(
      assessRowMutationWitness(e as unknown as RowMutationEvidence).verdict
    ).toBe('INCOMPLETE');
  });
});
