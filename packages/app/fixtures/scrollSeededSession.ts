import { assessPendingNavigationTrace } from './scrollNavigationTrace';
import { assessScrollReadingTrace } from './scrollReadingTrace';
import {
  assessScrollInputTrace,
  bindScrollInputDeliveries,
} from './scrollInputTrace';

export const seededSessionTitle =
  'seeded actions retain one real conversation across input, receive, thinking and thread loading';
export const seededSessionDefaults = { seed: 20260908, actionCount: 50 };
export type SeededActionKind =
  | 'open-thread'
  | 'back'
  | 'wheel'
  | 'grow'
  | 'remote-send'
  | 'select-all'
  | 'delete'
  | 'latest'
  | 'presence-show'
  | 'presence-clear'
  | 'own-send';
export type SeededAction = {
  id: string;
  kind: SeededActionKind;
  block: number;
  payload?: string;
  wheelY?: number;
};
export function seededSessionPlan(
  seed = seededSessionDefaults.seed,
  actionCount = seededSessionDefaults.actionCount
) {
  if (
    !Number.isInteger(seed) ||
    seed < 1 ||
    seed > 0xffffffff ||
    !Number.isInteger(actionCount) ||
    actionCount < 14 ||
    (actionCount - 2) % 6 !== 0
  )
    throw Error(
      'Require a nonzero uint32 seed and actionCount = 2 + 6*n, n >= 2'
    );
  let state = seed >>> 0;
  const draw = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  const count = (actionCount - 2) / 6;
  const blocks = Array.from({ length: count }, (_, index) => ({
    kind: index % 2 === 0 ? 'input' : 'thinking',
    clearFirst: Boolean(draw() & 1),
  }));
  for (let i = blocks.length - 1; i > 0; i--) {
    const j = draw() % (i + 1);
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  }
  const actions: SeededAction[] = [
    { id: 'action-1', kind: 'open-thread', block: -1 },
    { id: 'action-2', kind: 'back', block: -1 },
  ];
  const append = (
    kind: SeededActionKind,
    block: number,
    extra: Partial<SeededAction> = {}
  ) =>
    actions.push({ id: `action-${actions.length + 1}`, kind, block, ...extra });
  blocks.forEach((block, i) => {
    append('wheel', i, { wheelY: -320 - (draw() % 4) * 80 });
    const text = `Seed ${seed} block ${i} real remote message`;
    if (block.kind === 'input') {
      append('grow', i, {
        payload: `Seed ${seed} block ${i} growing draft\nsecond line\nthird line\nfourth line\nfifth line\nsixth line`,
      });
      append('remote-send', i, { payload: text });
      append('select-all', i, { payload: 'ControlOrMeta+A' });
      append('delete', i, { payload: '' });
      append('latest', i);
    } else {
      append('presence-show', i);
      if (block.clearFirst) {
        append('presence-clear', i);
        append('remote-send', i, { payload: text });
      } else {
        append('remote-send', i, { payload: text });
        append('presence-clear', i);
      }
      append('latest', i);
      append('own-send', i, {
        payload: `Seed ${seed} block ${i} real own message`,
      });
    }
  });
  return {
    version: 1,
    generator: 'xorshift32-fisher-yates-v1',
    seed,
    actionCount,
    actions,
    blocks,
    limits: {
      maxGapMs: 100,
      maxMeasurementMs: 32,
      tolerancePx: 1,
      quietTailMs: 1000,
      sequenceDeadlineMs: 120000,
      sampleCapacity: 10000,
    },
  };
}

