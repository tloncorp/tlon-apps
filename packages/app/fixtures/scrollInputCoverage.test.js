import { describe, expect, it } from 'vitest';
import {
  replayWebInput,
  webScenarioRegistry,
  assessWebEvidence,
} from '../../../scripts/scroll-stability-web-evidence.mjs';
import { SCROLL_INPUT_GROWTH_DRAFT } from './scrollInputTrace';

function evidence(position = 'end') {
  const scopeKey = '/apps/groups/groups/test/channel/chat/~zod/test';
  const state = (draft) => ({
    scopeKey,
    inputId: 'MessageInput',
    draft,
    selection: { start: draft.length, end: draft.length },
    composing: false,
    focused: true,
    caretVisible: true,
    sendVisible: true,
    sendHitTestable: draft.length > 0,
  });
  const actions = [SCROLL_INPUT_GROWTH_DRAFT, ''].map((payload, index) => ({
    id: `input-${index + 1}`,
    kind: 'input',
    scopeKey,
    inputId: 'MessageInput',
    payload,
  }));
  const contract = {
    version: 1,
    declaredAt: -1,
    start: 0,
    end: 1800,
    deferredThrough: 800,
    actions,
    phases: [
      { id: 'before', start: 0, end: 100, expected: state('') },
      {
        id: 'grown',
        start: 100,
        end: 500,
        triggerActionId: 'input-1',
        expected: state(SCROLL_INPUT_GROWTH_DRAFT),
      },
      {
        id: 'cleared',
        start: 500,
        end: 1800,
        triggerActionId: 'input-2',
        expected: state(''),
      },
    ],
  };
  const samples = Array.from({ length: 91 }, (_, index) => ({
    ...state(index >= 5 && index < 25 ? SCROLL_INPUT_GROWTH_DRAFT : ''),
    time: index * 20,
    valid: true,
  }));
  const raw = {
    declaredAt: -1,
    originalScope: scopeKey,
    inputId: 'MessageInput',
    samples,
    actions: actions.map((action, index) => ({
      ...action,
      time: index ? 500 : 100,
      observedAt: index ? 500 : 100,
      trusted: true,
    })),
    commandPlan: actions,
    dispatches: actions.map((action, index) => ({
      ...action,
      start: index ? 495 : 95,
      end: index ? 510 : 110,
    })),
  };
  const frames = samples.map((sample) => {
    const clientHeight = sample.time >= 100 && sample.time < 500 ? 60 : 100;
    const scrollTop =
      position === 'end'
        ? 1000 - clientHeight
        : position === 'near'
          ? 827
          : 500;
    return {
      time: sample.time,
      scrollHeight: 1000,
      scrollTop,
      clientHeight,
      viewportTop: 10,
      viewportBottom: 10 + clientHeight,
      bottomGap: 1000 - clientHeight - scrollTop,
      anchors:
        position === 'end'
          ? {}
          : { reading: { top: 20, bottom: 40, height: 20 } },
    };
  });
  const scenario = `web-composer-exact-${position === 'near' ? 'history' : position === 'deep' ? 'deep-history' : 'end'}`;
  return {
    scenario,
    executed: true,
    reportedStatus: 'passed',
    expectedStatus: 'passed',
    contract: webScenarioRegistry.find((entry) => entry.scenario === scenario),
    browserTraces: [
      {
        name: 'composer-exact-geometry',
        value: {
          frames,
          errors: [],
          marks: [
            { label: 'composer-exact-geometry:start', time: 10 },
            { label: 'composer-exact-geometry:terminal-state', time: 510 },
          ],
        },
      },
    ],
    inputProofs: [
      {
        name: 'composer-exact-input-proof',
        value: { contract, raw, result: { verdict: 'PASS' } },
      },
    ],
  };
}
const proof = (record) => record.inputProofs[0].value;

