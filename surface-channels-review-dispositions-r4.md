# Sol cold review r4 — dispositions

One entry per finding in `surface-channels-sol-review-r4-findings.md`, plus
the one survivor from the refused run that was never emitted as a finding.
The findings themselves are in that file, verbatim; this file says what was
decided about each and names the control that now stands behind it.

**All twelve were actioned.** Nothing here was declined and nothing was
deferred. Read this as the record of what was decided, not as a queue.

**Every control below entered the tree with the mutation that should break it
applied and observed breaking it.** Where the demonstration is worth reading —
because the pre-fix behaviour is the finding — the failure output is quoted.

The round was corrective only: no new capability, and **nothing in it touches
the browser-containment surface.** Every change is on the correctness track.

---

## The two Highs

### 1. High — hydration discards duplicate-sequence posts — **fixed, D187**

`getSequencedChannelPosts` ordered by `sequenceNum` alone with a `< N` cursor,
so one of a tied pair was read as a gap and then excluded from every later
page. The reducer's D174 tie-break never saw both rows.

**Where the boundary is.** In the paginator, not the reducer. The tie-break was
correct where it stood and protected nothing, because the row it was supposed to
compare against had already been dropped one layer down. Ordering and the page
cursor are both the pair `(sequenceNum, id)` now, and the contiguity walks treat
a repeated sequence number as another row on the same rung rather than a gap.
The SQL order is byte order on the id — deliberately not the reducer's canonical
order, because its only job is to enumerate every row exactly once. Which tied
row wins stays the reducer's call, over the complete set.

