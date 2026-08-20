---
id: TASK-9
title: Extend agent post-edit tooling to write blobs
status: To Do
assignee: []
created_date: '2026-08-19 13:47'
updated_date: '2026-08-20 14:23'
labels:
  - workspaces
  - interactive-cards
  - agent
milestone: m-1
dependencies:
  - TASK-3
references:
  - PLAN.md
  - packages/api/src/client/postsApi.ts
  - docs/tlon-apps/post-blobs.md
priority: high
type: feature
ordinal: 3200
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md's server-authoritative card model requires the agent to edit its own original message with new surface state. The post-edit transport already accepts a replacement blob (packages/api/src/client/postsApi.ts), but the agent's CLI edit path only edits message text.

Extend the agent's post-edit tooling so it can replace a post's blob (carrying the interactive surface entry defined by the protocol task) alongside or independently of text edits. Note the current frontend policy in docs/tlon-apps/post-blobs.md — frontend edit flows preserve the original blob; that policy stays for human edit flows, this change is for the agent's own tooling.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Agent tooling can edit one of its own posts replacing the blob with a new interactive surface payload
- [ ] #2 Text-only edits from human frontend flows continue to preserve the existing blob unchanged
- [ ] #3 Editing with a stale expected revision is rejected or safely ignored rather than clobbering newer state
- [ ] #4 Tests cover blob edit success, stale-revision rejection, and text-edit blob preservation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan

One decision needs you — §5 (how hard to guard against erasing a card). One thing needs saying before anything else, because it changes what this task is.

### 1. `tlon posts edit` currently destroys blobs. Every time.

This is a live bug, not a gap.

- `PostEditInput` (`commands/posts.ts:123`) has **no `blob` field**. `PostSendInput` right below it does.
- `apiEditPost` sends `blob: blob ?? null` (`postsApi.ts:258`).
- `%edit` stores the submitted essay wholesale.

So every `tlon posts edit` sets the post's blob to null. Any file attachment, voice memo, context-lens run record, kit card, or a2ui card on a post the agent edits is silently and durably erased. `ExistingPost` (`:162`) does not even carry `blob`, so the command cannot see what it is destroying.

The command already goes to real trouble to avoid exactly this class of mistake for *other* fields — it reads the post back to preserve title, image, cover, and the bot authorship shape, and **throws rather than editing blind** when it cannot read it, with a comment saying why. Blob was simply missed.

AC #2 asks that human frontend flows keep preserving the blob. They do: `editPostUsingDraft` passes `blob: postBeforeEdit.blob ?? undefined` (`postActions/postActions.ts:676`), and `docs/tlon-apps/post-blobs.md` design rule 5 states the policy. The agent path is the one that is wrong, and more wrongly than the AC contemplates.

**So preserve-by-default comes first, and the new capability is layered on top.** That ordering matters: it means a caller who does not mention blobs cannot lose one.

### 2. Plumb the blob through the lookup

- Add `blob?: string | null` to `ExistingPost`.
- Map it through in `posts-runtime.ts`'s `getChannelPosts` adapter.
- Add `blob?: string` to `PostEditInput`, and pass `existing.blob ?? undefined` in `editPost` by default.

That alone fixes §1 and satisfies AC #2 for the agent path as well as the frontend.

### 3. `--blob <json>` on `posts edit` — AC #1

`posts send` and `posts reply` already take `--blob <json>` (`commands/posts.ts:37`), and `'blob'` is already in the flag lists at `:81` and `:86`. Adding it to `edit` is the same flag in a third place, with one extra rule:

- **absent** → preserve the existing blob (§2)
- **present** → replace it wholesale
- **`--blob ''`** or an explicit empty array → clear it, for the caller who really means to

The value is a post-blob JSON array, validated by the same parse the other two commands use before it goes on the wire. Rejecting a malformed blob locally matters more here than on send, because a bad edit destroys existing state rather than just failing to add new state.

### 4. `--expected-revision <n>` — AC #3, and its honest limit

The backend stores and relays `blob` without inspecting it, so there is nothing server-side to enforce a revision against. The check has to be client-side:

1. Read the post (the command already does this).
2. Parse its `interactive-surface` entry with `findInteractiveSurface` (landed in TASK-10).
3. If `--expected-revision` was given and does not match, refuse with a clear error naming both revisions.

**This is advisory, not a lock, and I want that written down rather than implied.** Between the read and the poke there is a window in which someone else can edit the post; nothing closes it. It catches the realistic case — an agent working from state it fetched a moment ago, or a retry of a stale plan — and it cannot catch a true race. `%notes`' `expected-revision` has the same shape but is enforced inside the agent, which is a strictly stronger guarantee than anything available here.

Two smaller rules, both from `docs/tlon-apps/interactive-surfaces.md`:

- A post with **no** surface entry and `--expected-revision 0` should be treated as a match, not a failure: revision 0 is the initial state.
- `--expected-revision` with no `--blob` is a caller error, not a no-op. Guarding a text-only edit against a revision it does not touch reads as a mistake worth surfacing.

### 5. Decision — guarding against erasing the card

This is the protocol's sharpest edge, quoting the doc directly:

> An edit therefore replaces the entire blob, and **any entry not re-emitted is erased**. So an agent updating a surface must rebuild the whole blob array — the `a2ui` entry included — not just the entry it changed. Omitting the blob entirely on an edit erases the card outright.

A caller who passes `--blob` with only the new `interactive-surface` entry gets a card with state and no view. That is the single most likely way to misuse this command, and it is exactly what TASK-12 will be doing on every action.

