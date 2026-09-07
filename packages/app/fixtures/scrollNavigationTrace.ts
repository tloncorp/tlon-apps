export type NavigationRow = {
  id: string;
  top: number;
  bottom: number;
  exposed: boolean;
  body: {
    text: string | null;
    count: number;
    exposed: boolean;
    pointTop: number | null;
    blocks?: { text: string | null; exposed: boolean }[];
    pointBlockIndex?: number;
  };
};
export type NavigationList = {
  identity: number;
  kind: 'channel' | 'thread' | 'unknown';
  exposed: boolean;
  height: number;
  bottomGap: number;
  rows: NavigationRow[];
};
export type NavigationSample = {
  time: number;
  durationMs: number;
  route: string;
  documentVisible: boolean;
  lists: NavigationList[];
  loadingCount: number;
  unattributedBodies: number;
};
export type NavigationScope = {
  route: string;
  kind: 'channel' | 'thread';
  rows: Record<string, string>;
  textBlocks?: Record<string, string[]>;
  landing:
    | { kind: 'bottom'; newestId: string }
    | { kind: 'anchor'; rowId: string; top: number; pointTop: number };
};
export type ScrollNavigationPlan = {
  version: 1;
  declaredAt: number;
  initial: string;
  scopes: Record<string, NavigationScope>;
  commands: {
    id: string;
    from: string;
    to: string;
    cancels?: string;
    cancelsPending?: string;
    trigger:
      | {
          kind: 'click';
          text?: string;
          testId?: string;
          reference?: { rowId: string; text: string };
        }
      | { kind: 'popstate' };
  }[];
  maxGapMs: number;
  maxMeasurementMs: number;
  maxOutgoingMs: number;
  completionMs: number;
  quietTailMs: number;
  tolerancePx: number;
};
export type ScrollNavigationTrace = {
  start: number;
  end: number;
  samples: NavigationSample[];
  commands: { id: string; start: number; end: number | null }[];
  events: {
    time: number;
    observedAt: number;
    kind: 'click' | 'popstate';
    trusted: boolean;
    texts: string[];
    testIds: string[];
    reference?: { rowId: string | null; texts: string[]; frameCount: number };
  }[];
  errors: string[];
};

export type NavigationPendingProof = {
  version: 1;
  kind: 'reply-sync' | 'missing-parent';
  sourceChannel: string;
  parentId: string;
  referenceReplyId?: string;
  expectedRows: Record<string, string>;
  backend: {
    url: string;
    method: string;
    status: number;
    requestedAt: number;
    completedAt: number;
    body: unknown;
  };
  freshContext: { storage: 'cookies-and-localStorage-only'; createdAt: number };
  before: {
    time: number;
    parentQueryPresent: boolean;
    threadQueryPresent: boolean;
    reference?: { id: string; parentId: string; text: string } | null;
  };
  local: {
    time: number;
    route: string;
    parent: {
      status: string;
      fetching: string;
      id: string | null;
      text: string | null;
      replyCount: number | null;
    } | null;
    thread: { status: string; fetching: string; ids: string[] | null } | null;
  } | null;
  requests: {
    url: string;
    method: string;
    interceptedAt: number;
    interceptedTime: number;
    releasedAt?: number;
    releasedTime?: number;
    completedAt?: number;
    completedTime?: number;
    responseStatus?: number;
    responseBody?: unknown;
    failure?: string;
  }[];
};

const canonicalNavigationId = (id: unknown) => {
  const digits = typeof id === 'string' ? id.replaceAll('.', '') : '';
  return /^\d+$/.test(digits)
    ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    : null;
};

/** Exact independently committed plaintext essays; never derive expected text from DOM. */
export function navigationBackendThreadRows(
  value: unknown
): Record<string, string> | null {
  const object = (item: unknown): item is Record<string, unknown> =>
    item !== null && typeof item === 'object' && !Array.isArray(item);
  if (!object(value) || !object(value.seal) || !object(value.seal.replies))
    return null;
  const id = canonicalNavigationId(value.seal.id);
  const inline = (essay: unknown) => {
    if (
      !object(essay) ||
      essay.author !== '~zod' ||
      !Array.isArray(essay.content) ||
      essay.content.length !== 1
    )
      return null;
    const verse = essay.content[0];
    return object(verse) &&
      Array.isArray(verse.inline) &&
      verse.inline.length === 1 &&
      typeof verse.inline[0] === 'string' &&
      verse.inline[0].length
      ? verse.inline[0]
      : null;
  };
  const text = inline(value.essay);
  if (!id || !text) return null;
  const result: Record<string, string> = { [id]: text };
  for (const [key, reply] of Object.entries(value.seal.replies)) {
    if (!object(reply) || !object(reply.seal)) return null;
    const replyId = canonicalNavigationId(reply.seal.id);
    const replyText = inline(reply['reply-essay']);
    if (
      !replyId ||
      canonicalNavigationId(key) !== replyId ||
      canonicalNavigationId(reply.seal['parent-id']) !== id ||
      !replyText ||
      result[replyId] !== undefined
    )
      return null;
    result[replyId] = replyText;
  }
  return result;
}

