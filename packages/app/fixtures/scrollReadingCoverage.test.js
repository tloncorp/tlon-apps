import { describe, expect, it } from 'vitest';
import { assessScrollReferenceTrace } from './scrollReferenceTrace';
import { assessScrollReadingTrace } from './scrollReadingTrace';

import {
  assessWebEvidence,
  readPlaywrightReport,
  replayWebReading,
  webScenarioRegistry,
} from '../../../scripts/scroll-stability-web-evidence.mjs';

// Synthetic importer controls, never product coverage. The expected paragraph,
// clocks and lifecycle are authored here independently of recorded outcomes.
function evidence(position = 'latest', avatar = false) {
  const registered = webScenarioRegistry.find(
    (item) => item.scenario === `web-reading-image-${position}`
  );
  const label = registered.readingLabel;
  const scope = '/apps/groups/group/~zod%2Fgroup/channel/chat%2F~zod%2Fchannel';
  const origin = 'http://localhost:3000';
  const src = '/scroller-loading/12345678-1234-1234-1234-123456789abc.png';
  const rowId = 'post-1';
  const prefix = 'Reader abcdef12: plain words, ';
  const text = `${prefix}reading point stable() and unchanged trailing text.`;
  const inlines = [
    prefix,
    { bold: ['reading'] },
    ' ',
    { italics: ['point'] },
    ' ',
    { 'inline-code': 'stable()' },
    ' and unchanged trailing text.',
  ];
  const wall = Date.parse('2026-09-07T00:00:00Z');
  const box = (left, top, width, height) => ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  });
  const presentation = (left, top, width, height) => ({
    connected: true,
    displayed: true,
    opacity: 1,
    rect: box(left, top, width, height),
    clip: box(left, top, width, height),
  });
  const fragment = (left, width) => ({
    presentation: presentation(left, 650, width, 20),
    textAlpha: 1,
    pointerEvents: 'auto',
    hits: [0.1, 0.5, 0.9].map((fraction) => ({
      x: left + width * fraction,
      y: 660,
      stack: [{ relation: 'owner', tag: 'SPAN' }],
    })),
  });
  const row = (time) =>
    presentation(0, time < 350 ? 200 : 300, 700, time < 350 ? 500 : 400);
  const contract = {
    scope,
    rowId,
    blockSelector: '.body',
    revision: { id: `committed-post-${rowId}`, text },
    point: {
      start: prefix.length,
      end: prefix.length + 1,
      x: 200,
      y: 650,
      tolerancePx: 1,
    },
    coverage: {
      startTime: 10,
      endTime: 1400,
      maxGapMs: 100,
      maxMeasurementDurationMs: 32,
    },
    terminalTime: 400,
  };
  const trace = {
    blockSelector: '.body',
    point: { start: prefix.length, end: prefix.length + 1 },
    errors: [],
    marks: [{ id: 'terminal-ready', time: 400 }],
    samples: Array.from({ length: 29 }, (_, index) => {
      const time = 10 + index * 50;
      return {
        time,
        scope,
        rowId,
        sameRow: true,
        sameBlock: true,
        blockCount: 1,
        text,
        list: presentation(0, 0, 700, 800),
        row: row(time),
        block: presentation(20, 650, 600, 40),
        nodes: [
          { text, start: 0, end: text.length, fragments: [fragment(20, 600)] },
        ],
        point: {
          start: prefix.length,
          end: prefix.length + 1,
          text: 'r',
          relativeX: 200,
          relativeY: 650,
          fragment: fragment(200, 8),
        },
        measurement: { valid: true, durationMs: 1 },
      };
    }),
  };
  const geometry = {
    errors: [],
    marks: [
      { label: `${label}:response-release`, time: 290 },
      { label: `${label}:image-decoded`, time: 370 },
    ],
    frames: Array.from({ length: 30 }, (_, index) => {
      const time = index * 50;
      const rect = row(time).rect;
      const scrollHeight = time < 350 ? 2000 : 1900;
      const bottomGap = position === 'history' ? 300 : 0;
      return {
        time,
        scrollHeight,
        clientHeight: 800,
        scrollTop: scrollHeight - 800 - bottomGap,
        viewportTop: 0,
        viewportBottom: 800,
        bottomGap,
        anchors: {
          [rowId]: { top: rect.top, bottom: rect.bottom, height: rect.height },
        },
      };
    }),
  };
  const events = ['image-load', 'image-decoded'].map((id, index) => ({
    id,
    time: index ? 350 : 320,
    scope,
    src: origin + src,
    currentSrc: origin + src,
    originalTarget: true,
    trusted: true,
  }));
  const image = {
    errors: [],
    marks: [{ id: 'response-release', time: 300 }],
    events,
    samples: Array.from({ length: 29 }, (_, index) => {
      const time = 20 + index * 50;
      const ready = time >= 350;
      return {
        time,
        scope,
        rowId,
        sameRow: true,
        fallbackPresent: false,
        measurement: { valid: true, durationMs: 1 },
        images: [
          ...(avatar
            ? [
                {
                  src: '/avatar.png',
                  currentSrc: '/avatar.png',
                  sameElement: false,
                },
              ]
            : []),
          {
            src: origin + src,
            currentSrc: ready ? origin + src : '',
            complete: ready,
            naturalWidth: ready ? 2 : 0,
            naturalHeight: ready ? 1 : 0,
            sameElement: true,
            presentation: presentation(
              0,
              row(time).rect.top,
              600,
              ready ? 300 : 400
            ),
          },
        ],
      };
    }),
  };
  const essay = {
    author: '~zod',
    kind: '/chat',
    sent: wall + 100,
    meta: null,
    blob: null,
    content: [
      { block: { image: { src, alt: text, width: 0, height: 0 } } },
      { inline: inlines },
    ],
  };
  const loading = {
    scope,
    origin,
    src,
    imagePostId: rowId,
    beforeEssay: essay,
    afterEssay: structuredClone(essay),
    beforeRow: { height: 500 },
    afterRow: { height: 400 },
    beforeImage: { height: 400 },
    afterImage: { height: 300 },
    beforeDecode: { complete: false, width: 0, height: 0 },
    afterDecode: { complete: true, width: 2, height: 1 },
    requests: [
      {
        requestedAt: wall + 200,
        releasedAt: wall + 600,
        fulfilledAt: wall + 650,
      },
    ],
    releaseTime: 300,
    terminalTime: 400,
    events: structuredClone(events),
    clockDomains: {
      route: 'Date.now milliseconds',
      samplesAndEvents: 'performance.now milliseconds',
    },
  };
  const preparation = {
    scope,
    origin,
    ship: 'zod',
    e2eMode: false,
    developmentAssets: true,
    assets: 'Vite development assets',
    headed: true,
    channel: 'chromium',
    browser: '136.0.0.0',
    expectedText: text,
    inlines,
    semantic: {
      selector: '.body',
      text,
      descendants: [
        { text: 'reading', fontWeight: '700' },
        { text: 'point', fontStyle: 'italic' },
        { text: 'stable()', fontFamily: 'monospace' },
      ],
    },
  };
  const proof = {
    trace,
    contract,
    assessment: { verdict: 'PASS', passed: true },
  };
  const record = {
    scenario: registered.scenario,
    contract: registered,
    executed: true,
    reportedStatus: 'passed',
    expectedStatus: 'passed',
    attemptStartTime: new Date(wall).toISOString(),
    attemptDurationMs: 10_000,
    browserTraces: [{ name: `${label}-geometry`, value: geometry }],
    readingProofs: [
      ['reading-proof', proof],
      ['loading-proof', loading],
      ['image-events', image],
      ['preparation', preparation],
    ].map(([suffix, value]) => ({ name: `${label}-${suffix}`, value })),
  };
  return {
    record,
    trace,
    contract,
    image,
    loading,
    geometry,
    preparation,
    proof,
  };
}