export function assessSeededInput(raw: any, grown: string, end: number) {
  const scopeKey = raw.originalScope;
  const expected = [
    { id: 'input-1', kind: 'input', payload: grown },
    { id: 'select-all-1', kind: 'select-all', payload: 'ControlOrMeta+A' },
    { id: 'input-2', kind: 'input', payload: '' },
  ].map((a) => ({ ...a, scopeKey, inputId: 'MessageInput' }));
  const binding = bindScrollInputDeliveries({
    declaredAt: raw.declaredAt,
    expected: expected as any,
    dispatches: raw.dispatches,
    events: raw.actions,
    keyboard: raw.keyboard,
  });
  if (binding.issues.length)
    return {
      issues: binding.issues,
      semanticVerdict: 'INCOMPLETE',
      maxAcknowledgementMs: null,
      p95AcknowledgementMs: null,
    };
  const state = (draft: string, selected = false) => ({
    scopeKey,
    inputId: 'MessageInput',
    draft,
    selection: { start: selected ? 0 : draft.length, end: draft.length },
    focused: true,
    composing: false,
    caretVisible: true,
    sendVisible: true,
    sendHitTestable: draft.length > 0,
  });
  const [grow, select, clear] = binding.actions;
  const phases = [
    {
      id: 'before',
      start: raw.samples[0].time,
      end: grow.time,
      expected: state(''),
    },
    {
      id: 'grown',
      start: grow.time,
      end: select.time,
      triggerActionId: grow.id,
      expected: state(grown),
    },
    {
      id: 'selected',
      start: select.time,
      end: clear.time,
      triggerActionId: select.id,
      expected: state(grown, true),
    },
    {
      id: 'cleared',
      start: clear.time,
      end,
      triggerActionId: clear.id,
      expected: state(''),
    },
  ];
  const result = assessScrollInputTrace({
    contract: {
      version: 2,
      declaredAt: raw.declaredAt,
      start: raw.samples[0].time,
      end,
      deferredThrough: end - 1000,
      actions: expected as any,
      phases,
    },
    samples: raw.samples,
    actions: binding.actions,
  });
  if (
    select.time - grow.time < 350 ||
    clear.time - select.time < 150 ||
    end - clear.time < 1300
  ) {
    result.issues.push({
      code: 'seed-input-hold-shortened',
      kind: 'incomplete',
    });
    result.semanticVerdict = 'INCOMPLETE';
  }
  return result;
}

