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

function selectionEvidence() {
  const record = evidence();
  const p = proof(record);
  p.contract.version = 2;
  const selected = {
    ...p.contract.phases[1].expected,
    selection: { start: 0, end: SCROLL_INPUT_GROWTH_DRAFT.length },
  };
  const select = {
    ...p.contract.actions[0],
    id: 'select-all-1',
    kind: 'select-all',
    payload: 'ControlOrMeta+A',
  };
  p.contract.actions.splice(1, 0, select);
  p.contract.phases.splice(2, 0, {
    id: 'selected',
    start: 500,
    end: 700,
    triggerActionId: select.id,
    expected: selected,
  });
  p.contract.phases[3].start = 700;
  p.raw.commandPlan = structuredClone(p.contract.actions);
  p.raw.dispatches = p.contract.actions.map((a, i) => ({
    ...a,
    start: [95, 495, 695][i],
    end: [110, 510, 710][i],
  }));
  p.raw.actions = p.contract.actions.map((a, i) => ({
    ...a,
    time: [100, 500, 700][i],
    observedAt: [100, 500, 700][i],
    trusted: true,
  }));
  p.raw.keyboard = [
    {
      time: 500,
      observedAt: 500,
      key: 'a',
      code: 'KeyA',
      ctrlKey: true,
      metaKey: false,
    },
    {
      time: 699,
      observedAt: 699,
      key: 'Delete',
      code: 'Delete',
      ctrlKey: false,
      metaKey: false,
    },
  ].map((k) => ({
    ...k,
    scopeKey: p.raw.originalScope,
    inputId: 'MessageInput',
    trusted: true,
    targetIsInput: true,
    altKey: false,
    shiftKey: false,
    repeat: false,
  }));
  for (const sample of p.raw.samples) {
    if (sample.time >= 500 && sample.time < 700)
      Object.assign(sample, structuredClone(selected));
  }
  for (const f of record.browserTraces[0].value.frames) {
    if (f.time >= 500 && f.time < 700) {
      f.clientHeight = 60;
      f.scrollTop = 940;
      f.viewportBottom = 70;
    }
  }
  record.browserTraces[0].value.marks[1].time = 710;
  return record;
}

