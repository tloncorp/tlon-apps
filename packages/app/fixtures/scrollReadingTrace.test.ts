import { describe, expect, it } from 'vitest';

import type { ContentPresentation } from './scrollContentTrace';
import {
  assessInjectedReadingFault,
  assessScrollReadingTrace,
  type ReadingFragment,
  type ScrollReadingContract,
  type ScrollReadingTrace,
} from './scrollReadingTrace';

function evidence() {
  const box = (left: number, top: number, width: number, height: number) => ({
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  });
  const presentation = (
    left: number,
    top: number,
    width: number,
    height: number
  ): ContentPresentation => ({
    connected: true,
    displayed: true,
    opacity: 1,
    rect: box(left, top, width, height),
    clip: box(left, top, width, height),
  });
  const fragment = (left: number, width: number): ReadingFragment => ({
    presentation: presentation(left, 40, width, 20),
    textAlpha: 1,
    pointerEvents: 'auto',
    hits: [0.1, 0.5, 0.9].map((fraction) => ({
      x: left + width * fraction,
      y: 50,
      stack: [
        { relation: 'owner', tag: 'SPAN' },
        { relation: 'ancestor', tag: 'DIV' },
      ],
    })),
  });
  const contract: ScrollReadingContract = {
    scope: '/chat/a',
    rowId: 'post-1',
    blockSelector: '.body',
    revision: { id: 'text-v2', text: 'A reader stays here.' },
    point: { start: 2, end: 3, x: 30, y: 30, tolerancePx: 1 },
    coverage: {
      startTime: 0,
      endTime: 1300,
      maxGapMs: 100,
      maxMeasurementDurationMs: 32,
    },
    terminalTime: 300,
  };
  const trace: ScrollReadingTrace = {
    blockSelector: '.body',
    point: { start: 2, end: 3 },
    errors: [],
    marks: [{ id: 'terminal-ready', time: 300 }],
    samples: Array.from({ length: 27 }, (_, index) => ({
      time: index * 50,
      scope: '/chat/a',
      rowId: 'post-1',
      sameRow: true,
      sameBlock: true,
      blockCount: 1,
      text: contract.revision.text,
      list: presentation(10, 10, 600, 300),
      row: presentation(10, 30, 600, 220),
      block: presentation(30, 40, 500, 100),
      nodes: [
        {
          text: contract.revision.text,
          start: 0,
          end: contract.revision.text.length,
          fragments: [fragment(30, 200)],
        },
      ],
      point: {
        start: 2,
        end: 3,
        text: 'r',
        relativeX: 30,
        relativeY: 30,
        fragment: fragment(40, 8),
      },
      measurement: { valid: true, durationMs: 0.5 },
    })),
  };
  return { trace, contract };
}