/** This fixed-purpose composition never accepts an attached producer verdict. */
export function assessSeededSession(proof: any) {
  const issues: {
    code: string;
    kind: 'failure' | 'incomplete';
    action?: string;
  }[] = [];
  const add = (
    code: string,
    kind: 'failure' | 'incomplete' = 'incomplete',
    action?: string
  ) => issues.push({ code, kind, ...(action ? { action } : {}) });
  const merge = (prefix: string, result: any) => {
    for (const issue of result.issues ?? [])
      if (issue.code !== 'input-caret-unmeasured')
        add(`${prefix}:${issue.code}`, issue.kind, issue.action);
  };
  const finish = () => ({
    verdict: issues.some((i) => i.kind === 'failure') ? 'FAIL' : 'INCOMPLETE',
    behaviorVerdict: issues.some((i) => i.kind === 'failure')
      ? 'FAIL'
      : issues.length
        ? 'INCOMPLETE'
        : 'PASS',
    evidence: 'seeded-actual-session-sampled-dom',
    issues,
    presentation: 'INCOMPLETE',
    caret: 'INCOMPLETE',
    durableReads: 'INCOMPLETE',
    soak: 'NOT_RUN',
  });
  try {
    const plan = seededSessionPlan(proof.plan.seed, proof.plan.actionCount);
    if (JSON.stringify(proof.plan) !== JSON.stringify(plan)) {
      add('noncanonical-seed-plan');
      return finish();
    }
    const { session, trace, ledger } = proof;
    if (
      !session ||
      !Number.isFinite(session.timeOrigin) ||
      !session.token ||
      session.origin !== 'http://localhost:3000' ||
      session.ship !== 'zod' ||
      session.normalFlags !== true ||
      typeof session.headed !== 'boolean' ||
      session.viewport?.width !== 1280 ||
      session.viewport?.height !== 800 ||
      session.scope !== proof.pendingPlan.scopes.channel.route
    )
      add('session-preparation');
    if (!Array.isArray(ledger)) {
      add('missing-action-ledger');
      return finish();
    }
    if (ledger.length !== plan.actions.length)
      add('missing-or-extra-action-suffix');
    if (proof.errors?.length) add('producer-stopped-with-error');
    if (
      session.sender?.origin !== 'http://localhost:3002' ||
      session.sender?.ship !== 'ten' ||
      session.sender?.scope !== session.scope ||
      session.sender?.normalFlags !== true ||
      !Number.isFinite(session.sender?.timeOrigin) ||
      JSON.stringify(session.sender) !== JSON.stringify(proof.senderAfter)
    )
      add('sender-session-owner');
    if (
      proof.sessionAfter?.timeOrigin !== session.timeOrigin ||
      proof.sessionAfter?.scope !== session.scope ||
      proof.sessionAfter?.origin !== session.origin ||
      JSON.stringify(proof.sessionAfter?.viewport) !==
        JSON.stringify(session.viewport)
    )
      add('session-owner-retired');
    for (const [index, entry] of ledger.entries()) {
      const expected = plan.actions[index];
      if (
        JSON.stringify(entry.action) !== JSON.stringify(expected) ||
        entry.sessionToken !== session.token ||
        entry.timeOrigin !== session.timeOrigin ||
        !Number.isFinite(entry.start) ||
        !Number.isFinite(entry.end) ||
        entry.end < entry.start ||
        (index && entry.start < ledger[index - 1].end) ||
        entry.error
      )
        add('action-order-owner-or-error', 'incomplete', expected?.id);
      if (index >= 2 && entry.scope !== session.scope)
        add('action-wrong-scope', 'failure', expected?.id);
    }
    if (
      !trace ||
      trace.errors?.length ||
      !Array.isArray(trace.samples) ||
      trace.samples.length < 6 ||
      trace.samples.length >= plan.limits.sampleCapacity ||
      trace.end - trace.start > plan.limits.sequenceDeadlineMs ||
      trace.start > ledger[0]?.start - 200 ||
      trace.end < ledger.at(-1)?.end + 1000 ||
      trace.samples[0]?.time - trace.start > 100 ||
      trace.end - trace.samples.at(-1)?.time > 100
    )
      add('global-capture-coverage');
    const qualifiedSamples: any[] = [];
    let acquiredPrefix = true;
    for (const [i, sample] of trace.samples.entries()) {
      if (
        !Number.isFinite(sample.time) ||
        !Number.isFinite(sample.durationMs) ||
        sample.durationMs < 0 ||
        sample.durationMs > 32 ||
        typeof sample.route !== 'string' ||
        !Array.isArray(sample.lists) ||
        sample.lists.some(
          (l: any) =>
            !Array.isArray(l.rows) ||
            !Number.isFinite(l.bottomGap) ||
            !Number.isFinite(l.height)
        ) ||
        sample.documentVisible !== true ||
        (i &&
          (sample.time <= trace.samples[i - 1].time ||
            sample.time - trace.samples[i - 1].time > 100))
      ) {
        add('global-sample-gap-or-invalid');
        acquiredPrefix = false;
      }
      if (!acquiredPrefix) continue;
      qualifiedSamples.push(sample);
      if (sample.time > proof.pendingEnd && sample.route !== session.scope)
        add('late-scope-change', 'failure');
      if (
        sample.time > proof.pendingEnd &&
        (!sample.lists.some((l: any) => l.exposed && l.kind === 'channel') ||
          sample.unattributedBodies)
      )
        add('blank-or-unattributed-content', 'failure');
    }
    if (
      proof.pendingEnd !== proof.pending.requests?.[0]?.completedTime + 1200 ||
      (ledger[2] && proof.pendingEnd >= ledger[2].start)
    )
      add('pending-boundary');
    const pendingTrace = {
      ...trace,
      end: proof.pendingEnd,
      samples: trace.samples.filter((s: any) => s.time <= proof.pendingEnd),
      commands: trace.commands,
      events: trace.events.filter((e: any) => e.time <= proof.pendingEnd),
    };
    merge(
      'pending',
      assessPendingNavigationTrace(
        pendingTrace,
        proof.pendingPlan,
        proof.pending
      )
    );
    let initial: Record<string, string> = {};
    try {
      initial = seedBackendRows(proof.initialBackend, session.channel);
    } catch {
      /* unavailable corpus cannot authorize READ */
    }
    const initialBound = !(
      Object.keys(initial).length !== 24 ||
      Object.keys(initial).length !== Object.keys(proof.initialRows).length ||
      Object.entries(initial).some(
        ([id, text]) => proof.initialRows[id] !== text
      ) ||
      Object.keys(proof.pendingPlan.scopes.channel.rows).length !==
        Object.keys(proof.initialRows).length ||
      Object.entries(proof.pendingPlan.scopes.channel.rows).some(
        ([id, text]) => proof.initialRows[id] !== text
      )
    );
    if (!initialBound) add('initial-corpus-binding');
    const sent = ledger.filter((e: any) =>
      ['remote-send', 'own-send'].includes(e.action.kind)
    );
    const sendProblems = new Map<any, string[]>(
      sent.map((entry: any) => [entry, seededSendProblems(entry, session)])
    );
    if (proof.blocks?.length !== plan.blocks.length)
      add('missing-block-evidence');
    for (const [index, block] of (proof.blocks ?? []).entries()) {
      try {
        const actions = ledger.filter((e: any) => e.action.block === index);
        const latest = actions.find((e: any) => e.action.kind === 'latest');
        const wheel = actions[0];
        if (!wheel || !latest || !block.readingContract || !block.reading) {
          add('unfinished-block');
          continue;
        }
        const firstMutation = actions[1];
        if (
          block.readingContract.coverage.startTime > firstMutation?.start ||
          block.readingContract.terminalTime <
            actions
              .filter(
                (e: any) =>
                  !['wheel', 'latest', 'own-send'].includes(e.action.kind)
              )
              .at(-1)?.end ||
          block.readingContract.coverage.endTime < latest.start - 100
        )
          add('reading-handoff');
        const eligible = new Map<string, unknown>(
          initialBound ? Object.entries(initial) : []
        );
        for (const entry of sent)
          if (entry.end <= wheel.start && sendProblems.get(entry)?.length === 0)
            eligible.set(entry.postId, entry.wireText);
        const subjectBound =
          eligible.has(block.readingContract.rowId) &&
          eligible.get(block.readingContract.rowId) ===
            block.readingContract.revision?.text;
        if (!subjectBound)
          add('reading-corpus-binding', 'incomplete', wheel.action.id);
        const boundaryBound = !(
          block.index !== index ||
          block.readingContract.scope !== session.scope ||
          block.readingContract.coverage.startTime < wheel.start ||
          block.readingContract.coverage.endTime > latest.start ||
          block.readingContract.point.tolerancePx !== 1 ||
          block.readingContract.coverage.maxGapMs !== 100 ||
          block.readingContract.coverage.maxMeasurementDurationMs !== 32
        );
        if (!boundaryBound)
          add('reading-boundary', 'incomplete', wheel.action.id);
        if (
          subjectBound &&
          boundaryBound &&
          Number.isFinite(firstMutation?.start) &&
          block.readingContract.coverage.startTime <= firstMutation.start
        ) {
          const result = assessScrollReadingTrace(
            block.reading,
            block.readingContract
          );
          const globalAuthorityLost = result.issues.some((issue) =>
            [
              'invalid-capture',
              'invalid-fixed-contract',
              'capture-contract-mismatch',
            ].includes(issue.code)
          );
          const firstUnavailable = Math.min(
            Infinity,
            ...result.issues
              .filter(
                (issue) =>
                  issue.kind === 'incomplete' && issue.sampleIndex !== undefined
              )
              .map((issue) => issue.sampleIndex!)
          );
          merge(`reading-${index}`, {
            issues: result.issues.filter(
              (issue) =>
                issue.kind !== 'failure' ||
                (!globalAuthorityLost &&
                  issue.sampleIndex !== undefined &&
                  issue.sampleIndex < firstUnavailable)
            ),
          });
        }
        const wheels =
          proof.wheels?.filter(
            (w: any) => w.time >= wheel.start && w.time <= wheel.end
          ) ?? [];
        if (
          wheels.length !== 1 ||
          !wheels[0].trusted ||
          wheels[0].scope !== session.scope ||
          wheels[0].timeOrigin !== session.timeOrigin ||
          !wheels[0].inConversation ||
          wheels[0].deltaY !== wheel.action.wheelY
        )
          add('wheel-not-delivered', 'incomplete', wheel.action.id);
        const clicks = trace.events.filter(
          (e: any) =>
            e.time >= latest.start && e.time <= latest.end && e.kind === 'click'
        );
        if (
          clicks.length !== 1 ||
          !clicks[0].trusted ||
          !clicks[0].testIds.includes('ScrollToBottomButton')
        )
          add('latest-not-delivered', 'incomplete', latest.action.id);
        const nextWheel = ledger.find(
          (e: any) => e.action.block === index + 1 && e.action.kind === 'wheel'
        );
        const followEnd = nextWheel?.start ?? trace.end;
        const follow = qualifiedSamples.filter(
          (s: any) => s.time >= latest.start && s.time < followEnd
        );
        const landed = follow.findIndex((s: any) =>
          s.lists.some(
            (l: any) =>
              l.exposed && l.kind === 'channel' && Math.abs(l.bottomGap) <= 1
          )
        );
        if (landed < 0 || follow[landed].time > latest.start + 1000) {
          const deadlineCovered =
            follow[0]?.time - latest.start <= 100 &&
            follow.at(-1)?.time >= latest.start + 1000;
          add(
            'latest-landing',
            deadlineCovered ? 'failure' : 'incomplete',
            latest.action.id
          );
        } else
          for (const sample of follow.slice(landed))
            if (
              !sample.lists.some(
                (l: any) =>
                  l.exposed &&
                  l.kind === 'channel' &&
                  Math.abs(l.bottomGap) <= 1
              )
            )
              add('follow-gap', 'failure', latest.action.id);
        if (plan.blocks[index].kind === 'input') {
          const grown = actions.find((e: any) => e.action.kind === 'grow');
          merge(
            `input-${index}`,
            assessSeededInput(block.input, grown.action.payload, block.inputEnd)
          );
          if (block.input.paintOwner?.timeOrigin !== session.timeOrigin)
            add('input-page-owner');
          if (
            block.input.originalScope !== session.scope ||
            block.inputEnd > latest.start ||
            block.input.samples[0]?.time > grown.end ||
            block.input.dispatches?.[0]?.start < grown.start
          )
            add('input-scope-or-boundary');
        } else {
          const rawSamples = block.semantic?.samples ?? [],
            rawChrome = block.semantic?.chrome?.samples ?? [];
          const acquired = (series: any[], controls: boolean) => {
            let count = 0;
            for (const [i, sample] of series.entries()) {
              if (
                sample.scope !== session.scope ||
                !Number.isFinite(sample.time) ||
                sample.measurement?.valid !== true ||
                !Number.isFinite(sample.measurement.durationMs) ||
                sample.measurement.durationMs < 0 ||
                sample.measurement.durationMs > 32 ||
                (controls &&
                  (!Array.isArray(sample.controls) ||
                    sample.controls.some(
                      (c: any) => !Number.isFinite(c.opacity)
                    ))) ||
                (i &&
                  (sample.time <= series[i - 1].time ||
                    sample.time - series[i - 1].time > 100))
              ) {
                add('thinking-acquisition');
                break;
              }
              count++;
            }
            return series.slice(0, count);
          };
          const samples = acquired(rawSamples, false),
            chrome = acquired(rawChrome, true);
          const show = actions.find(
              (e: any) => e.action.kind === 'presence-show'
            ),
            clear = actions.find(
              (e: any) => e.action.kind === 'presence-clear'
            ),
            remote = actions.find((e: any) => e.action.kind === 'remote-send');
          if (
            block.semantic?.errors?.length ||
            samples.length < 6 ||
            chrome.length !== samples.length ||
            block.semantic.scope !== session.scope
          )
            add('thinking-capture');
          const visible = (s: any, name: string) =>
            s.controls.filter(
              (c: any) => c.kind === name && c.visible && c.opacity >= 0.99
            ).length;
          if (
            !chrome.some(
              (s: any) =>
                s.time >= show.start &&
                s.time <= clear.start &&
                visible(s, 'Scroll stability computing') === 1
            )
          )
            add('thinking-show-not-observed');
          if (
            chrome.some(
              (s: any) =>
                s.time >= show.presenceCompleted + 250 &&
                s.time < clear.start &&
                visible(s, 'Scroll stability computing') !== 1
            )
          )
            add('thinking-early-disappearance', 'failure');
          if (plan.blocks[index].clearFirst) {
            const held = chrome.filter(
              (s: any) =>
                s.time >= clear.presenceCompleted && s.time < clear.start + 2000
            );
            if (
              held.some((s: any) => visible(s, 'Thinking...') !== 1) ||
              remote.start < clear.start + 2000
            )
              add('thinking-hold', 'failure');
            if (!held.length) add('thinking-hold-unmeasured');
          }
          if (
            chrome.some(
              (s: any) =>
                s.time > Math.max(clear.presenceCompleted, remote.end) + 250 &&
                s.time < latest.start &&
                s.controls.some((c: any) => c.visible && c.opacity > 0.01)
            )
          )
            add('thinking-resurrection', 'failure');
          for (const entry of [show, clear])
            if (
              !Number.isFinite(entry.presenceCompleted) ||
              entry.presenceCompleted < entry.start ||
              entry.presenceCompleted > entry.end ||
              !validSeededPresence(
                entry.presence,
                session.channel,
                entry === show
              )
            )
              add('presence-receipt', 'incomplete', entry.action.id);
          if (
            samples[0]?.time > show.start ||
            samples.at(-1)?.time < block.readingContract.coverage.endTime ||
            (plan.blocks[index].clearFirst &&
              (!Number.isFinite(block.hiddenAt) ||
                block.hiddenAt < clear.start + 2000 ||
                remote.start < block.hiddenAt))
          )
            add('thinking-handoff');
        }
      } catch {
        add('malformed-block-evidence', 'incomplete', `block-${index}`);
      }
    }
    for (const entry of sent) {
      const problems = sendProblems.get(entry)!;
      for (const problem of problems)
        add(
          problem,
          problem === 'send-durable-row' &&
            !problems.includes('send-receipt') &&
            !problems.includes('original-send-wire-binding')
            ? 'failure'
            : 'incomplete',
          entry.action.id
        );

      // A remote post can remain virtualized while READ stays fixed; require its
      // exact body by the first FOLLOW interval instead of demanding offscreen DOM.
      const visibleAfter = qualifiedSamples.some(
        (s: any) =>
          s.time >= entry.start &&
          s.lists.some((l: any) =>
            l.rows.some(
              (r: any) =>
                r.id === entry.postId &&
                r.exposed &&
                r.body?.text === entry.wireText
            )
          )
      );
      if (!visibleAfter)
        add('observer-delivery-unmeasured', 'incomplete', entry.action.id);
    }
    const texts = new Map(Object.entries(proof.initialRows));
    for (const entry of sent) texts.set(entry.postId, entry.wireText);
    for (const sample of qualifiedSamples.filter(
      (s: any) => s.time > proof.pendingEnd
    ))
      for (const list of sample.lists.filter((l: any) => l.exposed)) {
        const ids = new Set();
        for (const row of list.rows.filter((r: any) => r.exposed)) {
          if (
            ids.has(row.id) ||
            sent.some(
              (e: any) => e.postId === row.id && sample.time < e.start
            ) ||
            !texts.has(row.id) ||
            row.body?.text !== texts.get(row.id) ||
            row.body?.count !== 1 ||
            (!row.body?.exposed && row.top >= 0 && row.bottom <= list.height)
          )
            add('visible-message-identity-or-text', 'failure');
          ids.add(row.id);
        }
      }
    const finalRows = seedBackendRows(proof.finalBackend, session.channel);
    if (
      !validSeededBackendBracket(
        proof.finalBackend,
        session.channel,
        ledger.at(-1)?.end,
        trace.end - 1000
      ) ||
      Object.keys(finalRows).length !== texts.size ||
      [...texts].some(([id, text]) => finalRows[id] !== text)
    )
      add('final-durable-membership', 'incomplete');
    const deliveries = proof.deliveries;
    if (
      !deliveries ||
      deliveries.errors?.length ||
      !Array.isArray(deliveries.events)
    )
      add('missing-primitive-deliveries');
    else
      for (const e of deliveries.events) {
        const owners = ledger.filter(
          (a: any) => e.time >= a.start && e.time <= a.end
        );
        if (
          owners.length !== 1 ||
          !e.trusted ||
          e.timeOrigin !== session.timeOrigin ||
          !Number.isFinite(e.observedAt) ||
          e.observedAt < e.time ||
          e.observedAt - e.time > 100
        ) {
          add('unowned-primitive-delivery');
          continue;
        }
        const kind = owners[0].action.kind;
        if (
          ['keydown', 'keyup'].includes(e.type) &&
          !['select-all', 'delete'].includes(kind)
        )
          add('unplanned-key-delivery', 'failure');
        if (
          (e.type === 'wheel' && kind !== 'wheel') ||
          (e.type === 'input' &&
            (!['grow', 'delete', 'own-send'].includes(kind) ||
              e.testId !== 'MessageInput' ||
              e.value !==
                (kind === 'delete' ? '' : owners[0].action.payload))) ||
          (e.type === 'click' &&
            !['open-thread', 'latest', 'own-send'].includes(kind)) ||
          (e.type === 'popstate' && kind !== 'back')
        )
          add('unplanned-primitive-delivery', 'failure');
      }
    for (const entry of ledger.filter((e: any) =>
      ['grow', 'delete', 'own-send'].includes(e.action.kind)
    )) {
      const inputs =
        deliveries?.events?.filter(
          (e: any) =>
            e.type === 'input' && e.time >= entry.start && e.time <= entry.end
        ) ?? [];
      if (inputs.length !== 1)
        add('input-delivery-cardinality', 'incomplete', entry.action.id);
    }
    for (const entry of ledger.filter((e: any) =>
      ['latest', 'own-send'].includes(e.action.kind)
    )) {
      const clicks = trace.events.filter(
        (e: any) =>
          e.kind === 'click' && e.time >= entry.start && e.time <= entry.end
      );
      const wanted =
        entry.action.kind === 'latest'
          ? 'ScrollToBottomButton'
          : 'MessageInputSendButton';
      if (
        clicks.length !== 1 ||
        !clicks[0].trusted ||
        !clicks[0].testIds.includes(wanted)
      )
        add('click-delivery-cardinality', 'incomplete', entry.action.id);
    }
    // Every completed follow observation must expose the newest committed post,
    // even if a stable gap could otherwise conceal a stale rendered dataset.
    for (const entry of ledger.filter(
      (e: any) => e.action.kind === 'latest' || e.action.kind === 'own-send'
    )) {
      const candidates = [
        ...Object.keys(proof.initialRows),
        ...sent
          .filter((e: any) => e.start <= entry.start || e === entry)
          .map((e: any) => e.postId),
      ].sort((a, b) =>
        BigInt(a.replaceAll('.', '')) > BigInt(b.replaceAll('.', '')) ? 1 : -1
      );
      const newest = candidates.at(-1);
      const sample = qualifiedSamples.findLast(
        (s: any) => s.time <= entry.end && s.time >= entry.end - 100
      );
      if (
        !sample?.lists.some(
          (l: any) =>
            l.exposed &&
            l.kind === 'channel' &&
            Math.abs(l.bottomGap) <= 1 &&
            l.rows.some(
              (r: any) =>
                r.id === newest &&
                r.exposed &&
                r.bottom <= l.height + 1 &&
                r.body?.text === texts.get(newest)
            )
        )
      )
        add(
          'newest-not-exposed',
          sample ? 'failure' : 'incomplete',
          entry.action.id
        );
    }
  } catch {
    add('malformed-seed-evidence');
  }
  return finish();
}