/** Independent transport qualification, retaining the DOM oracle's failures. */
export function assessPendingNavigationTrace(
  trace: ScrollNavigationTrace,
  plan: ScrollNavigationPlan,
  proof: NavigationPendingProof
) {
  const result = assessScrollNavigationTrace(trace, plan);
  const reject = (code: string) =>
    result.issues.push({ code, kind: 'incomplete' });
  const sameRows = (
    a: Record<string, string> | null,
    b: Record<string, string>
  ) =>
    !!a &&
    Object.keys(a).length === Object.keys(b).length &&
    Object.entries(a).every(([id, text]) => b[id] === text);
  try {
    const open = trace.events[0],
      back = trace.events[1];
    const request = proof.requests[0];
    const url = `http://localhost:3000/~/scry/channels/v5/${proof.sourceChannel}/posts/post/${proof.parentId}.json`;
    if (
      proof.version !== 1 ||
      !['reply-sync', 'missing-parent'].includes(proof.kind) ||
      !/^chat\/~zod\/[^/]+$/.test(proof.sourceChannel) ||
      canonicalNavigationId(proof.parentId) !== proof.parentId ||
      !proof.expectedRows[proof.parentId] ||
      Object.keys(proof.expectedRows).length !== 19 ||
      !sameRows(
        navigationBackendThreadRows(proof.backend.body),
        proof.expectedRows
      ) ||
      proof.backend.url !== url ||
      proof.backend.method !== 'GET' ||
      proof.backend.status !== 200 ||
      !Number.isFinite(proof.backend.requestedAt) ||
      proof.backend.completedAt < proof.backend.requestedAt ||
      ![
        proof.backend.completedAt,
        proof.freshContext.createdAt,
        proof.before.time,
        proof.local?.time,
      ].every(Number.isFinite) ||
      proof.freshContext.storage !== 'cookies-and-localStorage-only' ||
      proof.freshContext.createdAt < proof.backend.completedAt ||
      proof.before.time > plan.declaredAt ||
      proof.before.threadQueryPresent ||
      !open ||
      !back ||
      !proof.local ||
      proof.local.time < open.time ||
      proof.local.time >= back.time ||
      proof.local.route !== plan.scopes.thread.route
    )
      reject('pending-preparation-unproven');
    if (
      proof.requests.length !== 1 ||
      !request ||
      request.method !== 'GET' ||
      request.url !== url ||
      request.failure ||
      request.responseStatus !== 200 ||
      !sameRows(
        navigationBackendThreadRows(request.responseBody),
        proof.expectedRows
      ) ||
      ![
        request.interceptedTime,
        request.releasedTime,
        request.completedTime,
        request.interceptedAt,
        request.releasedAt,
        request.completedAt,
      ].every(Number.isFinite) ||
      request.interceptedTime < open.time ||
      request.interceptedTime > proof.local!.time ||
      request.interceptedTime >= back.time ||
      proof.local!.time >= request.releasedTime! ||
      back.time >= request.releasedTime! ||
      request.releasedTime! >= request.completedTime! ||
      request.completedTime! >= trace.end ||
      request.interceptedAt < proof.freshContext.createdAt ||
      request.releasedAt! < request.interceptedAt ||
      request.completedAt! < request.releasedAt! ||
      trace.end - request.completedTime! < plan.quietTailMs ||
      !trace.samples.some(
        (sample) =>
          sample.time > back.time &&
          sample.time < request.releasedTime! &&
          sample.route === plan.scopes.channel.route &&
          sample.lists.some((list) => list.exposed && list.kind === 'channel')
      )
    )
      reject('pending-request-order-unproven');
    const local = proof.local;
    const parent = local?.parent;
    if (proof.kind === 'reply-sync') {
      if (
        plan.commands[1]?.cancelsPending !== 'open-thread' ||
        plan.commands[1]?.cancels ||
        parent?.status !== 'success' ||
        parent.fetching !== 'idle' ||
        parent.id !== proof.parentId ||
        parent.text !== proof.expectedRows[proof.parentId] ||
        parent.replyCount !== 18 ||
        local?.thread?.status !== 'success' ||
        local.thread.fetching !== 'idle' ||
        !Array.isArray(local.thread.ids) ||
        local.thread.ids.length !== 0 ||
        result.firstReveals['open-thread'] === undefined ||
        result.firstReveals['open-thread'] >= back.time ||
        !sameRows(plan.scopes.thread.rows, {
          [proof.parentId]: proof.expectedRows[proof.parentId],
        }) ||
        plan.scopes.thread.landing.kind !== 'bottom' ||
        plan.scopes.thread.landing.newestId !== proof.parentId
      )
        reject('pending-local-replies-unproven');
    } else if (
      plan.commands[1]?.cancels !== 'open-thread' ||
      plan.commands[1]?.cancelsPending ||
      proof.before.parentQueryPresent ||
      parent?.status !== 'success' ||
      parent.fetching !== 'idle' ||
      parent.id !== null ||
      parent.text !== null ||
      local?.thread !== null ||
      proof.before.reference?.id !== proof.referenceReplyId ||
      proof.before.reference?.parentId !== proof.parentId ||
      proof.before.reference?.text !==
        proof.expectedRows[proof.referenceReplyId ?? ''] ||
      result.firstReveals['open-thread'] !== undefined ||
      !sameRows(plan.scopes.thread.rows, proof.expectedRows)
    )
      reject('pending-missing-parent-unproven');
  } catch {
    reject('malformed-pending-evidence');
  }
  result.verdict = result.issues.some((issue) => issue.kind === 'failure')
    ? 'FAIL'
    : result.issues.length
      ? 'INCOMPLETE'
      : 'PASS';
  return result;
}

