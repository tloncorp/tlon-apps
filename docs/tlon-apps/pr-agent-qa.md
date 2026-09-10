# PR simulator QA

`apps/tlon-mobile/.eas/workflows/pr-agent-qa-ios.yml` runs entirely on EAS:
the iOS build, simulator, Maestro bootstrap, and model loop all run in the cloud.
No desktop Codex task, local Metro, or developer Mac is needed.

## Run on a PR

Add the `qa` label to a non-draft PR from this repository. New commits on labeled
PRs rerun QA and cancel the previous same-branch workflow. The workflow must be
present on the PR branch, and the EAS project must be connected to GitHub.
Fork PRs are excluded from credentialed testing.

The job builds the PR using the existing `e2e` simulator profile, then rejects
any mismatch between the PR head, EAS build commit, and checked-out source. It
uses the EAS preview environment's `MAESTRO_EMAIL`, `MAESTRO_PASSWORD`, and
`OPENROUTER_API_KEY`, plus `MAESTRO_TEST_SHIP` for the account's expected ship.
Login must reach Home and the matching own-profile identity before
the agent can act.

The harness checks OpenRouter authentication before starting the simulator.
If it reports HTTP 401 or 403, replace `OPENROUTER_API_KEY` in the EAS project's
preview environment. Do not put API keys or login credentials in the repository.

The existing artifact is copied before installation. Only the copy's Expo.plist
is changed to disable OTA updates, then signed ad hoc for the simulator. This
keeps the embedded JavaScript under test fixed. Original and installed bundle
hashes, build ID, source commit, simulator UDID, and OS are recorded in report.json.

The agent receives the PR title, description, and mobile source diff. It can
inspect accessibility, tap, fill, scroll, go back, and view screenshots. It has
no shell, filesystem, or credential tool. Credentials stay in the scripted
Maestro bootstrap; bootstrap recordings are excluded from uploaded evidence.

For each check, the report records expected and observed behavior plus evidence
IDs. A failed login, unavailable model, oversized diff, or unfinished check is
blocked. A simulator run does not qualify push delivery, physical-device
performance, or production release behavior. Reports are advisory, not merge
gates. Failed and blocked results fail the QA job after saving its evidence;
the separate reporting job still posts the result.

## Limits and test data

The model loop is capped at 12 minutes, 40 requests, 100 tool calls, and a $3
model budget (a conservative next-request reserve uses current model pricing).
The harness has a 25-minute watchdog. EAS build/runner charges are separate.
The model defaults to `openai/gpt-5.4-mini` through OpenRouter.

The first version shares the existing isolated test ship. It permits inspection
and content creation in a new private `QA-agent-BUILD_ID` group only. The agent
must not change account/profile/theme settings, send DMs, invite anyone, or
modify existing groups. Checks needing those actions are blocked until a pool
of dedicated accounts or an account lease is added. EAS currently only cancels
same-branch runs; a custom concurrency group does not serialize all PRs.

## Validate the harness without a native build

Use an existing simulator build and copy its complete `gitCommitHash` from
`eas build:view BUILD_ID --json`. This mode clearly reports **Harness validation
only** and never comments on a PR or claims to test the harness commit's app.
Run from `apps/tlon-mobile`, using a pushed ref containing the workflow:

```sh
npx --yes eas-cli@23.2.0 workflow:run .eas/workflows/pr-agent-qa-ios.yml \
  --ref YOUR_PUSHED_REF --non-interactive \
  -F build_id=BUILD_ID -F build_sha=FULL_BUILD_COMMIT -F app_id=io.tlon.groups
```

The manual SHA is operator-supplied; verify it against the build record before
dispatch. Automated PR runs use EAS's build output instead. Use `--ref` to avoid
uploading a dirty local checkout. The manual focus can be set with `-F focus=...`.

Manual harness validation may relaunch once if fresh login reaches the app's
error boundary. The original failure remains in the artifacts and report, and
the account identity must still match before the agent starts. PR verification
does not use this recovery: a bootstrap failure blocks the PR test.

## Evidence and maintenance

Each run retains `ios-agent-qa`: screenshots, accessibility/action evidence,
model responses, bundle provenance, and Markdown/JSON reports. The PR comment
links to the EAS run's artifacts. No public screenshot bucket is required.
Treat artifacts as test-account data. Deterministic bootstrap comes from the
same login and identity-check pattern as `.maestro/reliability`, but is separate
so changes to that exploratory suite do not implicitly change the QA harness.

Run `node --test scripts/agent-qa/core.test.mjs` and, from `apps/tlon-mobile`,
`npx --yes eas-cli@23.2.0 workflow:validate .eas/workflows/pr-agent-qa-ios.yml
--non-interactive` after harness changes. Validate tool changes remotely against
an existing build. Native build reuse/repack and Android are follow-ups; this
version intentionally builds the app for each labeled PR revision.
