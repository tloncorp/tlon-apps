import { describe, expect, it } from 'vitest';
import {
  seededSessionPlan,
  assessSeededSession,
  assessSeededInput,
  validSeededPresence,
} from './scrollSeededSession';
import {
  seededEvidence,
  moveSeededReadingSample,
} from './scrollSeededSessionTestData';

const codes = (proof: any) =>
  assessSeededSession(proof).issues.map((i) => i.code);

// One declared multiline fill can deliver several native input events. Admit
// all of them only when both retained observers join the same bounded dispatch;
// event multiplicity is not a reason to omit a receipt or weaken its payload.
function multilineGrowEvidence() {
  const proof = seededEvidence();
  const entry = proof.ledger.find((e: any) => e.action.kind === 'grow');
  const input = proof.blocks[entry.action.block].input;
  const index = proof.deliveries.events.findIndex(
    (e: any) =>
      e.type === 'input' && e.time >= entry.start && e.time <= entry.end
  );
  const original = proof.deliveries.events[index];
  const globals = Array.from({ length: 11 }, (_, i) => ({
    ...original,
    time: original.time + i / 10,
    observedAt: original.time + i / 10 + 0.01,
  }));
  proof.deliveries.events.splice(index, 1, ...globals);
  const locals = globals.map((e, i) => ({
    ...input.actions[0],
    id: `native-${i}`,
    time: e.time,
    observedAt: e.time + 0.02,
  }));
  input.actions.splice(0, 1, ...locals);
  return { proof, entry, input, globals, locals };
}

describe('seeded grow uses the existing bounded native input binder', () => {
  it('joins all native multiline events to one declared grow without changing limits', () => {
    const { proof } = multilineGrowEvidence();
    expect(assessSeededSession(proof).issues).toEqual([]);
    expect(proof.plan.limits).toEqual(seededSessionPlan().limits);
  });
  it.each([
    'duplicate global',
    'missing global',
    'duplicate retained',
    'missing retained',
    'foreign scope',
    'wrong global payload',
    'wrong retained payload',
    'wrong target',
    'untrusted',
    'outside dispatch',
    'observed after dispatch',
  ])(
    'rejects %s instead of treating a native event count as authority',
    (fault) => {
      const { proof, input, globals, locals } = multilineGrowEvidence();
      const events = proof.deliveries.events;
      if (fault === 'duplicate global')
        events.splice(events.indexOf(globals[0]), 0, { ...globals[0] });
      else if (fault === 'missing global')
        events.splice(events.indexOf(globals[0]), 1);
      else if (fault === 'duplicate retained')
        input.actions.unshift({ ...locals[0] });
      else if (fault === 'missing retained') input.actions.shift();
      else if (fault === 'foreign scope') globals[0].scope = '/foreign';
      else if (fault === 'wrong global payload') globals[0].value = 'foreign';
      else if (fault === 'wrong retained payload')
        locals[0].payload = 'foreign';
      else if (fault === 'wrong target') globals[0].testId = 'ForeignInput';
      else if (fault === 'untrusted') globals[0].trusted = false;
      else if (fault === 'outside dispatch') {
        globals.at(-1)!.time = input.dispatches[0].end + 1;
        globals.at(-1)!.observedAt = globals.at(-1)!.time;
      } else globals[0].observedAt = input.dispatches[0].end + 1;
      const result = assessSeededSession(proof);
      expect(result.behaviorVerdict).not.toBe('PASS');
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: 'input-delivery-cardinality' })
      );
    }
  );
});

