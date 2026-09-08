import type { ContentPresentation } from './scrollContentTrace';
import type {
  ReadingFragment,
  ScrollReadingContract,
  ScrollReadingTrace,
} from './scrollReadingTrace';
import { evidence as pendingEvidence } from './scrollNavigationPendingTestData';
import { seededSessionPlan } from './scrollSeededSession';

// Modeled boundary data using the existing actual reader shapes, not a browser claim.
function readingEvidence() {
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

const clone = <T>(x: T): T => structuredClone(x);
export function seededEvidence(seed = 20260908, count = 14): any {
  const plan = seededSessionPlan(seed, count),
    pending = pendingEvidence();
  const scope = '/apps/groups/groups/test/channel/chat/~zod/source',
    timeOrigin = 1000000;
  const initialRows: Record<string, string> = {};
  for (let i = 0; i < 24; i++)
    initialRows[i === 0 ? '100.000' : `200.${String(i).padStart(3, '0')}`] =
      i === 0
        ? 'Parent text'
        : i === 1
          ? 'A reader stays here.'
          : `Original channel ${i}`;
  const reader = '200.001';
  const backend = (
    rows: Record<string, string>,
    startTime: number,
    endTime: number
  ) => ({
    url: 'http://localhost:3000/~/scry/channels/v5/chat/~zod/source/posts/newest/100/post.json',
    status: 200,
    startTime,
    endTime,
    body: {
      posts: Object.fromEntries(
        Object.entries(rows).map(([id, text]) => [
          id,
          {
            seal: { id: id.replaceAll('.', '') },
            essay: {
              author: text.includes('real remote') ? '~ten' : '~zod',
              content: [{ inline: [text] }],
            },
          },
        ])
      ),
    },
  });
  pending.plan.scopes.channel.route = scope;
  pending.plan.scopes.channel.rows = clone(initialRows);
  pending.plan.scopes.channel.landing = {
    kind: 'anchor',
    rowId: reader,
    top: 100,
    pointTop: 120,
  };
  pending.plan.scopes.thread.route = scope + '/post/~zod/100.000';
  pending.plan.commands[0].trigger = { kind: 'click', text: '18 replies' };
  pending.proof.local!.route = pending.plan.scopes.thread.route;
  for (const s of pending.trace.samples) {
    s.route =
      s.lists[0].kind === 'thread' ? pending.plan.scopes.thread.route : scope;
    const row = s.lists[0].rows[0];
    if (row.id === 'reader') {
      row.id = reader;
      row.body!.text = initialRows[reader];
    }
  }
  pending.trace.events[0].texts = ['18 replies'];
  const session = {
    token: 'one-page',
    sender: {
      timeOrigin: timeOrigin + 100,
      origin: 'http://localhost:3002',
      scope,
      ship: 'ten',
      normalFlags: true,
    },
    timeOrigin,
    origin: 'http://localhost:3000',
    scope,
    normalFlags: true,
    ship: 'zod',
    channel: 'chat/~zod/source',
    headed: false,
    viewport: { width: 1280, height: 800 },
  };
  const proof: any = {
    plan,
    session,
    sessionAfter: {
      timeOrigin,
      scope,
      origin: session.origin,
      viewport: session.viewport,
    },
    senderAfter: {
      timeOrigin: timeOrigin + 100,
      origin: 'http://localhost:3002',
      scope,
      ship: 'ten',
      normalFlags: true,
    },
    initialRows,
    initialBackend: backend(initialRows, -200, -100),
    pending: pending.proof,
    pendingPlan: pending.plan,
    pendingEnd: 2400,
    ledger: [],
    blocks: [],
    errors: [],
    deliveries: { events: [], errors: [] },
    wheels: [],
  };
  const trace = clone(pending.trace);
  trace.samples = trace.samples.filter((s) => s.time <= 2400);
  trace.end = 2400;
  proof.trace = trace;
  const actionEntry = (action: any, start: number, end: number): any => ({
    action: clone(action),
    start,
    end,
    scope: action.kind === 'back' ? pending.plan.scopes.thread.route : scope,
    timeOrigin,
    sessionToken: session.token,
  });
  proof.ledger.push(
    actionEntry(plan.actions[0], 240, 600),
    actionEntry(plan.actions[1], 690, 2450)
  );
  const event = (entry: any, type: string, at: number, extra: any = {}) => {
    const e = {
      type,
      time: at,
      observedAt: at,
      trusted: true,
      timeOrigin,
      scope: entry.scope,
      ...extra,
    };
    proof.deliveries.events.push(e);
    if (type === 'wheel') proof.wheels.push(e);
    if (type === 'click' && entry.action.kind !== 'open-thread')
      trace.events.push({
        time: at,
        observedAt: at,
        kind: 'click',
        trusted: true,
        texts: [],
        testIds: [extra.testId],
      });
    return e;
  };
  event(proof.ledger[0], 'click', 250);
  event(proof.ledger[1], 'popstate', 700);
  const allRows = { ...initialRows };
  let t = 2500,
    idCounter = 900000;
  for (const [index, kind] of plan.blocks.entries()) {
    const block: any = { index };
    proof.blocks.push(block);
    const entries: any[] = [];
    for (const action of plan.actions.filter((a) => a.block === index)) {
      if (action.kind === 'latest') t += 1010;
      const duration = (
        {
          wheel: 200,
          grow: 400,
          'remote-send': 400,
          'select-all': 180,
          delete: 1320,
          'presence-show': 300,
          'presence-clear': kind.clearFirst ? 2200 : 300,
          latest: 1000,
          'own-send': 400,
        } as any
      )[action.kind];
      const entry = actionEntry(action, t, t + duration);
      entries.push(entry);
      proof.ledger.push(entry);
      t = entry.end + 10;
      if (action.kind === 'wheel')
        event(entry, 'wheel', entry.start + 10, {
          deltaY: action.wheelY,
          inConversation: true,
        });
      if (['grow', 'delete', 'own-send'].includes(action.kind))
        event(entry, 'input', entry.start + 10, {
          testId: 'MessageInput',
          value: action.payload,
        });
      if (action.kind === 'latest' || action.kind === 'own-send')
        event(entry, 'click', entry.start + 20, {
          testId:
            action.kind === 'latest'
              ? 'ScrollToBottomButton'
              : 'MessageInputSendButton',
        });
      if (action.kind === 'remote-send' || action.kind === 'own-send') {
        entry.postId = String(idCounter++).replace(
          /\B(?=(\d{3})+(?!\d))/g,
          '.'
        );
        entry.author = action.kind === 'own-send' ? '~zod' : '~ten';
        entry.wireText = action.payload + ' ';
        entry.channel = session.channel;
        allRows[entry.postId] = entry.wireText;
        entry.request = {
          url: `http://localhost:${action.kind === 'own-send' ? 3000 : 3002}/~/channel/real`,
          method: 'PUT',
          actions: [
            {
              action: 'poke',
              app: 'channels',
              json: {
                channel: {
                  nest: session.channel,
                  action: {
                    post: {
                      add: {
                        author: entry.author,
                        content: [{ inline: [entry.wireText] }],
                      },
                    },
                  },
                },
              },
            },
          ],
          channel: session.channel,
          author: entry.author,
          text: entry.wireText,
          observerTimeOrigin: timeOrigin,
          senderTimeOrigin:
            action.kind === 'own-send' ? timeOrigin : timeOrigin + 100,
          status: 204,
          startTime: entry.start + 15,
          headersTime: entry.start + 100,
        };
        entry.backend = backend(allRows, entry.start + 120, entry.start + 200);
      }
      if (action.kind === 'presence-show' || action.kind === 'presence-clear') {
        const active = action.kind === 'presence-show',
          context = `/channel/${session.channel}`,
          key = { context, ship: '~ten', topic: 'computing' };
        entry.presenceCompleted = entry.start + 100;
        entry.presence = {
          active,
          ship: 'ten',
          channelId: session.channel,
          origin: 'http://localhost:3002',
          observerOrigin: 'http://localhost:3000',
          request: {
            url: 'http://localhost:3002/~/channel/scroller-test',
            status: 204,
            body: [
              {
                action: 'poke',
                app: 'presence',
                ship: 'ten',
                mark: 'presence-action-1',
                json: active
                  ? {
                      set: {
                        key,
                        display: {
                          text: 'Scroll stability computing',
                          blob: JSON.stringify({
                            protocol: 'tlon.computing-status.v1',
                            thinking: true,
                            toolCalls: [],
                          }),
                        },
                      },
                    }
                  : { clear: key },
              },
            ],
          },
          observer: {
            status: 200,
            body: {
              init: { [context]: { computing: active ? { '~ten': {} } : {} } },
            },
          },
        };
        if (!active && kind.clearFirst) block.hiddenAt = entry.start + 2100;
      }
    }
    const latest = entries.find((e) => e.action.kind === 'latest'),
      start = entries[0].start + 150,
      end = latest.start - 10,
      terminal = end - 1000;
    const r = readingEvidence();
    r.contract.scope = scope;
    r.contract.rowId = reader;
    r.contract.coverage = {
      ...r.contract.coverage,
      startTime: start,
      endTime: end,
    };
    r.contract.terminalTime = terminal;
    r.trace.marks = [{ id: 'terminal-ready', time: terminal }];
    r.trace.samples = [];
    for (let time = start; time <= end; time += 20) {
      const s = clone(readingEvidence().trace.samples[0]);
      s.time = time;
      s.scope = scope;
      s.rowId = reader;
      r.trace.samples.push(s);
    }
    if (r.trace.samples.at(-1)!.time < end) {
      const s = clone(r.trace.samples.at(-1)!);
      s.time = end;
      r.trace.samples.push(s);
    }
    block.reading = r.trace;
    block.readingContract = r.contract;
    if (kind.kind === 'input') {
      const grow = entries.find((e) => e.action.kind === 'grow'),
        select = entries.find((e) => e.action.kind === 'select-all'),
        clear = entries.find((e) => e.action.kind === 'delete');
      const actions = [grow, select, clear].map((e, i) => ({
        id: ['input-1', 'select-all-1', 'input-2'][i],
        kind: i === 1 ? 'select-all' : 'input',
        payload: e.action.payload,
        scopeKey: scope,
        inputId: 'MessageInput',
      }));
      const times = [grow.start + 10, select.start + 10, clear.start + 10];
      block.inputEnd = clear.start + 1310;
      const raw: any = {
        originalScope: scope,
        declaredAt: grow.start,
        inputId: 'MessageInput',
        paintOwner: { timeOrigin },
        commandPlan: actions,
        dispatches: actions.map((a, i) => ({
          ...a,
          start: times[i] - 5,
          end: times[i] + 5,
        })),
        actions: actions.map((a, i) => ({
          ...a,
          time: times[i],
          observedAt: times[i],
          trusted: true,
        })),
        samples: [],
        keyboard: [
          {
            time: times[1],
            observedAt: times[1],
            key: 'a',
            code: 'KeyA',
            ctrlKey: true,
            metaKey: false,
          },
          {
            time: times[2] - 1,
            observedAt: times[2] - 1,
            key: 'Delete',
            code: 'Delete',
            ctrlKey: false,
            metaKey: false,
          },
        ].map((k) => ({
          ...k,
          scopeKey: scope,
          inputId: 'MessageInput',
          trusted: true,
          targetIsInput: true,
          altKey: false,
          shiftKey: false,
          repeat: false,
        })),
      };
      for (let time = grow.start; time <= block.inputEnd; time += 10) {
        const draft =
          time >= times[0] && time < times[2] ? grow.action.payload : '';
        raw.samples.push({
          time,
          valid: true,
          scopeKey: scope,
          inputId: 'MessageInput',
          draft,
          selection: {
            start: time >= times[1] && time < times[2] ? 0 : draft.length,
            end: draft.length,
          },
          focused: true,
          composing: false,
          caretVisible: null,
          sendVisible: true,
          sendHitTestable: !!draft.length,
        });
      }
      block.input = raw;
    } else {
      const show = entries.find((e) => e.action.kind === 'presence-show'),
        clear = entries.find((e) => e.action.kind === 'presence-clear');
      const semantic: any = {
        scope,
        errors: [],
        samples: [],
        marks: [],
        presence: [],
        chrome: { samples: [], actions: [] },
      };
      for (let time = start; time <= end; time += 10) {
        semantic.samples.push({
          time,
          scope,
          measurement: { valid: true, durationMs: 1 },
          posts: [],
        });
        const text =
          time >= show.start + 50 && time < clear.start + 50
            ? 'Scroll stability computing'
            : kind.clearFirst &&
                time >= clear.start + 50 &&
                time < clear.start + 2050
              ? 'Thinking...'
              : null;
        semantic.chrome.samples.push({
          time,
          scope,
          measurement: { valid: true, durationMs: 1 },
          controls: text
            ? [{ id: 'thinking', scope, kind: text, visible: true, opacity: 1 }]
            : [],
        });
      }
      if (semantic.samples.at(-1).time < end) {
        semantic.samples.push({ ...semantic.samples.at(-1), time: end });
        semantic.chrome.samples.push({
          ...semantic.chrome.samples.at(-1),
          time: end,
        });
      }
      block.semantic = semantic;
    }
  }
  proof.finalBackend = backend(allRows, t, t + 100);
  trace.end = t + 1120;
  const sent = proof.ledger.filter((e: any) => e.postId);
  for (let time = 2420; time <= trace.end; time += 20) {
    const block = proof.blocks.find((b: any) => {
      const actions = proof.ledger.filter(
        (e: any) => e.action.block === b.index
      );
      return (
        time >= actions[0].start &&
        time <
          (proof.ledger.find((e: any) => e.action.block === b.index + 1)
            ?.start ?? Infinity)
      );
    });
    const latest = proof.ledger.find(
      (e: any) => e.action.block === block?.index && e.action.kind === 'latest'
    );
    const follow = latest && time >= latest.start + 40;
    const eligible = sent.filter((e: any) => e.start + 40 <= time),
      newest = eligible.at(-1)?.postId ?? Object.keys(initialRows).at(-1);
    const id = follow ? newest : reader,
      text = allRows[id];
    trace.samples.push({
      time,
      durationMs: 1,
      route: scope,
      documentVisible: true,
      loadingCount: 0,
      unattributedBodies: 0,
      lists: [
        {
          identity: 1,
          kind: 'channel',
          exposed: true,
          height: 500,
          bottomGap: follow ? 0 : 1000,
          rows: [
            {
              id,
              top: follow ? 450 : 100,
              bottom: follow ? 500 : 150,
              exposed: true,
              body: {
                count: 1,
                text,
                exposed: true,
                pointTop: follow ? 460 : 120,
              },
            },
          ],
        },
      ],
    });
  }
  return proof;
}

// A coherent actual-shaped translation, including glyph/hit geometry. Changing
// only relativeY would instead be unavailable coordinate provenance.
export function moveSeededReadingSample(sample: any, dy = 2) {
  const move = (p: any) => {
    for (const r of [p.rect, p.clip]) {
      r.top += dy;
      r.bottom += dy;
    }
  };
  for (const p of [sample.row, sample.block]) move(p);
  for (const f of [
    ...sample.nodes.flatMap((n: any) => n.fragments),
    sample.point.fragment,
  ]) {
    move(f.presentation);
    for (const hit of f.hits) hit.y += dy;
  }
  sample.point.relativeY += dy;
}