export function seedBackendRows(
  receipt: any,
  channel: string
): Record<string, string> {
  if (
    receipt?.status !== 200 ||
    receipt.url !==
      `http://localhost:3000/~/scry/channels/v5/${channel}/posts/newest/100/post.json` ||
    !receipt.body?.posts
  )
    throw Error('Missing exact committed channel window');
  const rows: Record<string, string> = {};
  for (const p of Object.values(receipt.body.posts) as any[]) {
    const id = String(p.seal?.id ?? '')
      .replaceAll('.', '')
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (
      !/^\d[\d.]*$/.test(id) ||
      rows[id] !== undefined ||
      p.essay?.content?.length !== 1 ||
      p.essay.content[0]?.inline?.length !== 1 ||
      typeof p.essay.content[0].inline[0] !== 'string'
    )
      throw Error('Unsupported or duplicate committed corpus row');
    rows[id] = p.essay.content[0].inline[0];
  }
  return rows;
}
export function validSeededPresence(
  p: any,
  channel: string,
  active: boolean
): boolean {
  const body = p?.request?.body,
    a = Array.isArray(body) && body.length === 1 ? body[0] : null;
  const context = `/channel/${channel}`,
    value = a?.json?.[active ? 'set' : 'clear'],
    key = active ? value?.key : value;
  const actual = p?.observer?.body?.init?.[context]?.computing?.['~ten'];
  return (
    p?.active === active &&
    p.ship === 'ten' &&
    p.channelId === channel &&
    p.origin === 'http://localhost:3002' &&
    p.observerOrigin === 'http://localhost:3000' &&
    p.request?.url?.startsWith(`${p.origin}/~/channel/scroller-`) &&
    p.request.status >= 200 &&
    p.request.status < 300 &&
    p.observer?.status === 200 &&
    p.observer.body?.init !== null &&
    typeof p.observer.body?.init === 'object' &&
    !Array.isArray(p.observer.body.init) &&
    a?.action === 'poke' &&
    a.ship === 'ten' &&
    a.app === 'presence' &&
    a.mark === 'presence-action-1' &&
    key?.context === context &&
    key.ship === '~ten' &&
    key.topic === 'computing' &&
    Boolean(actual) === active &&
    (!active ||
      (value?.display?.text === 'Scroll stability computing' &&
        value.display.blob ===
          JSON.stringify({
            protocol: 'tlon.computing-status.v1',
            thinking: true,
            toolCalls: [],
          })))
  );
}

