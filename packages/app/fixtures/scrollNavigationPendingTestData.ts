import type {
  NavigationPendingProof,
  ScrollNavigationPlan,
  ScrollNavigationTrace,
} from './scrollNavigationTrace';

export function evidence(kind: NavigationPendingProof['kind'] = 'reply-sync') {
  const parentId = '100.000';
  const expectedRows = Object.fromEntries(
    Array.from({ length: 19 }, (_, i) => [
      `100.${String(i).padStart(3, '0')}`,
      i ? `Reply ${i}` : 'Parent text',
    ])
  );
  const body = {
    seal: {
      id: '100000',
      replies: Object.fromEntries(
        Object.entries(expectedRows)
          .slice(1)
          .map(([id, text]) => [
            id,
            {
              seal: { id: id.replace('.', ''), 'parent-id': '100000' },
              'reply-essay': { author: '~zod', content: [{ inline: [text] }] },
            },
          ])
      ),
    },
    essay: { author: '~zod', content: [{ inline: ['Parent text'] }] },
  };
  const plan: ScrollNavigationPlan = {
    version: 1,
    declaredAt: -5,
    initial: 'channel',
    scopes: {
      channel: {
        route: '/channel/reader',
        kind: 'channel',
        rows: { reader: 'Reader text' },
        landing: { kind: 'anchor', rowId: 'reader', top: 100, pointTop: 120 },
      },
      thread: {
        route: '/channel/source/thread',
        kind: 'thread',
        rows:
          kind === 'reply-sync' ? { [parentId]: 'Parent text' } : expectedRows,
        landing: {
          kind: 'bottom',
          newestId: kind === 'reply-sync' ? parentId : '100.018',
        },
      },
    },
    commands: [
      {
        id: 'open-thread',
        from: 'channel',
        to: 'thread',
        trigger: { kind: 'click', text: 'target' },
      },
      {
        id: 'return-channel',
        from: 'thread',
        to: 'channel',
        trigger: { kind: 'popstate' },
        ...(kind === 'reply-sync'
          ? { cancelsPending: 'open-thread' }
          : { cancels: 'open-thread' }),
      },
    ],
    maxGapMs: 100,
    maxMeasurementMs: 32,
    maxOutgoingMs: 250,
    completionMs: 1000,
    quietTailMs: 1000,
    tolerancePx: 1,
  };
  const trace: ScrollNavigationTrace = {
    start: 0,
    end: 3500,
    errors: [],
    commands: [
      { id: 'open-thread', start: 240, end: 260 },
      { id: 'return-channel', start: 690, end: 710 },
    ],
    events: [
      {
        time: 250,
        observedAt: 250,
        kind: 'click',
        trusted: true,
        texts: ['target'],
        testIds: [],
      },
      {
        time: 700,
        observedAt: 700,
        kind: 'popstate',
        trusted: true,
        texts: [],
        testIds: [],
      },
    ],
    samples: Array.from({ length: 176 }, (_, i) => {
      const time = i * 20,
        thread = time >= 300 && time < 740;
      return {
        time,
        durationMs: 1,
        route: plan.scopes[thread ? 'thread' : 'channel'].route,
        documentVisible: true,
        unattributedBodies: 0,
        loadingCount: thread && kind === 'missing-parent' ? 1 : 0,
        lists:
          thread && kind === 'missing-parent'
            ? []
            : [
                {
                  identity: thread ? 2 : 1,
                  kind: thread ? 'thread' : 'channel',
                  exposed: true,
                  height: 500,
                  bottomGap: thread ? 0 : 1000,
                  rows: [
                    {
                      id: thread ? parentId : 'reader',
                      top: thread ? 450 : 100,
                      bottom: thread ? 500 : 150,
                      exposed: true,
                      body: {
                        count: 1,
                        text: thread ? 'Parent text' : 'Reader text',
                        exposed: true,
                        pointTop: thread ? 460 : 120,
                      },
                    },
                  ],
                },
              ],
      };
    }),
  };
  const proof: NavigationPendingProof = {
    version: 1,
    kind,
    sourceChannel: 'chat/~zod/source',
    parentId,
    expectedRows,
    backend: {
      url: 'http://localhost:3000/~/scry/channels/v5/chat/~zod/source/posts/post/100.000.json',
      method: 'GET',
      status: 200,
      requestedAt: 1000,
      completedAt: 1100,
      body,
    },
    freshContext: { storage: 'cookies-and-localStorage-only', createdAt: 1200 },
    before: {
      time: -10,
      parentQueryPresent: false,
      threadQueryPresent: false,
      ...(kind === 'missing-parent'
        ? { reference: { id: '100.007', parentId, text: 'Reply 7' } }
        : {}),
    },
    ...(kind === 'missing-parent' ? { referenceReplyId: '100.007' } : {}),
    local: {
      time: 500,
      route: plan.scopes.thread.route,
      parent: {
        status: 'success',
        fetching: 'idle',
        id: kind === 'reply-sync' ? parentId : null,
        text: kind === 'reply-sync' ? 'Parent text' : null,
        replyCount: kind === 'reply-sync' ? 18 : null,
      },
      thread:
        kind === 'reply-sync'
          ? { status: 'success', fetching: 'idle', ids: [] }
          : null,
    },
    requests: [
      {
        url: 'http://localhost:3000/~/scry/channels/v5/chat/~zod/source/posts/post/100.000.json',
        method: 'GET',
        interceptedAt: 1500,
        interceptedTime: 270,
        releasedAt: 2000,
        releasedTime: 1000,
        completedAt: 2200,
        completedTime: 1200,
        responseStatus: 200,
        responseBody: structuredClone(body),
      },
    ],
  };
  return { trace, plan, proof, backendBody: body };
}
