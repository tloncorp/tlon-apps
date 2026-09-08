import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readPlaywrightReport,
  webScenarioRegistry,
  assessWebEvidence,
} from './scroll-stability-web-evidence.mjs';
import {
  centerEditPlan,
  centerEditTitle,
  replayCenterEditEvidence,
} from './scroll-stability-center-edit-evidence.mjs';

import * as centerEditApi from './scroll-stability-center-edit-evidence.mjs';
const centerEditBelowTitle =
  'editing a visible message below the center reading character preserves that character';
// Independent fixed BELOW test data also loads against the original reader.
function belowPlanFixture(token) {
  const plan = centerEditPlan(token);
  plan.corpus[17] = `Center ${token} row 17: unchanged reading words remain visible in this conversation.`;
  plan.corpus[19] = plan.original;
  plan.editedIndex = 19;
  plan.expanded = plan.expanded.replaceAll(
    'above the reader',
    'below the reader'
  );
  return plan;
}
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
const fragment = (left, top, width) => ({
  presentation: presentation(left, top, width, 20),
  textAlpha: 1,
  pointerEvents: 'auto',
  hits: [0.1, 0.5, 0.9].map((f) => ({
    x: left + width * f,
    y: top + 10,
    stack: [{ relation: 'owner', tag: 'SPAN' }],
  })),
});
function fixture(side = 'above') {
  const plan =
      side === 'below'
        ? belowPlanFixture('a1234b56')
        : centerEditPlan('a1234b56'),
    origin = 'http://localhost:3000',
    channel = 'chat/~zod/test',
    scope = `/apps/groups/group/~zod%2Fgroup/channel/${encodeURIComponent(channel)}`;
  const readerId = '1019',
    editedId = String(1001 + plan.editedIndex),
    epoch = 1700000000000;
  const baselinePosts = Object.fromEntries(
    plan.corpus.map((text, i) => [
      String(1001 + i),
      {
        seal: { id: String(1001 + i), seq: i + 1 },
        essay: {
          content: [{ inline: [text] }],
          author: '~zod',
          sent: epoch + i,
          kind: '/chat',
          meta: null,
          blob: null,
        },
      },
    ])
  );
  const window = (startTime, endTime, editedText) => {
    const posts = structuredClone(baselinePosts);
    if (editedText) posts[editedId].essay.content = [{ inline: [editedText] }];
    return {
      url: `${origin}/~/scry/channels/v5/${channel}/posts/newest/100/post.json`,
      status: 200,
      startTime,
      endTime,
      body: { posts, total: 36, newest: 36, older: null, newer: null },
    };
  };
  const readingContract = {
    scope,
    rowId: readerId,
    blockSelector: '.body',
    revision: { id: readerId + ':unchanged', text: plan.corpus[18] },
    point: {
      start: plan.charStart,
      end: plan.charEnd,
      x: 200,
      y: 350,
      tolerancePx: 1,
    },
    coverage: {
      startTime: 100,
      endTime: 2000,
      maxGapMs: 100,
      maxMeasurementDurationMs: 32,
    },
    terminalTime: 1000,
  };
  const reading = {
    blockSelector: '.body',
    blockAcquisition: 'retained-element',
    point: { start: plan.charStart, end: plan.charEnd },
    errors: [],
    marks: [{ id: 'terminal-ready', time: 1000 }],
    samples: Array.from({ length: 39 }, (_, i) => ({
      time: 100 + i * 50,
      scope,
      rowId: readerId,
      sameRow: true,
      sameBlock: true,
      blockCount: 1,
      text: plan.corpus[18],
      list: presentation(0, 0, 800, 700),
      row: presentation(0, 335, 800, 52),
      block: presentation(100, 350, 600, 20),
      nodes: [
        {
          text: plan.corpus[18],
          start: 0,
          end: plan.corpus[18].length,
          fragments: [fragment(100, 350, 600)],
        },
      ],
      point: {
        start: plan.charStart,
        end: plan.charEnd,
        text: 'r',
        relativeX: 200,
        relativeY: 350,
        fragment: fragment(200, 350, 8),
      },
      measurement: { valid: true, durationMs: 1 },
    })),
  };
  const events = [200, 300, 400, 650, 750, 850].map((time, i) => ({
    time,
    kind: ['trigger', 'edit', 'save'][i % 3],
    rowId: i % 3 === 0 ? editedId : null,
    trusted: true,
    scope,
  }));
  const frames = Array.from({ length: 193 }, (_, i) => {
    const time = 90 + i * 10,
      height = time < 500 ? 50 : time < 950 ? 160 : 60;
    return {
      time,
      duration: 1,
      scope,
      offset: side === 'below' ? 600 : 600 + height - 50,
      extent: 2400 + height - 50,
      height: 700,
      edited: {
        id: editedId,
        count: 1,
        bodyCount: 1,
        top: side === 'below' ? 400 : 300 - height,
        height,
        text:
          time < 500
            ? plan.original
            : time < 950
              ? plan.expanded + ' '
              : plan.shrunk + ' ',
      },
      menuCount:
        (time >= 200 && time < 300) || (time >= 650 && time < 750) ? 1 : 0,
      menuTexts: [],
      neighbors: [],
    };
  });
  const commits = [
    { time: 550, height: 160, read: window(450, 500, plan.expanded + ' ') },
    { time: 975, height: 60, read: window(900, 950, plan.shrunk + ' ') },
  ];
  const requests = commits.map((commit, i) => {
    const actions = [
      {
        id: 10 + i,
        action: 'poke',
        ship: 'zod',
        app: 'channels',
        mark: 'channel-action-2',
        json: {
          channel: {
            nest: channel,
            action: {
              post: {
                edit: {
                  id: editedId,
                  essay: commit.read.body.posts[editedId].essay,
                },
              },
            },
          },
        },
      },
    ];
    return {
      method: 'PUT',
      url: origin + '/~/channel/real',
      status: 204,
      body: JSON.stringify(actions),
      actions,
      startTime: i ? 851 : 401,
      headersTime: i ? 870 : 410,
      endTime: i ? 880 : 420,
    };
  });
  return {
    proof: {
      plan,
      preparation: {
        origin,
        ship: 'zod',
        e2eMode: false,
        headed: false,
        timeOrigin: epoch,
        time: 50,
        wall: epoch + 50,
        wheelStartedAt: 20,
        scope,
      },
      channel,
      readerId,
      editedId,
      errors: [],
      readingContract,
      reading,
      wheel: [
        {
          time: 25,
          observedAt: 25,
          deltaY: -400,
          trusted: true,
          scope,
          sameList: true,
        },
      ],
      observer: { frames, events, errors: [] },
      before: window(20, 50),
      commits,
      requests,
      after: window(2010, 2020, plan.shrunk + ' '),
    },
    attempt: {
      title: side === 'below' ? centerEditBelowTitle : centerEditTitle,
      startTime: new Date(epoch).toISOString(),
      duration: 2500,
    },
  };
}
function evaluate(change = () => {}) {
  const evidence = fixture();
  change(evidence.proof);
  return replayCenterEditEvidence(evidence.proof, evidence.attempt);
}
function moveCharacter(p, amount) {
  const s = p.reading.samples[10],
    point = s.point;
  point.relativeY += amount;
  for (const r of [
    point.fragment.presentation.rect,
    point.fragment.presentation.clip,
  ]) {
    r.top += amount;
    r.bottom += amount;
  }
  point.fragment.hits.forEach((h) => (h.y += amount));
  for (const f of s.nodes[0].fragments) {
    for (const r of [f.presentation.rect, f.presentation.clip]) {
      r.top += amount;
      r.bottom += amount;
    }
    f.hits.forEach((h) => (h.y += amount));
  }
}

