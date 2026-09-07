import { describe, expect, it } from 'vitest';
import {
  referenceScenarioRegistry,
  replayWebReference,
} from '../../../scripts/scroll-stability-reference-evidence.mjs';
import {
  assessWebEvidence,
  readPlaywrightReport,
  webScenarioRegistry,
} from '../../../scripts/scroll-stability-web-evidence.mjs';

// Independently authored importer controls. These traces are deliberately
// synthetic and never counted as real reference or painted-frame coverage.
function evidence(position = 'latest') {
  const registered = referenceScenarioRegistry.find(
    (r) => r.referencePosition === position
  );
  const wall = Date.parse('2026-09-07T06:00:00Z');
  const sourceId = '123.456';
  const rowId = '234.567';
  const sourceChannel = 'chat/~zod/source';
  const destination = 'chat/~zod/reader';
  const scope = '/apps/groups/group/~zod%2Fgroup/channel/chat%2F~zod%2Freader';
  const first = 'Reference abcdef12: the original quoted words.';
  const second =
    first +
    ' The source was edited while its reference remained visible. This longer revision wraps across several lines and must never revert to the original quotation after becoming ready.';
  const paragraph =
    'Reference reader 1234abcd keeps this exact reading character visible.';
  const pending = 'Loading remote content...';
  const error = 'Content not available';
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
  const fragment = (left = 20, top = 600, width = 600, height = 20) => ({
    presentation: presentation(left, top, width, height),
    textAlpha: 1,
    pointerEvents: 'auto',
    hits: [0.1, 0.5, 0.9].map((fraction) => ({
      x: left + width * fraction,
      y: top + height / 2,
      stack: [{ relation: 'owner', tag: 'SPAN' }],
    })),
  });
  const essay = (text, sent = wall + 100) => ({
    author: '~zod',
    kind: '/chat',
    sent,
    meta: null,
    blob: null,
    content: [{ inline: [text] }],
  });
  const read = (channel, time) => ({
    url: `http://localhost:3000/~/scry/channels/v5/${channel}/posts/newest/100/post.json`,
    requestedAt: wall + time,
    completedAt: wall + time + 5,
    requestedTime: time,
    completedTime: time + 5,
  });
  const containingEssay = {
    ...essay(paragraph, wall + 200),
    content: [
      {
        block: {
          cite: { chan: { nest: sourceChannel, where: `/msg/${sourceId}` } },
        },
      },
      { inline: [paragraph] },
    ],
  };
  const containingBefore = {
    seal: { id: rowId },
    essay: containingEssay,
    revision: '0',
    read: read(destination, 500),
  };
  const source = {
    seal: { id: '123456' },
    essay: essay(first),
    revision: '0',
    snapshot: {
      postCount: 61,
      newerCount: 60,
      postIds: Array.from({ length: 61 }, (_, i) => String(123456 + i)),
    },
    read: read(sourceChannel, 300),
  };
  const requestPath = `/v5/said/~zod/${sourceChannel}/post/${sourceId}`;
  const actions = [
    {
      id: 3,
      action: 'subscribe',
      ship: 'zod',
      app: 'channels',
      path: requestPath,
    },
  ];
  const requests = [
    {
      method: 'PUT',
      url: 'http://localhost:3000/~/channel/1712-a',
      actions,
      path: requestPath,
      requestedAt: wall + 700,
      requestedTime: 700,
      releasedAt: wall + 1310,
      releasedTime: 1310,
      forwardedAt: wall + 1320,
      forwardedTime: 1320,
      forwardedActions: structuredClone(actions),
      overrideProvided: false,
    },
  ];
  const preparation = {
    scope,
    origin: 'http://localhost:3000',
    ship: 'zod',
    e2eMode: false,
    warmupMs: 2010,
    browser: '136.0.0.0',
    channel: 'chromium',
    headed: true,
    assets: 'Vite development assets',
  };
  const editEssay = essay(second, wall + 3290);
  const editWrite = {
    url: 'http://localhost:3000/~/channel/scroller-reference-12345678-1234-1234-1234-123456789abc',
    method: 'PUT',
    status: 200,
    requestedAt: wall + 3310,
    requestedTime: 3310,
    completedAt: wall + 3340,
    completedTime: 3340,
    actions: [
      {
        id: 1,
        action: 'poke',
        ship: 'zod',
        app: 'channels',
        mark: 'channel-action-2',
        json: {
          channel: {
            nest: sourceChannel,
            action: { post: { edit: { id: sourceId, essay: editEssay } } },
          },
        },
      },
    ],
  };
  const record = {
    scenario: registered.scenario,
    contract: registered,
    executed: true,
    reportedStatus: 'passed',
    expectedStatus: 'passed',
    attemptStartTime: new Date(wall).toISOString(),
    attemptDurationMs: 10_000,
    browserTraces: [],
    referenceProofs: [],
  };
  const phases = {};
  for (const [index, phase] of ['load', 'edit'].entries()) {
    const startTime = 1000 + index * 2000;
    const actionTime = startTime + 300;
    const ready = startTime + 350;
    const terminal = startTime + 400;
    const label = `reference-${position}-${phase}`;
    const beforeText = phase === 'load' ? pending : first;
    const afterText = phase === 'load' ? first : second;
    const forbiddenTexts =
      phase === 'load' ? [error, second] : [error, pending];
    const pointStart = paragraph.indexOf('reading');
    const contract = {
      beforeText,
      afterText,
      forbiddenTexts,
      actionTime,
      authorSelector: '.is_PostReferenceAuthorName',
      authorLabel: '~zod',
      reading: {
        scope,
        rowId,
        blockSelector: ':scope > span:nth-child(2)',
        revision: { id: `reference-reader-${rowId}`, text: paragraph },
        point: {
          start: pointStart,
          end: pointStart + 1,
          x: 200,
          y: 600,
          tolerancePx: 1,
        },
        coverage: {
          startTime,
          endTime: terminal + 1000,
          maxGapMs: 100,
          maxMeasurementDurationMs: 32,
        },
        terminalTime: terminal,
      },
    };
    const trace = {
      blockSelector: contract.reading.blockSelector,
      point: { start: pointStart, end: pointStart + 1 },
      errors: [],
      marks: [{ id: 'terminal-ready', time: terminal }],
      samples: Array.from({ length: 29 }, (_, i) => {
        const time = startTime + 50 * i;
        const current = time < ready ? beforeText : afterText;
        return {
          time,
          scope,
          rowId,
          sameRow: true,
          sameBlock: true,
          blockCount: 1,
          text: paragraph,
          list: presentation(0, 0, 700, 800),
          row: presentation(0, 400, 700, 300),
          block: presentation(20, 600, 600, 20),
          nodes: [
            {
              text: paragraph,
              start: 0,
              end: paragraph.length,
              fragments: [fragment()],
            },
          ],
          point: {
            start: pointStart,
            end: pointStart + 1,
            text: 'r',
            relativeX: 200,
            relativeY: 600,
            fragment: fragment(200, 600, 8),
          },
          measurement: { valid: true, durationMs: 1 },
          observations: [beforeText, afterText, ...forbiddenTexts].map(
            (text) => ({
              text,
              count: text === current ? 1 : 0,
              fragments: text === current ? [fragment(20, 450, 600)] : [],
            })
          ),
          elements: [
            {
              selector: '.is_PostReferenceAuthorName',
              count: current === pending ? 0 : 1,
              texts: current === pending ? [] : ['~zod'],
              fragments: current === pending ? [] : [fragment(20, 420, 40)],
            },
          ],
        };
      }),
    };
    const geometry = {
      errors: [],
      marks: [
        { label: `${label}:start`, time: actionTime - 10 },
        { label: `${label}:terminal-state`, time: terminal + 5 },
      ],
      frames: Array.from({ length: 30 }, (_, i) => ({
        time: startTime - 5 + i * 50,
        scrollHeight: 2000,
        clientHeight: 800,
        scrollTop: position === 'latest' ? 1200 : 900,
        bottomGap: position === 'latest' ? 0 : 300,
        viewportTop: 0,
        viewportBottom: 800,
        anchors: { [rowId]: { top: 400, bottom: 700, height: 300 } },
      })),
    };
    const proof = {
      trace,
      contract,
      assessment: { verdict: 'PASS' },
      requests,
      source,
      sourceChannel,
      sourceId,
      containingEssay,
      containingBefore,
      containingAfter: {
        ...containingBefore,
        read: read(destination, terminal + 1050),
      },
      preparation,
      clockDomains: {
        transport: 'Date.now milliseconds',
        capture: 'performance.now milliseconds',
      },
      ...(phase === 'edit' ? { editWrite } : {}),
    };
    record.browserTraces.push({ name: `${label}-geometry`, value: geometry });
    record.referenceProofs.push(
      { name: `${label}-proof`, value: proof },
      { name: `${label}-reading-raw`, value: trace }
    );
    phases[phase] = { proof, trace, contract, geometry };
  }
  const committed = {
    seal: { id: '123456' },
    essay: editEssay,
    revision: '1',
    snapshot: { postCount: 61, newerCount: 60 },
    read: read(sourceChannel, 4600),
  };
  record.referenceProofs.push({
    name: `reference-${position}-committed-edit`,
    value: committed,
  });
  return {
    record,
    phases,
    requests,
    source,
    containingEssay,
    editWrite,
    committed,
  };
}

