# Writing the pull request

The description's job is to let a reviewer decide the change is safe to merge, from what they cannot get out of the diff. Before posting, run the fresh-eyes pass below with `references/lazy-skimmer-review.md`.

## Draft, then ready

Create as a draft so the evidence can be spliced in, then `gh pr ready` as step 8 of the skill says. The Codex reviewer only reviews ready pull requests, and that review is part of the loop.

## The template

Read `.github/pull_request_template.md` and fill every section under its own heading, in its order. `gh pr create` does not apply the template, so write it out yourself. Do not rename, drop or reorder its sections, and do not substitute another structure from habit. Answer its literal questions literally: `Safe to rollback without consulting PR author? (Yes | No)`, and tick the affected areas from its list. A section you genuinely cannot fill is a question for the user, not a placeholder.

The Linear ticket link goes in the Summary, not the title.

## Title

A conventional commit line, `type(scope): imperative summary`, with `fix`, `feat`, `chore`, `docs`, `refactor`, `test` or `ci` as the type and the platform or area as the scope (`fix(android): decode GIFs with Glide instead of APNG4Android`). Name the user-facing effect, not the mechanism ("fix(chat): voice memo recorder missing left padding", not "apply paddingStart in recording mode"). One line, specific, accurate to the final diff; retitle if the scope changes after review. This is a decision for pull requests opened through this workflow, not the observed history: the merged log is mostly plain sentences.

## Writing Descriptions

### Principles
- Before drafting, fully understand the problem and solution (read issue context, relevant files, and key diff hunks).
- If understanding is incomplete, ask clarifying questions instead of guessing.
- Focus on context and rationale reviewers cannot infer from the diff (intent, constraints, trade-offs, side effects).
- Lead with the problem and impact, not implementation details.
- **Explain the *intent* behind a mechanism, not just how it behaves.** When a change introduces a deliberate behavior — a special return value, a default, a new condition — describe what it's *for* from the caller's or reviewer's side, not only the mechanics of when it triggers. "Returns `null` when native is disabled, the module is missing, or the value isn't a boolean" walks the plumbing; "returns `null` for *couldn't determine* so callers don't mistake an unknown state for a clean result" gives the design intent the reviewer is actually asking about. The plumbing is visible in the diff; the intent is the thing only you can supply. Likewise, when a line happens to also fix a bug, say *why it's a fix* (the thing it avoided was actively harmful), not merely that it removes something redundant — "redundant" undersells a real fix.
- **Describe the solution as prose, not a bullet-point changelog** — but *do* add structure when the PR bundles genuinely distinct changes. If it fixes two separate problems, or applies two independent mitigations to one problem, give each its own short paragraph or bullet that explains *that* change and why it's needed. One bullet per distinct fix-and-its-reasoning is good structure and reads clearly; a bullet per file restating what changed is the changelog to avoid. For a single focused change, plain prose is enough — don't manufacture sections that aren't there.
- **Use whatever formatting makes it easiest to scan — not just paragraphs.** Inline code for identifiers, paths, and API names; a fenced code block for a short repro or an error message; a tight bullet list when you're genuinely enumerating things. Strong PRs mix prose with light formatting. Conciseness means cutting filler and diff-restatement, not flattening everything into one voice-of-prose block.
- **Right-size the description to the change.** A one-line fix needs two or three sentences, not three paragraphs. Your job is the context a reviewer *can't* recover from the diff — intent, root cause, constraints — not a walkthrough of mechanics the diff already shows. When several things are affected the same way, give one representative example instead of enumerating every symbol, prop, or file. (The full cut pass lives in "Tighten before you post".)
- State scope clearly (platform, module, API, user flow, environment).
- **Ground every claim — nothing in the description should outrun what you verified.**
  - *Root cause:* explain it only when you've confirmed it in code, docs, or platform source. Unsure → dig in or hedge plainly ("I haven't pinned down exactly why, but the change does X"); a confident, specific, *wrong* cause is worse than an honest gap. Never invent issue numbers, PR numbers, or links.
  - *Identifiers and mechanisms:* any symbol you name (e.g. `_highestMeasuredFrameIndex`) must come from reading the source, not memory — a reviewer will grep for it, and a near-miss reads as fabricated. Same bar for framework-internal claims; downgrade what you can't ground to hedged wording ("likely", "appears to") rather than asserting. A vaguer-but-true sentence beats a precise-but-unverified one.
  - *Links:* when a load-bearing mechanism claim rests on a source outside this diff (framework lifecycle, platform API, upstream library), add a SHA permalink to the exact spot (see GitHub Code Links below). One link where the claim lives — it turns a correct-but-asserted explanation into one the reviewer can verify without re-deriving it.
