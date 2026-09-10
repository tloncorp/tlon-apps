# PR simulator QA

`apps/tlon-mobile/.eas/workflows/pr-agent-qa-ios.yml` runs entirely on EAS:
the iOS build, simulator, Maestro bootstrap, and Codex CLI with Argent all run in the cloud.
No desktop Codex task, local Metro, or developer Mac is needed.

## Run on a PR

Opening a non-draft PR from this repository, marking it ready, reopening it, or
pushing a new commit starts a Linux assessment job. No `qa` label is needed.
New commits cancel the previous same-branch workflow. The workflow must be
present on the PR branch, and the EAS project must be connected to GitHub.
Fork PRs are excluded from credentialed testing.

Codex + Sol first reads the PR title, description, complete changed-file list,
and diff. It classifies the PR as `test`, `skip`, or `blocked`. It considers
behavior changes as well as visible UI: error handling, copy, assets, data and
backend changes can be user-facing. Only a supported conclusion that no
user-facing behavior changes exist can skip the build and simulator. Missing
context, large diffs, unsupported platforms and missing fixtures are blocked,
not silently skipped. The assessment is saved as `pr-qa-assessment`.

A `test` assessment includes up to eight scenarios identifying changed files,
concrete actions, expected results and prerequisites. The simulator agent must
account for every scenario by its ID in its findings. A generic successful
login or Home smoke cannot satisfy this coverage requirement. A `skip` or
`blocked` assessment posts its reason without starting a native build or simulator.

The job builds only assessed PRs using the existing `e2e` simulator profile, then rejects
any mismatch between the assessed base/head, PR head, EAS build commit, and
checked-out source. It
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

Codex CLI 0.145.0 runs openai/gpt-5.6-sol through OpenRouter at medium reasoning with Argent 0.23.0
through MCP. It receives the assessment scenarios, PR title, description, and complete source diff.
Its shell tool and web search are disabled, edits are blocked by a read-only
sandbox, and Argent exposes only the selected interaction and inspection tools.
A fresh CODEX_HOME and temporary working directory avoid personal configuration.
The installed Argent interaction skill is included in the task instructions.
The MCP subprocess receives a stripped environment without the API key. Credentials stay in the scripted
Maestro bootstrap; bootstrap recordings are excluded from uploaded evidence.

For each check, the report records expected and observed behavior plus evidence
IDs. A failed login, unavailable model, oversized diff, or unfinished check is
blocked. A simulator run does not qualify push delivery, physical-device
performance, or production release behavior. Reports are advisory, not merge
gates. Failed and blocked results fail the QA job after saving its evidence;
the separate reporting job still posts the result.

## Limits and test data

Codex is capped at nine minutes and 100 MCP tool calls. The wrapper has a
25-minute watchdog. JSONL events, diagnostics, token usage, and the structured
result are saved. Codex does not report dollar cost or per-request usage through
this interface; the old OpenRouter $3 reserve is removed. Use the dedicated
OpenRouter key's spending limit for spend management; these run limits are
not a hard dollar cap. EAS runner/build charges remain separate.

The PR path currently shares the existing test ship and permits navigation and
inspection only. It does not mutate settings, create content, message, invite,
or modify groups. Scenarios requiring those actions are reported blocked with
the missing prerequisite until isolated writable accounts are connected to
this path. The disposable two-ship experiment remains separate. Likewise, the
PR path does not deploy changed backend desks: checks depending on those changes
must be blocked rather than claimed as tested against the old backend. EAS currently only cancels
same-branch runs; a custom concurrency group does not serialize all PRs.

## Validate the harness without a native build

Use an existing simulator build and copy its complete `gitCommitHash` from
`eas build:view BUILD_ID --json`. This mode clearly reports **Harness validation
only** and does not itself comment on a PR or claim to test the harness commit's app.
The separate GitHub publisher can attach its evidence to an explicitly chosen PR.
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
links to the EAS run's artifacts. A separate `ios-agent-qa-video` attachment
contains `test-session.mp4`, and the PR report explicitly points reviewers to it.
The reporting job downloads this MP4 and posts the report using GitHub CLI
2.99.0 `gh pr comment --attach`. GitHub hosts the attachment and renders an
inline video player directly in the PR comment. No public media bucket is required.

Set `GH_QA_TOKEN` as a **secret** in the EAS preview environment. Use a dedicated
QA account's GitHub OAuth token, classic PAT, or fine-grained PAT with write access
to this repository (the `repo` scope for a classic PAT on this private repository).
GitHub's default installation token (`GITHUB_TOKEN`) cannot upload attachments. The reporting job maps it to `GH_TOKEN`; the
device subprocesses and model tools do not receive it. Do not copy a developer's
general GitHub login into EAS without their authorization.

If the upload fails or the credential is missing, the reporting job fails and
EAS's GitHub integration posts the report with an explicit embedding failure
and the backup EAS artifact link. Runs without a video still get a text report.
The automatic embedding path needs this credential even though the existing
EAS integration can already post text comments.

Recording starts only after login, exact account verification, and initial
device inspection. It captures the agent's full test session, including failed
or blocked checks, and stops before device cleanup. Login credentials and the
Maestro bootstrap are not recorded. Setup failures before this point explicitly
report that no video is available.

The harness finalizes the recording in its cleanup path, including on handled
termination, and enforces a separate ten-minute recording cap. It decodes the
whole video, exports H.264 MP4 with fast-start metadata, and verifies duration
against elapsed testing time. Missing or truncated video prevents a passing
result. Abrupt worker loss or forced cancellation can still prevent artifact
upload. FFmpeg/ffprobe are installed on the worker when unavailable.

