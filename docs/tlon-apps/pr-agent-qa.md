# PR simulator QA

`apps/tlon-mobile/.eas/workflows/pr-agent-qa-ios.yml` runs entirely on EAS:
the iOS build, simulator, Maestro bootstrap, and Codex CLI with Argent all run in the cloud.
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

Codex CLI 0.145.0 runs openai/gpt-5.6-sol through OpenRouter at medium reasoning with Argent 0.23.0
through MCP. It receives the PR title, description, and mobile source diff.
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
links to the EAS run's artifacts. A separate `ios-agent-qa-video` attachment
contains `test-session.mp4`, and the PR report explicitly points reviewers to it.
The reporting job downloads this MP4 and posts the report using GitHub CLI
2.99.0 `gh pr comment --attach`. GitHub hosts the attachment and renders an
inline video player directly in the PR comment. No public media bucket is required.

Set `GH_QA_TOKEN` as a **secret** in the EAS preview environment. Use a dedicated
QA account's GitHub OAuth token or classic PAT with write access to this repository
(the `repo` scope for this private repository). These are the token types supported
by GitHub's attachment uploader. The reporting job maps it to `GH_TOKEN`; the
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
version intentionally builds the app for each labeled PR revision.

## Disposable Blacksmith ships (experiment)

`.github/workflows/agent-ships-proof.yml` prepares two fake ships with Rube on
Blacksmith, then dispatches this EAS workflow against an existing iOS build.
It is a manual harness experiment, not certification of a PR's frontend.
The backend uses the selected GitHub revision; the report records both app and
backend commits separately. The experiment push trigger is restricted to its
workflow file on `db/pr-agent-qa-ios`.

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
automatic video publishing credentials remain separate follow-ups.

## Codex qualification status

The Codex + Sol + Argent replacement uses the existing `OPENROUTER_API_KEY` in EAS preview.
Codex uses a custom provider with `wire_api = "responses"`; no OpenAI credential is needed.
It has not yet passed the remote two-ship scenario. The earlier shared-ship video
and the blocked custom-agent runs do not qualify this new runtime. The initial
qualification reuses build 709ad03a-fc06-457a-a0c4-cb7ca437797c, with the app and
backend revisions reported separately. No new native build is needed.

Argent boots the CI simulator with accessibility enabled and owns interaction,
screenshots and recording. This existing-build path uses the wrapper's explicit
simulator UDID and verified downloaded artifact for installation; it does not
start Metro or modify a developer's Stim devices. Recording has static trimming
disabled, shows touch markers, and is finalized independently of Codex.