describe('independent composer input replay', () => {
  it('replays both exact input and the registered bottom geometry', () => {
    const record = evidence();
    expect(replayWebInput(record)).toEqual([]);
    expect(assessWebEvidence(record).status).toBe('recorded-sampled-pass');
  });
  it('keeps actual textarea caret unavailable instead of accepting the producer pass', () => {
    const record = evidence();
    proof(record).raw.samples.forEach((sample) => {
      sample.caretVisible = null;
    });
    expect(assessWebEvidence(record).status).toBe('incomplete');
    expect(assessWebEvidence(record).issues).toContain(
      'input-caret-unmeasured'
    );
  });
  it.each([
    'wrong-payload',
    'lost-focus',
    'stale-after-correct',
    'duplicate-action',
  ])('rejects %s behind a producer PASS', (fault) => {
    const record = evidence();
    if (fault === 'wrong-payload')
      proof(record).raw.actions[0].payload = 'wrong';
    if (fault === 'lost-focus') proof(record).raw.samples[40].focused = false;
    if (fault === 'stale-after-correct')
      proof(record).raw.samples[40].draft = 'stale';
    if (fault === 'duplicate-action')
      proof(record).raw.actions.push({
        ...proof(record).raw.actions[1],
        time: 800,
        observedAt: 800,
      });
    expect(
      replayWebInput(record).some((issue) => issue.kind === 'failure')
    ).toBe(true);
    expect(assessWebEvidence(record).status).toBe('fail');
  });
  it.each([
    'missing',
    'different-scope',
    'different-expected-draft',
    'short-growth',
    'short-tail',
    'fake-delivery',
    'different-clock',
    'malformed',
  ])('leaves %s evidence incomplete', (fault) => {
    const record = evidence();
    if (fault === 'missing') record.inputProofs = [];
    if (fault === 'different-scope')
      proof(record).raw.originalScope = '/channel/other';
    if (fault === 'different-expected-draft')
      proof(record).contract.phases[1].expected.draft = 'different';
    if (fault === 'short-growth') proof(record).contract.phases[1].end = 200;
    if (fault === 'short-tail') proof(record).contract.deferredThrough = 1000;
    if (fault === 'fake-delivery') proof(record).raw.actions[0].trusted = false;
    if (fault === 'different-clock')
      record.browserTraces[0].value.frames[0].time = 10000;
    if (fault === 'malformed') proof(record).raw.samples = null;
    expect(assessWebEvidence(record).status).toBe('incomplete');
  });
  it('does not let exact input hide a sampled geometry failure', () => {
    const record = evidence();
    record.browserTraces[0].value.frames[40].scrollTop -= 8;
    record.browserTraces[0].value.frames[40].bottomGap = 8;
    expect(assessWebEvidence(record).status).toBe('fail');
  });
  it('retains a witnessed scroll jump when textarea caret geometry is unavailable', () => {
    const record = evidence();
    proof(record).raw.samples.forEach((sample) => {
      sample.caretVisible = null;
    });
    record.browserTraces[0].value.frames[40].scrollTop -= 8;
    record.browserTraces[0].value.frames[40].bottomGap = 8;
    const result = assessWebEvidence(record);
    expect(result.status).toBe('fail');
    expect(result.issues).toContain('input-caret-unmeasured');
    expect(result.issues.some((issue) => issue.includes('bottom'))).toBe(true);
  });
  it('retains exact draft corruption when textarea caret geometry is unavailable', () => {
    const record = evidence();
    proof(record).raw.samples.forEach((sample) => {
      sample.caretVisible = null;
    });
    proof(record).raw.samples[40].draft = 'stale';
    expect(assessWebEvidence(record).status).toBe('fail');
  });
  it('does not promote an unqualified producer failure when all geometry is missing', () => {
    const record = evidence();
    record.reportedStatus = 'failed';
    record.browserTraces[0].value.frames = [];
    proof(record).raw.samples.forEach((sample) => {
      sample.caretVisible = null;
    });
    expect(assessWebEvidence(record).status).toBe('incomplete');
  });
  it.each(['near', 'deep'])(
    'qualifies %s history separately and retains drift despite missing caret',
    (position) => {
      const record = evidence(position);
      expect(assessWebEvidence(record).status).toBe('recorded-sampled-pass');
      proof(record).raw.samples.forEach((sample) => {
        sample.caretVisible = null;
      });
      record.browserTraces[0].value.frames[40].anchors.reading.top -= 8;
      record.browserTraces[0].value.frames[40].anchors.reading.bottom -= 8;
      expect(assessWebEvidence(record).status).toBe('fail');
    }
  );
  it('rejects near-bottom setup relabeled as deep history', () => {
    const record = evidence('near');
    record.scenario = 'web-composer-exact-deep-history';
    record.contract = webScenarioRegistry.find(
      (entry) => entry.scenario === record.scenario
    );
    expect(assessWebEvidence(record).status).toBe('incomplete');
  });
  it('accepts every identical native delivery inside a single multiline dispatch', () => {
    const record = evidence();
    proof(record).raw.actions.splice(1, 0, {
      ...proof(record).raw.actions[0],
      id: 'input-extra',
      time: 103,
      observedAt: 103,
    });
    expect(replayWebInput(record)).toEqual([]);
  });
  it('rejects a different value inside an otherwise correct native delivery batch', () => {
    const record = evidence();
    proof(record).raw.actions.splice(1, 0, {
      ...proof(record).raw.actions[0],
      id: 'input-extra',
      time: 103,
      observedAt: 103,
      payload: 'stale',
    });
    expect(assessWebEvidence(record).status).toBe('fail');
  });
  it.each(['overlap', 'wide', 'missing-dispatch', 'late-plan', 'future-event'])(
    'rejects %s command evidence',
    (fault) => {
      const record = evidence();
      if (fault === 'overlap') proof(record).raw.dispatches[1].start = 100;
      if (fault === 'wide') proof(record).raw.dispatches[0].end = 450;
      if (fault === 'missing-dispatch') proof(record).raw.dispatches = [];
      if (fault === 'late-plan')
        proof(record).raw.declaredAt = proof(record).contract.declaredAt = 96;
      if (fault === 'future-event')
        proof(record).raw.actions[0].observedAt = 99;
      expect(
        replayWebInput(record).some(
          (issue) => issue.message === 'invalid-input-dispatch-evidence'
        )
      ).toBe(true);
    }
  );
  it('uses event creation time when an earlier handler delays the collector', () => {
    const record = evidence();
    const p = proof(record);
    p.raw.actions[0].observedAt = 240;
    p.raw.dispatches[0].end = 250;
    // Keep complete coverage: semantic acknowledgement actually arrives late.
    for (const sample of p.raw.samples) {
      if (sample.time >= 100 && sample.time < 240) {
        sample.draft = '';
        sample.selection = { start: 0, end: 0 };
        sample.sendHitTestable = false;
      }
    }
    expect(assessWebEvidence(record).status).not.toBe('recorded-sampled-pass');
    expect(
      replayWebInput(record).some((issue) => issue.message.includes('ack'))
    ).toBe(true);
  });
});
