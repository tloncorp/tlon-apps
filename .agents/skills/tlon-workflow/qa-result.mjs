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
      current.kind === 'blocked' &&
      comment.body.includes(
        '**PR assessment: no user-facing changes — simulator skipped**'
      );
    return {
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