- **(a) No guard.** `--blob` means what it says. Simplest, and the doc already warns. But the first wrong call silently deletes a card from every member's copy.
- **(b) Refuse the destructive case.** If the existing blob has an `a2ui` entry and the replacement does not, error out and say so, with a `--force` to override. Catches the real mistake, costs one comparison, and the escape hatch keeps deliberate removal possible.
- **(c) Merge.** Carry forward entries the replacement omits. Rejected — it makes `--blob` mean something other than "replace", and then removing an entry becomes impossible to express.

**I recommend (b).** It is a guard against one specific, high-cost, easy mistake, not a general safety net, and it does not change what `--blob` means. **This is the decision I need.**

### 6. Tests — AC #4

Existing coverage to extend: `commands/posts.test.ts` already has a `makeDeps` harness recording `editPost` calls (`:102`), so all of this is unit-testable with no ship.

- **Blob replace** — `--blob` with a surface payload reaches `editPost` verbatim.
- **Blob preserved on a text-only edit** — the regression test for §1. Edit with no `--blob`, assert the existing blob is passed through unchanged. This is the one that would have caught the current bug.
- **Blob cleared explicitly** — `--blob '[]'` sends an empty array rather than preserving.
- **Stale revision refused** — mismatch errors and `editPost` is never called. Plus the two edge rules from §4: absent surface with `--expected-revision 0` succeeds; `--expected-revision` without `--blob` is rejected.
- **Malformed `--blob` refused** before any poke.
- **The §5 guard**, whichever way you decide.
- **Frontend preservation (AC #2)** — check whether `postActions.test.ts` already asserts `blob: postBeforeEdit.blob`. If not, add it; the policy is currently protected only by a comment.

### 7. Verification

`pnpm -r tsc`, then `pnpm --filter '@tloncorp/tlon-skill' check` — that is the exact CI invocation and it needs **bun**, which is now installed at `~/.bun` (1.3.4, matching the workflow pin). It runs typecheck plus 449 unit and 364 hermetic tests plus the binary build smoke. Also the api and shared suites, and prettier.

`cli-test-matrix.ts` enumerates `posts edit` invocations for the help/usage surface; a new flag needs its entries there too or the matrix drifts.

### 8. What this does not do

- **No action application.** Validating an actor, computing new state, and deciding to edit is TASK-12. This task gives it the tool.
- **No surface-aware convenience command.** A `posts surface` that takes state and does the read-modify-write itself would be a better interface for TASK-12 than raw `--blob`, but it presumes the apply semantics TASK-12 owns. Worth revisiting there.
- **No change to human edit flows.** They already preserve the blob and should keep doing so.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research notes, before any code.

**The headline finding: `tlon posts edit` erases the blob on every call.** `PostEditInput` (`commands/posts.ts:123`) has no `blob` field — `PostSendInput` immediately below it does — and `apiEditPost` sends `blob: blob ?? null` (`postsApi.ts:258`), which `%edit` then stores wholesale. So any file attachment, voice memo, context-lens record, kit card, or a2ui card on a post the agent edits is silently destroyed. `ExistingPost` (`:162`) carries `title`/`image`/`description`/`cover`/`isBot` but **not** `blob`, so the command cannot even see what it is deleting.

This is a live bug rather than a missing feature, and it is worth noting the command already takes the same class of care everywhere else: `editPost` (`:789`) reads the post back specifically to preserve metadata and the bot authorship shape, and **throws rather than editing blind** when the read fails, with a comment explaining that `%edit` submits the whole essay so editing blind is "a silent, durable rewrite". Blob was just missed.

**The frontend side of AC #2 is already correct.** `editPostUsingDraft` passes `blob: postBeforeEdit.blob ?? undefined` (`postActions/postActions.ts:676`) with a comment that blob is not editable, and `docs/tlon-apps/post-blobs.md` design rule 5 states the policy. So AC #2 is about *keeping* that true while adding the agent capability — but the agent path is the one that is actually broken.

**`--blob <json>` already exists on two sibling commands.** `posts send` and `posts reply` both document it (`commands/posts.ts:29-30`, `:37`) and `'blob'` is already in the flag lists at `:81` and `:86`. Adding it to `edit` is the same flag in a third place, not new machinery.

**AC #3 can only be advisory, and I want that stated rather than implied.** The backend stores and relays `blob` without inspecting it, so there is no server-side enforcement point for a revision check. It has to be read-then-compare-then-poke on the client, which leaves a genuine window between the read and the write that nothing closes. It catches the realistic failure (an agent acting on state it fetched a moment ago, or a retried stale plan) and cannot catch a true race. `%notes`' `expected-revision` looks similar but is enforced inside the agent, which is strictly stronger.

**`findInteractiveSurface` already exists** — landed in TASK-10 (`5fafe613cd`) in `content-helpers.ts` and exported from `@tloncorp/api`. So parsing the current revision out of a post is a one-liner here rather than new code.

**The erase-the-card trap is the main hazard.** Per `docs/tlon-apps/interactive-surfaces.md`, an edit replaces the entire blob and any entry not re-emitted is erased — so a caller passing only the new `interactive-surface` entry ends up with state and no view. That is precisely what TASK-12 will do on every action, which is why the plan proposes a guard on the specific case of dropping an `a2ui` entry.

**Test harness is in place.** `commands/posts.test.ts` has a `makeDeps` fixture recording `editPost` calls (`:102`), so every case here is unit-testable without a ship. `cli-test-matrix.ts` separately enumerates `posts edit` invocations for the help/usage surface and will need entries for a new flag.

**Verification needs bun**, now installed (1.3.4 at `~/.bun`, matching the `oven-sh/setup-bun` pin). `pnpm --filter '@tloncorp/tlon-skill' check` is the exact CI command: typecheck + 449 unit + 364 hermetic tests + binary build smoke.
<!-- SECTION:NOTES:END -->
