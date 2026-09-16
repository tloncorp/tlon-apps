# Hosted PR simulator QA

The manual `Hosted PR agent QA` GitHub action assesses a PR, prepares disposable
fixtures, tests supported user-facing changes on an EAS iOS simulator, and posts
findings with video. It does not require a developer Mac, Metro, or desktop agent.

This is an advisory pilot. It has no automatic pull-request trigger and must not
be made a required merge check. Product failures and incomplete coverage remain
visible in the report and workflow status. Automatic PR assessment will be enabled
separately after the pilot demonstrates reliable completion and useful findings.

## Run a PR

Choose **Actions → Hosted PR agent QA → Run workflow**, select the landed branch,
and provide `pr_number`. Only non-draft PRs from `tloncorp/tlon-apps` are eligible;
fork PRs are rejected. Runs for the same PR are serialized to allow backend cleanup.

```sh
gh workflow run mobile-pr-agent-qa.yml --repo tloncorp/tlon-apps \
  --ref develop -f pr_number=PR_NUMBER
```

Before landing, run the action from `db/pr-agent-qa-ios` and set `qa_ref` to a QA
overlay on the target PR's exact head. The overlay may change only the allowlisted
QA tooling and fixture files. Product-source equality is checked from Git objects.
Executed QA tooling must also exactly match the trusted coordinator checkout;
PR changes to the harness are rejected until supplied in an approved overlay.
The assessment records the exact PR base/head; the build and simulator revalidate
those revisions and report the installed app and backend identities separately.

Optional inputs:

- `assessment_run_id`: reuse a completed `test` assessment only while both PR revisions
  match. Its source citations and setup plan are revalidated.
- `build_id` and `build_sha`: reuse an existing simulator build only after its
  source identity is independently verified.
- `qa_ref`: QA overlay for pre-landing qualification; normally omitted after landing.

## What the agent does

1. An independent source reviewer reads pinned base/head code, diff, callers and
   helpers without PR prose or human comments. Checked line citations support its
   regression hypotheses; hypotheses are not runtime findings.
2. A planner maps every declared user-facing change and source hypothesis to concrete tests.
   A supported conclusion of no user-facing changes skips device work. Missing
   context or unsupported requirements are explicit; supported tests still run.
3. The workflow checks native compatibility and repacks JavaScript into a compatible
   existing app. It falls back to a native build when required. Builds finish before
   the backend lease starts. The installed copy has OTA updates disabled, and its
   bundle identity is recorded.
4. A four-CPU Blacksmith runner prepares disposable ~zod/~ten ships. Reviewed
   `chat-v1` and `notes-v1` recipes create and verify the selected fixture. Models
   select recipes, never arbitrary setup commands. Cached ships are isolated copies
   keyed by backend inputs; changes to those inputs require fresh preparation.
5. Scripted Maestro login verifies Home and the exact account identity. Routine
   navigation opens the fixture. Codex drives Argent for the planned checks and
   exploratory inspection; visible controls missing from accessibility may be
   targeted from screenshots. Recording starts after login and finishes independently
   of the model, including when the operator times out.
6. Once capture and upload finish, the backend stops. A fresh visual reviewer examines
   actions and screenshots without the plan or operator conclusions. A separate
   evidence reviewer checks coverage and can inspect consecutive native video frames
   for brief states that screenshots missed. Missing evidence stays incomplete.
7. An editor groups duplicate findings and writes plain-language explanations. A
   fidelity pass checks meaning, uncertainty and event order. Verified video moments
   produce one complete clip per finding; an extra clip review runs only when needed.
   Clips must show the before state, trigger, outcome and settled result.

All model stages currently use Codex CLI 0.145.0 with `openai/gpt-5.6-sol` at high
reasoning through OpenRouter. Device interaction uses Argent 0.23.0. Source, visual
and evidence review remain independent. Smaller models or lower effort require
quality comparisons before changing these defaults.

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
Repeated frame requests are deduplicated within a review session, but independent
reviewers each receive the images they request.

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
`QA_TUNNEL_TOKEN`, and the configured test-login variables. Use a dedicated QA
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

- iOS only. Unsupported web, Android, data-volume and timing requirements stay explicit.
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

Historical qualification: [#6460 notebook/header evidence](https://github.com/tloncorp/tlon-apps/pull/6460#issuecomment-5636234222),
[#6511 editing evidence](https://github.com/tloncorp/tlon-apps/pull/6511#issuecomment-5637423244),
and [#6516 delivery-indicator evidence](https://github.com/tloncorp/tlon-apps/pull/6516#issuecomment-5642081001).
These runs required harness fixes or continuations and are not clean qualifications
of a later harness revision. Product observations came from the automated reviewers.
The #6516 run cost about $3.05 including failures/retries; its completed retry alone
was about $1.58, with prepared assessment/app/ships reused. These are examples, not
per-PR guarantees.

Run `node --test scripts/agent-qa/*.test.mjs` for harness regression checks. Before
landing a changed publisher or coordinator, qualify a user-facing PR through new
video uploads, a documentation-only skip, and publication retry against the same
comment. Record the exact harness revision and cloud results in the PR description.