function productReport(change = () => {}, side = 'above') {
  const { proof, attempt } = fixture(side);
  const attachment = {
    name: 'center-edit-reading-proof',
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify(proof)).toString('base64'),
  };
  const result = {
    ...attempt,
    status: 'passed',
    retry: 0,
    attachments: [attachment],
    annotations: [
      {
        type: 'scroller-attempt-clock',
        description: JSON.stringify({
          version: 1,
          source: 'playwright.onTestEnd',
          testId: 'center-case',
          retry: 0,
          startTime: attempt.startTime,
          endedAt: Date.parse(attempt.startTime) + attempt.duration,
        }),
      },
    ],
  };
  change({ proof, result, attachment });
  attachment.body = Buffer.from(JSON.stringify(proof)).toString('base64');
  return {
    suites: [
      {
        title:
          side === 'below'
            ? 'Real conversation geometry'
            : 'scroller-center-edit-stability.spec.ts',
        specs: [
          {
            id: 'center-case',
            title: attempt.title,
            file:
              side === 'below'
                ? 'scroller-stability.spec.ts'
                : 'scroller-center-edit-stability.spec.ts',
            tests: [
              {
                projectName: 'chromium',
                expectedStatus: 'passed',
                results: [result],
              },
            ],
          },
        ],
      },
    ],
  };
}
function productAssessment(change) {
  const [record] = readPlaywrightReport(productReport(change), 'report.json');
  assert.equal(record.scenario, 'web-center-edit-reading');
  return assessWebEvidence(record);
}
test('full-suite importer replays the existing center-character contract', () => {
  assert.equal(productAssessment().status, 'recorded-sampled-pass');
});
test('center importer uses enclosing wall span instead of timeout-budget duration', () => {
  assert.equal(
    productAssessment(({ result }) => {
      result.duration = 1;
    }).status,
    'recorded-sampled-pass'
  );
});
test('center importer rejects a displaced character despite a producer pass', () => {
  assert.equal(
    productAssessment(({ proof }) => moveCharacter(proof, 12)).status,
    'fail'
  );
});
for (const [name, change] of [
  [
    'missing proof',
    ({ result }) => {
      result.attachments = [];
    },
  ],
  [
    'duplicate proof',
    ({ result, attachment }) => {
      result.attachments.push(attachment);
    },
  ],
  [
    'missing wall clock',
    ({ result }) => {
      result.annotations = [];
    },
  ],
  [
    'missing second saved revision',
    ({ proof }) => {
      proof.commits.pop();
    },
  ],
])
  test('full-suite center importer rejects ' + name, () => {
    assert.equal(productAssessment(change).status, 'incomplete');
  });