describe('stationary visible text and interior reading-point evidence', () => {
  it('accepts complete expected text and the retained exposed character', () => {
    const { trace, contract } = evidence();
    expect(assessScrollReadingTrace(trace, contract)).toMatchObject({
      verdict: 'PASS',
      presentedFrames: 'INCOMPLETE',
    });
  });
  const failures: [
    string,
    (data: ReturnType<typeof evidence>) => void,
    string,
  ][] = [
    [
      'brief stale text',
      ({ trace }) => {
        trace.samples[8].text = 'A writer stays here.';
        trace.samples[8].nodes[0].text = trace.samples[8].text;
      },
      'unexpected-text-revision',
    ],
    [
      'blank child in a stationary row',
      ({ trace }) => {
        trace.samples[8].text = '';
        trace.samples[8].nodes = [];
        trace.samples[8].point = null;
      },
      'unexpected-text-revision',
    ],
    [
      'inner displacement with unchanged row',
      ({ trace }) => {
        const point = trace.samples[8].point!;
        point.relativeY += 12;
        point.fragment.presentation.rect.top += 12;
        point.fragment.presentation.rect.bottom += 12;
        point.fragment.presentation.clip.top += 12;
        point.fragment.presentation.clip.bottom += 12;
        point.fragment.hits.forEach((hit) => {
          hit.y += 12;
        });
        const nodeFragment = trace.samples[8].nodes[0].fragments[0];
        nodeFragment.presentation.rect.top += 12;
        nodeFragment.presentation.rect.bottom += 12;
        nodeFragment.presentation.clip.top += 12;
        nodeFragment.presentation.clip.bottom += 12;
        nodeFragment.hits.forEach((hit) => {
          hit.y += 12;
        });
      },
      'reading-point-moved',
    ],
    [
      'transparent text',
      ({ trace }) => {
        trace.samples[8].nodes[0].fragments[0].textAlpha = 0;
      },
      'hidden-text',
    ],
    [
      'opacity-hidden character',
      ({ trace }) => {
        trace.samples[8].point!.fragment.presentation.opacity = 0;
      },
      'hidden-text',
    ],
    [
      'hidden block',
      ({ trace }) => {
        trace.samples[8].block.opacity = 0;
      },
      'hidden-content-container',
    ],
    [
      'covered character',
      ({ trace }) => {
        trace.samples[8].point!.fragment.hits[1].stack.unshift({
          relation: 'foreign',
          tag: 'ASIDE',
        });
      },
      'text-obstructed',
    ],
    [
      'covered second text region',
      ({ trace }) => {
        trace.samples[8].nodes[0].fragments[0].hits[2].stack.unshift({
          relation: 'foreign',
          tag: 'ASIDE',
        });
      },
      'text-obstructed',
    ],
    [
      'wrong conversation',
      ({ trace }) => {
        trace.samples[8].scope = '/chat/old';
      },
      'content-identity-changed',
    ],
    [
      'missing text layout',
      ({ trace }) => {
        trace.samples[8].nodes[0].fragments = [];
        trace.samples[8].point = null;
      },
      'missing-text-layout',
    ],
    [
      'missing character',
      ({ trace }) => {
        trace.samples[8].point = null;
      },
      'missing-reading-point',
    ],
    [
      'wrong character identity',
      ({ trace }) => {
        trace.samples[8].point!.text = 'w';
      },
      'reading-point-identity-changed',
    ],
    [
      'fully clipped character',
      ({ trace }) => {
        const fragment = trace.samples[8].point!.fragment;
        fragment.presentation.clip.right = fragment.presentation.clip.left;
        fragment.presentation.clip.width = 0;
        fragment.hits = [];
      },
      'reading-point-clipped',
    ],
  ];
  it.each(failures)('rejects %s even after recovery', (_name, mutate, code) => {
    const data = evidence();
    mutate(data);
    const result = assessScrollReadingTrace(data.trace, data.contract);
    expect(result.verdict).toBe('FAIL');
    expect(result.issues.some((issue) => issue.code === code)).toBe(true);
    expect(data.trace.samples.at(-1)).toEqual(evidence().trace.samples.at(-1));
  });
  const incomplete: [string, (data: ReturnType<typeof evidence>) => void][] = [
    [
      'same-looking block replacement',
      ({ trace }) => {
        trace.samples[8].sameBlock = false;
      },
    ],
    [
      'ambiguous duplicated block',
      ({ trace }) => {
        trace.samples[8].blockCount = 2;
      },
    ],
    [
      'same-scope row replacement',
      ({ trace }) => {
        trace.samples[8].sameRow = false;
      },
    ],
    [
      'capture errors',
      ({ trace }) => {
        trace.errors.push('lost document');
      },
    ],
    [
      'empty trace',
      ({ trace }) => {
        trace.samples = [];
      },
    ],
    [
      'missing tail',
      ({ trace }) => {
        trace.samples.splice(-2);
      },
    ],
    [
      'missing terminal marker',
      ({ trace }) => {
        trace.marks = [];
      },
    ],
    [
      'duplicate terminal marker',
      ({ trace }) => {
        trace.marks.push(trace.marks[0]);
      },
    ],
    [
      'weak terminal deadline',
      ({ contract }) => {
        contract.coverage.endTime--;
      },
    ],
    [
      'weak max gap',
      ({ contract }) => {
        contract.coverage.maxGapMs = 101;
      },
    ],
    [
      'weak measurement budget',
      ({ contract }) => {
        contract.coverage.maxMeasurementDurationMs = 33;
      },
    ],
    [
      'weak geometry tolerance',
      ({ contract }) => {
        contract.point.tolerancePx = 2;
      },
    ],
    [
      'late initial sample',
      ({ trace }) => {
        trace.samples.shift();
      },
    ],
    [
      'blind sample interval',
      ({ trace }) => {
        trace.samples.splice(7, 3);
      },
    ],
    [
      'duplicate time',
      ({ trace }) => {
        trace.samples[8].time = trace.samples[7].time;
      },
    ],
    [
      'slow acquisition',
      ({ trace }) => {
        trace.samples[8].measurement.durationMs = 33;
      },
    ],
    [
      'invalid measurement',
      ({ trace }) => {
        trace.samples[8].measurement.valid = false;
      },
    ],
    [
      'wrong selector contract',
      ({ trace }) => {
        trace.blockSelector = '.other';
      },
    ],
    [
      'wrong range contract',
      ({ trace }) => {
        trace.point.start++;
      },
    ],
    [
      'missing text inventory',
      ({ trace }) => {
        trace.samples[8].nodes = [];
      },
    ],
    [
      'invalid inventory offsets',
      ({ trace }) => {
        trace.samples[8].nodes[0].start++;
      },
    ],
    [
      'missing hit witnesses',
      ({ trace }) => {
        trace.samples[8].point!.fragment.hits = [];
      },
    ],
    [
      'empty hit-test stack',
      ({ trace }) => {
        trace.samples[8].point!.fragment.hits[0].stack = [];
      },
    ],
    [
      'falsified hit-test coordinate',
      ({ trace }) => {
        trace.samples[8].point!.fragment.hits[0].x += 10;
      },
    ],
    [
      'inconsistent point coordinates',
      ({ trace }) => {
        trace.samples[8].point!.relativeY++;
      },
    ],
    [
      'invalid geometry',
      ({ trace }) => {
        trace.samples[8].point!.fragment.presentation.rect.width = NaN;
      },
    ],
    [
      'clip extending beyond text',
      ({ trace }) => {
        trace.samples[8].point!.fragment.presentation.clip.width++;
        trace.samples[8].point!.fragment.presentation.clip.right++;
      },
    ],
    [
      'negative opacity',
      ({ trace }) => {
        trace.samples[8].row.opacity = -1;
      },
    ],
    [
      'whitespace reading point',
      ({ contract }) => {
        contract.point.start = 1;
        contract.point.end = 2;
      },
    ],
  ];
  it.each(incomplete)('fails closed on %s', (_name, mutate) => {
    const data = evidence();
    mutate(data);
    expect(assessScrollReadingTrace(data.trace, data.contract).verdict).toBe(
      'INCOMPLETE'
    );
  });
  it('does not erase a real displacement when capture is also incomplete', () => {
    const data = evidence();
    failures[2][1](data);
    data.trace.samples.splice(12, 3);
    const result = assessScrollReadingTrace(data.trace, data.contract);
    expect(result.verdict).toBe('INCOMPLETE');
    expect(
      result.issues.some((issue) => issue.code === 'reading-point-moved')
    ).toBe(true);
  });
  it('permits the actual ancestor hit target for noninteractive text', () => {
    const data = evidence();
    for (const sample of data.trace.samples) {
      for (const fragment of [
        sample.point!.fragment,
        ...sample.nodes.flatMap((node) => node.fragments),
      ]) {
        fragment.pointerEvents = 'none';
        fragment.hits.forEach((hit) => {
          hit.stack.shift();
        });
      }
    }
    expect(assessScrollReadingTrace(data.trace, data.contract).verdict).toBe(
      'PASS'
    );
  });
  describe('injected detection is separate from continuous stability', () => {
    const prepared = () => {
      const data = evidence();
      data.contract.terminalTime = 500;
      data.contract.coverage.endTime = 1500;
      data.trace.marks[0].time = 500;
      data.trace.samples = Array.from({ length: 31 }, (_, index) => ({
        ...structuredClone(data.trace.samples[0]),
        time: index * 50,
      }));
      failures[2][1](data);
      return data;
    };
    const fault = {
      code: 'reading-point-moved',
      appliedAt: 350,
      restoredAt: 450,
    };
    it('qualifies a matching fault observed with unchanged row geometry', () => {
      const data = prepared();
      expect(
        assessInjectedReadingFault(data.trace, data.contract, fault)
      ).toMatchObject({
        detected: true,
        continuityVerdict: 'FAIL',
        productCoverage: false,
      });
    });
    it('retains incomplete continuity when a coherent sample catches the fault', () => {
      const data = prepared();
      data.trace.samples.splice(12, 3);
      expect(
        assessInjectedReadingFault(data.trace, data.contract, fault)
      ).toMatchObject({
        detected: true,
        continuityVerdict: 'INCOMPLETE',
        productCoverage: false,
      });
    });
    it.each([
      'no-fault',
      'wrong-code',
      'outside-window',
      'invalid-sample',
      'invalid-baseline',
      'unhealthy-baseline',
      'wrong-contract',
      'row-moved',
    ] as const)('does not qualify %s', (kind) => {
      const data = prepared();
      const expected = { ...fault };
      if (kind === 'no-fault')
        data.trace.samples[8] = {
          ...structuredClone(data.trace.samples[7]),
          time: 400,
        };
      if (kind === 'wrong-code') expected.code = 'hidden-text';
      if (kind === 'outside-window') expected.appliedAt = 425;
      if (kind === 'invalid-sample')
        data.trace.samples[8].measurement.durationMs = 33;
      if (kind === 'invalid-baseline')
        data.trace.samples[0].row.rect.width = NaN;
      if (kind === 'unhealthy-baseline')
        data.trace.samples[0].block.opacity = 0;
      if (kind === 'wrong-contract') data.trace.blockSelector = '.other';
      if (kind === 'row-moved') {
        data.trace.samples[8].row.rect.top += 12;
        data.trace.samples[8].row.rect.bottom += 12;
        data.trace.samples[8].row.clip.top += 12;
        data.trace.samples[8].row.clip.bottom += 12;
      }
      expect(
        assessInjectedReadingFault(data.trace, data.contract, expected).detected
      ).toBe(false);
    });
  });
  it('allows offscreen text fragments while the declared character remains visible', () => {
    const data = evidence();
    for (const sample of data.trace.samples) {
      const fragment = structuredClone(sample.nodes[0].fragments[0]);
      fragment.presentation.rect.top += 400;
      fragment.presentation.rect.bottom += 400;
      fragment.presentation.clip.top += 400;
      fragment.presentation.clip.bottom += 400;
      fragment.presentation.clip.width = 0;
      fragment.presentation.clip.right = fragment.presentation.clip.left;
      fragment.hits = [];
      sample.nodes[0].fragments.push(fragment);
    }
    expect(assessScrollReadingTrace(data.trace, data.contract).verdict).toBe(
      'PASS'
    );
  });
});
