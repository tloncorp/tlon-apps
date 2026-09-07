import { describe, expect, it } from 'vitest';
import {
  assessScrollChromeTrace,
  type ScrollChromeContract,
  type ScrollChromeControl,
  type ScrollChromeTrace,
} from './scrollChromeTrace';

const scope = '/channel/main';
const control = (kind = 'icon', opacity = 1): ScrollChromeControl => ({
  id: 'latest',
  scope,
  kind,
  visible: opacity > 0,
  opacity,
});
function fixture() {
  const contract: ScrollChromeContract = {
    scope,
    coverage: { startTime: 0, endTime: 600, maxGapMs: 100 },
    action: { id: 'click-latest', startTime: 150, endTime: 180 },
    phases: [
      {
        id: 'ready',
        startTime: 0,
        endTime: 150,
        loading: false,
        semanticState: 'content-ready',
        controls: [{ id: 'latest', kind: 'icon', visibility: 'visible' }],
      },
      {
        id: 'loading',
        startTime: 250,
        endTime: 600,
        loading: true,
        semanticState: 'content-ready',
        controls: [{ id: 'latest', kind: 'spinner', visibility: 'visible' }],
      },
    ],
    transitions: [
      {
        from: 'ready',
        to: 'loading',
        startTime: 150,
        endTime: 250,
        opacity: 'instant',
      },
    ],
  };
  const trace: ScrollChromeTrace = {
    actions: [{ id: 'click-latest', scope, time: 160 }],
    samples: Array.from({ length: 13 }, (_, i) => ({
      time: i * 50,
      scope,
      loading: i >= 4,
      semanticState: 'content-ready',
      controls: [control(i >= 4 ? 'spinner' : 'icon')],
      measurement: { valid: true, durationMs: 1 },
    })),
  };
  return { trace, contract };
}
const codes = (result: ReturnType<typeof assessScrollChromeTrace>) =>
  result.issues.map((issue) => issue.code);

