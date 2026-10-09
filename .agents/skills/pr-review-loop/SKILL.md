---
name: pr-review-loop
description: Use after opening or marking ready a pull request in tlon-apps, to follow its review to the end without a human relaying comments -- wait for each Codex/CI/human review round, triage findings ruthlessly, fix what matters, reply to the rest, push, and repeat until the PR is clean, then hand it to a human reviewer. Works for any PR (desk, packages, apps), not only mobile.
---

# PR review loop

The agent that wrote the change follows its review. It has the context, the
local checkouts (urbit, vere, a dev ship) and the tests; the person who started
it should only see the PR again when it is clean or when a decision is theirs.

Everything runs from the repository root. The watcher is shared with the
`tlon-workflow` skill:

```bash
node <repo>/.agents/skills/tlon-workflow/pr-watch.mjs <number>
```

Run it unsandboxed (sandboxed, `gh` cannot reach the repository), in the
foreground, with the longest timeout your shell tool allows. If the call times
out before printing and the harness moved it to the background, wait on that
run instead of starting a second; two watchers share one seen-state file. A
killed run can be started again, since it keeps what it already reported.

## What the watcher prints

One run is one round. It blocks until the PR gets a review, review comment, or
comment from Codex (`chatgpt-codex-connector[bot]`) or someone with write
access, keeps collecting until Codex's status for the head commit and the CI
result are in, prints one JSON line per item, and exits:

- review items: `kind` (`review_comment`, `review`, `comment`), `author`,
  `path`, `line`, `url`, `body`, `commentId`, and `replyTo` for thread replies;
- `{"kind":"codex-status","headSha":...,"findings":<n>}` when Codex finishes
  the head commit. `findings: 0` means nothing *new* on that commit, not clean;
- `{"kind":"ci","status":"failure","failed":[{name,url}]}` or
  `{"kind":"ci","status":"success"}` once every check on the head has passed;
- `{"kind":"closed","merged":...}` and `{"kind":"timeout"}` (no activity by
  anyone for `--timeout` seconds, default 1800).

Codex only reviews ready (non-draft) pull requests, and reviews every push.

## Each round

1. **Collect** the round's items. Keep a running list of every thread printed
   so far and what you did with it.
2. **Triage all of them before touching code.** For each finding decide:
   - *Is it reachable?* Trace it against the real code path and the other
     side's real contract (the desk's marks and scries, the db schema, the
     platform split). Name the concrete input or sequence that triggers it. If
     you cannot, it is not a bug. A bot's P1 label is not evidence.
   - *Does it misread the architecture?* Check it against the `AGENTS.md`
     files that cover the changed paths. A finding that contradicts one is
     declined with a pointer to the rule.
   - *Is it one root cause?* Several findings that each say "one of N sibling
     branches missed a step" mean the structure is wrong; fix the structure
     once.
   - **Verdict:** fix, or decline with a one-line reason. Default to declining.
     Fix what is realistically reachable and worth the code it costs.
3. **Fix by removing the problem.** Delete the branch, collapse duplicate arms,
   make the invariant structural, narrow what the code accepts. Do not add
   guards, retries, flags or special cases for a hypothetical. If the only fix
   is a pile of complexity for an unlikely case, decline it. Keep adjacent bugs
   and other consumers out of this PR; note them in your report.
4. **Validate** what you changed the way the touched area's `AGENTS.md` says
   (tests, `pnpm -r tsc`, `pnpm format`; for `desk/`, the ship build and
   agent tests). Never push a desk change you have not compiled.
5. **Reply in every thread.** End every reply and comment with the line
   `<!-- tlon-workflow:agent -->`; it is how the watcher tells your replies
   from a reviewer's (they often share one GitHub account).
   - `review_comment`:
     `gh api repos/tloncorp/tlon-apps/pulls/<number>/comments/<root>/replies -f body=...`,
     where `<root>` is `replyTo` when set and `commentId` otherwise (GitHub only
     accepts replies to a thread's first comment).
   - `review` or `comment`: `gh pr comment <number> --body ...`.
   - Fixed: say what changed and where, one sentence, then resolve the thread.
     Declined: give the reason and leave the thread open for the reviewer.
     Post a reply and confirm it landed before resolving anything.
6. **Push once** for the whole round, then run the watcher again.

Resolve a thread with:

```bash
gh api graphql -f query='mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}' -f id=<thread node id>
```

(thread node ids come from `gh api graphql` `pullRequest.reviewThreads`).

A failed check is an item like any other: `gh run view --job <job id>
--log-failed` (the job id is the last path segment of its url). A failure in
code you did not touch is rerun once (`gh run rerun <run id> --failed`); if it
fails again, report it rather than fixing unrelated code.

## When to stop

Stop and report when any of these holds:

- **Clean:** every thread on your list has a reply from you, the head commit
  has `ci: success` (every check, including workflows for packages you did not
  touch; a running check counts as activity), and its `codex-status` has arrived with nothing
  unanswered.
- **Merged or closed.**
- **Timeout.**
- **Three rounds** in which you pushed fixes. More usually means Codex and the
  code are trading edge cases; a human should look.
- **The decision is not yours:** a finding that disputes the design or the
  task's scope, a product question, a human reviewer requesting changes you
  disagree with, or a desk change you cannot validate on a ship. Reply in the
  thread that you are escalating, and stop.

## Then hand it to a human

Once CI is green and every thread has an answer (and also on timeout), request
a reviewer. There is no `CODEOWNERS`; pick who maintains the files the change
actually lives in, weighting the file you changed over fixtures or tests you
touched:

```bash
git log --since='12 months ago' --format='%an' -- <changed path> | grep -v '\[bot\]' | sort | uniq -c | sort -rn
gh api "repos/tloncorp/tlon-apps/commits/<sha>" --jq '.author.login'   # name -> login
gh api "repos/tloncorp/tlon-apps/collaborators/<login>/permission" --jq '.permission'
gh pr edit <number> --add-reviewer <login>
```

Tag the top one or two whose permission is `admin`, `maintain` or `write`.
`read` means the person left or never had access; a 404 means you mis-mapped
the name. Do not tag the PR's author.

## Report

Per round, briefly: what was fixed and how it simplified the code (with the
commit), what was declined and why (one line each), anything escalated, and
any root cause that looks architectural and worth discussing. At the end: the
final state (clean, escalated, timed out) and who you tagged.