/** Strict sampled DOM navigation. Neither rAF nor correct DOM proves paint. */
export function assessScrollNavigationTrace(
  trace: ScrollNavigationTrace,
  plan: ScrollNavigationPlan
) {
  const issues: {
    code: string;
    kind: 'failure' | 'incomplete';
    sampleIndex?: number;
  }[] = [];
  const reject = (
    code: string,
    kind: 'failure' | 'incomplete' = 'incomplete',
    sampleIndex?: number
  ) => {
    if (
      !issues.some(
        (issue) => issue.code === code && issue.sampleIndex === sampleIndex
      )
    )
      issues.push({
        code,
        kind,
        ...(sampleIndex === undefined ? {} : { sampleIndex }),
      });
  };
  const finite = (...values: number[]) => values.every(Number.isFinite);
  const result = (firstReveals: Record<string, number> = {}) => ({
    verdict: issues.some((issue) => issue.kind === 'failure')
      ? ('FAIL' as const)
      : issues.length
        ? ('INCOMPLETE' as const)
        : ('PASS' as const),
    evidenceLevel: 'sampled-dom-navigation' as const,
    presentation: 'INCOMPLETE' as const,
    durableReads: 'INCOMPLETE' as const,
    issues,
    firstReveals,
  });
  if (
    !plan ||
    plan.version !== 1 ||
    !plan.scopes?.[plan.initial] ||
    !Array.isArray(plan.commands) ||
    !plan.commands.length ||
    !finite(
      plan.declaredAt,
      plan.maxGapMs,
      plan.maxMeasurementMs,
      plan.maxOutgoingMs,
      plan.completionMs,
      plan.quietTailMs,
      plan.tolerancePx
    ) ||
    plan.maxGapMs <= 0 ||
    plan.maxGapMs > 100 ||
    plan.maxMeasurementMs <= 0 ||
    plan.maxMeasurementMs > 32 ||
    plan.maxOutgoingMs < 0 ||
    plan.maxOutgoingMs > 250 ||
    plan.completionMs <= 0 ||
    plan.completionMs > 1000 ||
    plan.quietTailMs < 1000 ||
    plan.tolerancePx < 0 ||
    plan.tolerancePx > 1
  ) {
    reject('invalid-plan');
    return result();
  }
  for (const scope of Object.values(plan.scopes)) {
    if (
      !scope ||
      !scope.route?.startsWith('/') ||
      !['channel', 'thread'].includes(scope.kind) ||
      !scope.rows ||
      !Object.keys(scope.rows).length ||
      Object.values(scope.rows).some(
        (text) => typeof text !== 'string' || !text.length
      ) ||
      (scope.textBlocks &&
        Object.entries(scope.textBlocks).some(
          ([id, blocks]) =>
            !scope.rows[id] ||
            !Array.isArray(blocks) ||
            !blocks.length ||
            blocks.some((text) => typeof text !== 'string' || !text.length) ||
            blocks.filter((text) => text === scope.rows[id]).length !== 1
        )) ||
      (scope.landing?.kind === 'bottom'
        ? !scope.rows[scope.landing.newestId]
        : scope.landing?.kind !== 'anchor' ||
          !scope.rows[scope.landing.rowId] ||
          !finite(scope.landing.top, scope.landing.pointTop))
    )
      reject('invalid-scope');
  }
  if (
    new Set(Object.values(plan.scopes).map((scope) => scope?.route)).size !==
    Object.keys(plan.scopes).length
  )
    reject('ambiguous-scope-routes');
  let priorScope = plan.initial;
  const commandIds = new Set<string>();
  for (const [index, command] of plan.commands.entries()) {
    if (
      !command.id ||
      commandIds.has(command.id) ||
      command.from !== priorScope ||
      !plan.scopes[command.to] ||
      command.from === command.to ||
      !command.trigger ||
      !['click', 'popstate'].includes(command.trigger.kind) ||
      (command.trigger.kind === 'click' &&
        !command.trigger.text &&
        !command.trigger.testId &&
        !command.trigger.reference) ||
      (command.trigger.kind === 'click' &&
        command.trigger.reference &&
        (!command.trigger.reference.rowId ||
          !command.trigger.reference.text)) ||
      (command.cancels &&
        (index === 0 || command.cancels !== plan.commands[index - 1].id)) ||
      (command.cancelsPending &&
        (command.cancels ||
          index === 0 ||
          command.cancelsPending !== plan.commands[index - 1].id))
    )
      reject('invalid-command-plan');
    commandIds.add(command.id);
    priorScope = command.to;
  }
  if (issues.length) return result();
  if (
    !trace ||
    !Array.isArray(trace.samples) ||
    !Array.isArray(trace.commands) ||
    !Array.isArray(trace.events) ||
    !Array.isArray(trace.errors) ||
    !finite(trace.start, trace.end) ||
    trace.end <= trace.start ||
    plan.declaredAt > trace.start
  ) {
    reject('invalid-trace');
    return result();
  }
  if (trace.errors.length) reject('collector-errors');
  if (
    trace.samples.some(
      (sample) =>
        !sample ||
        typeof sample.route !== 'string' ||
        !Array.isArray(sample.lists) ||
        sample.lists.some(
          (list) =>
            !list ||
            typeof list.exposed !== 'boolean' ||
            !Array.isArray(list.rows) ||
            list.rows.some(
              (row) =>
                !row ||
                typeof row.id !== 'string' ||
                typeof row.exposed !== 'boolean' ||
                !row.body
            )
        )
    )
  ) {
    reject('malformed-sample');
    return result();
  }
  if (trace.commands.length !== plan.commands.length) reject('command-count');
  for (const [index, command] of trace.commands.entries()) {
    const previous = trace.commands[index - 1];
    if (
      command.id !== plan.commands[index]?.id ||
      command.end === null ||
      !finite(command.start, command.end ?? NaN) ||
      command.start < trace.start ||
      command.end! < command.start ||
      command.end! > trace.end ||
      (previous && command.start <= previous.start)
    )
      reject('invalid-command-bracket');
  }
  if (
    issues.some(
      (issue) =>
        issue.code === 'command-count' ||
        issue.code === 'invalid-command-bracket'
    )
  )
    return result();
  if (trace.events.length !== plan.commands.length) {
    reject('delivery-count');
    return result();
  }
  for (const [index, event] of trace.events.entries()) {
    const bracket = trace.commands[index],
      expected = plan.commands[index].trigger;
    if (
      !event ||
      !finite(event.time, event.observedAt) ||
      event.time < bracket.start ||
      event.time > bracket.end! ||
      event.observedAt < event.time ||
      event.observedAt - event.time > plan.maxGapMs ||
      event.trusted !== true ||
      event.kind !== expected.kind ||
      !Array.isArray(event.texts) ||
      !Array.isArray(event.testIds) ||
      (expected.kind === 'click' &&
        ((expected.text && !event.texts.includes(expected.text)) ||
          (expected.testId && !event.testIds.includes(expected.testId)) ||
          (expected.reference &&
            (!event.reference ||
              event.reference.rowId !== expected.reference.rowId ||
              event.reference.frameCount !== 1 ||
              !Array.isArray(event.reference.texts) ||
              event.reference.texts.length !== 1 ||
              event.reference.texts[0] !== expected.reference.text))))
    )
      reject('invalid-delivery');
  }
  if (issues.some((issue) => issue.code === 'invalid-delivery'))
    return result();
  if (trace.commands[0].start - trace.start < 200) reject('baseline-too-short');
  if (trace.samples.length < 3) {
    reject('missing-samples');
    return result();
  }
  if (
    trace.samples[0].time < trace.start ||
    trace.samples[0].time - trace.start > plan.maxGapMs ||
    trace.samples.at(-1)!.time > trace.end ||
    trace.end - trace.samples.at(-1)!.time > plan.maxGapMs
  )
    reject('capture-boundary-gap');
  const firstReveals: Record<string, number> = {};
  const routeArrived = new Set<string>();
  function verifyList(
    sample: NavigationSample,
    scope: NavigationScope,
    index: number
  ) {
    if (sample.unattributedBodies > 0) {
      reject('content-owner-unavailable', 'incomplete', index);
      return false;
    }
    const active = sample.lists.filter((list) => list.exposed);
    if (active.length !== 1) {
      reject(
        active.length ? 'ambiguous-active-list' : 'blank-content',
        'failure',
        index
      );
      return false;
    }
    const list = active[0];
    if (list.kind !== scope.kind) reject('wrong-list-scope', 'failure', index);
    if (
      !finite(list.identity, list.height, list.bottomGap) ||
      list.identity <= 0 ||
      list.height <= 0
    ) {
      reject('invalid-list-geometry', 'incomplete', index);
      return false;
    }
    if (!Array.isArray(list.rows)) {
      reject('invalid-rows', 'incomplete', index);
      return false;
    }
    const visible = list.rows.filter((row) => row.exposed);
    if (!visible.length) reject('blank-content', 'failure', index);
    if (new Set(list.rows.map((row) => row.id)).size !== list.rows.length)
      reject('duplicate-row', 'failure', index);
    for (const row of visible) {
      if (!scope.rows[row.id]) reject('wrong-row-scope', 'failure', index);
      if (
        !finite(row.top, row.bottom) ||
        row.bottom <= row.top ||
        row.bottom <= 0 ||
        row.top >= list.height
      )
        reject('invalid-row-geometry', 'incomplete', index);
      const expectedBlocks = scope.textBlocks?.[row.id] ?? [scope.rows[row.id]];
      if (
        row.body.count !== expectedBlocks.length ||
        (expectedBlocks.length > 1 &&
          row.body.blocks?.length !== expectedBlocks.length)
      )
        reject('text-acquisition-unavailable', 'incomplete', index);
      else if (
        row.body.text !== scope.rows[row.id] ||
        (row.body.blocks &&
          (row.body.blocks.length !== expectedBlocks.length ||
            row.body.blocks.some(
              (block, blockIndex) =>
                block.text !== expectedBlocks[blockIndex] ||
                (row.top >= 0 && row.bottom <= list.height && !block.exposed)
            ) ||
            row.body.pointBlockIndex !==
              expectedBlocks.indexOf(scope.rows[row.id]) ||
            row.body.text !==
              row.body.blocks[row.body.pointBlockIndex!]?.text)) ||
        (row.top >= 0 && row.bottom <= list.height && !row.body.exposed)
      )
        reject('wrong-or-hidden-text', 'failure', index);
    }
    if (
      visible.every(
        (row) => row.body.count === (scope.textBlocks?.[row.id]?.length ?? 1)
      ) &&
      !visible.some((row) =>
        row.body.blocks
          ? row.body.blocks.some((block) => block.exposed)
          : row.body.exposed
      )
    )
      reject('blank-text', 'failure', index);
    const landing = scope.landing;
    if (landing.kind === 'bottom') {
      const newest = visible.find((row) => row.id === landing.newestId);
      if (
        Math.abs(list.bottomGap) > plan.tolerancePx ||
        !newest ||
        newest.bottom > list.height + plan.tolerancePx
      )
        reject('wrong-bottom-landing', 'failure', index);
    } else {
      const anchor = visible.find((row) => row.id === landing.rowId);
      if (!anchor || Math.abs(anchor.top - landing.top) > plan.tolerancePx)
        reject('wrong-reading-landing', 'failure', index);
      if (
        anchor &&
        (anchor.body.pointTop === null ||
          !Number.isFinite(anchor.body.pointTop))
      )
        reject('reading-point-unavailable', 'incomplete', index);
      else if (
        anchor &&
        Math.abs(anchor.body.pointTop! - landing.pointTop) > plan.tolerancePx
      )
        reject('wrong-reading-landing', 'failure', index);
    }
    return visible.length > 0;
  }
  for (const [index, sample] of trace.samples.entries()) {
    if (
      !sample ||
      !finite(sample.time, sample.durationMs) ||
      sample.time < trace.start ||
      sample.time > trace.end ||
      sample.durationMs < 0 ||
      sample.durationMs > plan.maxMeasurementMs ||
      (index > 0 && sample.time <= trace.samples[index - 1].time) ||
      !Array.isArray(sample.lists) ||
      !Number.isInteger(sample.loadingCount) ||
      sample.loadingCount < 0 ||
      !Number.isInteger(sample.unattributedBodies) ||
      sample.unattributedBodies < 0
    ) {
      reject('invalid-sample', 'incomplete', index);
      continue;
    }
    if (
      index > 0 &&
      sample.time - trace.samples[index - 1].time > plan.maxGapMs
    )
      reject('sample-gap', 'incomplete', index);
    if (!sample.documentVisible) reject('document-hidden', 'incomplete', index);
    const actionIndex = trace.events.reduce(
      (last, event, index) => (event.time <= sample.time ? index : last),
      -1
    );
    if (actionIndex < 0) {
      if (sample.route !== plan.scopes[plan.initial].route)
        reject('wrong-baseline-route', 'failure', index);
      verifyList(sample, plan.scopes[plan.initial], index);
      continue;
    }
    const action = plan.commands[actionIndex];
    const command = { start: trace.events[actionIndex].time };
    const destination = plan.scopes[action.to];
    const source = plan.scopes[action.from];
    if (sample.route === destination.route) routeArrived.add(action.id);
    if (sample.route !== destination.route) {
      if (
        sample.route !== source.route ||
        routeArrived.has(action.id) ||
        sample.time - command.start > plan.maxOutgoingMs
      )
        reject('wrong-route', 'failure', index);
    }
    const visibleLists = sample.lists.filter((list) => list.exposed);
    const hasContent = visibleLists.some(
      (list) => Array.isArray(list.rows) && list.rows.some((row) => row.exposed)
    );
    if (sample.unattributedBodies > 0) {
      reject('content-owner-unavailable', 'incomplete', index);
      continue;
    }
    if (!hasContent && sample.loadingCount > 0) {
      if (sample.loadingCount !== 1)
        reject('ambiguous-loading', 'incomplete', index);
      if (firstReveals[action.id] !== undefined)
        reject('loading-after-reveal', 'failure', index);
      if (sample.time - command.start > plan.completionMs)
        reject('loading-deadline', 'failure', index);
      continue;
    }
    if (sample.loadingCount > 0)
      reject('loading-over-content', 'failure', index);
    // Router state and DOM commits can become observable in either order.
    // Actual destination content owns its first reveal, even before URL commit.
    // Only a still-correct outgoing view may precede it, for a bounded interval.
    if (
      visibleLists.length === 1 &&
      visibleLists[0].kind === source.kind &&
      firstReveals[action.id] === undefined &&
      sample.time - command.start <= plan.maxOutgoingMs
    ) {
      verifyList(sample, source, index);
      continue;
    }
    if (
      verifyList(sample, destination, index) &&
      firstReveals[action.id] === undefined
    ) {
      firstReveals[action.id] = sample.time;
      if (sample.time - command.start > plan.completionMs)
        reject('first-reveal-deadline', 'failure', index);
    }
  }
  for (const [index, action] of plan.commands.entries()) {
    const command = { start: trace.events[index].time };
    const next = plan.commands[index + 1];
    const finish = trace.events[index + 1]?.time ?? trace.end;
    if (!routeArrived.has(action.id)) reject('destination-route-unobserved');
    if (next?.cancels === action.id) {
      if (firstReveals[action.id] !== undefined)
        reject('cancellation-not-before-reveal');
      if (finish - command.start > plan.completionMs)
        reject('cancellation-too-late');
    } else if (firstReveals[action.id] === undefined)
      reject('destination-reveal-unobserved');
    else if (
      next?.cancelsPending !== action.id &&
      finish - firstReveals[action.id] < plan.quietTailMs
    )
      reject('missing-quiet-tail');
  }
  return result(firstReveals);
}
