# PR triage

The local `tlon-pr-triage` skill assesses complexity, sensitivity, automated
findings, and decisions requiring a human. Invoke it with a PR URL:

```text
Use $tlon-pr-triage https://github.com/tloncorp/tlon-apps/pull/6794
```

Local invocation produces a report and proposed comments/labels. It does not
publish unless the user authorizes publication.

Each assessment retains three evidence views in its full report:

- A behavior impact map connecting changed files to callers, consumers,
  platforms/contract boundaries, relevant validation, and material gaps.
- A requirements assessment citing the PR, relevant issue/spec, repository
  contract, or explicit decision behind each material requirement. It separates
  met, unmet, and unclear requirements; missing specifications are not invented
  or automatically escalated to humans.
- A structured counter-review recording each bot claim's trigger, reviewed
  revision, source trace, validation method, supporting and opposing evidence,
  proof gaps, current status, next step, and independent fix assessment.

A coverage ledger accounts for bot review bodies, inline comments/replies, and
conversation, including messages with zero findings. Several findings may share
one discussion URL. Clear requirement mismatches remain agent work; unresolved
consequential product/authority choices require an explicit human decision.

## GitHub Actions

`.github/workflows/pr-triage.yml` runs the same skill using Codex. It starts on
open, reopen, ready, push, or PR edits. It also handles Codex's
`<!-- codex-pull-request-review-summary -->` issue comment, including edits:
review start invalidates the previous automatic routing, and completion at the
current head triggers counter-review. Findings in review bodies, inline
comments, replies, and earlier revisions are collected together.

Other issue comments do not trigger inference or cancel an active analysis.
Closing a PR or converting it to draft invalidates automatic routing without
running inference. Automatic analysis currently covers open, non-draft PRs
whose head repository is `tloncorp/tlon-apps`; fork PRs are skipped. Non-Codex
triggers require repository write access. These restrictions also bound access
to paid inference.

To activate, merge the skill, scripts, and workflows into the repository's
default branch, currently `develop`. The existing repository Actions secret
`OPENROUTER_API_KEY` supplies inference. No PAT is needed: publication uses the
job's `GITHUB_TOKEN`. Optionally set the non-secret repository variable
`PR_TRIAGE_MODEL` to an OpenRouter model ID. The default matches the existing
agent QA model, `openai/gpt-5.6-sol`. Never put an API key in a variable.

For a manual run after activation:

```bash
gh workflow run pr-triage.yml --repo tloncorp/tlon-apps \
  --ref develop \
  -f pr_url=https://github.com/tloncorp/tlon-apps/pull/6794
```

Use a canonical URL without a fragment or query. Manual runs publish too.
For a historical/closed PR, use the local skill instead.

## Published results

| Outcome | Automatic label | Meaning |
| --- | --- | --- |
| `human-required` | `review:human-required` | A concrete human decision is needed. |
| `agent-work-needed` | `review:agent-work-needed` | Bounded implementation or verification work remains. |
| `agent-eligible` | `review:agent-eligible` | Sufficient evidence, no outstanding work or human boundary. |
| `incomplete` | No automatic agent label | Routing cannot yet be established. |

Missing labels are created on demand. Agent labels are refreshed on each run.
`review:human-required` is sticky: only an explicit maintainer decision clears it.
When that label already exists, an eligible assessment does not add the
agent-eligible label. Agent work and an existing human requirement may coexist.
The shared `ready-for-human` label is left to the existing workflow/maintainers.
No outcome approves, merges, assigns a reviewer, resolves a thread, or changes
the PR's code.

One bot-owned summary comment is updated in place, targeting 150–250 words:
route, impact, counter-review/requirement counts, evidence limits, and next steps.
The full ledger goes in the workflow job summary, linked from the PR comment.
Local assessments keep separate report and preview files.

Concrete human decisions also get inline `COMMENT` reviews. For confirmed
current-head defects routed to agent work, up to three small, self-contained
fixes may be proposed with GitHub `suggestion` blocks. The publisher checks the
exact original text and a contiguous current-side diff range (at most 20 lines
each for original and replacement), rejects overlaps and stale evidence, and
leaves all changes unapplied. Each suggestion explains the defect and its
validation limits. Broader or uncertain fixes stay in the next steps.

Each revision/location is posted at most once; decisions without a valid
anchor remain in the summary. Comments from other reviewers are preserved.

## Evidence and execution boundaries

Three separate jobs gate the request, perform inference, and publish:

- The gate and publisher execute only scripts from a pinned trusted default
  branch revision. The PR cannot supply its own triage policy or publisher.
- The analysis checks out that same policy revision and fetches PR Git objects
  for `git show`/`git diff`. It never checks out the PR, installs its dependencies,
  or executes its tests. The agent runs read-only with `drop-sudo`, receives a
  paginated snapshot, and has no GitHub write token. The inference key is passed
  to the action's Responses proxy using its endpoint override.
- The publisher runs on a fresh runner and validates structured output,
  finding references, diff positions, current revisions, and a fingerprint of
  the reviews/checks. It accepts only the predefined routing labels and comment
  operations. It never executes model output.

A new push removes stale automatic labels. API errors, missing secrets, a
timeout, malformed output, omitted review sources/inline findings, or evidence
changing during analysis never produce an eligible label. A failed assessment updates
the summary to incomplete; a cancelled run can leave a pending summary, without
an automatic agent label. Human requirements remain in force.

The publisher checks changed-file coverage, requirement source consistency,
and declared per-message finding counts. It also blocks eligibility on material
gaps inside impact-map/finding entries or unresolved requirements. These checks
validate bookkeeping and routing consistency, not whether the model extracted
every claim or reached the correct technical conclusion.

The hosted pass relies on source inspection and collected check results.
It must disclose missing reproductions or device evidence, and may return
`incomplete` until a local agent supplies that evidence. Checks changing during
analysis invalidate the result. There is no automatic retry on CI completion:
rerun manually once checks settle, or let the next push/Codex review trigger it.
The three triage jobs are excluded from their own evidence fingerprint.
Linked issues or external specs are not fetched by the hosted analysis; a
material requirement source absent from the supplied context is reported as
unavailable. Local invocation can inspect relevant links with the GitHub CLI.

The workflow's first hosted run still needs to confirm the account's inference
access/quota and repository Actions permissions. Secret-name inspection and
local tests cannot establish these.

## Maintenance

Run the deterministic tests without installing repository dependencies:

```bash
node --test scripts/pr-triage/triage.test.mjs
```

The separate `pr-triage-checks.yml` runs those tests on changes to the skill,
scripts, and workflows, without secrets or write permissions.

Policy lives in `.agents/skills/tlon-pr-triage/`; the runner/output schema live
in `scripts/pr-triage/`. Keep local routing and hosted output consistent.
Upgrades to the pinned Codex action/CLI should verify the Responses proxy,
read-only sandbox, output schema, and bot allowlist together.

References: [Codex GitHub Action](https://developers.openai.com/codex/github-action)
and [OpenRouter Responses API](https://openrouter.ai/docs/api/reference/responses/overview).