// Acceptance: an own-send's provisional ID comes only from its original wire
// timestamp, never from a sampled row. The sole trusted Send bounds admission;
// canonical presentation retires the alias. Both incarnations cannot coexist.
// Missing ownership stays incomplete; wrong bodies/IDs with proven ownership
// remain failures. All existing acquisition and terminal budgets still apply.
function pendingOwnSendEvidence() {
  const proof = seededEvidence();
  const entry = proof.ledger.find((e: any) => e.action.kind === 'own-send');
  const essay = entry.request.actions[0].json.channel.action.post.add;
  const sent = proof.session.timeOrigin + entry.start + 25;
  essay.sent = sent;
  entry.request.startTime = entry.start + 40;
  for (const receipt of [entry.backend, proof.finalBackend])
    receipt.body.posts[entry.postId].essay.sent = sent;
  // Independently spell the integer timestamp conversion for modeled data.
  // The supplemental unchanged R2 replay supplies four real wire timestamps.
  const provisionalId = (
    170141184475152167957503069145530368000n +
    (BigInt(sent) * 18446744073709551616n) / 1000n
  )
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const pending: any[] = [],
    canonical: any[] = [];
  for (const sample of proof.trace.samples)
    for (const list of sample.lists)
      for (const row of list.rows)
        if (row.id === entry.postId) {
          if (sample.time < entry.start + 160) {
            row.id = provisionalId;
            pending.push({ sample, list, row });
          } else canonical.push({ sample, list, row });
        }
  return { proof, entry, essay, provisionalId, pending, canonical };
}

describe('wire-owned provisional own-send identity', () => {
  it('accepts the real-shaped pending to canonical transition without promoting presentation', () => {
    const { proof } = pendingOwnSendEvidence();
    expect(assessSeededSession(proof)).toMatchObject({
      verdict: 'INCOMPLETE',
      behaviorVerdict: 'PASS',
      issues: [],
    });
  });
  it.each(['missing timestamp', 'timestamp/backend disagreement'])(
    'keeps %s incomplete without authorizing a sampled ID',
    (fault) => {
      const { proof, essay } = pendingOwnSendEvidence();
      if (fault === 'missing timestamp') delete essay.sent;
      else essay.sent++;
      const result = assessSeededSession(proof);
      expect(result.behaviorVerdict).toBe('INCOMPLETE');
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: 'own-send-provisional-unproven',
          kind: 'incomplete',
        })
      );
    }
  );
  it.each(['author', 'channel'])(
    'does not admit a foreign %s receipt',
    (fault) => {
      const { proof, essay, entry } = pendingOwnSendEvidence();
      if (fault === 'author') essay.author = '~ten';
      else entry.request.actions[0].json.channel.nest = 'chat/~ten/foreign';
      expect(assessSeededSession(proof).behaviorVerdict).not.toBe('PASS');
      expect(codes(proof)).toContain('original-send-wire-binding');
    }
  );
  it.each([
    'wrong text',
    'wrong same-text ID',
    'coherent timestamp tamper',
    'coexisting incarnations',
    'reappearing provisional',
    'provisional before Send',
    'provisional after action',
    'other corpus corruption',
  ])('preserves a qualified failure for %s', (fault) => {
    const { proof, entry, essay, provisionalId, pending, canonical } =
      pendingOwnSendEvidence();
    if (fault === 'wrong text') pending[0].row.body.text = 'foreign body';
    else if (fault === 'wrong same-text ID') pending[0].row.id = '999.123';
    else if (fault === 'coherent timestamp tamper') {
      essay.sent++;
      entry.backend.body.posts[entry.postId].essay.sent++;
    } else if (fault === 'coexisting incarnations') {
      pending[0].list.rows.push({
        ...structuredClone(pending[0].row),
        id: entry.postId,
      });
    } else if (fault === 'reappearing provisional')
      canonical[1].row.id = provisionalId;
    else if (fault === 'provisional before Send') {
      const before = proof.trace.samples.findLast(
        (s: any) => s.time < entry.start
      );
      before.lists[0].rows.push(structuredClone(pending[0].row));
    } else if (fault === 'provisional after action') {
      canonical.find((s) => s.sample.time > entry.end)!.row.id = provisionalId;
    } else {
      proof.trace.samples.find(
        (s: any) => s.time > proof.pendingEnd
      ).lists[0].rows[0].body.text = 'corrupt';
    }
    const result = assessSeededSession(proof);
    expect(result.behaviorVerdict).toBe('FAIL');
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'visible-message-identity-or-text',
        kind: 'failure',
      })
    );
  });
});

