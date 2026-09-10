# Writing the pull request

The description's job is to let a reviewer decide the change is safe to merge, from what they cannot get out of the diff.

## The template wins

Use every section of `.github/pull_request_template.md` with its own heading, in its order. Do not rename, drop, or reorder sections. A section you cannot fill (a ticket link you do not have) is a question for the user, not a placeholder.

## Title

Match the repository's merged pull requests, not its commit log: `gh pr list --state merged --limit 10`. Here that is a plain sentence, sometimes with a scope prefix (`android: decode GIFs with Glide instead of APNG4Android`). Name the user-facing effect, not the mechanism. One line; retitle if the scope changes.

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