test('center importer cannot suppress proof with a forged registry contract', () => {
  const [record] = readPlaywrightReport(productReport(), 'report.json');
  record.contract = { ...record.contract, requireCenterEditProof: false };
  assert.equal(assessWebEvidence(record).status, 'incomplete');
});
test('center producer failure stays failed even with valid geometry', () => {
  assert.equal(
    productAssessment(({ result }) => {
      result.status = 'failed';
    }).status,
    'fail'
  );
});
test('complete unchanged character plus two real revision witnesses', () =>
  assert.equal(evaluate().verdict, 'PASS'));
for (const [name, change, code] of [
  [
    'center moves while all row tops remain fixed',
    (p) => moveCharacter(p, 12),
    'reading:reading-point-moved',
  ],
  [
    'stale unchanged paragraph',
    (p) => (p.reading.samples[10].text = 'stale words'),
    'reading:unexpected-text-revision',
  ],
  [
    'identical clone loses retained acquisition',
    (p) => (p.reading.samples[10].sameBlock = false),
    'reading:content-acquisition-lost',
  ],
  [
    'missing one-second tail',
    (p) => p.reading.samples.splice(-8),
    'reading:missing-planned-coverage',
  ],
  [
    'cadence gap',
    (p) => p.reading.samples.splice(10, 3),
    'reading:capture-gap',
  ],
  [
    'overbudget acquisition',
    (p) => (p.reading.samples[10].measurement.durationMs = 33),
    'reading:invalid-sample',
  ],
  [
    'wrong edited canonical ID in request',
    (p) => {
      p.requests[0].actions[0].json.channel.action.post.edit.id = '1050';
      p.requests[0].body = JSON.stringify(p.requests[0].actions);
    },
    'invalid-actual-edit-commit-link',
  ],
  [
    'no actual growth',
    (p) => (p.commits[0].height = 50),
    'unproven-two-height-mutations',
  ],
  [
    'duplicate actual Save',
    (p) => p.observer.events.push(p.observer.events.at(-1)),
    'missing-exact-real-edit-actions',
  ],
  [
    'fake untrusted trigger',
    (p) => (p.observer.events[0].trusted = false),
    'missing-exact-real-edit-actions',
  ],
  [
    'changed backend reader',
    (p) =>
      (p.after.body.posts[p.readerId].essay.content = [
        { inline: ['wrong reader'] },
      ]),
    'unrelated-post-mutated',
  ],
  [
    'incomplete backend window',
    (p) => delete p.after.body.posts['1001'],
    'incomplete-exact-backend-window',
  ],
  [
    'quiet tail read too early',
    (p) => (p.after.startTime = 1900),
    'final-read-before-quiet-tail',
  ],
  [
    'missing menu observation',
    (p) => p.observer.frames.forEach((f) => (f.menuCount = 0)),
    'missing-real-menu-exposure-intervals',
  ],
  [
    'clamped boundary outside bounded case',
    (p) => (p.observer.frames[40].offset = 0),
    'outside-unclamped-read-slice',
  ],
  [
    'weak plan tolerance',
    (p) => (p.plan.tolerancePx = 12),
    'invalid-attempt-plan-or-local-scope',
  ],
])
  test(name, () => {
    const result = evaluate(change);
    assert.notEqual(result.verdict, 'PASS');
    assert(
      result.issues.some((i) => i.code === code),
      JSON.stringify(result)
    );
  });