describe('one seeded persistent-session declaration and independent raw composition', () => {
  it('declares 50 unique actions with four input and four thinking blocks', () => {
    const plan = seededSessionPlan();
    expect(plan.actions).toHaveLength(50);
    expect(new Set(plan.actions.map((a) => a.id)).size).toBe(50);
    expect(plan.blocks.filter((b) => b.kind === 'input')).toHaveLength(4);
    expect(plan.blocks.filter((b) => b.kind === 'thinking')).toHaveLength(4);
    expect(plan.actions.slice(0, 2).map((a) => a.kind)).toEqual([
      'open-thread',
      'back',
    ]);
    expect(plan).toEqual(seededSessionPlan());
    expect(plan.actions).not.toEqual(seededSessionPlan(77).actions);
  });
  it.each([0, -1, 1.5, 0x100000000])('rejects invalid seed %s', (seed) =>
    expect(() => seededSessionPlan(seed)).toThrow()
  );
  it.each([0, 2, 13, 15, 49])('rejects invalid action count %s', (count) =>
    expect(() => seededSessionPlan(1, count)).toThrow()
  );
  it('allows a longer deterministic plan without raising deadlines or sample capacity', () => {
    expect(seededSessionPlan(1, 98).actions).toHaveLength(98);
    expect(seededSessionPlan(1, 98).limits).toEqual(seededSessionPlan().limits);
  });
  it.each([14, 50])(
    'accepts the complete modeled %s-action behavior while retaining presentation and soak omissions',
    (count) => {
      const result = assessSeededSession(seededEvidence(20260908, count));
      expect(result.issues).toEqual([]);
      expect(result).toMatchObject({
        verdict: 'INCOMPLETE',
        behaviorVerdict: 'PASS',
        presentation: 'INCOMPLETE',
        caret: 'INCOMPLETE',
        durableReads: 'INCOMPLETE',
        soak: 'NOT_RUN',
      });
    }
  );
  const faults: [string, (p: any) => void, string][] = [
    ['missing suffix', (p) => p.ledger.pop(), 'missing-or-extra-action-suffix'],
    [
      'extra action',
      (p) => p.ledger.push({ ...p.ledger.at(-1) }),
      'missing-or-extra-action-suffix',
    ],
    [
      'reordered action',
      (p) => ([p.ledger[3], p.ledger[4]] = [p.ledger[4], p.ledger[3]]),
      'action-order-owner-or-error',
    ],
    [
      'changed expanded seed',
      (p) => (p.plan.actions[3].payload = 'different'),
      'noncanonical-seed-plan',
    ],
    [
      'context replacement',
      (p) => p.sessionAfter.timeOrigin++,
      'session-owner-retired',
    ],
    [
      'action owner replacement',
      (p) => p.ledger[4].timeOrigin++,
      'action-order-owner-or-error',
    ],
    [
      'initial corpus changed',
      (p) => (p.initialRows['200.002'] = 'forged'),
      'initial-corpus-binding',
    ],
    [
      'send ID changed',
      (p) => (p.ledger.find((e: any) => e.postId).postId = '999.999'),
      'send-durable-row',
    ],
    [
      'wrong real wire request',
      (p) =>
        (p.ledger.find(
          (e: any) => e.postId
        ).request.actions[0].json.channel.nest = 'chat/~zod/other'),
      'original-send-wire-binding',
    ],
    [
      'GET overlaps send acknowledgement',
      (p) => {
        const e = p.ledger.find((e: any) => e.postId);
        e.backend.startTime = e.request.headersTime - 1;
      },
      'send-receipt',
    ],
    [
      'missing final committed member',
      (p) => delete p.finalBackend.body.posts['200.002'],
      'final-durable-membership',
    ],
    [
      'new unplanned final member',
      (p) =>
        (p.finalBackend.body.posts['999.999'] = {
          seal: { id: '999999' },
          essay: { author: '~ten', content: [{ inline: ['extra'] }] },
        }),
      'final-durable-membership',
    ],
    [
      'late response scope changed',
      (p) => (p.pending.local.route = '/other'),
      'pending:pending-preparation-unproven',
    ],
    [
      'gap',
      (p) => p.trace.samples.splice(140, 6),
      'global-sample-gap-or-invalid',
    ],
    [
      'too costly acquisition',
      (p) => (p.trace.samples[140].durationMs = 32.01),
      'global-sample-gap-or-invalid',
    ],
    [
      'truncated tail',
      (p) => (p.trace.end = p.ledger.at(-1).end + 999),
      'global-capture-coverage',
    ],
    [
      'uncovered reading handoff',
      (p) => (p.blocks[0].readingContract.coverage.startTime = p.ledger[3].end),
      'reading-handoff',
    ],
    [
      'extra actual wheel',
      (p) =>
        p.deliveries.events.push({
          ...p.wheels[0],
          time: p.ledger[3].start + 1,
          observedAt: p.ledger[3].start + 1,
        }),
      'unplanned-primitive-delivery',
    ],
    ['missing actual wheel', (p) => (p.wheels = []), 'wheel-not-delivered'],
    [
      'untrusted Latest',
      (p) =>
        (p.trace.events.find((e: any) =>
          e.testIds.includes('ScrollToBottomButton')
        ).trusted = false),
      'latest-not-delivered',
    ],
    [
      'blank transient',
      (p) => (p.trace.samples[140].lists = []),
      'blank-or-unattributed-content',
    ],
  ];
  it.each(faults)(
    'rejects %s without accepting a producer PASS',
    (_, mutate, expected) => {
      const proof = seededEvidence();
      proof.verdict = 'PASS';
      mutate(proof);
      expect(codes(proof)).toContain(expected);
      expect(assessSeededSession(proof).behaviorVerdict).not.toBe('PASS');
    }
  );
  it('preserves a transient point failure even with a missing suffix and recovered final position', () => {
    const p = seededEvidence();
    moveSeededReadingSample(p.blocks[0].reading.samples[20], 12);
    p.ledger.pop();
    expect(assessSeededSession(p)).toMatchObject({
      verdict: 'FAIL',
      behaviorVerdict: 'FAIL',
    });
    expect(codes(p)).toContain('reading-0:reading-point-moved');
  });
  it('rejects a temporary end gap even when the final end is exact', () => {
    const p = seededEvidence();
    const e = p.ledger.find((e: any) => e.action.kind === 'latest');
    p.trace.samples.find(
      (s: any) => s.time > e.start + 100
    ).lists[0].bottomGap = 12;
    expect(codes(p)).toContain('follow-gap');
    expect(assessSeededSession(p).verdict).toBe('FAIL');
  });
  it('rejects a retained-row sample with the inner point absent', () => {
    const p = seededEvidence();
    p.blocks[0].reading.samples[20].point = null;
    expect(assessSeededSession(p).behaviorVerdict).not.toBe('PASS');
  });
  it.each(['draft', 'selection', 'focused'])(
    'rejects transient exact-input %s corruption',
    (field) => {
      const p = seededEvidence(),
        b = p.blocks.find((b: any) => b.input),
        s = b.input.samples.find(
          (s: any) =>
            s.draft.length > 0 && s.time > b.input.actions[0].time + 200
        );
      if (field === 'draft') s.draft += 'x';
      else if (field === 'selection') s.selection = { start: 1, end: 1 };
      else s.focused = false;
      const result = assessSeededInput(
        b.input,
        p.ledger.find(
          (e: any) => e.action.block === b.index && e.action.kind === 'grow'
        ).action.payload,
        b.inputEnd
      );
      expect(result.issues.some((i) => i.kind === 'failure')).toBe(true);
    }
  );
  it('rejects unsolicited selected input outside the declared selection dispatch', () => {
    const p = seededEvidence(),
      b = p.blocks.find((b: any) => b.input);
    b.input.actions.push({
      ...b.input.actions[1],
      time: b.input.actions[2].time + 100,
      observedAt: b.input.actions[2].time + 100,
    });
    expect(assessSeededSession(p).verdict).toBe('FAIL');
  });
  it('rejects early disappearance and later resurrection of computing state', () => {
    const p = seededEvidence(),
      b = p.blocks.find((b: any) => b.semantic),
      show = p.ledger.find(
        (e: any) =>
          e.action.block === b.index && e.action.kind === 'presence-show'
      );
    const s = b.semantic.chrome.samples.find(
      (s: any) => s.time >= show.presenceCompleted + 250
    );
    s.controls = [];
    expect(codes(p)).toContain('thinking-early-disappearance');
    const end = b.semantic.chrome.samples.at(-2);
    end.controls = [{ kind: 'Thinking...', visible: true, opacity: 1 }];
    expect(codes(p)).toContain('thinking-resurrection');
  });
  it('requires original presence key/author/observer state', () => {
    const p = seededEvidence(),
      show = p.ledger.find((e: any) => e.action.kind === 'presence-show');
    expect(validSeededPresence(show.presence, p.session.channel, true)).toBe(
      true
    );
    show.presence.request.body[0].json.set.key.ship = '~zod';
    expect(validSeededPresence(show.presence, p.session.channel, true)).toBe(
      false
    );
  });
  it('does not hide a measured caret failure behind the ordinary unmeasured-caret omission', () => {
    const p = seededEvidence(),
      b = p.blocks.find((b: any) => b.input);
    const sample = b.input.samples.find(
      (s: any) => s.time > b.input.actions[0].time + 200 && s.draft.length > 0
    );
    sample.caretVisible = false;
    expect(assessSeededSession(p).verdict).toBe('FAIL');
  });
  it('rejects an undeclared key even if no text changed', () => {
    const p = seededEvidence(),
      e = p.ledger.find((e: any) => e.action.kind === 'latest');
    p.deliveries.events.push({
      type: 'keydown',
      key: 'Shift',
      time: e.start + 5,
      observedAt: e.start + 5,
      trusted: true,
      timeOrigin: p.session.timeOrigin,
      scope: p.session.scope,
    });
    expect(codes(p)).toContain('unplanned-key-delivery');
  });

  it('rejects a replaced TEN sender even when the observer owner is unchanged', () => {
    const p = seededEvidence();
    p.senderAfter.timeOrigin++;
    expect(codes(p)).toContain('sender-session-owner');
  });
  it('accepts a clipped outer row whose author is visible while its exact body is below the viewport', () => {
    const p = seededEvidence(),
      list = p.trace.samples[140].lists[0];
    list.rows.push({
      id: '200.002',
      top: 490,
      bottom: 620,
      exposed: true,
      body: {
        count: 1,
        text: p.initialRows['200.002'],
        exposed: false,
        pointTop: 540,
      },
    });
    expect(assessSeededSession(p).behaviorVerdict).toBe('PASS');
  });
  it('still fails a hidden body when the entire outer row is visible', () => {
    const p = seededEvidence(),
      list = p.trace.samples[140].lists[0];
    list.rows.push({
      id: '200.002',
      top: 350,
      bottom: 480,
      exposed: true,
      body: {
        count: 1,
        text: p.initialRows['200.002'],
        exposed: false,
        pointTop: 400,
      },
    });
    expect(codes(p)).toContain('visible-message-identity-or-text');
    expect(assessSeededSession(p).verdict).toBe('FAIL');
  });
});