**Control** (the finding's own, verbatim): conflicting same-sequence posts
inserted in opposite orders into two databases, both hydrated, both required to
reach the reducer with the canonically greater id winning —
`packages/shared/src/store/surface/hydration.test.ts`. Run at `pageSize: 1`
(the tie split across a page boundary — the half the tuple cursor fixes) and at
`pageSize: 50` (both rows in one page — the half the contiguity walk fixes).
Under the pre-fix code it fails: `x: 1` and a one-entry log, in every
arrangement.

**One honest note about what the mutation showed.** Under the pre-fix code both
insertion orders produced the *same* wrong state on this SQLite build, not two
different ones — the planner satisfied `ORDER BY sequence_number DESC` off an
index keyed on `(channel_id, id)`, so the tie came back id-ascending regardless
of insertion order and the old code deterministically kept the loser. That
determinism is an accident of planner and index choice, not a contract: mobile
(op-sqlite) and web (SQLocal) are different builds. The assertions doing the
work are the two the reviewer named — both rows reach the reducer, and the
canonical id wins.

**The reading the fix was gated on: are duplicate sequence numbers producible?**
Answered out of the Hoon rather than assumed, and the answer is **yes, and it has
already happened.** `desk/lib/channel-utils.hoon:1584-1598` is `+repair-channel`,
whose docstring lists "duplicate sequence nrs in the posts" among the things past
migrations caused; it is wired into `state-10-to-11`. The 7→8 conversion numbered
`posts` and the `log` with two independent counters over different id sets. There
is a diagnostic thread whose whole job is finding them
(`desk/ted/channel/check-posts-integrity.hoon:45`), and the type itself concedes
the case (`desk/sur/channels.hoon:483`). The client mirror can hold them even
where the host does not: `++ca-apply-post` keeps the old `seq` on every
checkpoint, and the corrective round trip has no automatic trigger. Normal
posting cannot produce one — the counter is increment-only — so this is a
migration and mirror class, not a live-write class. Recorded in D187.

**Residual, recorded not fixed:** `mode: 'around'` gets the deterministic
secondary sort but not the tie retention. It indexes a single cursor row out of
its result and slices around it, so retaining a tie changes the window
arithmetic — and it is the chat scroller's jump-to path, not the surface fold's.
Changing it here would be an unmeasured change to a much larger blast radius.

### 2. High — the write fence is check-then-overwrite — **fixed, D188**

Publish, fork and `channels update`/`rename` each read a channel, did seconds of
asynchronous work, then submitted a complete stale channel value to a `%groups`
that has no version token. Publish's own read-back then certified its own
overwrite, which is what made it silent.

**Where the boundary is.** At the write, not at the check. The scope contract
said "at write time" in as many words and the tests only ever mutated state
before the command ran — a contract sentence with no control under it.

All three paths now re-read the target immediately before the write
(`readDefinitionForWrite`), refuse on any change naming both identities, and
write nothing. Two details that are part of the fix rather than incidental:

- **The identity compared is narrower than the operator's pre-state bound.**
  That one folds the post head in, so a member saying hello during the upload
  would fail a publish. This one is the definition cell and nothing else.
- **The payload is built from the FRESH channel.** A full-cell overwrite
  otherwise drops another admin's concurrent edit to an unrelated field — a
  title, an icon — which is the same race with a wider blast and no gate at
  all. `channels update` compares the whole cell and refuses.

**Control** (the finding's own): the fake ship is mutated *during* the command —
in the bundle-upload seam and again immediately before the write — in each of
the three paths; each must refuse with zero description writes, asserted against
the double's write log rather than its final value. For publish the control also
pins the self-certifying read-back, so no regression can overwrite-and-confirm
again.

**Residual, stated in the plan (§4.3) and in the fence's own contract comment.**
A last-second re-read narrows the window from the length of a bundle upload to
one round trip. **It does not close it.** Closing it needs compare-and-swap on
the description cell in `%groups` — a backend change, recorded as a v1 item in
plan §12 alongside the `%surface` agent. v0 claims the narrowing and not the
guarantee. Also recorded: a full-cell write cannot merge a concurrent edit the
way an append-only log would, so only one half of this wire format converges.

---

## The survivor from the refused run

### S. The D175 head guard did not reach the CLI — **fixed, D190**

`advertisedHead` appeared zero times in `packages/tlon-skill`. The CLI folded
from a snapshot the client refuses as future-covering, and `surface snapshot`
would then write a fresh one out of that fold — laundering the bad boundary into
a record the client *would* accept, while the original still stood.

**Where the boundary is.** The client, not the CLI — and the CLI is the writer.
A guard that only the reader applies is a guard the writer can walk through.

The CLI now derives the head from the ship as it hydrates: it has no local store
to compare against itself, so the greatest sequence number the ship returned on
this call *is* the server's head, and both commands already refuse a truncated
page walk before reducing. The fold now REPORTS what it stepped over
(`headExceededSnapshots`) rather than only logging it, on the reduced and the
migration-pending branch both. `surface state` folds the real log and names the
post; `surface snapshot` **refuses**.

**Refusing rather than repairing is the disposition, not an omission.** Snapshot
selection takes the greatest boundary, so a fresh honest snapshot loses to the
bad one — writing would report a repair that changed nothing. The repair is
retracting the offending post, and the refusal says so.

**Control:** a snapshot claiming `upTo: 1_000_000`. Pre-fix, `surface state`
reports `{"bringing": {"laundered": true}}` — the inflated snapshot winning. Post-fix
it reports the real fold and `headExceededSnapshots: [2]`, and `surface snapshot`
exits 1 with `snapshot-head-exceeded` and zero posts written. A third case pins
that an honest snapshot at the head is still folded from, so the guard can be
observed NOT firing.

---

## Mediums and Lows

### 3. Medium — a corrected revision does not recover a halted sandbox — **fixed, D194**

The halt was a bare message and the early return sat above the keyed host, so a
board halted on revision 1 could not mount revision 2. An admin publishing the
fix changed nothing for anyone already looking at the broken board — which is
exactly the population that cannot be told to press Reload.

The halt now names the session that produced it and is shown only when that
session is the one being mounted. `reloadSurface` no longer clears it
separately: a reload is already a new session, and clearing it twice would be
two representations of one fact.

**Control:** halt v1, rerender with healthy v2, require the halted state to
clear and a fresh live frame to appear — plus its converse, that a re-render of
the SAME revision keeps the halt, so the fix cannot degenerate into "never
halt". Under the pre-fix shape both fail.

### 4. Medium — countdown's note implies publish owns `shellVersion` — **fixed, D195**

Publish owns `assetRef`, `sha256` and `size` and preserves the author's
`shellVersion` — the one field in the block whose loss is not repaired by the
next publish, since publish defaults an absent one to 1 and old clients then run
a bundle needing shell 2.

Fixed in countdown, and **pinned across every template**, because the wording
was copied between templates and the next drift will be too. Three templates
carried no bundle note at all — the same defect with nothing to read — and have
one now.

**Control:** `surface-templates.test.ts` requires every template's `NOTES.md` to
name the three publisher-owned fields and to name `shellVersion` as the
author's. Reverting countdown's note to "the whole `bundle` block is
placeholders publish overwrites" fails it.

### 5. Medium — preview doctrine describes two obsolete execution models — **fixed**

`RUBRIC.md` said preview folds actions only and cannot express host events;
`--host-ops` validates and folds real host entries. `rsvp` and `potluck` said
destructive actions must be declared first to avoid losing an actor; the restore
pass removed that cost.

Both corrected against the source. The rsvp/potluck notes were **not** simply
emptied: the reviewer's own observation — that with current ordering the restore
pass does not yield one actor per answer, because later constructive actions
overwrite earlier ones for the same actor — is now stated in each file, so the
replacement text is accurate rather than merely un-stale. A grep for the same
claim found two more instances (RUBRIC's `memberInteraction` bullet and
habit-tracker's notes, the latter self-contradicting the very next sentence);
both fixed.

**Control:** the reviewer named the restore-pass test as its own negative
control, and it stands. The doctrine text itself is covered by the claims-index
validator (see 6) rather than by a per-sentence pin — a pin per sentence is the
machinery this project has repeatedly declined.

### 6. Medium — the claims index is materially stale — **fixed, and now validated in CI**

The index identified itself as a dirty working tree at `2c62221d7b`, not a
commit, and its own header said "Nothing here is verified against any commit."
An index that cannot say which tree it describes is a claim, not evidence —
which is the exact failure it exists to catch.

Regenerated at this round's head with the eight stale rows corrected, and the
now-false-and-fixed "host events cannot be previewed" claim added. A validator
runs in CI beside the decision-record check.

**Controls** — one per failure mode, each demonstrated: a dead file anchor; a
line number past end-of-file; a cited surface file changed since the recorded
head; the dirty-tree wording restored.

**One deliberate departure from how this was specified, because the strict form
was unaffordable.** "The index's recorded head equals the validated commit",
enforced flatly, means every cited file must be unchanged since that head — and
the index cites `DECISIONS.md`, `ci.yml`, `e2e/test-fixtures.ts` and
`db/queries.ts` among its 113 paths. After merge that turns most pull requests
in the repository red until somebody regenerates a Surface Channels document
they have nothing to do with. So the rule is split by ownership: drift in a
surface-owned path fails, drift anywhere else is reported by name and the run
stays green. The gate sits where the claims are load-bearing and where whoever
moved the file is whoever owns the index. Recorded as D197 rather than done
quietly, because it is a weaker guarantee than the one that was asked for.

### 7. Low — fork's fresh-id invariant is asserted, not enforced — **fixed, D193**

`--surface-id` is removed. The landing run takes the id from the completed
rubric sheet, which already binds it to these bytes and this definition and is
already required. Passing the flag is now an unknown-option refusal.

**Why removal rather than the check the finding proposed.** The finding's
control — refuse when the destination holds retained posts under the requested
id — is a correct check for a situation that should not be expressible. Removing
the flag makes the reused-id fold unconstructible instead of caught.

**Stated honestly, because "impossible" is the kind of sentence this project
keeps having to retract:** this removes the OVERRIDE, not every path to a reused
id. A caller who hand-edits the staged spec before previewing gets a sheet keyed
to whatever they wrote. That is forging the binding artifact rather than using a
documented flag — materially different, not the same thing as impossible.

**Control:** `'refuses --surface-id on every run there is'` — the flag is
refused on the staging, landing and regenerate runs alike, asserting the refusal
(exit 1, `usage`, `Unknown option: --surface-id`, nothing staged, nothing
written) rather than an absence. Re-adding the flag to the parser so it is
accepted and ignored fails exactly that test and nothing else. A second test
covers the sheet naming the source's own id, which is now `rubric-mismatch`.

### 8. Low — the reducer's "posts, any order" contract is false without ids — **fixed, D189**

`SurfacePostView.id` was optional and `comparePostIds` returned equality
whenever either side was absent, so tied id-less posts sorted in caller order.
The comparator was also not a total order in two ways: `1.000` and `1000` gave
`a > b` and `b > a` at once, and numeric versus non-numeric ids closed the cycle
`"2" > "1x" > "10" > "2"`.

`id` is required at the type level and enforced at runtime — a post with no
string id is structurally unfoldable, like one with no sequence number, and is
skipped rather than folded in arrival order. The comparator orders the two
classes first, then digit count, then digit string, then the raw string.

The gate, the preview and the transition walk mint deterministic synthetic ids
now. Without them those tools would fold in array order while a real channel
folds in id order, and predicting what the channel will do is the only thing
they are for.

**Controls:** a property test over a corpus spanning both id classes asserting
antisymmetry and transitivity directly, plus the reviewer's own reproduction —
two tied conflicting host writes reduce to the same state under both input
orders. The no-id half of that reproduction now fails to typecheck, which is the
point.

### 9. Low — `inert-action` suppression is prefix-based — **fixed, D192**

`startsWith('actions.' + id)` made `actions.vote` a prefix of
`actions.vote-no`, so a malformed `vote-no` masked a genuinely dead `vote`.
Comparison is by segment now — equal, or followed by `.` or `[`.

**Control:** the reviewer's exact fixture — dead `vote`, malformed `vote-no` —
must report both findings; pre-fix it reports one. Plus a direct unit test of
the segment comparison covering exact match, both child forms, and the
prefix-collision non-match.

Impact was bounded: the gate stayed red throughout, so the cost was a wasted
repair cycle rather than a dead action shipping green. It is still a guard that
reported one defect where there were two.

### 10. Low — `memberInteraction` can contradict a nonempty action map — **fixed, D191**

**A knock-on worth naming, because it cost coverage.** The fork test fixture
carried the marker on an actionful spec *deliberately* — it was what made rubric
check 8 apply to the copy, so the sheet the fork demands could be shown not to
be the sheet the source was scored with. That is no longer expressible. The
fixture was rewritten rather than exempted: `duplicatesTolerated` now carries the
"a declared marker survives the copy" claim alone, and the check-8 claim moved to
its own display-only fixture. `timeDisplay` was tried for the first role and
rejected — it makes the compliant bundle draw a `time-display` warning, which
would put gate noise into every fork test. One claim is genuinely narrower than
before: the check-8 statement is now made about a display-only app rather than
about the actionful fixture, because the actionful fixture cannot make it.


Refused at the SCHEMA, not in lint. The contradiction is readable by everything
that validates a spec — the reducer's read-back, `surface show`, the preview,
the client — and a gate-only rule would leave every one of those agreeing that a
self-contradicting spec is fine.

**Control:** the compliant interactive fixture plus the marker must fail schema
validation, with both non-contradicting shapes still passing so the rule can be
observed not firing.

### 11. Low — SKILL's date rule is false against its own countdown — **fixed**

`SKILL.md` said dates exist only where a host event wrote them; `PARADIGM.md`
correctly permits a value written once at creation, and the countdown stores
`targetMs` in `initialState`. SKILL now matches PARADIGM and names the countdown
as the case the old sentence got wrong.

---

## What this round did not do

The five verification rows the reviewer ranked are **handed to M3, not
actioned** — they are recorded verbatim in plan §10 as the work order M3 opens
from. Each is a measurement against a live ship or a first piece of Hoon
testing, and neither belongs in a correctness round. Row 4 (Hoon negatives for
the backend kind and size backstops) additionally wants a deliberate yes before
it starts: it would be this project's first Hoon test.

Also untouched, deliberately: native, containment, hooks, the corpus run, the
tlonbot delivery change, the invisible spinner (routed to its app owner), and
`data:`/`blob:` navigation targets.
