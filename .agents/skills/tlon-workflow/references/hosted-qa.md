# Hosted PR review

This bot explores an implemented PR as a reviewer. It reads
[reviewer guidance](pr-reviewer.md) and the shared [navigation notes](driving-the-app.md),
not the author's before/after acceptance workflow. It creates ordinary test data
through the app on a disposable ship, investigates suspicious behavior, and reports
what it observed with video. Base recordings are not required.

Dispatch for a ready, trusted same-repository PR:

```sh
gh workflow run mobile-pr-agent-qa.yml --ref develop -f pr_number=<number>
```

Before landing, use the reviewed QA branch and a source-verified tooling overlay;
see `docs/tlon-apps/pr-agent-qa.md` for setup and the trusted-code boundary.

The planning phase chooses useful starting paths. The device reviewer can explore
beyond them. One independent evidence reviewer checks the recording and selects
one complete clip per finding. Publishing updates a single PR comment automatically.
There is no extra code reviewer, editor or automatic fix/merge loop here.

Current scope is the implemented iOS PR build. Other platforms and the base build
are outside scope. A completed run may find bugs and leave paths unexplored; those
are separate from infrastructure failure. The report states all three clearly.

If you requested a hosted run, wait for that exact EAS run before handing the PR to
a human:

```sh
node .agents/skills/tlon-workflow/pr-watch.mjs <pr> --qa-run <EAS-workflow-UUID>
```

The watcher still handles normal review/CI events. `--qa-run` waits within its
`--timeout` budget, ends the wait if the PR head changes, and never dispatches or
retries QA. Without it, the watcher only surfaces already-published QA results.
Read a result once and handle verified findings in the current review round.

CI owns build selection, disposable ships, shared login and full-session capture.
The login helper accepts runtime disposable credentials; developer credentials
are not used. The optional peer helper supplies cross-ship state when needed.
Keep this review manual and advisory; completion is not merge approval.