/** The exact fresh channel readback is required even when its body looks right. */
function validSeededBackendBracket(
  receipt: any,
  channel: string,
  start: number,
  end: number
) {
  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    receipt?.status === 200 &&
    receipt.body?.posts !== null &&
    typeof receipt.body?.posts === 'object' &&
    !Array.isArray(receipt.body.posts) &&
    receipt.url ===
      `http://localhost:3000/~/scry/channels/v5/${channel}/posts/newest/100/post.json` &&
    Number.isFinite(receipt.startTime) &&
    Number.isFinite(receipt.endTime) &&
    receipt.startTime >= start &&
    receipt.endTime >= receipt.startTime &&
    receipt.endTime <= end
  );
}
function seededSendProblems(entry: any, session: any): string[] {
  const problems: string[] = [];
  if (
    !entry.postId ||
    entry.author !== (entry.action.kind === 'own-send' ? '~zod' : '~ten') ||
    entry.wireText !== entry.action.payload + ' ' ||
    entry.channel !== session.channel ||
    !entry.request ||
    entry.request.method !== 'PUT' ||
    entry.request.channel !== session.channel ||
    entry.request.author !== entry.author ||
    entry.request.text !== entry.wireText ||
    entry.request.observerTimeOrigin !== session.timeOrigin ||
    entry.request.senderTimeOrigin !==
      (entry.action.kind === 'own-send'
        ? session.timeOrigin
        : session.sender?.timeOrigin) ||
    !(entry.request.status >= 200 && entry.request.status < 300) ||
    !Number.isFinite(entry.request.startTime) ||
    !Number.isFinite(entry.request.headersTime) ||
    entry.request.startTime < entry.start ||
    entry.request.headersTime < entry.request.startTime ||
    !validSeededBackendBracket(
      entry.backend,
      session.channel,
      entry.request.headersTime,
      entry.end
    ) ||
    entry.backend?.status !== 200
  )
    problems.push('send-receipt');
  const adds =
    entry.request?.actions?.filter(
      (a: any) =>
        a?.action === 'poke' &&
        a.app === 'channels' &&
        a.json?.channel?.action?.post?.add
    ) ?? [];
  if (
    adds.length !== 1 ||
    adds[0].json.channel.nest !== session.channel ||
    adds[0].json.channel.action.post.add.author !== entry.author ||
    JSON.stringify(adds[0].json.channel.action.post.add.content) !==
      JSON.stringify([{ inline: [entry.wireText] }]) ||
    !entry.request?.url?.startsWith(
      `http://localhost:${entry.action.kind === 'own-send' ? 3000 : 3002}/~/channel/`
    )
  )
    problems.push('original-send-wire-binding');
  const matching = Object.values(entry.backend?.body?.posts ?? {}).filter(
    (post: any) =>
      String(post.seal?.id).replaceAll('.', '') ===
        String(entry.postId).replaceAll('.', '') &&
      post.essay?.author === entry.author &&
      JSON.stringify(post.essay?.content) ===
        JSON.stringify([{ inline: [entry.wireText] }])
  );
  if (matching.length !== 1) problems.push('send-durable-row');

  return problems;
}