// Detector controls are synthetic faults; they are not product or paint proof.
describe('scroll chrome sampled lifecycle oracle', () => {
  it('accepts a witnessed one-way icon/loading transition and preserves presentation limits', () => {
    const { trace, contract } = fixture();
    expect(assessScrollChromeTrace(trace, contract)).toMatchObject({
      verdict: 'PASS',
      passed: true,
      evidenceLevel: 'sampled-state',
      nativePresentation: 'INCOMPLETE',
    });
  });
  it('rejects a one-sample hide/show pulse although the final control recovers', () => {
    const { trace, contract } = fixture();
    trace.samples[7].controls[0] = control('spinner', 0);
    const result = assessScrollChromeTrace(trace, contract);
    expect(result.verdict).toBe('FAIL');
    expect(codes(result)).toContain('control-visibility-mismatch');
  });
  it('rejects a transparent wrapper reported as visible', () => {
    const { trace, contract } = fixture();
    trace.samples[7].controls[0].opacity = 0;
    expect(codes(assessScrollChromeTrace(trace, contract))).toContain(
      'control-opacity-mismatch'
    );
  });
  it('rejects repeated spinner/icon switching while loading is unchanged', () => {
    const { trace, contract } = fixture();
    trace.samples[7].controls[0].kind = 'icon';
    trace.samples[9].controls[0].kind = 'icon';
    const result = assessScrollChromeTrace(trace, contract);
    expect(result.verdict).toBe('FAIL');
    expect(
      result.issues.filter((issue) => issue.code === 'control-kind-mismatch')
    ).toHaveLength(2);
  });
  it('rejects a mounted wrapper with no actual icon/spinner content', () => {
    const { trace, contract } = fixture();
    trace.samples[7].controls[0].kind = 'missing-content';
    expect(assessScrollChromeTrace(trace, contract).verdict).toBe('FAIL');
  });
  it('rejects duplicate controls even if one duplicate is transparent', () => {
    const { trace, contract } = fixture();
    trace.samples[7].controls.push(control('spinner', 0));
    expect(codes(assessScrollChromeTrace(trace, contract))).toContain(
      'duplicate-control'
    );
  });
  it.each(['sample', 'control'])(
    'rejects exact identity from the wrong %s scope',
    (where) => {
      const { trace, contract } = fixture();
      if (where === 'sample') trace.samples[7].scope = '/channel/other';
      else trace.samples[7].controls[0].scope = '/channel/other';
      expect(codes(assessScrollChromeTrace(trace, contract))).toContain(
        'wrong-scope'
      );
    }
  );
  it('rejects correct content that reverts after reaching its terminal revision', () => {
    const { trace, contract } = fixture();
    trace.samples[10].semanticState = 'stale-placeholder';
    expect(codes(assessScrollChromeTrace(trace, contract))).toContain(
      'semantic-state-mismatch'
    );
  });
  it('rejects a same-looking unexpected loading-state pulse', () => {
    const { trace, contract } = fixture();
    trace.samples[8].loading = false;
    expect(assessScrollChromeTrace(trace, contract).verdict).toBe('FAIL');
  });
  it('distinguishes intentionally hidden mounted controls from absent controls', () => {
    const { trace, contract } = fixture();
    contract.phases[1].controls[0] = {
      id: 'latest',
      kind: 'icon',
      visibility: 'hidden',
      opacity: 0,
    };
    for (const sample of trace.samples)
      if (sample.time >= 200) sample.controls = [control('icon', 0)];
    expect(assessScrollChromeTrace(trace, contract).verdict).toBe('PASS');
    trace.samples[7].controls = [];
    expect(codes(assessScrollChromeTrace(trace, contract))).toContain(
      'control-missing'
    );
    contract.phases[1].controls[0].visibility = 'absent';
    for (const sample of trace.samples)
      if (sample.time >= 200) sample.controls = [];
    expect(assessScrollChromeTrace(trace, contract).verdict).toBe('PASS');
    trace.samples[7].controls = [control('icon', 0)];
    expect(codes(assessScrollChromeTrace(trace, contract))).toContain(
      'control-should-be-absent'
    );
  });
  it('allows explicitly hidden opaque controls, without calling them visible', () => {
    const { trace, contract } = fixture();
    contract.phases[1].controls[0] = {
      id: 'latest',
      kind: 'spinner',
      visibility: 'hidden',
      opacity: 1,
    };
    for (const sample of trace.samples)
      if (sample.time >= 200) sample.controls[0].visible = false;
    expect(assessScrollChromeTrace(trace, contract).verdict).toBe('PASS');
  });
  it.each(['missing', 'duplicate', 'wrong-scope', 'wrong-time'])(
    'rejects %s actual action evidence',
    (fault) => {
      const { trace, contract } = fixture();
      if (fault === 'missing') trace.actions = [];
      if (fault === 'duplicate') trace.actions.push({ ...trace.actions[0] });
      if (fault === 'wrong-scope') trace.actions[0].scope = '/channel/other';
      if (fault === 'wrong-time') trace.actions[0].time = 400;
      expect(codes(assessScrollChromeTrace(trace, contract))).toContain(
        'action-not-witnessed'
      );
      expect(assessScrollChromeTrace(trace, contract).verdict).toBe(
        'INCOMPLETE'
      );
    }
  );
  it('rejects capture that omits an entire expected phase', () => {
    const { trace, contract } = fixture();
    trace.samples = trace.samples.filter((sample) => sample.time >= 200);
    expect(codes(assessScrollChromeTrace(trace, contract))).toContain(
      'phase-not-witnessed'
    );
  });
  it.each(['empty', 'end', 'gap', 'time', 'invalid', 'slow', 'opacity'])(
    'rejects missing or invalid %s capture',
    (fault) => {
      const { trace, contract } = fixture();
      if (fault === 'empty') trace.samples = [];
      if (fault === 'end') trace.samples.pop();
      if (fault === 'gap') trace.samples.splice(5, 2);
      if (fault === 'time') trace.samples[5].time = trace.samples[4].time;
      if (fault === 'invalid') trace.samples[5].measurement.valid = false;
      if (fault === 'slow') trace.samples[5].measurement.durationMs = 33;
      if (fault === 'opacity')
        trace.samples[5].controls[0].opacity = Number.NaN;
      expect(assessScrollChromeTrace(trace, contract).verdict).toBe(
        'INCOMPLETE'
      );
    }
  );
  it('retains detected flicker diagnostically when other capture evidence is missing', () => {
    const { trace, contract } = fixture();
    trace.actions = [];
    trace.samples[7].controls[0] = control('spinner', 0);
    const result = assessScrollChromeTrace(trace, contract);
    expect(result.verdict).toBe('INCOMPLETE');
    expect(result.metrics.observedViolations).toBeGreaterThan(0);
  });
  it('requires an explicit transition between phases and a complete control inventory', () => {
    const { trace, contract } = fixture();
    contract.transitions = [];
    expect(codes(assessScrollChromeTrace(trace, contract))).toContain(
      'invalid-contract'
    );
    const f = fixture();
    f.contract.phases[1].controls = [];
    expect(codes(assessScrollChromeTrace(f.trace, f.contract))).toContain(
      'incomplete-control-inventory'
    );
  });
});

