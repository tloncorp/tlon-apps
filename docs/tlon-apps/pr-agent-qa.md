# PR simulator QA

`.github/workflows/mobile-pr-agent-qa.yml` coordinates assessment, fixture setup and testing.
EAS runs the iOS build, simulator, Maestro bootstrap and Codex CLI with Argent;
Blacksmith hosts disposable ships and selected deterministic tests.
No desktop Codex task, local Metro, or developer Mac is needed.

## Run on a PR

Opening a non-draft PR from this repository, marking it ready, reopening it, or
pushing a new commit starts a Linux assessment job. No `qa` label is needed.
Runs for the same PR are serialized so backend cleanup can finish. The workflow must be
present on the PR branch, and the EAS project must be connected to GitHub.
Fork PRs are excluded from credentialed testing.

Codex + Sol first reads the PR title, description, complete changed-file list,
and diff. It classifies the PR as `test`, `skip`, or `blocked`. It considers
behavior changes as well as visible UI: error handling, copy, assets, data and
backend changes can be user-facing. Only a supported conclusion that no
user-facing behavior changes exist can skip the build and simulator. Missing
context, large diffs and unsupported platforms are blocked. Supported missing
fixtures are created by the runner before testing. The assessment is saved as `pr-qa-assessment`.

A `test` assessment includes up to eight scenarios identifying changed files,
concrete actions, expected results and prerequisites. Each scenario selects a reviewed fixture recipe and either simulator or regression
execution. The report must account for every scenario by its ID and preserve its expected result verbatim
in the findings. A generic successful
login or Home smoke cannot satisfy this coverage requirement. A `skip` or
`blocked` assessment posts its reason without starting a native build or simulator.

The job builds only assessed PRs using the existing `e2e` simulator profile, then rejects
any mismatch between the assessed base/head, PR head, EAS build commit, and
checked-out source. It
uses verified disposable-ship credentials for provisioned fixtures. Navigation-only
runs without fixtures use EAS preview's shared-account credentials. `OPENROUTER_API_KEY`
stays in EAS preview.
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

Provisioned runs use disposable ships and allow writes only within their verified
fixture. Runs without a setup recipe retain the shared account's navigation-only
limits. Unsupported fixtures remain explicit blockers; a generic smoke pass
cannot replace feature coverage.

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

