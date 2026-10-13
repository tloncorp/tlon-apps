# Hosted PR review

A manual, advisory developer tool for trusted same-repository PRs. It uses Codex
CLI (Sol high through OpenRouter), agent-device, ffmpeg and gh. It does not fix
code, request another review, or merge.

```sh
gh workflow run mobile-pr-agent-qa.yml --repo tloncorp/tlon-apps \
  --ref develop -f pr_number=PR_NUMBER
```

Before landing, use the QA branch for `--ref` and a `qa_ref` tooling overlay on the
PR head. Optional `build_id` and `build_sha` reuse an exact simulator build.
Otherwise EAS repacks compatible native code or builds it. Product source is
checked against the PR before testing. Forks and draft PRs are not supported.

## Flow

1. A short assessment reads the PR and an ordinary source checkout. Docs/tooling
   changes skip the simulator. User-facing iOS changes proceed to build preparation.
2. GitHub starts the existing Rube disposable ships and authenticated tunnel,
   reusing the prepared ship cache. EAS installs the selected app and uses the
   shared `tlon-workflow` login helper.
3. Codex explores the feature using agent-device while recording. It creates test
   data through the UI and follows suspicious behavior beyond the starting plan.
4. A separate Codex session reads the recording, screenshots and operator notes.
   It uses normal shell tools, ffmpeg and image viewing to inspect frames and choose
   one complete clip per finding. There is no custom evidence MCP or receipt format.
5. Code cuts the clips and uses `gh --attach` to update one QA comment, placing each
   video beside its finding and the full recording below. The PR watcher can wait
   for the specific EAS run with `--qa-run`.

Exploration, recording review and publication run on one EAS Mac worker. This
keeps execution simple but retains the Mac/ship lease during recording review.
There is no automatic retry/recovery layer: a failed run saves artifacts and can
be rerun, optionally with its previous build. Per-request billing is left to the
provider; Codex event logs retain token usage.

## Scope and setup

Only the implemented iOS build is reviewed. Base builds and other platforms are
not prerequisites. Reports separate findings, explored paths and unreached paths;
completion is not a correctness guarantee or approval to merge.

Use a dedicated GitHub QA account and dispatch only through the GitHub action,
which serializes runs per PR. If that account has a newer unrelated comment,
publication stops rather than editing it. No locks or publication history service
are involved. A changed PR head requires another run.

GitHub secrets: `EXPO_TOKEN`, `MAESTRO_FAKE_SHIP_NGROK_TOKEN`, `QA_TUNNEL_TOKEN`.
EAS preview secrets: `OPENROUTER_API_KEY`, `GH_QA_TOKEN`, matching `QA_TUNNEL_TOKEN`.
The QA GitHub token needs repository write access. Disposable login credentials
come from the runner; developer credentials are not used. This is trusted code
executing in credentialed CI, not a sandbox for arbitrary external contributions.

Run `node --test --test-concurrency=1 scripts/agent-qa/*.test.mjs` and EAS workflow
validation for tooling checks. A hosted run is needed to qualify the live device,
model review and upload path. Artifacts include the recording, screenshots, Codex
logs and report; treat them as test-account data. Local native work still uses Stim.