function fadeFixture() {
  const { trace, contract } = fixture();
  contract.coverage.endTime = 700;
  contract.phases[0].controls[0] = {
    id: 'latest',
    kind: 'icon',
    visibility: 'hidden',
  };
  contract.phases[1] = {
    ...contract.phases[1],
    loading: false,
    startTime: 400,
    endTime: 700,
    controls: [{ id: 'latest', kind: 'icon', visibility: 'visible' }],
  };
  contract.transitions[0] = {
    ...contract.transitions[0],
    endTime: 400,
    opacity: 'monotonic',
  };
  trace.samples = Array.from({ length: 15 }, (_, i) => ({
    time: i * 50,
    scope,
    loading: false,
    semanticState: 'content-ready',
    controls: [control('icon', Math.max(0, Math.min(1, (i * 50 - 150) / 200)))],
    measurement: { valid: true, durationMs: 1 },
  }));
  return { trace, contract };
}

describe('explicit monotonic chrome fades', () => {
  it('accepts a bounded monotonic reveal without pretending it was painted', () => {
    const { trace, contract } = fadeFixture();
    expect(assessScrollChromeTrace(trace, contract).verdict).toBe('PASS');
  });
  it('rejects opacity reversal/reset even when final opacity recovers', () => {
    const { trace, contract } = fadeFixture();
    trace.samples[5].controls[0].opacity = 0.1;
    expect(codes(assessScrollChromeTrace(trace, contract))).toContain(
      'opacity-reversal'
    );
  });
  it('rejects fade overshoot outside its declared endpoints', () => {
    const { trace, contract } = fadeFixture();
    contract.phases[1].controls[0].opacity = 0.8;
    expect(codes(assessScrollChromeTrace(trace, contract))).toContain(
      'opacity-reversal'
    );
  });
  it('rejects showing then hiding again during a permitted fade', () => {
    const { trace, contract } = fadeFixture();
    trace.samples[5].controls[0].visible = false;
    expect(codes(assessScrollChromeTrace(trace, contract))).toContain(
      'transition-reversal'
    );
  });
  it('rejects icon-spinner-icon reversal inside an explicit transition window', () => {
    const { trace, contract } = fixture();
    contract.phases[1].startTime = 350;
    contract.transitions[0].endTime = 350;
    trace.samples[5].controls[0].kind = 'icon';
    expect(codes(assessScrollChromeTrace(trace, contract))).toContain(
      'transition-reversal'
    );
  });
  it('rejects a blank bridge between visible icon and spinner at stable opacity', () => {
    const { trace, contract } = fixture();
    trace.samples[4].controls[0].visible = false;
    expect(codes(assessScrollChromeTrace(trace, contract))).toContain(
      'blank-transition-bridge'
    );
  });
  it('rejects semantic/loading reversal inside a permitted transition', () => {
    const { trace, contract } = fixture();
    contract.phases[1].startTime = 350;
    contract.transitions[0].endTime = 350;
    trace.samples[5].loading = false;
    expect(codes(assessScrollChromeTrace(trace, contract))).toContain(
      'transition-reversal'
    );
  });
  it('rejects terminal settling shorter than200ms', () => {
    const { trace, contract } = fixture();
    contract.phases[1].startTime = 450;
    contract.transitions[0].endTime = 450;
    expect(codes(assessScrollChromeTrace(trace, contract))).toContain(
      'insufficient-terminal-tail'
    );
  });
});

describe('fail-closed chrome evidence boundaries', () => {
  it('rejects absent or null raw arrays without throwing', () => {
    const { trace, contract } = fixture();
    expect(
      assessScrollChromeTrace(
        { ...trace, samples: undefined } as unknown as ScrollChromeTrace,
        contract
      ).verdict
    ).toBe('INCOMPLETE');
    expect(
      assessScrollChromeTrace(
        { ...trace, samples: [null] } as unknown as ScrollChromeTrace,
        contract
      ).verdict
    ).toBe('INCOMPLETE');
    expect(
      assessScrollChromeTrace(trace, {
        ...contract,
        phases: [null],
      } as unknown as ScrollChromeContract).verdict
    ).toBe('INCOMPLETE');
  });
  it('rejects cumulative small backwards opacity steps', () => {
    const { trace, contract } = fadeFixture();
    contract.coverage.endTime = 800;
    contract.phases[1].startTime = 550;
    contract.phases[1].endTime = 800;
    contract.transitions[0].endTime = 550;
    trace.samples = Array.from({ length: 17 }, (_, i) => ({
      time: i * 50,
      scope,
      loading: false,
      semanticState: 'content-ready',
      controls: [
        control('icon', Math.max(0, Math.min(1, (i * 50 - 150) / 200))),
      ],
      measurement: { valid: true, durationMs: 1 },
    }));
    trace.samples[8].controls[0].opacity = 0.994;
    trace.samples[9].controls[0].opacity = 0.988;
    trace.samples[10].controls[0].opacity = 0.982;
    expect(codes(assessScrollChromeTrace(trace, contract))).toContain(
      'opacity-reversal'
    );
  });
});
