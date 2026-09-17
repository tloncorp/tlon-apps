# Hosted PR simulator QA

The manual `Hosted PR agent QA` GitHub action assesses a PR, prepares disposable
fixtures, tests supported user-facing changes on an EAS iOS simulator, and posts
findings with video. It does not require a developer Mac, Metro, or desktop agent.

This is an advisory pilot. It has no automatic pull-request trigger and must not
be made a required merge check. Product failures and incomplete coverage remain
visible in the report and workflow status. Automatic PR assessment will be enabled
separately after the pilot demonstrates reliable completion and useful findings.

## Trust boundary

This is a manual developer tool for trusted same-repository code. The dispatcher
must trust both the selected workflow ref and the target PR, including build hooks,
Expo configuration and regression tests. These execute in credentialed CI jobs;
source/harness checks prevent accidental mismatches, not malicious code execution.
Forks and untrusted contributions are outside this pilot's scope. Do not dispatch
this workflow for code you would not otherwise run with development credentials.

## Run a PR

Choose **Actions → Hosted PR agent QA → Run workflow**, select the landed branch,
and provide `pr_number`. Only non-draft PRs from `tloncorp/tlon-apps` are eligible;
fork PRs are rejected. Runs for the same PR are serialized to allow backend cleanup.

```sh
gh workflow run mobile-pr-agent-qa.yml --repo tloncorp/tlon-apps \
  --ref develop -f pr_number=PR_NUMBER
```

Before landing, run the action from `db/hosted-pr-qa-review` and set `qa_ref` to a QA
overlay on the target PR's exact head. The overlay may change only the allowlisted
QA tooling and fixture files. Product-source equality is checked from Git objects.
Executed QA tooling must also exactly match the trusted coordinator checkout;
PR changes to the harness are rejected until supplied in an approved overlay.
The assessment records the exact PR base/head; the build and simulator revalidate
those revisions and report the installed app and backend identities separately.

Optional inputs:

- `assessment_run_id`: reuse a completed `test` assessment only while both PR revisions
  match. Its change coverage and setup plan are revalidated.
- `build_id` and `build_sha`: reuse an existing simulator build only after its
  source identity is independently verified.
- `qa_ref`: QA overlay for pre-landing qualification; normally omitted after landing.

## What the agent does

The tester and evidence reviewer read testing guidance directly from
[tlon-workflow](../../.agents/skills/tlon-workflow/SKILL.md). Platform selection,
reproduction conditions, lifecycle variations and evidence standards have one
source of truth. The hosted adaptation is documented in that skill's
[hosted QA reference](../../.agents/skills/tlon-workflow/references/hosted-qa.md).

1. The tester plans from the pinned diff and read-only base/head source. Every
   declared user-facing change has a scenario. A supported conclusion of no
   user-facing changes skips device work; missing capability stays explicit.
2. CI reuses/repackages a compatible native app or builds when required, then
   prepares disposable ~zod/~ten ships and the selected chat/notebook fixtures.
   Build and backend source are verified against the requested PR.
3. The existing `tlon-workflow/mobile-login.mjs` signs in using runtime disposable
   credentials. Codex executes the plan with the official agent-device MCP server.
   The runner captures the authenticated session, including when the tester times out.
4. One independent evidence reviewer examines actions, screenshots and native video
   frames. It writes concise findings and selects one complete trigger-to-outcome
   clip per finding. Unsupported or unobserved behavior stays incomplete.
5. Deterministic code checks frame receipts, cuts clips, and updates the canonical
   PR comment. There are no separate source-critic, blind-visual, editorial,
   fidelity or clip-selection agents.

Both roles use Codex CLI 0.145.0 with `openai/gpt-5.6-sol` at high reasoning through
OpenRouter. The tester has a planning phase before device allocation and an
execution phase on EAS. Device interaction uses agent-device 0.21.5. Local builds
remain owned by Stim; the hosted runner installs the verified EAS Release artifact.
The shared skill's local authoring/fixing/merge steps are not run by hosted QA.

`pr-watch.mjs` identifies QA comments as advisory `qa-result` events, keyed by run,
commit and completed publication state. An updated result in the same comment is
visible once, without creating another automatic repair/review cycle.

## Publication and recovery