- **Treat the changed code's history as a first-class research source.** `git log -S` / `git blame` on the lines you're touching is cheap and often answers the "why was it like this?" question the description needs — consider it whenever the origin or intent of pre-existing behavior is unclear, and include what you find when it clarifies the change.
- **When the diff reverses behavior that looks deliberate, digging up its origin is mandatory, not optional.** The signal: you're deleting or contradicting a comment/doc that describes the old behavior as intended, removing a guard or special case someone clearly wrote on purpose, or flipping a long-standing default. Run `git log -S` / `git blame` on the removed lines and find the commit that introduced them. Then put the answer in the description — a sentence plus a commit permalink: the old behavior was intentional (here's where it came from), and here's why it no longer applies. This preempts the reviewer's first question — "did the author realize this was on purpose?" — and saves them re-running the same archaeology. If the history doesn't explain why the behavior stopped making sense, say that plainly ("presumably made sense for the original container; doesn't hold up in the current layout") rather than inventing a refactor story you can't point to.
- Provide a concrete test plan (environment, steps, expected result).
- Prefer plain, natural wording (e.g., "behaves differently" not "diverges").
- **First person is welcome — often the most organic register.** "I hit this in a real app", "I tried X first but it broke Y", "I'm not sure this is the right layer — open to moving it" read like a human owner of the change; use first person freely for ownership, uncertainty, and judgment calls. Two limits: don't slide into chronological investigation narration ("First I looked at… then I realized…" — that's process, not content), and only make first-person claims that are true of the work actually done.