describe('R2 review: acquisition, declared subject and readback authority', () => {
  const incompleteOnly = (p: any) => {
    const result = assessSeededSession(p);
    expect(result.issues.filter((i) => i.kind === 'failure')).toEqual([]);
    expect(result.behaviorVerdict).toBe('INCOMPLETE');
  };
  it.each(['blank', 'scope', 'text', 'follow'])(
    'does not qualify %s on an unavailable global sample',
    (fault) => {
      const p = seededEvidence();
      const latest = p.ledger.find((e: any) => e.action.kind === 'latest');
      const sample = p.trace.samples.find(
        (s: any) => s.time > latest.start + 100
      );
      sample.durationMs = 32.01;
      if (fault === 'blank') sample.lists = [];
      if (fault === 'scope') sample.route = '/other';
      if (fault === 'text') sample.lists[0].rows[0].body.text = 'unavailable';
      if (fault === 'follow') sample.lists[0].bottomGap = 12;
      incompleteOnly(p);
    }
  );
  it('missing landing/endpoint after acquisition loss is incomplete, not a measured bad landing', () => {
    const p = seededEvidence();
    const latest = p.ledger.find((e: any) => e.action.kind === 'latest');
    for (const s of p.trace.samples.filter(
      (s: any) => s.time >= latest.start
    )) {
      s.durationMs = 40;
      s.lists[0].bottomGap = 12;
      s.lists[0].rows = [];
    }
    incompleteOnly(p);
  });
  it('preserves a qualified earlier global failure before a later cadence gap', () => {
    const p = seededEvidence();
    p.trace.samples[140].lists = [];
    p.trace.samples.splice(150, 6);
    expect(assessSeededSession(p).verdict).toBe('FAIL');
    expect(codes(p)).toContain('blank-or-unattributed-content');
  });
  it('does not qualify a point from inconsistent coordinates', () => {
    const p = seededEvidence();
    p.blocks[0].reading.samples[20].point.relativeY += 2;
    incompleteOnly(p);
    expect(codes(p)).toContain('reading-0:invalid-reading-point-coordinates');
  });
  it('preserves an authoritative earlier reading failure before a later acquisition gap', () => {
    const p = seededEvidence();
    moveSeededReadingSample(p.blocks[0].reading.samples[20]);
    p.blocks[0].reading.samples.splice(30, 6);
    expect(codes(p)).toContain('reading-0:reading-point-moved');
    expect(assessSeededSession(p).verdict).toBe('FAIL');
  });
  it.each(['boundary', 'capture', 'measurement', 'point-layout'])(
    'does not qualify READ with unavailable %s authority',
    (fault) => {
      const p = seededEvidence(),
        b = p.blocks[0];
      moveSeededReadingSample(b.reading.samples[20]);
      if (fault === 'boundary') b.readingContract.scope = '/forged';
      if (fault === 'capture') b.reading.blockSelector = '.other';
      if (fault === 'measurement')
        b.reading.samples[20].measurement.durationMs = 40;
      if (fault === 'point-layout')
        b.reading.samples[20].nodes[0].fragments = [];
      incompleteOnly(p);
    }
  );
  const rebind = (block: any, id: string, text: string) => {
    block.readingContract.rowId = id;
    block.readingContract.revision.text = text;
    for (const s of block.reading.samples) {
      s.rowId = id;
      s.text = text;
      s.nodes[0].text = text;
      s.nodes[0].end = text.length;
      s.point.text = text.slice(s.point.start, s.point.end);
    }
  };
  it.each(['unknown ID', 'forged text', 'future send'])(
    'rejects self-consistent READ from %s outside pre-wheel corpus',
    (fault) => {
      const p = seededEvidence(),
        b = p.blocks[0];
      const e = p.ledger.find((e: any) => e.postId);
      rebind(
        b,
        fault === 'unknown ID'
          ? '999.999'
          : fault === 'future send'
            ? e.postId
            : b.readingContract.rowId,
        fault === 'future send'
          ? e.wireText
          : fault === 'forged text'
            ? 'A forged stays here.'
            : b.readingContract.revision.text
      );
      incompleteOnly(p);
      expect(codes(p)).toContain('reading-corpus-binding');
    }
  );
  it('accepts a prior completed receipt-bound send as the next reading subject', () => {
    const p = seededEvidence();
    const e = p.ledger.find((e: any) => e.postId && e.action.block === 0);
    rebind(p.blocks[1], e.postId, e.wireText);
    expect(assessSeededSession(p).issues).toEqual([]);
  });
  it('does not let an unavailable prior send receipt authorize the next reading subject', () => {
    const p = seededEvidence();
    const e = p.ledger.find((e: any) => e.postId && e.action.block === 0);
    rebind(p.blocks[1], e.postId, e.wireText);
    delete e.backend.startTime;
    incompleteOnly(p);
    expect(codes(p)).toContain('reading-corpus-binding');
  });
  it.each(['start', 'end', 'reversed', 'url'])(
    'rejects unavailable per-send GET %s provenance',
    (fault) => {
      const p = seededEvidence(),
        e = p.ledger.find((e: any) => e.postId);
      if (fault === 'start') delete e.backend.startTime;
      if (fault === 'end') delete e.backend.endTime;
      if (fault === 'reversed') e.backend.endTime = e.backend.startTime - 1;
      if (fault === 'url') e.backend.url = 'http://localhost:3000/other';
      incompleteOnly(p);
      expect(codes(p)).toContain('send-receipt');
    }
  );
  it.each(['start', 'end', 'reversed', 'url'])(
    'rejects unavailable final GET %s provenance',
    (fault) => {
      const p = seededEvidence();
      if (fault === 'start') delete p.finalBackend.startTime;
      if (fault === 'end') delete p.finalBackend.endTime;
      if (fault === 'reversed')
        p.finalBackend.endTime = p.finalBackend.startTime - 1;
      if (fault === 'url') p.finalBackend.url = 'http://localhost:3000/other';
      incompleteOnly(p);
    }
  );
  it.each(['body', 'init', 'null', 'array'])(
    'does not infer cleared presence from unavailable %s',
    (fault) => {
      const p = seededEvidence(),
        e = p.ledger.find((e: any) => e.action.kind === 'presence-clear');
      if (fault === 'body') delete e.presence.observer.body;
      if (fault === 'init') delete e.presence.observer.body.init;
      if (fault === 'null') e.presence.observer.body.init = null;
      if (fault === 'array') e.presence.observer.body.init = [];
      incompleteOnly(p);
      expect(codes(p)).toContain('presence-receipt');
    }
  );
});

