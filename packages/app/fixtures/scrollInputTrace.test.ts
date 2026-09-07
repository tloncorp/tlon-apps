import { describe, expect, it } from 'vitest';
import {
  assessScrollInputTrace,
  type ScrollInputContract,
  type ScrollInputSample,
  type ScrollInputState,
  type ScrollInputAction,
} from './scrollInputTrace';

const state = (draft = 'hello'): ScrollInputState => ({
  scopeKey: 'channel-a/session-1/view-1',
  inputId: 'composer',
  draft,
  selection: { start: draft.length, end: draft.length },
  composing: false,
  focused: true,
  caretVisible: true,
  sendVisible: true,
  sendHitTestable: true,
});
function evidence() {
  const contract: ScrollInputContract = {
    version: 1,
    declaredAt: -1,
    start: 0,
    end: 1200,
    deferredThrough: 200,
    actions: [
      {
        id: 'type',
        kind: 'input',
        scopeKey: state().scopeKey,
        inputId: 'composer',
        payload: 'hello',
      },
    ],
    phases: [
      { id: 'before', start: 0, end: 100, expected: state('') },
      {
        id: 'typed',
        start: 100,
        end: 1200,
        triggerActionId: 'type',
        expected: state(),
      },
    ],
  };
  const samples: ScrollInputSample[] = Array.from({ length: 61 }, (_, i) => ({
    ...state(i < 6 ? '' : 'hello'),
    time: i * 20,
    valid: true,
  }));
  const actions: ScrollInputAction[] = [{ ...contract.actions[0], time: 100 }];
  return { contract, samples, actions };
}
const codes = (value: ReturnType<typeof evidence>) =>
  assessScrollInputTrace(value).issues.map((issue) => issue.code);

describe('exact composer evidence controls', () => {
  it('accepts delivered input followed by exact stable state and reports sampled latency', () => {
    expect(assessScrollInputTrace(evidence())).toMatchObject({
      verdict: 'PASS',
      evidenceLevel: 'sampled-input',
      maxAcknowledgementMs: 20,
      p95AcknowledgementMs: 20,
    });
  });
  it.each([
    'draft',
    'selection',
    'focused',
    'composing',
    'caretVisible',
    'sendVisible',
    'sendHitTestable',
    'scopeKey',
    'inputId',
  ] as const)(
    'rejects a transient %s change even when the final state recovers',
    (field) => {
      const e = evidence();
      const sample = e.samples[20];
      if (field === 'draft') sample.draft = 'hellx';
      else if (field === 'selection') sample.selection = { start: 0, end: 0 };
      else if (field === 'scopeKey' || field === 'inputId')
        sample[field] = 'other';
      else sample[field] = !sample[field];
      expect(codes(e)).toContain(`input-${field}-changed`);
      expect(assessScrollInputTrace(e).verdict).toBe('FAIL');
    }
  );
  it.each(['missing', 'duplicate', 'payload', 'kind', 'scope', 'target', 'id'])(
    'rejects %s action evidence',
    (fault) => {
      const e = evidence();
      if (fault === 'missing') e.actions = [];
      if (fault === 'duplicate') e.actions.push({ ...e.actions[0], time: 110 });
      if (fault === 'payload') e.actions[0].payload = 'different';
      if (fault === 'kind') e.actions[0].kind = 'send';
      if (fault === 'scope') e.actions[0].scopeKey = 'old-session';
      if (fault === 'target') e.actions[0].inputId = 'other-composer';
      if (fault === 'id') e.actions[0].id = 'other-action';
      expect(codes(e)).toContain('input-action-mismatch');
    }
  );
  it('does not accept a stale draft that eventually recovers after the acknowledgement deadline', () => {
    const e = evidence();
    e.samples = e.samples.map((sample) =>
      sample.time < 240
        ? { ...state(''), time: sample.time, valid: true }
        : sample
    );
    expect(codes(e)).toContain('input-acknowledgement-missing-or-late');
  });
  it('enforces p95 rather than only the maximum acknowledgement bound', () => {
    const e = evidence();
    e.samples = e.samples.map((sample) =>
      sample.time < 160
        ? { ...state(''), time: sample.time, valid: true }
        : sample
    );
    expect(codes(e)).toContain('input-acknowledgement-p95');
    expect(assessScrollInputTrace(e).maxAcknowledgementMs).toBe(60);
  });
  it.each([
    'head',
    'tail',
    'gap',
    'empty',
    'invalid',
    'duplicate-time',
    'reversed',
    'bad-selection',
  ])('cannot pass %s capture corruption', (fault) => {
    const e = evidence();
    if (fault === 'head') e.samples.shift();
    if (fault === 'tail') e.samples.pop();
    if (fault === 'gap') e.samples.splice(15, 6);
    if (fault === 'empty') e.samples = [];
    if (fault === 'invalid') e.samples[10].valid = false;
    if (fault === 'duplicate-time') e.samples[10].time = e.samples[9].time;
    if (fault === 'reversed') e.samples.reverse();
    if (fault === 'bad-selection') e.samples[10].selection.end = 999;
    expect(assessScrollInputTrace(e).verdict).toBe('INCOMPLETE');
  });
  it('keeps missing acknowledgement incomplete when the observation interval was lost', () => {
    const e = evidence();
    e.samples = e.samples.filter(
      (sample) => sample.time < 100 || sample.time > 300
    );
    expect(assessScrollInputTrace(e).verdict).toBe('INCOMPLETE');
  });
  it.each([
    'late-plan',
    'short-tail',
    'missing-phase',
    'phase-gap',
    'duplicate-phase',
    'duplicate-action',
    'trigger',
    'nonfinite',
  ])('rejects a %s contract instead of blessing a weakened check', (fault) => {
    const e = evidence();
    if (fault === 'late-plan') e.contract.declaredAt = 50;
    if (fault === 'short-tail') e.contract.deferredThrough = 300;
    if (fault === 'missing-phase') e.contract.phases.shift();
    if (fault === 'phase-gap') e.contract.phases[1].start = 110;
    if (fault === 'duplicate-phase') e.contract.phases[1].id = 'before';
    if (fault === 'duplicate-action')
      e.contract.actions.push({ ...e.contract.actions[0] });
    if (fault === 'trigger') e.contract.phases[1].triggerActionId = 'missing';
    if (fault === 'nonfinite') e.contract.end = NaN;
    expect(codes(e)).toContain('invalid-input-contract');
  });
  it('binds acknowledgement to the actual triggering event rather than an invented start time', () => {
    const e = evidence();
    e.actions[0].time = 120;
    expect(codes(e)).toContain('input-phase-trigger-mismatch');
  });
  it('supports an explicit ongoing IME state without interpreting it as a send', () => {
    const e = evidence();
    e.contract.actions[0].kind = 'composition-start';
    e.actions[0].kind = 'composition-start';
    e.contract.phases[1].expected.composing = true;
    e.samples = e.samples.map((sample) =>
      sample.time >= 120 ? { ...sample, composing: true } : sample
    );
    expect(assessScrollInputTrace(e).verdict).toBe('PASS');
  });
  it('does not turn an unmeasurable textarea caret into a visibility pass', () => {
    const e = evidence();
    e.samples = e.samples.map((sample) => ({ ...sample, caretVisible: null }));
    expect(assessScrollInputTrace(e)).toMatchObject({
      verdict: 'INCOMPLETE',
      semanticVerdict: 'PASS',
    });
    expect(codes(e)).toContain('input-caret-unmeasured');
  });
});