function movePoint(sample, delta = 25) {
  sample.point.relativeY += delta;
  for (const fragment of [
    sample.point.fragment,
    ...sample.nodes[0].fragments,
  ]) {
    for (const r of [fragment.presentation.rect, fragment.presentation.clip]) {
      r.top += delta;
      r.bottom += delta;
    }
    for (const hit of fragment.hits) hit.y += delta;
  }
}

describe('independent real reference evidence import', () => {
  it.each(['latest', 'history'])(
    'accepts a complete independently authored %s load and edit',
    (position) => {
      const { record } = evidence(position);
      expect(replayWebReference(record)).toEqual([]);
      expect(assessWebEvidence(record).status).toBe('recorded-sampled-pass');
    }
  );
  it('survives JSON serialization without depending on shared object identity', () => {
    const record = JSON.parse(JSON.stringify(evidence().record));
    expect(replayWebReference(record)).toEqual([]);
  });
  it('does not manufacture a wall-clock endpoint from monotonic attempt duration', () => {
    const { record } = evidence();
    record.attemptStartTime = new Date(
      Date.parse(record.attemptStartTime) - 2000
    ).toISOString();
    record.attemptDurationMs = 5000;
    expect(replayWebReference(record)).toEqual([]);
  });
  it.each([
    [
      'missing load',
      (d) => {
        d.record.referenceProofs.splice(0, 2);
      },
    ],
    [
      'missing edit',
      (d) => {
        d.record.referenceProofs.splice(2, 2);
      },
    ],
    [
      'duplicate attachment',
      (d) => d.record.referenceProofs.push(d.record.referenceProofs[0]),
    ],
    ['missing raw trace', (d) => d.record.referenceProofs.splice(1, 1)],
    [
      'contradictory raw trace',
      (d) => {
        d.record.referenceProofs[1].value = structuredClone(
          d.phases.load.trace
        );
        d.record.referenceProofs[1].value.samples[3].time++;
      },
    ],
    [
      'missing author',
      (d) => {
        delete d.phases.load.contract.authorLabel;
        d.phases.load.trace.samples.forEach((s) => delete s.elements);
      },
    ],
    [
      'wrong source id',
      (d) => {
        d.phases.load.proof.sourceId = '456.789';
      },
    ],
    [
      'wrong outer post',
      (d) => {
        d.phases.load.proof.containingAfter = {
          ...d.phases.load.proof.containingAfter,
          seal: { id: '456.789' },
        };
      },
    ],
    [
      'changed containing essay',
      (d) => {
        d.phases.load.proof.containingAfter = structuredClone(
          d.phases.load.proof.containingAfter
        );
        d.phases.load.proof.containingAfter.essay.content[1].inline[0] +=
          'edited';
      },
    ],
    [
      'cached source inside initial window',
      (d) => {
        d.source.snapshot.newerCount = 49;
      },
    ],
    [
      'missing raw source inventory',
      (d) => {
        delete d.source.snapshot.postIds;
      },
    ],
    [
      'forged newer count',
      (d) => {
        d.source.snapshot.postIds[60] = '123455';
      },
    ],
    [
      'duplicate source inventory',
      (d) => {
        d.source.snapshot.postIds[60] = d.source.snapshot.postIds[59];
      },
    ],
    [
      'missing uncached request',
      (d) => {
        d.requests.length = 0;
      },
    ],
    [
      'wrong subscription',
      (d) => {
        d.requests[0].actions[0].path = '/wrong';
      },
    ],
    [
      'rewritten forwarding',
      (d) => {
        d.requests[0].forwardedActions[0].ship = 'nec';
      },
    ],
    [
      'request override',
      (d) => {
        d.requests[0].overrideProvided = true;
      },
    ],
    [
      'stale request from old attempt',
      (d) => {
        d.requests[0].requestedAt = 10;
      },
    ],
    [
      'release after ready',
      (d) => {
        d.requests[0].forwardedTime = 1500;
      },
    ],
    [
      'premature release',
      (d) => {
        d.requests[0].releasedTime = 1200;
      },
    ],
    [
      'wrong clock domain',
      (d) => {
        d.phases.load.proof.clockDomains.capture = 'Date.now milliseconds';
      },
    ],
    [
      'wall/performance mismatch',
      (d) => {
        d.requests[0].forwardedAt += 200;
      },
    ],
    [
      'capture outside fresh browser lifetime',
      (d) => {
        d.record.attemptDurationMs = 1000;
      },
    ],
    [
      'weakened sampling gap',
      (d) => {
        d.phases.load.contract.reading.coverage.maxGapMs = 101;
      },
    ],
    [
      'weakened acquisition',
      (d) => {
        d.phases.load.contract.reading.coverage.maxMeasurementDurationMs = 33;
      },
    ],
    [
      'weakened point tolerance',
      (d) => {
        d.phases.load.contract.reading.point.tolerancePx = 2;
      },
    ],
    [
      'posthoc tail',
      (d) => {
        d.phases.load.contract.reading.coverage.endTime -= 200;
      },
    ],
    [
      'missing sample',
      (d) => {
        d.phases.load.trace.samples.splice(6, 3);
      },
    ],
    [
      'long acquisition',
      (d) => {
        d.phases.load.trace.samples[5].measurement.durationMs = 33;
      },
    ],
    [
      'missing terminal tail',
      (d) => {
        d.phases.load.trace.samples.splice(-3);
      },
    ],
    [
      'skipped pending phase',
      (d) => {
        d.phases.load.contract.actionTime = 1100;
      },
    ],
    [
      'missing action mark',
      (d) => {
        d.phases.load.geometry.marks.shift();
      },
    ],
    [
      'unpaired viewport',
      (d) => {
        d.phases.load.geometry.frames.forEach((f) => {
          f.viewportTop += 10;
          f.viewportBottom += 10;
        });
      },
    ],
    [
      'missing edit write',
      (d) => {
        delete d.phases.edit.proof.editWrite;
      },
    ],
    [
      'wrong edit destination',
      (d) => {
        d.editWrite.actions[0].json.channel.nest = 'chat/~zod/elsewhere';
      },
    ],
    [
      'wrong edit id',
      (d) => {
        d.editWrite.actions[0].json.channel.action.post.edit.id = '456.789';
      },
    ],
    [
      'failed write request',
      (d) => {
        d.editWrite.status = 500;
      },
    ],
    [
      'old backend revision',
      (d) => {
        d.committed.revision = '0';
      },
    ],
    [
      'stale backend content',
      (d) => {
        d.committed.essay = d.source.essay;
      },
    ],
    [
      'backend read before terminal',
      (d) => {
        d.committed.read.requestedTime = 3300;
      },
    ],
    [
      'test-only flags',
      (d) => {
        d.phases.load.proof.preparation.e2eMode = true;
      },
    ],
    [
      'reused edit capture',
      (d) => {
        d.phases.edit.proof.trace = d.phases.load.trace;
      },
    ],
  ])('rejects %s despite producer PASS', (_name, corrupt) => {
    const d = evidence();
    corrupt(d);
    expect(() => replayWebReference(d.record)).not.toThrow();
    expect(
      replayWebReference(d.record).some((issue) => issue.kind === 'incomplete')
    ).toBe(true);
    expect(assessWebEvidence(d.record).status).not.toBe(
      'recorded-sampled-pass'
    );
  });
  it.each(['load', 'edit'])(
    'preserves a valid %s interior movement as failure',
    (phase) => {
      const d = evidence();
      movePoint(d.phases[phase].trace.samples[12]);
      expect(
        replayWebReference(d.record).some(
          (i) =>
            i.kind === 'failure' && i.message.includes('reading-point-moved')
        )
      ).toBe(true);
      expect(assessWebEvidence(d.record).status).toBe('fail');
    }
  );
  it('retains load geometry failure when author and edit evidence are missing', () => {
    const d = evidence();
    movePoint(d.phases.load.trace.samples[12]);
    delete d.phases.load.contract.authorLabel;
    d.phases.load.trace.samples.forEach((s) => delete s.elements);
    d.record.referenceProofs.splice(2);
    expect(assessWebEvidence(d.record).status).toBe('fail');
    expect(
      replayWebReference(d.record).some((i) => i.kind === 'incomplete')
    ).toBe(true);
  });
  it('does not attribute a bad initial reading point to the mutation', () => {
    const d = evidence('history');
    d.phases.load.trace.samples[0].point.fragment.presentation.clip.height = 0;
    d.phases.load.trace.samples[0].point.fragment.presentation.clip.bottom = 600;
    d.phases.load.trace.samples[0].point.fragment.hits = [];
    movePoint(d.phases.load.trace.samples[12]);
    expect(replayWebReference(d.record).some((i) => i.kind === 'failure')).toBe(
      false
    );
    expect(assessWebEvidence(d.record).status).toBe('incomplete');
  });
  it('does not turn a gap surrounding movement into qualified failure', () => {
    const d = evidence();
    movePoint(d.phases.load.trace.samples[12]);
    d.phases.load.trace.samples.splice(8, 3);
    expect(assessWebEvidence(d.record).status).toBe('incomplete');
  });
  it('detects a transient latest gap with eventual correct landing', () => {
    const d = evidence();
    d.phases.load.geometry.frames[12].scrollTop -= 20;
    d.phases.load.geometry.frames[12].bottomGap += 20;
    expect(assessWebEvidence(d.record).status).toBe('fail');
  });
  it.each([
    [
      'wrong author',
      (s) => {
        s.elements[0].texts = ['~nec'];
      },
    ],
    [
      'stale reference reappears',
      (s) => {
        s.observations[0].count = 1;
        s.observations[0].fragments = s.observations[1].fragments;
        s.observations[1].count = 0;
        s.observations[1].fragments = [];
      },
    ],
    [
      'brief blank',
      (s) => {
        s.observations[1].count = 0;
        s.observations[1].fragments = [];
      },
    ],
    [
      'hidden reference',
      (s) => {
        s.observations[1].fragments[0].presentation.opacity = 0;
      },
    ],
    [
      'covered reference',
      (s) => {
        s.observations[1].fragments[0].hits[0].stack.unshift({
          relation: 'foreign',
          tag: 'ASIDE',
        });
      },
    ],
  ])('detects %s from valid samples', (_name, corrupt) => {
    const d = evidence();
    corrupt(d.phases.edit.trace.samples[12]);
    expect(assessWebEvidence(d.record).status).toBe('fail');
  });
  it('registers only the two real product titles and imports base64 proof', () => {
    const { record } = evidence();
    const attachments = [
      ...record.browserTraces,
      ...record.referenceProofs,
    ].map(({ name, value }) => ({
      name,
      contentType: 'application/json',
      body: Buffer.from(JSON.stringify(value)).toString('base64'),
    }));
    const report = {
      suites: [
        {
          title: 'scroller-reference-stability.spec.ts',
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
    expect(
      webScenarioRegistry.filter((r) => r.requireReferenceProof)
    ).toHaveLength(2);
    expect(records).toHaveLength(1);
    expect(assessWebEvidence(records[0]).status).toBe('recorded-sampled-pass');
  });
  it('records a registered pre-capture setup failure as incomplete', () => {
    const { record } = evidence();
    record.reportedStatus = 'failed';
    record.browserTraces = [];
    record.referenceProofs = [];
    expect(assessWebEvidence(record).status).toBe('incomplete');
  });
  it('returns incomplete for malformed attachment inventories', () => {
    const { record } = evidence();
    record.referenceProofs = {};
    expect(() => replayWebReference(record)).not.toThrow();
    expect(
      replayWebReference(record).every((issue) => issue.kind === 'incomplete')
    ).toBe(true);
  });
});