test('menu obstruction retains original exposure failure without excusing geometry', () => {
  const result = evaluate((p) =>
    p.reading.samples[3].point.fragment.hits[0].stack.unshift({
      relation: 'foreign',
      tag: 'DIV',
    })
  );
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.exposure, 'NOT_QUALIFIED_DURING_USER_OPENED_MENUS');
  assert.equal(result.readingAssessment.verdict, 'FAIL');
  assert(
    result.readingAssessment.issues.some((i) => i.code === 'text-obstructed')
  );
});
test('unknown covering layer outside actual menus fails', () => {
  const result = evaluate((p) =>
    p.reading.samples[10].point.fragment.hits[0].stack.unshift({
      relation: 'foreign',
      tag: 'DIV',
    })
  );
  assert(
    result.issues.some(
      (i) => i.code === 'unexpected-obstruction-outside-user-menu'
    )
  );
  assert.equal(result.verdict, 'FAIL');
});

test('stale expanded text after shrink cannot pass the terminal tail', () => {
  const result = evaluate((p) => {
    for (const f of p.observer.frames)
      if (f.time >= 1000) f.edited.text = p.plan.expanded + ' ';
  });
  assert.notEqual(result.verdict, 'PASS');
  assert(
    result.issues.some((i) => i.code === 'committed-ui-revision-reverted')
  );
});
test('original text cannot reappear after expanded commit', () => {
  const result = evaluate((p) => {
    p.observer.frames.find((f) => f.time === 600).edited.text = p.plan.original;
  });
  assert.notEqual(result.verdict, 'PASS');
  assert(
    result.issues.some((i) => i.code === 'committed-ui-revision-reverted')
  );
});
test('unrelated wheel cannot establish this list READ', () => {
  const result = evaluate((p) => {
    p.wheel[0].scope = '/another-channel';
    p.wheel[0].sameList = false;
  });
  assert.notEqual(result.verdict, 'PASS');
  assert(result.issues.some((i) => i.code === 'missing-actual-upward-read'));
});
test('nonfinite observed menu count rejects incomplete acquisition', () => {
  const result = evaluate((p) => {
    p.observer.frames[12].menuCount = NaN;
  });
  assert.notEqual(result.verdict, 'PASS');
});
test('a different destination ship cannot qualify the actual edit', () => {
  const result = evaluate((p) => {
    p.requests[0].actions[0].ship = 'ten';
    p.requests[0].body = JSON.stringify(p.requests[0].actions);
  });
  assert.notEqual(result.verdict, 'PASS');
});

test('204 headers plus exact durable content tolerate unknown response end without a latency claim', () => {
  const result = evaluate((p) =>
    p.requests.forEach((r) => {
      r.endTime = null;
    })
  );
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.responseEndLatency, 'INCOMPLETE');
});
for (const [name, change] of [
  [
    'missing header time',
    (p) => {
      p.requests[0].headersTime = null;
    },
  ],
  [
    'headers before request',
    (p) => {
      p.requests[0].headersTime = 300;
    },
  ],
  [
    'negative response end',
    (p) => {
      p.requests[0].endTime = -1;
    },
  ],
  [
    'unknown end without 204',
    (p) => {
      p.requests[0].endTime = null;
      p.requests[0].status = 200;
    },
  ],
  [
    'end before headers',
    (p) => {
      p.requests[0].endTime = 405;
    },
  ],
])
  test('rejects ' + name, () => {
    const result = evaluate(change);
    assert.notEqual(result.verdict, 'PASS');
    assert.ok(
      result.issues.some((i) => i.code === 'invalid-actual-edit-commit-link')
    );
  });

