import { isDeepStrictEqual as same } from 'node:util';
import {
  assessScrollNavigationTrace,
  assessPendingNavigationTrace,
} from '../packages/app/fixtures/scrollNavigationTrace.ts';

export const navigationScenarioRegistry = ['journey', 'cancellation'].map(
  (kind) => ({
    scenario: `web-navigation-${kind}`,
    title:
      kind === 'journey'
        ? 'channel to thread and return preserve the first reveal and entire journey'
        : 'immediate Back supersedes thread opening before its first reveal',
    source: 'apps/tlon-web/e2e/scroller-navigation-stability.spec.ts',
    suite: 'Actual continuous channel and thread navigation',
    matrix: ['THR-01', 'THR-02', 'FLK-07'],
    history: [],
    traceNames: [],
    scope: `Actual desktop channel to cached thread and return, continuous exact text and first-visible landing with ${kind === 'cancellation' ? 'strict pre-reveal cancellation qualification' : 'one-second quiet tails'}; normal flags, local ship, Vite assets. Sampled DOM only; presentation, durable reads, uncached loading and native navigation remain incomplete.`,
    evidenceLevel: 'sampled-dom-navigation',
    requireNavigationProof: true,
    navigationKind: kind,
  })
);

navigationScenarioRegistry.push(
  ...['reply-sync', 'missing-parent'].map((kind) => ({
    scenario: `web-navigation-${kind}`,
    title:
      kind === 'reply-sync'
        ? 'Back cancels a real pending reply sync after the cached parent reveals'
        : 'Back cancels a missing-parent reply reference before first thread content',
    source: 'apps/tlon-web/e2e/scroller-navigation-stability.spec.ts',
    suite: 'Actual continuous channel and thread navigation',
    matrix: ['THR-01', 'THR-02', 'FLK-07'],
    history: [],
    traceNames: [],
    scope: `Actual desktop ${kind === 'reply-sync' ? 'cached-parent pending reply sync' : 'missing-parent reply-reference navigation'} canceled during an original held full-thread GET, then released after Back; exact original response and local-query witnesses. Unlabelled blank remains failure. Sampled DOM and request completion only; durable reads, painted frames and native remain incomplete.`,
    evidenceLevel: 'sampled-dom-navigation',
    requireNavigationProof: true,
    navigationKind: kind,
  }))
);

export function navigationAttachmentNames(registry) {
  return [
    'navigation-preparation',
    'navigation-plan',
    'navigation-raw',
    ...(['reply-sync', 'missing-parent'].includes(registry?.navigationKind)
      ? ['navigation-pending']
      : []),
  ];
}

