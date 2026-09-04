# Surface Channels — channel hooks design note

**Status:** post-6b workstream; nothing in v0 depends on it. Contingent on the hooks verification spike (`hooks-spike-findings.md`), whose verdict holds while the hooks-relevant desk files (`app/channels-server.hoon`, `sur/hooks.hoon`, `sur/channels.hoon`, `lib/channel-utils.hoon`, `ted/hook/run.hoon`) are byte-identical to the spike's pin; the desk preflight can watch those paths. Re-run the spike ladder if they change.

## What hooks are, for this project

Host-side Hoon on the channel host's `channels-server`, running on channel events with allow/deny/transform and effects. In v0 the surface channel host is the bot's moon, so the bot's CLI can install them. In v1's group-host hosting, installation moves to a ship the bot does not own — that is a provisioning item, recorded in the ledger.

## Spike facts that are design constraints (observed, not assumed)

1. **Denial is silent to the writer.** `%denied` yields a positive poke ack, the post appears in no scry, the denial message is visible only in the host's dojo, and the writer's `%channels` keeps the post in `pending.posts` indefinitely.
2. **Effects re-enter the hook pipeline.** A post a hook emits runs the hooks again.
3. **`hooks cron` fires once immediately** on scheduling, then on period.
4. **`%groups` and `%contacts` effects are stubbed with `!!`** — emitting them crashes the event, which nacks the triggering post.
5. **The description cell is readable from the bowl** at `group.bowl → channels → meta.description`, and `group.bowl` is the bunt when `%groups` is unknown.
6. **`%wait` self-rescheduling works.**

## Trust-tier rules (hard, permanent)

- Hooks are host infrastructure, a separate tier from app bundles. Nothing an app or its spec can express may cause hook installation; **`surfaceSpec` never gains a hooks field.**
- **Curated, parameterized fixtures only.** No bot-authored Hoon in any loop, ever. Parameters travel through the hook config map.
- **Effects allowlist:** `%channels` and `%wait` only. Never `%groups`, `%contacts` (fact 4), `%dm`, or `%activity`.
- Every surface hook ignores events whose author is `our` (fact 2), which is also the condition under which a validation hook must *allow* host events.

## Design 1 — host-side validation pre-filter (M4 deliverable)

**Purpose.** Enforce the §4.3 invariants at the host so adversarial events never enter the log or replicate: adversarial posts today land in history and are ignored by every client's reducer; with the pre-filter they are refused before commit.

**Denies exactly:** a surface-kind post whose blob fails structural validation (shape, size caps), an invoke whose `actionId` is not in the current spec's action map (read per fact 5), a `mode: 'host'` entry from a non-host author, a malformed entry count. **Allows everything else**, including all host-authored events and anything it cannot evaluate.

**The rule that makes silent denial acceptable (fact 1):** `hook-denies ⊆ client-refuses-to-send`. The hook may deny only inputs the shipped client's own validation already refuses to emit, so a legitimate client can never hit a denial and never strands a pending post. This is asserted, not assumed, by a **conformance corpus** — shared JSON event fixtures run through the TS validator and through the hook via the dojo runner (`hook-run`; the spike's runner patch is therefore a prerequisite), asserting hook-deny ⇒ client-invalid on every fixture.

**Named cases the pre-filter must NOT be asked to carry.** Two §7 writer obligations look like validation and are out of reach here, because the hook must allow every host-authored event (fact 2) and both are host-authored: a snapshot whose `upToSequenceNum` exceeds the channel's real head (D175), and a `preserveState: true` revision that edits `initialState` (D176, D167). The first is checkable in principle — the hook can see the channel's head — but denying a host snapshot violates the trust-tier rule above; the second is not visible from a single event at all. Both stay writer obligations enforced at publish time, and the pre-filter's scope note should say so rather than leaving a reader to assume the hook covers them.

**Claim hierarchy, stated as for the gate:** the hook is a pre-filter, never the boundary. The reducer remains the single authoritative implementation of §4.3; a hook is a second implementation of a *subset* and drift between them is the raw-vs-validated divergence at language scale, which is what the corpus exists to catch. **Fail open**: on the bunt bowl or any unevaluable condition, allow.

**Why M4:** its value is security, and shared groups — other members' bots' code and other members' posts — is where the threat exists. In a personal group the only adversary is the user.

## Design 2 — ship-side rollover fixture (resilience upgrade, unscheduled)

A single parameterized fixture (`period`, target pointer, archive pointer) that posts the daily host event as `our`, using `%cron` or `%wait` (fact 6). Not needed by any v0 template: countdown derives time from the host-supplied render input with zero ticks, and habit rolls over lazily on the bot's next interaction. Value is resilience — a rollover that survives the bot process and the gateway.

**Constraints:** idempotent per date — archive only if `/today` is non-empty and `/history/<date>` is absent — because installation fires immediately (fact 3) and restarts re-fire; the posted host event is byte-identical to the bot's lazy rollover so the tick source is swappable without template changes; ignores its own post on re-entry (fact 2).

## Design 3 — rate limiting: deferred

Fact 1 rules out the naive design: denying a burst of legitimate taps silently discards votes with no feedback path and leaves them pending on the writer forever. What survives is a flood cutoff at rates no human produces, whose value is marginal. Deferred without a schedule; revisit only if shared-group flooding is observed.

## Sequencing

1. Land the runner patch (`hook-run`) — prerequisite for the corpus.
2. Design 1 with its conformance corpus, inside M4's hardening.
3. Design 2 opportunistically, when habit's lazy rollover proves annoying in use.
4. Design 3: not scheduled.

## Items routed to the hooks maintainer (not ours)

The `!!` effect stubs, silent denial semantics, denied posts lingering in `pending.posts`, and the doc drift — see the report sent to arthyn. Their resolution may relax constraints above; until then the constraints stand as written.