Every publishing path shares one comment per PR and publisher account, identified
by `<!-- ios-agent-qa:pr-N -->`. Retries update the exact comment ID. Earlier attempts
remain linked in collapsed history; late runs cannot overwrite newer results, and a
same-run fallback error cannot replace its completed report. Recognized legacy QA
comments from that account are consolidated only after verifying the replacement.
Unrelated comments are untouched.

GitHub hosts the clips and full recording as inline video players. Assets upload
through the endpoint used by GitHub CLI's `--attach`, followed by an exact comment
update and a rendered-player check. Failures retain the EAS evidence and an explicit
incomplete report. Uploading videos requires `GH_QA_TOKEN`; `GITHUB_TOKEN` cannot
replace it.

Publication uses an atomic temporary Git tag, `ios-agent-qa-lock-pr-N`, to serialize
the final freshness check and comment update across normal runs and replays.
The QA token needs Contents read/write as well as PR comment and video access.
Locks are released after publication, including errors. A killed worker may leave
a lock: inspect its annotated tag for the owning EAS run, confirm that run has
stopped, then delete that exact tag and retry. Locks never expire automatically.
Oversized reports are shortened with links to the full artifacts; video links remain.

Completed model stages are checkpointed against instructions, schema, input and
implementation. A worker retries an interrupted review/publication once; the
coordinator can recover from durable artifacts without repeating simulator work.
Repeated frame requests are deduplicated within a review session, and the evidence reviewer selects clips in the same pass.

For a diagnostic replay, from `apps/tlon-mobile`:

```sh
node ../../scripts/agent-qa/replay.mjs EAS_RUN_UUID QA_REF
```

The default replay produces evidence-review artifacts without a PR comment. Use
`complete` to run review and publication, or `present` to publish a recorded report.
These modes reuse saved evidence and do not certify a newer product commit.
Signed artifact URLs are passed to the worker without printing them in diagnostics.

## Configuration and boundaries

GitHub needs `EXPO_TOKEN`, `MAESTRO_FAKE_SHIP_NGROK_TOKEN`, and `QA_TUNNEL_TOKEN`.
The EAS preview environment needs `OPENROUTER_API_KEY`, `GH_QA_TOKEN`, the matching
`QA_TUNNEL_TOKEN`, and no developer ship-login credentials. Disposable login credentials are supplied at runtime. Use a dedicated QA
account for GitHub publication with repository write access; do not put credentials
in repository files or model prompts.

The public backend tunnel rejects requests without its token. A loopback proxy on
EAS adds that token; app/device tools do not receive it. Fixture setup is checked
before device execution. Rube and fixture actor subprocesses receive an allowlisted
environment without tunnel or CI credentials. Model and MCP environments are stripped, shell
and web tools are disabled, and evidence reviewers have no live device tools.
Only selected same-repository source runs in the credentialed workflow; this is
not a sandbox for arbitrary external PRs. Changes to QA scripts, workflows and
fixture recipes need review before credentialed execution.

`ios-agent-qa` retains screenshots, action traces, structured findings, provenance
and per-request billing. `ios-agent-qa-video` holds the full recording. Linux review
and presentation artifacts retain reviewed evidence, clip receipts and publication
results. Backend artifacts have a three-day retention period. Treat all artifacts
as test-account data.

## Limits and qualification

- First stage: iOS PR build only. Apply the shared skill's platform and before/after rules, but mark required Android, web, Cosmos and base-build checks unavailable. Supported iOS checks still run; incomplete overall coverage cannot be reported as a pass.
- Deterministic regression recipes currently run only alongside a disposable fixture.
  Regression-only plans remain unavailable in this pilot.
- Supported fixture recipes do not cover every product state. A generic login or
  chat smoke cannot satisfy unrelated PR criteria.
- The workflow compares base/head source and before/after states on the head app.
  It has no paired base/head device run and must not claim a visual defect was
  introduced by the PR without that evidence.
- Long scenarios may exceed the operator budget. Unfinished checks are not passes.
- A cold native build or backend preparation can cost substantially more than reuse.
  Dollar totals distinguish measured provider charges from estimated runner costs.

## Validation

Run `node --test scripts/agent-qa/*.test.mjs` for harness regression checks.
Qualify changes to the device path on a hosted PR run; local unit tests do not
establish simulator, video-review or publication success. Record the exact harness
revision and cloud run in the PR description. Older Argent-based runs do not
qualify this agent-device implementation.