describe('explicit keyboard select-all and Delete input coverage', () => {
  it.each(['Control', 'Meta'])(
    'accepts an intentional %s select-all phase followed by real Delete',
    (modifier) => {
      const record = selectionEvidence();
      const p = proof(record);
      if (modifier === 'Meta')
        Object.assign(p.raw.keyboard[0], { ctrlKey: false, metaKey: true });
      p.raw.keyboard.unshift({
        ...p.raw.keyboard[0],
        key: modifier,
        code: `${modifier}Left`,
        time: 499,
        observedAt: 499,
      });
      expect(replayWebInput(record)).toEqual([]);
      expect(assessWebEvidence(record).status).toBe('recorded-sampled-pass');
    }
  );
  it('retains the old fill-clear selection prelude failure with its original phase contract', () => {
    const record = evidence();
    proof(record).raw.samples[24].selection = {
      start: 0,
      end: SCROLL_INPUT_GROWTH_DRAFT.length,
    };
    expect(replayWebInput(record)).toContainEqual({
      message: 'input-selection-changed',
      kind: 'failure',
    });
  });
  it.each([
    'unsolicited-before-shortcut',
    'wrong-selection',
    'selection-reverts',
    'lost-focus',
    'changed-draft',
    'covered-send',
    'late-selection',
  ])('rejects %s without exempting dispatch intervals', (fault) => {
    const record = selectionEvidence(),
      p = proof(record);
    if (fault === 'unsolicited-before-shortcut')
      Object.assign(p.raw.samples[24], {
        time: 498,
        selection: { start: 0, end: 70 },
      });
    if (fault === 'wrong-selection')
      p.raw.samples[28].selection = { start: 1, end: 70 };
    if (fault === 'selection-reverts')
      p.raw.samples[28].selection = { start: 70, end: 70 };
    if (fault === 'lost-focus') p.raw.samples[28].focused = false;
    if (fault === 'changed-draft') p.raw.samples[28].draft = 'x'.repeat(70);
    if (fault === 'covered-send') p.raw.samples[28].sendHitTestable = false;
    if (fault === 'late-selection')
      for (const sample of p.raw.samples)
        if (sample.time >= 500 && sample.time < 620)
          sample.selection = { start: 70, end: 70 };
    expect(replayWebInput(record).some((i) => i.kind === 'failure')).toBe(true);
  });
  it.each([
    'out-of-scope',
    'wrong-target',
    'untrusted',
    'wrong-shortcut',
    'repeated-key',
    'late-key',
    'missing-delete',
    'wrong-delete',
    'extra-key',
    'missing-keyboard',
  ])('rejects %s keyboard delivery evidence', (fault) => {
    const record = selectionEvidence(),
      p = proof(record);
    if (fault === 'out-of-scope') p.raw.keyboard[0].scopeKey = '/channel/other';
    if (fault === 'wrong-target') p.raw.keyboard[0].targetIsInput = false;
    if (fault === 'untrusted') p.raw.keyboard[0].trusted = false;
    if (fault === 'wrong-shortcut') p.raw.keyboard[0].ctrlKey = false;
    if (fault === 'repeated-key') p.raw.keyboard[0].repeat = true;
    if (fault === 'late-key') p.raw.keyboard[0].observedAt = 520;
    if (fault === 'missing-delete') p.raw.keyboard.pop();
    if (fault === 'wrong-delete') p.raw.keyboard[1].key = 'Backspace';
    if (fault === 'extra-key')
      p.raw.keyboard.splice(1, 0, {
        ...p.raw.keyboard[0],
        key: 'x',
        time: 501,
        observedAt: 501,
      });
    if (fault === 'missing-keyboard') delete p.raw.keyboard;
    expect(replayWebInput(record).length).toBeGreaterThan(0);
    expect(assessWebEvidence(record).status).not.toBe('recorded-sampled-pass');
  });
  it.each([
    'short-selected-hold',
    'wrong-expected-selection',
    'missing-select-action',
    'missing-phase',
    'unknown-version',
  ])('rejects a weakened %s contract', (fault) => {
    const record = selectionEvidence(),
      p = proof(record);
    if (fault === 'short-selected-hold') p.contract.phases[2].end = 550;
    if (fault === 'wrong-expected-selection')
      p.contract.phases[2].expected.selection.start = 70;
    if (fault === 'missing-select-action') p.contract.actions.splice(1, 1);
    if (fault === 'missing-phase') p.contract.phases.splice(2, 1);
    if (fault === 'unknown-version') p.contract.version = 3;
    expect(assessWebEvidence(record).status).toBe('incomplete');
  });
});

describe('optional input paint cannot promote other gates', () => {
  it('preserves legacy input evidence when paint is not requested', () => {
    expect(replayWebInput(evidence())).toEqual([]);
  });
  it('ignores producer paint success and retains unmeasured textarea caret', () => {
    const record = evidence();
    proof(record).raw.samples.forEach((sample) => {
      sample.caretVisible = null;
    });
    proof(record).raw.paintedCaret = {
      version: 1,
      frames: [],
      result: { verdict: 'PASS' },
    };
    const issues = replayWebInput(record).map((issue) => issue.message);
    expect(issues).toContain('input-caret-unmeasured');
    expect(issues).toContain('input-caret-paint-missing-or-invalid-binding');
    expect(assessWebEvidence(record).status).toBe('incomplete');
  });
  it('preserves actual draft failure behind a producer paint success', () => {
    const record = evidence();
    proof(record).raw.samples[40].draft = 'unexpected';
    proof(record).raw.paintedCaret = {
      version: 1,
      frames: [],
      result: { verdict: 'PASS' },
    };
    expect(assessWebEvidence(record).status).toBe('fail');
    expect(
      replayWebInput(record).some((issue) => issue.kind === 'failure')
    ).toBe(true);
  });
});