### Help the reviewer merge with confidence — honestly
A PR description's deeper job is to let the reviewer decide the change is *safe to merge*. Surface what bears on that and isn't visible in the diff: the blast radius (what else touches this, who's affected), the worst case if it's wrong, how reversible it is, and anything you're unsure about or didn't test. The reviewer is asking "what could this break, and how would we know?" — answer it.

This is an honest risk picture, not salesmanship. Surfacing a risk that makes the reviewer pause is the description doing its job — never downplay or omit one to get the PR through. If the change is genuinely risky, hard to reverse, or not ready, say so plainly ("high-traffic path; worst case X, mitigated by Y, revert is a one-liner" / "needs careful QA on Z before prod"). Right-size it: a small, contained change needs a sentence on scope and worst case at most — don't manufacture a risk section for a trivial fix. Spend the words where the change can actually hurt: shared/foundational code, migrations, perf- or concurrency-sensitive paths, anything hard to undo.

### Changes is not a file list

The template's Changes heading invites a file-by-file walkthrough; do not write one. One bullet per distinct fix saying what it addresses and why that is the right place, or one paragraph when there is a single fix. `channelsApi.ts: ...`, `sync.ts: ...`, `Tests: ...` is the shape to avoid; "delete events decode to the existing `deletePost` update instead of `addPost`, so a tombstone never enters the pending-post merge" is the shape to write.

### Length

A fix in one or two files is about 250 words of prose, not counting the template's checkbox block and the evidence tables; a change across `packages/` earns up to about 450. When the budget and the grounding rules below pull against each other, keep one permalink per load-bearing claim and at most two in the body, and keep the "where the old behavior came from" paragraph only when the diff reverses something deliberate.

### Do / Don't
Do:
- "When X happens, Y fails because Z. This PR changes A to prevent it."
- "Tested on <platform/version> with <scenario>; verified <result>."
- For a PR with two distinct fixes: one line of shared context, then a short bullet per fix — each naming what it addresses and the reason for it (not which files changed).
- When the change is about which inputs are accepted or rejected (validation, config schema, API shape), show a tiny concrete example of the triggering input — and the resulting error if it's short — instead of only describing it. A 4-line config block plus the error it throws is clearer than a sentence about it.

Don't:
- "Minor fixes" / "Various improvements"
- "Tested locally" (without details)
- AI tells: "This PR introduces…" openers, marketing closers ("this improves maintainability and developer experience"), over-sectioning a small change, uniform corporate cadence. Either register works — first person or neutral third person; what fails is performative polish. Write like a dev who wants to get back to coding.
- Bullet-point walkthrough of implementation details
- A "Changes" / "Solution" / "What's in the diff" section that re-walks the diff file-by-file — the diff already shows that
- Claim certainty on root cause when unsure
- Invent an issue number, PR number, or link you can't verify
- A "how it works on the other platform" / "how this subsystem generally works" contrast paragraph that isn't needed to follow *this* change
- The PR's own backstory — narrating review rounds or approaches this PR tried and abandoned ("previously this PR did X", "reworked after feedback"); that's process, not diff (see "Descriptions must reflect the diff, not the process"). This is NOT about the history of the *code* being changed — the origin and intent of pre-existing behavior is welcome whenever it clarifies the change, and expected when the diff reverses something deliberate (see question 3 below)
- Restating, in prose, a fact the reviewer can read directly in the diff
- Padding the motivation with plausible-but-unevidenced benefits or use cases ("this also helps with X", "callers could use this to Y") that the diff doesn't actually support — stick to what the change demonstrably does, and let a hedge ("likely", "appears to") carry anything you're inferring rather than asserting

### Before finalizing, ask three questions
Most PRs answer "no" to all three — but actually ask, because when the answer is yes these add real clarity that prose alone misses:

1. **Is the core problem spatial or structural?** — layout, list/scroll position, ordering, before/after arrangement, tree or region shape. If yes, and you're leaning on a dense paragraph to describe it, draw a tiny 3–6 line ASCII sketch instead (e.g. for a list-region bug, show the region order and mark which one is mishandled). A picture of the arrangement usually beats a sentence about it. Skip it only when the problem genuinely isn't spatial — a diagram for a non-visual change is noise.

2. **Does the change sit on a hot path *and* change its cost?** — code that runs per render, per frame, per list item, or in a tight inner loop in framework/library core. If yes *and* the change alters algorithmic complexity or allocations, add one line saying so (e.g. "an O(1) check of the last region instead of an O(n) scan on every render"). Concretely, this is worth a line when you've **removed a loop or array scan that ran every render**, replaced an O(n) operation with O(1), or cut a per-item allocation — that's a real reviewer-relevant win, so note it. The bar is a real complexity/allocation change on a hot path — not cold/one-shot code, and not "marginally faster."

3. **Does the diff reverse something that looks deliberate?** — a deleted guard, special case, or default; especially a removed comment/doc that described the old behavior as intended. If yes, the history is load-bearing: blame the removed lines, cite the introducing commit with a permalink, and state why the old intent no longer applies (per the origin-digging principle above). A reviewer who recognizes the old behavior as intentional will stall the review to ask "was this on purpose?" — answer it preemptively.

### Tighten before you post
Drafts run long because research turns up more than the reviewer needs. **Length should track the subtlety of the problem, not how much you discovered.** After drafting, do one deliberate cut pass — for each sentence ask:

- *Could the reviewer get this from the diff?* Cut it. The smaller the diff, the less scaffolding it needs: don't quote the old code being replaced, walk every link of the cause-and-effect chain, or expand an error message past the line that identifies it.
- *Did I already make this point?* Cut the echo. Trailing sentences that restate the root cause, the fragility, or the fix in slightly different words add length without information — make each point once.
- *Did I just show this concretely?* A code block, config-and-error example, or ASCII diagram already made the point — don't re-walk it in prose. Show it *or* explain it, not both.

Rough gauge: a one- or two-file fix is a few sentences of context plus a short test plan. The best PR descriptions read like the author was slightly impatient to get back to coding.

### Test plan / validation sections

Whether it's your own test plan or the PR template's "how to test" / validation / QA section, list only what a reviewer would actually exercise to validate the change. Omit routine checks (typecheck, lint, build, unit tests passing) unless the PR itself changes the test/build/lint/type setup — those are table stakes you ran locally, not validation content for the reviewer.

When a short runnable example makes the change easy to verify, include it inline instead of just writing "tested locally" — the smallest snippet that reproduces the behavior. If the example is long enough to bury the description (roughly >100 lines), put it in a gist (`gh gist create`) and link that instead of pasting it inline.

For UI-affecting changes, include visual evidence — a reviewer can rarely judge a visual fix from the diff alone. Before/after screenshots for layout fixes; a short screen recording for interactions or animations. Upload via the github-upload skill (GitHub user-attachments render reliably inline; mp4 beats gif on size). Keep the media current: if later commits change the visible behavior, re-capture.

### How did I test?, Screenshots / videos, Risks and impact, Rollback plan

**How did I test?** Device, steps, expected and observed result, per platform. The before and after recordings from steps 4 and 6 are the evidence; if later commits change the visible behavior, re-capture. Say which platforms you exercised and, when one was enough, why; a shared-code change tested only on iOS says so.

**Screenshots / videos.** One table per platform, before on the left, after on the right, the bare `user-attachments` URL in each cell; GitHub renders the player inside the cell. A one-line caption above each table saying what the clip shows, nothing else:

```markdown
### iOS

Delete an already-loaded message; before shows the gap and the error toast.

| Before | After |
|---|---|
| https://github.com/user-attachments/assets/<before-ios> | https://github.com/user-attachments/assets/<after-ios> |

### Android

| Before | After |
|---|---|
| https://github.com/user-attachments/assets/<before-android> | https://github.com/user-attachments/assets/<after-android> |
```

A platform with a screenshot instead of a recording uses the same cell (`<img src="..." width="300">` keeps two phones side by side). One table when one platform was enough. A change with nothing to show on screen has no table.

**Risks and impact.** Two things in this codebase deserve a sentence whenever a diff touches them, because neither is visible in the diff. React Query here runs with a global `staleTime: Infinity` and refreshes only through explicit table-dependency invalidation, so if you touched a `createReadQuery` / `createWriteQuery` declaration or a `queryKey`, say what now invalidates what. And a schema change means a migration, generated by `pnpm generate:migration` and never hand-written; say that you generated it.

**Rollback plan.** Usually "revert the PR". When it is not (a migration has run, a setting was written) say what else has to happen.

### Descriptions must reflect the diff, not the process
The PR description should describe **what is in the diff vs the base branch** — not the iterative work done during review. If a reviewer flags an issue and you fix it, that fix becomes part of the diff and should be described as such, but do not include review-process artifacts like "re-enabled X that was accidentally disabled" or "fixed Y from review feedback" unless they are meaningful changes relative to the base branch. If a fix addresses a pre-existing issue unrelated to the PR's purpose, it should not be in the description at all.

### Keeping descriptions up to date
When making changes after a PR is opened, update the description if the approach, scope, or test plan changed. Re-read the diff against the base branch to ensure accuracy — do not accumulate iterative changelog entries.

### Splitting and stacking
When work spans multiple PRs (a stacked branch, or a feature PR plus an independent fix), scope each description to its own diff-vs-base: move content between descriptions rather than duplicating it, and leave a one-line cross-reference in each ("Related: #5917 independently fixes the highlight alignment"). Prefer basing each PR on the default branch when the code allows — move the genuinely dependent piece into the PR it depends on rather than stacking the whole branch. After restructuring (moving commits between PRs, retargeting a base), re-derive every affected description from its new diff, and re-check that each PR's screenshots/videos still demonstrate *that* PR's behavior.

### Always refetch before editing
Before running `gh pr edit --body`, fetch the current body with `gh pr view <num> --json body -q .body`. The user may have edited the description manually (fixed typos, reworded the test plan, checked boxes, added links). Overwriting with a locally-remembered version silently discards their changes. Diff the fetched body against your last-sent version, preserve anything that changed, and only then apply your update.

## Fresh-eyes review pass (before you post)

Before running `gh pr create` (or finalizing the description in a dry run), put the draft in front
of a **fresh-context reviewer** — a subagent that never saw your research and judges the
description as written. This catches bloat you've rationalized: you're attached to everything you
dug up; a cold reader isn't. Run it on every PR (a tight, honest body passes in seconds).

1. Spawn one subagent with your harness's subagent tool (the Task/Agent tool in Claude Code),
   running in the repo, with `references/lazy-skimmer-review.md`. Give it **only the PR title and
   body** and **the base branch to diff against** — not your reasoning, not the diff itself. It
   pulls the change with `git diff <base>...HEAD` (plain `git diff` if you haven't committed yet);
   naming the base is what makes this work after you've committed/pushed, when plain `git diff`
   shows nothing.
2. It returns a skimmability score (1–5), where its attention dropped, anything buried below that
   point, and 1–3 concrete cuts.
3. **Apply the warranted cuts** — bias toward cutting and toward moving the gist above the tune-out
   point. But evaluate the feedback; don't apply it blindly. Tighten the prose *inside* sections;
   don't drop or rename a template section heading, rewrite the title, or cut a required derivation
   to land a cut. If the skimmer skipped a load-bearing risk caveat, keep it (maybe move it up).

One pass is enough; don't loop. If you can't spawn subagents, run the persona file yourself as a
deliberate fresh-eyes pass — weaker (you can't un-see your draft), but better than nothing.

## Code comments in bug-fix PRs

When your change moves code from broken to correct, don't document what was broken in a code comment — not the bug, not a link to the issue that was fixed. The code just does the right thing now; the history belongs in the commit message and PR description. A future reader opening the file doesn't need to know what used to be there.

Exception: the code itself is **unintuitive** — a hack, a workaround for a bug you don't own (upstream library, platform, framework), or a spot with known edge cases. A short comment keeps future readers from "cleaning up" something that looks odd but is there on purpose. Keep it to one or two lines. Link an upstream issue only when understanding the workaround requires the full context — otherwise the unusual pattern plus a one-line "why" is enough signal.

```tsx
// Forces remount on state change to work around facebook/react-native#52415.
<View key={hasUnreads ? 'unread' : 'read'} ... />
```

Rule of thumb: if removing the comment would leave a future reader confused about *why* the code looks unusual, keep it. If the comment only explains a bug that no longer exists, delete it.

## Justification belongs on the PR, not in the code

When you write a comment that explains **why you made this change** — why this shape instead of
the obvious one, why the signature is written this way, why the extra branch is there — check who
the explanation is for.

- Does it answer *"why did the author do this?"* → review-time information. Post it as a comment on
  the diff line, not in the file.
- Does it answer *"why does this code look strange?"* for a reader who never saw the PR → keep it in
  the code (see "Code comments in bug-fix PRs" above).

The test is the reader. A future reader opens the file with no memory of the alternatives you
weighed; a reviewer reads the same lines while holding the diff and asks exactly why you chose
them. Comments that compare the new code to the code it replaced only make sense to the second
reader.

<Bad>
```ts
/**
 * The Fetch function to use. Defaults to window.fetch
 *
 * A bare call signature rather than `typeof fetch` so callers can pass a
 * plain fetch-shaped function under runtimes whose global carries extra
 * properties (bun's adds `preconnect`).
 */
fetch?: (...args: Parameters<typeof fetch>) => Promise<Response>;
```
</Bad>

<Good>
```ts
/** The Fetch function to use. Defaults to window.fetch */
fetch?: (...args: Parameters<typeof fetch>) => Promise<Response>;
```
Plus a comment on the diff line: "Bare call signature instead of `typeof fetch` — bun's global
fetch carries an extra `preconnect` property, so `typeof fetch` rejects a plain fetch-shaped
function."
</Good>

Attach the comment to the exact line so it sits next to the code it explains:

```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments \
  -f body='<the justification>' \
  -f commit_id='<head sha>' \
  -f path='src/file.ts' \
  -F line=65 \
  -f side=RIGHT
```

Use `gh pr comment <number> --body '...'` only when the point covers the whole PR rather than one
line. Either way, post it yourself when you open the PR — do not wait for a reviewer to ask.

## GitHub Code Links

Always use **permalinks** (URLs with a commit SHA) instead of branch-relative links. Branch links break when the file changes.

To get a permalink: resolve the commit SHA via `gh api`, then construct:
```
https://github.com/{org}/{repo}/blob/{sha}/{path}#L{start}-L{end}
```