describe('real ChatMessage reading evidence importer', () => {
  it.each(['latest', 'history'])(
    'independently accepts the bounded %s contract with an unrelated avatar',
    (position) => {
      const { record } = evidence(position, true);
      expect(replayWebReading(record)).toEqual([]);
      expect(assessWebEvidence(record).status).toBe('recorded-sampled-pass');
    }
  );

  const incomplete = [
    ['missing attachment', (d) => d.record.readingProofs.pop()],
    [
      'duplicate attachment',
      (d) => d.record.readingProofs.push(d.record.readingProofs[0]),
    ],
    [
      'malformed proof inventory',
      (d) => {
        d.record.readingProofs = {};
      },
    ],
    [
      'malformed image inventory',
      (d) => {
        d.image.samples[0].images = {};
      },
    ],
    ['collector error', (d) => d.image.errors.push('detached during capture')],
    [
      'only endpoints retained',
      (d) => {
        d.image.samples = [d.image.samples[0], d.image.samples.at(-1)];
      },
    ],
    ['image capture gap', (d) => d.image.samples.splice(4, 3)],
    [
      'duplicate image timestamp',
      (d) => {
        d.image.samples[4].time = d.image.samples[3].time;
      },
    ],
    [
      'slow image acquisition',
      (d) => {
        d.image.samples[4].measurement.durationMs = 33;
      },
    ],
    [
      'missing image acquisition',
      (d) => {
        delete d.image.samples[4].measurement;
      },
    ],
    [
      'stale backend essay',
      (d) => {
        d.loading.afterEssay.sent++;
      },
    ],
    [
      'request from previous attempt',
      (d) => {
        d.loading.requests[0].requestedAt = 1;
      },
    ],
    [
      'untrusted load',
      (d) => {
        d.image.events[0].trusted = d.loading.events[0].trusted = false;
      },
    ],
    [
      'decode preceding load',
      (d) => {
        d.image.events[1].time = d.loading.events[1].time = 310;
      },
    ],
    [
      'short pending interval',
      (d) => {
        d.loading.releaseTime = d.image.marks[0].time = 200;
      },
    ],
    [
      'missing quiet tail',
      (d) => {
        d.trace.samples.splice(-3);
      },
    ],
    [
      'weak point tolerance',
      (d) => {
        d.contract.point.tolerancePx = 2;
      },
    ],
    [
      'wrong paired viewport',
      (d) => {
        d.geometry.frames.forEach((f) => {
          f.viewportTop += 10;
          f.viewportBottom += 10;
        });
      },
    ],
    [
      'test-only application mode',
      (d) => {
        d.preparation.e2eMode = true;
      },
    ],
    [
      'missing rich formatting precondition',
      (d) => {
        d.preparation.semantic.descendants = [];
      },
    ],
    [
      'premature row resize',
      (d) => {
        d.trace.samples[3].row.rect.height = 400;
        d.trace.samples[3].row.rect.bottom -= 100;
        d.trace.samples[3].row.clip.height = 400;
        d.trace.samples[3].row.clip.bottom -= 100;
      },
    ],
  ];
  it.each(incomplete)(
    'rejects %s without trusting producer PASS',
    (_name, corrupt) => {
      const data = evidence();
      corrupt(data);
      expect(() => replayWebReading(data.record)).not.toThrow();
      expect(
        replayWebReading(data.record).some(
          (issue) => issue.kind === 'incomplete'
        )
      ).toBe(true);
    }
  );

  it.each([
    [
      'blank inner text',
      (d) => {
        d.trace.samples[10].text = '';
        d.trace.samples[10].nodes = [];
        d.trace.samples[10].point = null;
      },
    ],
    [
      'covered character',
      (d) => {
        d.trace.samples[10].point.fragment.hits[1].stack.unshift({
          relation: 'foreign',
          tag: 'ASIDE',
        });
      },
    ],
    [
      'image source reversion',
      (d) => {
        d.image.samples[10].images[0].currentSrc =
          'http://localhost:3000/stale.png';
      },
    ],
    [
      'image ready to pending',
      (d) => {
        Object.assign(d.image.samples[10].images[0], {
          complete: false,
          naturalWidth: 0,
          naturalHeight: 0,
          currentSrc: '',
        });
      },
    ],
    [
      'image error fallback',
      (d) => {
        d.image.samples[10].fallbackPresent = true;
      },
    ],
    [
      'inner text shift inside stable row',
      (d) => {
        const s = d.trace.samples[10];
        s.point.relativeY += 12;
        for (const f of [s.point.fragment, s.nodes[0].fragments[0]]) {
          for (const r of [f.presentation.rect, f.presentation.clip]) {
            r.top += 12;
            r.bottom += 12;
          }
          f.hits.forEach((hit) => {
            hit.y += 12;
          });
        }
      },
    ],
  ])('retains observed %s as failure', (_name, corrupt) => {
    const data = evidence();
    corrupt(data);
    expect(
      replayWebReading(data.record).some((issue) => issue.kind === 'failure')
    ).toBe(true);
  });

  it('does not turn a failed browser attempt into a pass', () => {
    const { record } = evidence();
    record.reportedStatus = 'failed';
    expect(assessWebEvidence(record).status).toBe('fail');
  });

  it('recognizes top-level product titles and base64 raw attachments without a describe wrapper', () => {
    const { record } = evidence();
    const attachments = [...record.browserTraces, ...record.readingProofs].map(
      ({ name, value }) => ({
        name,
        contentType: 'application/json',
        body: Buffer.from(JSON.stringify(value)).toString('base64'),
      })
    );
    const report = {
      suites: [
        {
          title: 'scroller-reading-stability.spec.ts',
          file: record.contract.source,
          specs: [
            {
              title: record.contract.title,
              file: record.contract.source,
              tests: [
                {
                  expectedStatus: 'passed',
                  results: [
                    {
                      status: 'passed',
                      startTime: record.attemptStartTime,
                      duration: record.attemptDurationMs,
                      attachments,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const records = readPlaywrightReport(report, '/synthetic/report.json');
    expect(records).toHaveLength(1);
    expect(records[0].scenario).toBe(record.scenario);
    expect(assessWebEvidence(records[0]).status).toBe('recorded-sampled-pass');
  });
});

describe('real reference revision phase evidence', () => {
  function reference() {
    const { trace, contract } = evidence();
    const phases = {
      reading: contract,
      beforeText: 'Loading remote content...',
      afterText: 'Current quotation',
      forbiddenTexts: ['Content not available'],
      actionTime: 300,
      authorSelector: '.is_PostReferenceAuthorName',
      authorLabel: '~zod',
    };
    trace.samples.forEach((sample) => {
      sample.elements = [
        {
          selector: phases.authorSelector,
          count: sample.time < 350 ? 0 : 1,
          texts: sample.time < 350 ? [] : ['~zod'],
          fragments:
            sample.time < 350 ? [] : structuredClone(sample.nodes[0].fragments),
        },
      ];
      sample.observations = [
        phases.beforeText,
        phases.afterText,
        ...phases.forbiddenTexts,
      ].map((text) => {
        const count =
          text === (sample.time < 350 ? phases.beforeText : phases.afterText)
            ? 1
            : 0;
        return {
          text,
          count,
          fragments: count ? structuredClone(sample.nodes[0].fragments) : [],
        };
      });
    });
    return { trace, phases };
  }
  it('accepts an observed pending interval, exact quotation and independent quiet tail', () => {
    const { trace, phases } = reference();
    expect(
      assessScrollReferenceTrace(trace, phases, assessScrollReadingTrace)
        .verdict
    ).toBe('PASS');
  });
  it.each([
    [
      'brief blank',
      (d) => {
        d.trace.samples[10].observations[1].count = 0;
      },
    ],
    [
      'stale quotation returns',
      (d) => {
        const o = d.trace.samples[10].observations;
        o[0].count = 1;
        o[0].fragments = o[1].fragments;
        o[1].count = 0;
        o[1].fragments = [];
      },
    ],
    [
      'error fallback',
      (d) => {
        d.trace.samples[10].observations[2].count = 1;
      },
    ],
    [
      'hidden quotation',
      (d) => {
        d.trace.samples[10].observations[1].fragments[0].presentation.opacity = 0;
      },
    ],
    [
      'covered quotation',
      (d) => {
        d.trace.samples[10].observations[1].fragments[0].hits[0].stack.unshift({
          relation: 'foreign',
          tag: 'ASIDE',
        });
      },
    ],
  ])('rejects %s', (_name, corrupt) => {
    const d = reference();
    corrupt(d);
    expect(
      assessScrollReferenceTrace(
        d.trace,
        d.phases,
        assessScrollReadingTrace
      ).issues.some((issue) => issue.kind === 'failure')
    ).toBe(true);
  });
  it.each([
    [
      'wrong author',
      (d) => {
        d.trace.samples[10].elements[0].texts[0] = '~ten';
      },
    ],
    [
      'absent author',
      (d) => {
        d.trace.samples[10].elements[0] = {
          selector: d.phases.authorSelector,
          count: 0,
          texts: [],
          fragments: [],
        };
      },
    ],
    [
      'hidden author',
      (d) => {
        d.trace.samples[10].elements[0].fragments[0].presentation.opacity = 0;
      },
    ],
    [
      'covered author',
      (d) => {
        d.trace.samples[10].elements[0].fragments[0].hits[0].stack.unshift({
          relation: 'foreign',
          tag: 'ASIDE',
        });
      },
    ],
    [
      'unexposed author',
      (d) => {
        d.trace.samples[10].elements[0].fragments = [];
      },
    ],
  ])('rejects %s', (_name, corrupt) => {
    const d = reference();
    corrupt(d);
    expect(
      assessScrollReferenceTrace(
        d.trace,
        d.phases,
        assessScrollReadingTrace
      ).issues.some((issue) => issue.kind === 'failure')
    ).toBe(true);
  });
  it('qualifies missing author observation as incomplete', () => {
    const d = reference();
    delete d.trace.samples[10].elements;
    expect(
      assessScrollReferenceTrace(d.trace, d.phases, assessScrollReadingTrace)
        .verdict
    ).toBe('INCOMPLETE');
  });
  it('rejects missing actual reference observations', () => {
    const { trace, phases } = reference();
    delete trace.samples[10].observations;
    expect(
      assessScrollReferenceTrace(trace, phases, assessScrollReadingTrace)
        .verdict
    ).toBe('INCOMPLETE');
  });
});