Treat artifacts as test-account data. Deterministic bootstrap comes from the
same login and identity-check pattern as `.maestro/reliability`, but is separate
so changes to that exploratory suite do not implicitly change the QA harness.

Run `node --test scripts/agent-qa/*.test.mjs` and, from `apps/tlon-mobile`,
`npx --yes eas-cli@23.2.0 workflow:validate .eas/workflows/pr-agent-qa-ios.yml
--non-interactive` after harness changes. Validate tool changes remotely against
an existing build. Native build reuse/repack and Android are follow-ups; this
version builds the app for each revision assessed as needing simulator checks.

## Disposable Blacksmith ships (experiment)

`.github/workflows/agent-ships-proof.yml` prepares two fake ships with Rube on
Blacksmith, then dispatches this EAS workflow against an existing iOS build.
It is a manual harness experiment, not certification of a PR's frontend.
The backend uses the selected GitHub revision; the report records both app and
backend commits separately. Dispatch the action with the destination `pr_number`. Its separate `publish` job
automatically downloads the saved EAS report and MP4, attaches the video to that
PR, and verifies that GitHub rendered a video player. It runs after failed tests
as well as successful ones when an EAS run exists. Setup failures with a report
but no video get an explicit text report. The publish job uses a dedicated
GitHub `GH_QA_TOKEN` secret only in its publishing step; the simulator and model
do not receive it. The EAS metadata/download step uses `EXPO_TOKEN` separately.

To retry only publication, dispatch with the saved `eas_run_id` and destination
`pr_number`. This skips ships and simulator work. A run-specific marker prevents
duplicate comments by the same publisher on retries. Only completed runs from
this EAS project and QA workflow are accepted. The action is manual while this
harness experiment is under review; it has no push trigger.

The backend controller creates one unique group, sends a message from ~ten,
and waits for the exact mobile reply from ~zod. The agent opens the group,
checks the peer message, sends the reply, and checks the live acknowledgment.
A passing EAS result also requires a separate authenticated backend receipt
matching the source revision, fixture, and both ships' desk hashes. Video uses
the existing recording and artifact path.

The EAS host exposes a loopback proxy for the simulator. That proxy adds
`QA_TUNNEL_TOKEN` when connecting to the HTTPS ngrok tunnel; the public backend
proxy rejects requests without it. The app and device tools do not receive the
tunnel token. GitHub and EAS preview require the same secret. GitHub also needs
`MAESTRO_FAKE_SHIP_NGROK_TOKEN` and its existing `EXPO_TOKEN`. Local credentials
are not needed to run a configured job.

Prepared snapshots use the handoff's backend-input cache key and clean shutdown
procedure. Once backend preparation passes, a cold snapshot can be saved even
if the later UI test fails. Each restored copy is reset, and the prior fixture must be absent.
Backend changes require a new snapshot; warm timing does not imply fast cold
compilation. Snapshot compatibility changes require a key-version bump. The
runtime is retained with each snapshot; cold runtime selection remains a
follow-up. The experiment serializes runs and limits the backend lease.

The compatibility proxy still changes the SSE content type for the older app
binary. A current app with the parser fix must be qualified without that shim
before removing it. Automatic PR backend selection, cross-PR parallelism, and
account leasing remain separate follow-ups.

## Codex qualification status

The Codex + Sol + Argent replacement uses the existing `OPENROUTER_API_KEY` in EAS preview.
Codex uses a custom provider with `wire_api = "responses"`; no OpenAI credential is needed.
The two-ship scenario passed on September 10, 2026 with harness/backend commit
`74bba0da7faa4441cc0d64162ee5870441c69f69`. Codex completed 10 Argent calls:
read the peer message, send the mobile reply once, and observe the acknowledgment
live. The separate backend receipt confirmed delivery. The 82.4-second recording
passed a full decode check. [EAS run and artifacts](https://expo.dev/accounts/tlon/projects/groups/workflows/01a08d64-866a-728b-b1d3-8fe09276a6a9).

This qualification reused build `709ad03a-fc06-457a-a0c4-cb7ca437797c`, app source
`f0e37ea6bf92a3e44554caeb96afddea089ba2fa`. It validates the harness, not a new
frontend revision. The GitHub experiment action includes automatic publication using a repository
`GH_QA_TOKEN` secret; the separate EAS-only automatic PR reporting path reads that
name from EAS preview. Configure it in each environment whose workflow you use.

The publisher downloaded this run's report and video on a clean GitHub runner.
The existing `REPO_TOKEN` was rejected with HTTP 401, so automatic upload is not
yet qualified. Add the dedicated `GH_QA_TOKEN` with repository write access and
rerun publication with EAS run `01a08d64-866a-728b-b1d3-8fe09276a6a9` and
PR `6496`; no new simulator run is needed. The default `GITHUB_TOKEN` installation
token cannot replace this upload credential.

Argent boots the CI simulator with accessibility enabled and owns interaction,
screenshots and recording. This existing-build path uses the wrapper's explicit
simulator UDID and verified downloaded artifact for installation; it does not
start Metro or modify a developer's Stim devices. Recording has static trimming
disabled, shows touch markers, and is finalized independently of Codex.

## Assessment-only qualification

Dispatch the EAS workflow with `assessment_pr_json` containing the GitHub API PR
object. It runs the same assessor against those exact base/head commits without
a build, simulator, backend, or PR comment, using the EAS preview OpenRouter
credential. The result is saved as `pr-qa-assessment`. Only the selected harness
scripts execute; the target PR's diff is read as data. This diagnostic mode does
not certify the supplied PR metadata or mark a PR as tested.

The assessor has no shell, web or device tools, an isolated Codex home, a
three-minute limit and a 240,000-character diff budget. Failures become blocked.