/** Recompute raw evidence. Attached assessments are deliberately never read. */
export function replayWebNavigation(record) {
  const issues = [];
  const reject = (message, kind = 'incomplete') =>
    issues.push({ message: `Navigation: ${message}`, kind });
  const registered = navigationScenarioRegistry.find(
    (item) => item.scenario === record?.scenario
  );
  if (!registered || !same(record.contract, registered)) {
    reject('Missing exact registered scenario contract');
    return issues;
  }
  const get = (name) => {
    const matches = (
      Array.isArray(record.navigationProofs) ? record.navigationProofs : []
    ).filter((item) => item?.name === name);
    return matches.length === 1 && !matches[0].error
      ? matches[0].value
      : undefined;
  };
  const preparation = get('navigation-preparation');
  const plan = get('navigation-plan');
  const raw = get('navigation-raw');
  const pendingKind = ['reply-sync', 'missing-parent'].includes(
    registered.navigationKind
  );
  const pending = pendingKind ? get('navigation-pending') : undefined;
  try {
    if (
      !preparation ||
      !plan ||
      !raw ||
      preparation.origin !== 'http://localhost:3000' ||
      preparation.ship !== 'zod' ||
      preparation.normalFlags !== true ||
      preparation.developmentAssets !== true ||
      preparation.headed !== true ||
      typeof preparation.browser !== 'string' ||
      !preparation.browser.length ||
      !same(preparation.viewport, { width: 1280, height: 800 }) ||
      preparation.declaredAt !== plan.declaredAt ||
      preparation.route !== preparation.channelRoute ||
      preparation.channelRoute !== plan.scopes?.channel?.route ||
      preparation.threadRoute !== plan.scopes?.thread?.route ||
      !same(preparation.channelRows, plan.scopes.channel.rows) ||
      !same(preparation.threadRows, plan.scopes.thread.rows) ||
      Object.keys(preparation.channelRows).length !== 24 ||
      Object.keys(preparation.threadRows).length !==
        (registered.navigationKind === 'reply-sync' ? 1 : 19) ||
      !same(plan.scopes.channel.landing, {
        kind: 'anchor',
        rowId: preparation.baseline?.rowId,
        top: preparation.baseline?.top,
        pointTop: preparation.baseline?.pointTop,
      }) ||
      preparation.baseline?.bottomGap <= 100 ||
      !Number.isFinite(Date.parse(record.attemptStartTime)) ||
      !Number.isFinite(record.attemptDurationMs) ||
      raw.end - raw.start > record.attemptDurationMs ||
      plan.initial !== 'channel' ||
      !same(Object.keys(plan.scopes).sort(), ['channel', 'thread']) ||
      !same(plan.commands, [
        {
          id: 'open-thread',
          from: 'channel',
          to: 'thread',
          trigger: {
            kind: 'click',
            ...(registered.navigationKind === 'missing-parent'
              ? {
                  reference: {
                    rowId: plan.scopes.channel.landing.rowId,
                    text: pending?.expectedRows?.[pending?.referenceReplyId],
                  },
                }
              : { text: '18 replies' }),
          },
        },
        {
          id: 'return-channel',
          from: 'thread',
          to: 'channel',
          trigger: { kind: 'popstate' },
          ...(['cancellation', 'missing-parent'].includes(
            registered.navigationKind
          )
            ? { cancels: 'open-thread' }
            : registered.navigationKind === 'reply-sync'
              ? { cancelsPending: 'open-thread' }
              : {}),
        },
      ])
    )
      reject(
        'Missing or inconsistent actual-app preparation and command declaration'
      );
    const frames = preparation?.frameTimes;
    if (
      !Array.isArray(frames) ||
      frames.length < 40 ||
      frames.at(-1) - frames[0] < 900 ||
      frames.at(-1) > preparation.declaredAt ||
      frames.some(
        (time, index) =>
          !Number.isFinite(time) ||
          (index > 0 &&
            (time <= frames[index - 1] || time - frames[index - 1] > 100))
      )
    )
      reject('Missing bounded visible-page warmup evidence');
    if (pendingKind) {
      if (
        pending?.kind !== registered.navigationKind ||
        !Number.isFinite(pending?.backend?.requestedAt) ||
        pending.backend.requestedAt < Date.parse(record.attemptStartTime) ||
        pending.requests?.some(
          (request) =>
            !Number.isFinite(request.completedAt) ||
            request.completedAt >
              Date.parse(record.attemptStartTime) + record.attemptDurationMs
        )
      )
        reject('Pending transport is not bound to this enclosing attempt');
      const snapshot = preparation.readerBackend;
      const expected = preparation.channelRows;
      const actual = {};
      for (const item of Object.values(snapshot?.body?.posts ?? {})) {
        const id =
          typeof item?.seal?.id === 'string'
            ? item.seal.id
                .replaceAll('.', '')
                .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
            : null;
        const text = item?.essay?.content?.find((verse) => verse.inline)
          ?.inline?.[0];
        if (id && expected[id] !== undefined) actual[id] = text;
      }
      if (
        snapshot?.method !== 'GET' ||
        snapshot.status !== 200 ||
        !same(actual, expected) ||
        !Number.isFinite(snapshot.completedAt) ||
        snapshot.completedAt > pending?.freshContext?.createdAt
      )
        reject('Missing independent committed reader corpus');
      if (registered.navigationKind === 'missing-parent') {
        const anchor = plan.scopes.channel.landing.rowId;
        const item = Object.values(snapshot?.body?.posts ?? {}).find(
          (post) =>
            String(post?.seal?.id).replaceAll('.', '') ===
            anchor.replaceAll('.', '')
        );
        const expectedCitation = {
          chan: {
            nest: pending?.sourceChannel,
            where: `/msg/${pending?.parentId}/${pending?.referenceReplyId}`,
          },
        };
        if (
          !same(item?.essay?.content?.[0]?.block?.cite, expectedCitation) ||
          !same(plan.scopes.channel.textBlocks?.[anchor], [
            pending?.expectedRows?.[pending?.referenceReplyId],
            expected[anchor],
          ])
        )
          reject(
            'Missing exact committed reply-reference target and text blocks'
          );
      }
    }
    const result = pendingKind
      ? assessPendingNavigationTrace(raw, plan, pending)
      : assessScrollNavigationTrace(raw, plan);
    for (const issue of result.issues)
      reject(
        `${issue.code}${issue.sampleIndex === undefined ? '' : ` at sample ${issue.sampleIndex}`}`,
        issue.kind
      );
  } catch {
    reject('Malformed raw evidence');
  }
  return issues;
}
