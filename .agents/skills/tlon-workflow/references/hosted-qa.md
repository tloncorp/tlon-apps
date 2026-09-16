# Hosted PR QA

Use the same reproduction, platform selection, and evidence rules as steps 4,
6 and 8 of `tlon-workflow`. Those sections and `driving-the-app.md` are read
by the hosted tester directly; do not maintain a separate testing playbook.

Dispatch for an existing ready, same-repository PR:

```sh
gh workflow run mobile-pr-agent-qa.yml --ref develop -f pr_number=<number>
```

Before the workflow lands, use the reviewed QA branch for `--ref` and a
source-verified tooling overlay for `qa_ref`; see
`docs/tlon-apps/pr-agent-qa.md`. Do not use an arbitrary PR's harness with secrets.

The tester plans before allocating devices, then executes that plan with the
official agent-device tools. A separate evidence reviewer examines the recording,
writes findings in plain language, and chooses one complete clip per finding.
Publishing is automatic and edits one canonical comment. `pr-watch.mjs` reports
these as `qa-result`, once per run, head and completed publication state.

Current capability: iOS PR build on EAS, with disposable ships. Android, web,
Cosmos, and a base-build comparison are still unavailable. The planner must apply
the shared skill's selection rules and list required missing coverage explicitly;
it must still execute supported iOS cases. Do not call an observed defect a new
regression solely from the PR recording.

Build selection, ship provisioning and full-session capture belong to CI.
Do not execute the local workflow's fix/commit/review-request/merge/cleanup loop
inside hosted QA. A developer's local ship credentials are not used in CI:
`mobile-login.mjs` accepts `TLON_LOGIN_URL` and `TLON_LOGIN_CODE` for the
disposable login, and the testing agent starts only after login has completed.

Keep runs manual and advisory. A failure or incomplete check does not authorize
an automatic repair cycle or merge.
