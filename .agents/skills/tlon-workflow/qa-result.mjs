// Called only after the watcher has established the author's write access.
// QA edits one comment in place; its run/head identify a result, not its comment ID.
export function qaResult(comment) {
  if (!/<!-- ios-agent-qa:pr-\d+ -->/.test(comment.body || ''))
    return undefined;
  const encoded = comment.body.match(
    /<!-- ios-agent-qa-state:([A-Za-z0-9+/=]+) -->/
  )?.[1];
  try {
    const { current } = JSON.parse(
      Buffer.from(encoded || '', 'base64').toString()
    );
    if (
      !/^[a-f0-9]{40}$/.test(current.head) ||
      !/^https:\/\/expo\.dev\/accounts\/tlon\/projects\/groups\/workflows\/[a-f0-9-]{36}$/.test(
        current.url
      ) ||
      !['report', 'blocked'].includes(current.kind)
    )
      return null;
    // Assessment-only publication uses the same fallback envelope as setup
    // failures. Its explicit skip verdict is successful, not incomplete QA.
    const skipped =
      comment.body.includes('**Simulator skipped**') ||
      comment.body.includes(
        '**PR assessment: no user-facing changes — simulator skipped**'
      );
    const outcomeText = comment.body.match(
      /<!-- ios-agent-qa-outcome:(.*?) -->/
    )?.[1];
    const outcome = outcomeText ? JSON.parse(outcomeText) : {};
    return {
      ...outcome,
      kind: 'qa-result',
      id: `qa:${comment.id}:${current.head}:${current.url}:${current.kind}`,
      at: comment.updated_at || comment.created_at,
      author: comment.user.login,
      headSha: current.head,
      status: skipped
        ? 'skipped'
        : current.kind === 'blocked'
          ? 'incomplete'
          : 'reviewed',
      url: comment.html_url,
      runUrl: current.url,
      body: comment.body,
    };
  } catch {
    return null;
  }
}

// A caller opts in to waiting for one exact hosted run, never a new review loop.
export function qaWaitState(runId, items, head, initialHead) {
  if (!runId) return 'none';
  if (head !== initialHead) return 'superseded';
  return items.some(
    (item) =>
      item.kind === 'qa-result' &&
      item.headSha === head &&
      item.runUrl.endsWith(`/${runId}`)
  )
    ? 'received'
    : 'pending';
}
