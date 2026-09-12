// All publishers share one comment. Upload assets before changing the visible report.
import { writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

export const repo = 'tloncorp/tlon-apps';
const runPattern =
  /https:\/\/expo\.dev\/accounts\/tlon\/projects\/groups\/workflows\/([a-f0-9-]{36})/;
const statePattern = /<!-- ios-agent-qa-state:([A-Za-z0-9+/=]+) -->/;
export const markerFor = (pr) => `<!-- ios-agent-qa:pr-${pr} -->`;

function runTime(url) {
  const id = url?.match(runPattern)?.[1];
  // EAS workflow IDs are UUIDv7; use creation time, not publication completion time.
  return id?.[14] === '7'
    ? parseInt(id.replaceAll('-', '').slice(0, 12), 16)
    : 0;
}
function readState(comment) {
  const encoded = comment.body.match(statePattern)?.[1];
  if (encoded) return JSON.parse(Buffer.from(encoded, 'base64').toString());
  const url = comment.body.match(runPattern)?.[0];
  return {
    current: {
      url,
      head:
        comment.body.match(
          /(?:Requested commit|PR head|Source head)[^a-f0-9]*([a-f0-9]{40})/i
        )?.[1] || '',
      key: `legacy-${comment.id}`,
      kind: comment.body.includes('ios-agent-qa-presentation:')
        ? 'report'
        : 'blocked',
      time: runTime(url) || Date.parse(comment.created_at),
    },
    history: [],
  };
}
export function planComment({ comments, viewerId, pr, head, attempt }) {
  const marker = markerFor(pr);
  const owned = comments.filter(
    (c) =>
      c.user.id === viewerId &&
      (c.body.includes(marker) ||
        /<!-- ios-agent-qa(?:-presentation)?:[a-f0-9-]{36}(?::[a-f0-9]{40})? -->/.test(
          c.body
        ) ||
        (c.body.startsWith('## iOS agent QA\n') &&
          runPattern.test(c.body) &&
          /Requested commit `[a-f0-9]{40}`/.test(c.body)))
  );
  const canonical = owned.find((c) => c.body.includes(marker)) || owned.at(-1);
  const state = canonical ? readState(canonical) : { history: [] };
  const incoming = { ...attempt, time: runTime(attempt.url) || attempt.time };
  const previous = state.current;
  const stale =
    previous &&
    (incoming.time < previous.time ||
      (previous.head === head && incoming.head !== head) ||
      (incoming.url === previous.url &&
        previous.kind === 'report' &&
        incoming.kind === 'blocked'));
  const history = [
    ...state.history,
    ...owned
      .filter((c) => c.id !== canonical?.id)
      .flatMap((c) => {
        const old = readState(c);
        return [...old.history, old.current];
      }),
    ...(previous && previous.url !== incoming.url
      ? [stale ? incoming : previous]
      : []),
  ];
  const current = stale ? previous : incoming;
  const unique = [
    ...new Map(
      history
        .filter((a) => a.url && a.url !== current.url)
        .map((a) => [a.url, a])
    ).values(),
  ]
    .sort((a, b) => b.time - a.time)
    .slice(0, 10);
  return {
    marker,
    canonical,
    duplicates: owned.filter((c) => c.id !== canonical?.id),
    state: { current, history: unique },
    stale: Boolean(stale),
    unchanged:
      previous?.key === incoming.key && previous?.kind === incoming.kind,
  };
}
export function renderComment(plan, report) {
  const history = plan.state.history;
  return [
    plan.marker,
    `<!-- ios-agent-qa-state:${Buffer.from(JSON.stringify(plan.state)).toString('base64')} -->`,
    report
      .split('\n<!-- ios-agent-qa-history -->')[0]
      .replace(/<!-- ios-agent-qa[^\n]* -->\n?/g, '')
      .trim(),
    ...(history.length
      ? [
          '\n<!-- ios-agent-qa-history -->',
          '<details>',
          '<summary>Earlier QA attempts</summary>',
          '',
          ...history.map(
            (a) =>
              `- [${a.kind === 'blocked' ? 'Incomplete attempt' : 'QA report'} · ${new Date(a.time).toISOString()}](${a.url})${a.head ? ` · commit \`${a.head.slice(0, 10)}\`` : ''}`
          ),
          '',
          '</details>',
        ]
      : []),
    '',
  ].join('\n');
}

export function publishComment({
  gh,
  pr,
  body,
  attempt,
  attachments = [],
  directory,
}) {
  if (
    !/^[1-9][0-9]*$/.test(String(pr)) ||
    !runPattern.test(attempt.url || '') ||
    !attempt.key
  )
    throw new Error('Missing publication provenance');
  const target = JSON.parse(gh(['api', `repos/${repo}/pulls/${pr}`]));
  if (
    target.head.repo?.full_name !== repo ||
    target.base.repo?.full_name !== repo
  )
    throw new Error('Expected a same-repository PR');
  const viewer = JSON.parse(gh(['api', 'user']));
  const list = () =>
    JSON.parse(
      gh([
        'api',
        '--paginate',
        '--slurp',
        `repos/${repo}/issues/${pr}/comments?per_page=100`,
      ])
    ).flat();
  const planning = () =>
    planComment({
      comments: list(),
      viewerId: viewer.id,
      pr,
      head: target.head.sha,
      attempt,
    });
  let plan = planning();
  if (!plan.stale && !plan.unchanged) {
    for (const attachment of attachments) {
      const file = path.resolve(directory, attachment);
      if (
        !file.endsWith('.mp4') ||
        !statSync(file).isFile() ||
        statSync(file).size > 100 * 1024 * 1024 ||
        !statSync(file).size
      )
        throw new Error('Invalid video attachment');
      // Same endpoint/protocol as gh 2.99 --attach, allowing exact comment-ID updates.
      const query = new URLSearchParams({
        name: path.basename(file),
        content_type: 'video/mp4',
        repository_id: String(target.base.repo.id),
      });
      const asset = JSON.parse(
        gh([
          'api',
          '--method',
          'POST',
          `https://uploads.github.com/user-attachments/assets?${query}`,
          '-H',
          'Content-Type: application/octet-stream',
          '--input',
          file,
        ])
      );
      if (
        !/^https:\/\/github\.com\/user-attachments\/assets\/[a-f0-9-]+$/.test(
          asset.url
        )
      )
        throw new Error('Invalid GitHub video URL');
      const ref = `./${path.basename(file)}`;
      const pattern = new RegExp(
        `!?\\[[^\\]\\n]*\\]\\(${ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`,
        'g'
      );
      if (pattern.test(body)) body = body.replace(pattern, asset.url);
      else body += `\n\n${asset.url}\n`;
    }
    // Another publisher may have finished while uploads were in progress.
    plan = planning();
  }
  if (plan.stale || plan.unchanged) body = plan.canonical.body;
  const payload = path.join(directory, 'comment-payload.json');
  writeFileSync(payload, JSON.stringify({ body: renderComment(plan, body) }));
  const endpoint = plan.canonical
    ? `repos/${repo}/issues/comments/${plan.canonical.id}`
    : `repos/${repo}/issues/${pr}/comments`;
  const published = JSON.parse(
    gh([
      'api',
      '--method',
      plan.canonical ? 'PATCH' : 'POST',
      endpoint,
      '--input',
      payload,
    ])
  );
  const rendered = JSON.parse(
    gh([
      'api',
      '-H',
      'Accept: application/vnd.github.full+json',
      `repos/${repo}/issues/comments/${published.id}`,
    ])
  );
  const expectedPlayers = (
    body.match(
      /^https:\/\/github\.com\/user-attachments\/assets\/[a-f0-9-]+$/gm
    ) || []
  ).length;
  const players = (rendered.body_html?.match(/<video\b/g) || []).length;
  if (players !== expectedPlayers || /\]\(\.\/[^)]*\.mp4\)/.test(rendered.body))
    throw new Error('GitHub did not embed every recording');
  // Consolidate only recognized QA comments by this publisher, after replacement succeeds.
  for (const duplicate of plan.duplicates)
    gh([
      'api',
      '--method',
      'DELETE',
      `repos/${repo}/issues/comments/${duplicate.id}`,
    ]);
  return { ...rendered, players, superseded: plan.stale };
}
