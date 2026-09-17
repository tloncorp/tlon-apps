# Hosted PR simulator review

`Hosted PR agent QA` is a manual, advisory GitHub action. It explores a trusted
same-repository PR on an EAS iOS simulator and posts findings with video in one
comment. No developer Mac, Metro or desktop agent is needed.

## Run

```sh
gh workflow run mobile-pr-agent-qa.yml --repo tloncorp/tlon-apps \
  --ref develop -f pr_number=PR_NUMBER
```

The PR must be non-draft. Before landing, use the QA branch as `--ref` and set
`qa_ref` to a tooling overlay on the target PR's exact head. Product-source
identity is checked independently of tooling changes. Optional `build_id` and
`build_sha` select an existing simulator build; its identity is verified before use.
Otherwise EAS repacks a compatible native build or makes a new one.

Dispatch only code you trust to run with development credentials, including its
build hooks and Expo configuration. This is not a sandbox for hostile PRs. There
is no automatic PR trigger and this must not be a required merge check.

## Flow

1. **Prepare.** Codex CLI reads an ordinary checkout of the exact PR head and
   chooses a few useful interactions. Docs/tooling-only PRs skip the simulator.
   CI prepares the app and disposable ships, then uses the shared login helper.
2. **Review.** Codex explores the installed app with agent-device while recording.
   It creates ordinary test data through the UI and follows suspicious behavior
   beyond the starting plan. The ships' preflight chat is available for peer state.
   After capture, a separate Codex session on Linux inspects actions, screenshots
   and video frames, then writes findings and selects complete clips.
3. **Publish.** Code cuts the selected clips and updates one canonical PR comment,
   including the full recording. No additional editing model is involved.

All model sessions use Codex CLI 0.145.0, Sol at high reasoning through OpenRouter.
Device interaction uses agent-device 0.21.5. The reviewer shares the existing
[login and navigation conventions](../../.agents/skills/tlon-workflow/references/hosted-qa.md)
and follows [exploratory reviewer guidance](../../.agents/skills/tlon-workflow/references/pr-reviewer.md).
It does not run the author's fix, merge or mandatory before/after workflow.

## Results and retries

Completion, findings and unexplored paths are separate. A completed review may
find bugs or leave paths unexplored. Device, login, recording or independent-review
failure makes execution incomplete. Findings describe observed behavior, not proof
that this PR introduced it. Android, web, Cosmos and base builds are outside scope.

Publication updates the same comment for the PR. A short publication lock prevents
concurrent writers; current-head checks prevent an old result replacing a newer
one. At most one verified trigger-through-settled clip is attached per finding.

The Linux review/publication job retries once on the same worker and reuses a
completed evidence review. Artifacts remain available if both attempts fail; rerun
the workflow to try again, optionally reusing its build. There are no standalone
replay modes, cross-worker recovery, fixture catalogs or regression-test recipes.

If a hosted run was explicitly requested, wait for its exact result before handoff:

```sh
node .agents/skills/tlon-workflow/pr-watch.mjs PR_NUMBER --qa-run EAS_WORKFLOW_UUID
```

The watcher is bounded by `--timeout`, stops waiting if the head changes, and never
starts another review or fix loop. Completion does not authorize a merge.

## Configuration and validation

GitHub requires `EXPO_TOKEN`, `MAESTRO_FAKE_SHIP_NGROK_TOKEN` and `QA_TUNNEL_TOKEN`.
The EAS preview environment requires `OPENROUTER_API_KEY`, `GH_QA_TOKEN` and the
matching `QA_TUNNEL_TOKEN`. The GitHub QA account needs repository write access for
comment and video publication. Disposable login credentials are supplied at runtime.

The authenticated backend tunnel is exposed to the app through a loopback proxy.
Screenshots, action traces, reports, video and provider billing are saved as EAS
artifacts. Backend artifacts are retained for three days. Treat them as test data.

Run `node --test --test-concurrency=1 scripts/agent-qa/*.test.mjs` for harness tests
and EAS workflow validation for wiring. These do not establish live simulator or
publication success; qualify device-path changes with a hosted run and record its
harness revision. Local native development continues to use Stim.
