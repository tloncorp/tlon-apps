# Writing the pull request

The description's job is to let a reviewer decide the change is safe to merge, from what they cannot get out of the diff.

## The template wins

`.github/pull_request_template.md` has six sections, and they are the ones to use, with their own headings, in this order:

    ## Summary
    ## Changes
    ## How did I test?
    ## Risks and impact
    ## Rollback plan
    ## Screenshots / videos

Do not rename, drop, or reorder them, and do not substitute a Description/Solution/Test-plan structure from habit. `gh pr create` does not apply the template, so write all six out. A section you genuinely cannot fill is a question for the user, not a placeholder.

**Risks and impact** carries two things the template asks for literally: answer `Safe to rollback without consulting PR author? (Yes | No)`, and tick the affected area from its list -- Onboarding, State / providers, Message sync, Channel display, Notifications, or Other. Those five are there because they are where a regression is expensive and hard to spot; if your change touches one, say what it touches and how you checked it.

## Title

One line, an imperative verb, naming the user-facing effect rather than the mechanism. Two shapes are in use here, and either is fine:

    Fix navigation-context crash in Pressable by removing link props
    android: decode GIFs with Glide instead of APNG4Android

Plain sentence, or a lowercase area prefix and a colon. Across the last 120 merged pull requests it splits roughly 57/43 in favour of plain, so reach for a prefix when the area is not obvious from the title itself. The areas actually in use: `ops`, `mobile`, `ios`, `android`, `web`, `api`, `shared`, `sync`, `desk`, `logs`, `e2e`, `onboarding`, `telemetry`, `tooling`.

Two things this repository does **not** do, whatever your instincts say:

- **No conventional-commit prefixes.** `feat:`, `fix(scope):`, `chore:` appear in 3 of the last 120. The commit log has them; the pull request titles do not. Do not infer the convention from commits.
- **No ticket id in the title.** Also 3 of 120. Linear links belong in the body.

Retitle if the scope changes after review.

## Summary and Changes

Lead with the problem and its impact, then the intent behind the fix. Explain what a mechanism is *for* from the reviewer's side, not only when it triggers. Prose, not a file-by-file changelog; a short bullet per distinct fix when the PR bundles more than one. Inline code for identifiers and paths. Right-size it: a one-line fix needs three sentences.

Ground every claim. A root cause is stated only when confirmed in code; otherwise hedge plainly. Every symbol named comes from reading the source. A load-bearing claim about a framework or library gets a permalink with a commit SHA (`https://github.com/{org}/{repo}/blob/{sha}/{path}#L{n}`). Never invent an issue number, PR number, or link.

When the diff reverses something that looks deliberate (a removed guard, a flipped default, a deleted comment describing the old behavior as intended), `git log -S` / `git blame` the removed lines and say where the old behavior came from and why it no longer applies.

## How did I test?

Only what a reviewer would exercise: the device, the steps, the expected and observed result. Lint, typecheck, and unit tests passing are not test content unless the PR changes them. The before and after recordings are the evidence; if later commits change the visible behavior, re-capture.

## Risks, rollback

State scope (platform, screen, flow), the worst case if the change is wrong, and how reversible it is. A small contained change needs a sentence. Do not downplay a risk to get the PR through.

## What not to write

"This PR introduces...", "improves maintainability", a paragraph on how the other platform works, or the PR's own backstory ("reworked after feedback"). Describe the diff against the base branch, never the review process.

## Before editing an existing description

`gh pr view <n> --json body -q .body` first. The user may have edited it; merge, do not overwrite.

## Justification belongs on the PR, not in the code

A comment that explains why you chose this shape over the obvious one is for the reviewer: post it on the diff line (`gh api repos/{owner}/{repo}/pulls/{n}/comments -f body=... -f commit_id=... -f path=... -F line=... -f side=RIGHT`), not in the file. A code comment stays only when the code would otherwise look wrong to a future reader.