`GH_QA_TOKEN` is now configured in GitHub repository secrets and EAS preview.
The [publication-only action](https://github.com/tloncorp/tlon-apps/actions/runs/34542358655)
downloaded the saved report and MP4, uploaded the native attachment, and verified
GitHub's inline video player in the [automatically posted comment](https://github.com/tloncorp/tlon-apps/pull/6496#issuecomment-5626853536).
The job passed in 36 seconds without starting a simulator or backend. This
qualifies the separate GitHub publisher; full PR-run results are recorded below. The default `GITHUB_TOKEN` installation
token cannot replace the upload credential.

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

The assessment was qualified on EAS against notebook-header PR #6460 at
`063fc5b77286ca2c8359fdf1a244a1f52232767f`: it selected `test` and planned six
specific checks, including headers/actions, permissions, scrolling, preview/edit,
save status and reply deduplication. It identified the write and event-fixture
requirements explicitly. No simulator or native build ran in this qualification.
[EAS assessment run](https://expo.dev/accounts/tlon/projects/groups/workflows/01a08d7f-f0ec-710a-bcf8-6b3b9bc6378f).

The final assessor also classified documentation PR #6242 as `skip`: its internal
engineering bot rubric changes no Tlon end-user product behavior. No native build
or simulator was started.
[EAS skip assessment](https://expo.dev/accounts/tlon/projects/groups/workflows/01a08d84-228a-759f-9258-2780e5a594a3).
These runs qualify assessment and planning only. Full PR-run results follow.

## Full runs before the workflow is merged

For a PR that does not yet contain this workflow, create a temporary QA branch
whose sole commit is a direct child of the exact PR head. Only `scripts/agent-qa/`,
this workflow file and this QA document may differ. Both assessment and simulator
setup verify this boundary from Git objects; any product-file change blocks the
run. The report records the requested PR source alongside the actual build commit.

Dispatch that branch with the GitHub PR JSON in `assessment_pr_json` and
`full_pr_run=true`. EAS verifies the PR metadata against GitHub, assesses the
original diff, builds only when needed, runs the simulator checks and posts the
video or skip/blocked report to the original PR. The original PR branch is not
modified. Merged PRs can be checked historically with the same pinned-source
rules. Regular PR-triggered runs continue to require the exact PR build commit.

For a tooling-only retry, supply the previous `build_id` and `build_sha` with
`full_pr_run=true`. EAS resolves the simulator build by its recorded commit and
checks its ID. The harness independently verifies that both overlay commits are
direct children of the requested PR head and change only QA files. A different
product tree is rejected; no native rebuild is needed for a report-harness fix.

The first full #6460 run built the requested product source, completed fresh
login, exercised read-only notebook scrolling/navigation and automatically
embedded a 164.8-second video. Its report guard rejected an additional generic
smoke finding, hiding the detailed blocked scenarios. The output schema now
restricts findings to assessed IDs and omits the default smoke focus on PR runs.
Editable notes, folders, save timing and event-order fixtures remain unqualified.
[First full run](https://expo.dev/accounts/tlon/projects/groups/workflows/01a08dba-9eb7-756c-8e06-784682632180).

The full #6242 run correctly skipped simulator/build work and automatically posted
the internal-docs-only assessment on the original PR.
[Automatic skip report](https://github.com/tloncorp/tlon-apps/pull/6242#issuecomment-5627093779).

Independent review of the first recording found the agent had visited Getting
Started, which appears to use the legacy notebook UI. The requested PR changes
`notes` channels; a visible title alone does not establish that its native header
code ran. The blocked result must not be presented as successful changed-screen
coverage. A known `notes` fixture with editable notes and folders is still needed.

The [simulator retry](https://expo.dev/accounts/tlon/projects/groups/workflows/01a08dda-da0d-7af3-80c9-6125ed77c412)
reused build `242a11cc-2a62-40f7-9a60-d31eab6c8a40` with harness
`87f85ddf61a650924ba59311931568889ecdca63`; EAS skipped native compilation.
Fresh login passed. The agent returned all six planned findings with their exact
acceptance criteria, correctly excluded the legacy Getting Started channel and
reported every scenario blocked by unavailable `%notes` and sync fixtures. The
227.4-second recording passed video validation. This qualifies source-checked
build reuse and structured blocked reporting, not the requested app behavior.
The EAS publisher then automatically embedded the video with all six findings
[in the original PR](https://github.com/tloncorp/tlon-apps/pull/6460#issuecomment-5627538335).
GitHub's rendered response contains a native `<video>` player. The workflow
correctly ends in failure for blocked coverage while publication succeeds.

## Provisioned fixture runs

The coordinator first obtains an assessment with a setup plan. `notes-v1` creates
a group-linked `%notes` notebook, ten long root notes and four notes in a folder
on disposable ~zod. It reads back notebook identity, folder, note count, owner
permission and search results before starting the simulator. The agent receives
those exact IDs/titles and may write only in that fixture. `Getting Started` is
legacy notebook content and cannot substitute for `%notes` coverage.

The current notes backend gives group readers edit access. The assessor reads
that compatibility boundary and selects component regression tests for unsupported
permission combinations; snapshot/reply races use the existing real database
regression. Their receipts and logs are reported as automated tests, not video
proof. Both the app and backend product source must match the requested PR.

Fixture setup recipes are reviewed code selected by the assessment; the model
cannot emit arbitrary setup shell commands. New feature families need additional
recipes. Original shared-account results above are historical qualifications.