it('does not qualify an early thinking disappearance from an unavailable semantic sample', () => {
  const p = seededEvidence(),
    b = p.blocks.find((b: any) => b.semantic);
  const show = p.ledger.find(
    (e: any) => e.action.block === b.index && e.action.kind === 'presence-show'
  );
  const sample = b.semantic.chrome.samples.find(
    (s: any) => s.time > show.presenceCompleted + 250
  );
  sample.measurement.durationMs = 40;
  sample.controls = [];
  const result = assessSeededSession(p);
  expect(result.issues.filter((i) => i.kind === 'failure')).toEqual([]);
  expect(result.behaviorVerdict).toBe('INCOMPLETE');
});

it('does not qualify a late/rebased READ baseline admitted after the first mutation', () => {
  const p = seededEvidence(),
    b = p.blocks[0];
  const mutation = p.ledger.find(
    (e: any) => e.action.block === 0 && e.action.kind !== 'wheel'
  );
  b.reading.samples = b.reading.samples.filter(
    (s: any) => s.time > mutation.start + 100
  );
  b.readingContract.coverage.startTime = b.reading.samples[0].time;
  moveSeededReadingSample(b.reading.samples[10]);
  const result = assessSeededSession(p);
  expect(result.issues).toContainEqual({
    code: 'reading-handoff',
    kind: 'incomplete',
  });
  expect(result.issues.filter((i) => i.kind === 'failure')).toEqual([]);
  expect(result.behaviorVerdict).toBe('INCOMPLETE');
});

it('does not turn an unavailable send readback body into a qualified missing-message failure', () => {
  const p = seededEvidence(),
    e = p.ledger.find((e: any) => e.postId);
  delete e.backend.body;
  const result = assessSeededSession(p);
  expect(result.issues).toContainEqual({
    code: 'send-receipt',
    kind: 'incomplete',
    action: e.action.id,
  });
  expect(result.issues.filter((i) => i.kind === 'failure')).toEqual([]);
});