// BELOW is a separate exact registered contract; raw evidence cannot choose it.
test('below plan export matches the independently declared fixed corpus', () => {
  assert.deepEqual(
    centerEditApi.centerEditBelowPlan?.('a1234b56'),
    belowPlanFixture('a1234b56')
  );
});
test('full-suite importer binds BELOW to its exact existing-suite title', () => {
  const [record] = readPlaywrightReport(
    productReport(undefined, 'below'),
    'report.json'
  );
  assert.equal(record.scenario, 'web-center-edit-below-reading');
  assert.equal(assessWebEvidence(record).status, 'recorded-sampled-pass');
});
test('healthy below-center edits preserve the same exact reading character', () => {
  const { proof, attempt } = fixture('below');
  assert.equal(replayCenterEditEvidence(proof, attempt).verdict, 'PASS');
});
for (const [name, change] of [
  [
    'above title with below plan',
    (_, a) => {
      a.title = centerEditTitle;
    },
  ],
  [
    'unknown title',
    (_, a) => {
      a.title = 'unknown edit side';
    },
  ],
  [
    'wrong target index in plan',
    (p) => {
      p.plan.editedIndex = 17;
    },
  ],
  [
    'above spatial target under below title',
    (p) => {
      p.observer.frames[0].edited.top = 250;
    },
  ],
  [
    'below target clipped at baseline',
    (p) => {
      p.observer.frames[0].edited.top = 680;
    },
  ],
  [
    'displaced reading character',
    (p) => {
      moveCharacter(p, 12);
    },
  ],
  [
    'changed reader identity',
    (p) => {
      p.reading.samples[10].rowId = '1002';
    },
  ],
  [
    'changed reader text',
    (p) => {
      p.reading.samples[10].text = 'different reader';
    },
  ],
  [
    'weakened point tolerance',
    (p) => {
      p.readingContract.point.tolerancePx = 2;
    },
  ],
  [
    'weakened sample cadence',
    (p) => {
      p.readingContract.coverage.maxGapMs = 101;
    },
  ],
  [
    'missing terminal tail',
    (p) => {
      p.readingContract.coverage.endTime -= 1;
    },
  ],
])
  test(`below-center reader rejects ${name}`, () => {
    const { proof, attempt } = fixture('below');
    change(proof, attempt);
    assert.notEqual(replayCenterEditEvidence(proof, attempt).verdict, 'PASS');
  });
test('above proof cannot be recast as the below registered contract', () => {
  const { proof, attempt } = fixture();
  attempt.title = centerEditBelowTitle;
  assert.notEqual(replayCenterEditEvidence(proof, attempt).verdict, 'PASS');
});

test('active registry replaces the old row test with BELOW and remains43 cases', () => {
  assert.equal(webScenarioRegistry.length, 43);
  assert.equal(
    webScenarioRegistry.filter((r) => r.requireCenterEditProof).length,
    2
  );
  assert.equal(
    webScenarioRegistry.some((r) => r.scenario === 'web-edit-growth-shrink'),
    false
  );
});
test('historical first-row raw retains its original registration and anchor oracle', () => {
  const report = productReport(undefined, 'below');
  report.suites[0].specs[0].title =
    'editing a visible message to grow and shrink preserves history';
  const [record] = readPlaywrightReport(report, 'historical.json');
  assert.equal(record.scenario, 'web-edit-growth-shrink');
  assert.equal(record.contract.requireAnchors, true);
  assert.equal(record.contract.requireCenterEditProof, undefined);
});

test('below importer rejects forged contract that removes exact proof requirements', () => {
  const [record] = readPlaywrightReport(
    productReport(undefined, 'below'),
    'report.json'
  );
  record.contract = { ...record.contract, requireCenterEditProof: false };
  record.centerEditProofs = [];
  assert.equal(assessWebEvidence(record).status, 'incomplete');
});
