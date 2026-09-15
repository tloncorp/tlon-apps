import { randomUUID } from 'node:crypto';

// Creating a Git ref is atomic across workers. Do not expire/steal a lock:
// a paused owner could otherwise resume and overwrite the next owner's report.
export function withCommentLock(
  { gh, repo, pr, head, url },
  publish,
  {
    now = Date.now,
    pause = () =>
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000),
    timeout = 300_000,
  } = {}
) {
  const name = `ios-agent-qa-lock-pr-${pr}`;
  const endpoint = `repos/${repo}/git/refs/tags/${name}`;
  const read = () =>
    JSON.parse(gh(['api', `repos/${repo}/git/ref/tags/${name}`]));
  const tag = JSON.parse(
    gh([
      'api',
      '--method',
      'POST',
      `repos/${repo}/git/tags`,
      '-f',
      `tag=${name}`,
      '-f',
      `message=${url}\nOwner: ${randomUUID()}`,
      '-f',
      `object=${head}`,
      '-f',
      'type=commit',
    ])
  );
  const deadline = now() + timeout;
  while (true) {
    try {
      gh([
        'api',
        '--method',
        'POST',
        `repos/${repo}/git/refs`,
        '-f',
        `ref=refs/tags/${name}`,
        '-f',
        `sha=${tag.sha}`,
      ]);
      break;
    } catch (error) {
      let owner;
      try {
        owner = read().object.sha;
      } catch {
        throw error;
      }
      // The server may have created our ref even if the response was lost.
      if (owner === tag.sha) break;
      if (now() >= deadline)
        throw new Error(
          `QA publication lock is held: ${name}. Check the owning run before clearing it.`
        );
      pause();
    }
  }
  try {
    return publish();
  } finally {
    let deleting = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      let owner;
      try {
        owner = read().object.sha;
      } catch (error) {
        if (deleting && /HTTP 404/.test(String(error.stderr || error.message)))
          break;
        if (attempt === 2) throw error;
        pause();
        continue;
      }
      if (owner !== tag.sha)
        throw new Error('QA publication lock ownership changed');
      try {
        deleting = true;
        gh(['api', '--method', 'DELETE', endpoint]);
        break;
      } catch (error) {
        if (attempt === 2) throw error;
        pause();
      }
    }
  }
}
