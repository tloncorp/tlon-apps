# Open issues

Found while fixing the test suite in November 2026. None of these is fixed.
Each entry says how much was established: **Reproduced** means it was seen on a
test ship, **Read** means it comes from reading the code or docs, and **Inferred**
means it follows from those but was not run. Recommendations are proposals, not
decisions. Line references were last checked against the code at `bcce2d5c32`, by
reading.

## Permissions

A turn the owner drives directly (their own DM with the bot, ACP, a local poke, or as a
peer) gets every tool whatever the conversation's saved tools say, except Run JS, which
needs `code` saved on the conversation. This was decided in TLON-7154. Entries 1, 3 and 9
describe what follows from it.

Run JS is not opt-in for the owner's ship working as a peer. Its peer conversations take
their grants from `owner-grant` (`desk/app/harness.hoon`), which holds `%code` and is
rewritten on every request, so there is no saved setting to leave it out of. TLON-7154
did not decide this case.

### 1. Delegated children follow their parent's tools, not its saved grants

**Reproduced.** A child of an owner conversation granted `subagents, web,
workspace` received 27 tools, including `curl`, `run_js`, `tlon`, `write_skill`
and `ask_peer`, and its `curl` POST reached a local test server. The same grant
through a non-owner hand gave the child 9 tools, and `curl` was rejected. That run
predates Run JS becoming opt-in on owner turns: without `code` saved, neither the owner
turn nor its child is now offered `run_js`.

**Read.** This is not an escalation past the parent. `action-spawn` passes the
parent's `execution-tools` (`desk/app/harness.hoon:4443`), which become `owner-tools`
for an administrator (`desk/app/harness.hoon:5668`), so the owner parent already holds
those tools itself, and the child loses `harness_admin` and `cron`. A child is capped by
what its parent turn could use, so this is intended. The comment at
`desk/lib/harness-defaults.hoon:6-10`, "delegated work retains its explicit grants", was
wrong and has been corrected.

### 3. Owner uploads are not limited by Clay path grants

**Reproduced against a throwaway `%storage` stub.** An owner session granted only
`tlon` uploaded `/harness/lib/harness-tlon-tool/hoon`. `upload-authorized`
(`desk/app/harness-tlon.hoon:819`) passes because its `clay-granted` check (`:837`) reads
the owner's effective tools, which hold all of Clay. This is intended: an owner turn
keeps every tool.

## Context and compaction

### 4. Fixed: summaries used the ship's default provider

With no summary model chosen, a conversation now summarizes on its own provider and
model, so it no longer halts on the ship's missing credential. A chosen summary model
with no credential stops with an error naming that model. `compaction-conformance`
covers both, and fails with the original error when the old route is restored.

### 19. Mutually owned bots may DM each other forever

**Inferred.** Two ships set as each other's owner failed with timeouts in `just test`, and
passed once one owned itself. Each bot answers its owner's DMs, so with failing providers
each failure message would be answered by the other, spending money with working ones.
This wasn't observed directly.

**Read.** There is no guard against replying to another bot or to a failure message.
`normalize-owned` (`desk/lib/harness-tlon-policy.hoon:119`) drops only the ship's own
messages and ungranted authors, and `settle-hands` (`desk/app/harness.hoon:4108`) posts
a failure back to the conversation, where the other side admits it as an owner DM. The
queue caps in `activity-room` (`desk/app/harness-tlon.hoon:1804`) limit waiting work,
not a strict back-and-forth. `scripts/test-js.sh` avoids the case by having each test
ship own itself.

### 5. A rejected request isn't compacted and retried

**Read, not reproduced.** The context estimate now trusts the reported prompt for
instructions, tools and memory. If those grow right at the limit, a provider can reject
the request. The user sees a request-size error (`desk/lib/harness-failure.hoon:48`), and
because a failed turn adds no new measurement, retrying would probably fail the same way
until someone runs `/compact`.

`%llm-failed` clears the pending turn and starts no compaction
(`desk/lib/harness.hoon:107`). The only automatic follow-up is `try-fallback`
(`desk/app/harness.hoon:5157`), which moves to the next fallback model on any failure
with no streamed output, so a size rejection is retried only where a fallback model with
a larger window is configured.

**Recommendation:** on a size rejection, compact once and retry, with a guard so it can't
loop.

### 6. Fixed: a non-JSON summary halted compaction

Fenced or embedded JSON is now accepted, and plain text becomes a summary with no
memories. A reply starting with `{` that doesn't parse is refused as probably cut off,
and the error says "no usable summary". `compaction-conformance` covers plain, fenced and
cut-off replies. A plain refusal could still pass as a summary if it is shorter than what
it replaces.

### 7. Fixed: summaries moved to a different provider

Fixed along with issue 4. A summary model chosen in settings still sends content to that
provider, and dreaming, which has no conversation, uses the ship's default.

### 8. `/context` understates what the turn logic uses

**Reproduced.** It reported about 8k tokens while `drive` was over a 24.7k budget.

**Read.** `context-report` (`desk/lib/harness-command.hoon:61`) estimates from the saved
grants: its view (`desk/app/harness.hoon:4077`) is not passed through `execution-tools`,
as `drive` does (`desk/app/harness.hoon:4838`). The two numbers differ only when no usage
report matches the view: before the first reported turn, after a model switch, or with a
provider that reports no prompt tokens. With a report, `est-tokens`
(`desk/lib/harness-provider.hoon:16-32`) subtracts the catalog on both sides.

### 9. Owner turns carry the full tool catalog

**Reproduced.** A request was 30.5 kB, of which 26.7 kB was the catalog of 29 tools, so
windows of 8000 or less failed with no way to shrink below it. That was measured before
Run JS became opt-in on owner turns.

This is the intended cost of owner turns keeping every tool: turning tools off does not
shrink an owner turn's request, so owner turns need a model context window well above
8000 tokens.

### 18. Fixed: recalled memory sat ahead of the history

Recall now goes just before the latest user message in all three provider formats, so a
changed selection only affects the last exchange's cache match. This is from the
request order, not measured: Harness doesn't record cache hits, and no `cache_control` or
cache key appears in `harness-provider.hoon` or `harness-provider-wire.hoon`, so caching
only happens where a provider does it automatically.

## Tool descriptions

### 10. Fixed, not checked on a model: the `tlon` tool description was over its limit

It is now under the 1,000-byte cap, which also clears a reported 1,024-character limit on
OpenAI function descriptions. The closing passage was trimmed, removing the help topic
list. **The tlonbot fixtures need rerunning**, because this text steers the model and
only they can show whether it still behaves.

## Reported state

### 11. Fixed: `/status` did not show an owner's real tools

`/status` now counts the tools the turn can use and marks an owner turn as one the
saved grants do not limit, except for Run JS. `harness/session/config` still returns the saved list, which the settings
client edits, so for an owner turn it does not show the tools the turn gets.

### 12. Fixed: a child's saved config listed tools it could not use

A child's saved config no longer lists `admin`, `cron`, `tlon-read` or `tlon-write`,
which it copied from the parent's effective tools and lost at execution. What the child
can use did not change. An owner's child still lists `tlon`, the ship-wide tool, which it
can use.

## Agent lifecycle

### 20. The Tlon adapter scries while loading

**Reproduced.** Driving `/app/harness-tlon` with `test-agent` prints `scrying during
+on-load... careful!` for four paths: `%gu /harness`, `%gu /chat`,
`%gx /chat/dm/invited/ships` and `%gu /contacts`. `on-init` takes the same route.

**Read.** `on-load` runs `abet:boot:refresh-peers:retire-uploads:reset-wake`
(`desk/app/harness-tlon.hoon:61`) and `on-init` runs `abet:boot:refresh-peers` (`:50`).
Neither defers the work.

- `refresh-peers` checks that the head agent is running before poking it
  (`desk/app/harness-tlon.hoon:214`).
- `boot` calls `accept-granted-invitations` (`:222`), which checks `%chat` and reads its
  pending DM invites (`desk/lib/harness-tlon-io.hoon:16`) inside `mole`.
- `abet` calls `sync-liveness` (`:174`), which checks `%contacts`
  (`desk/lib/harness-tlon-io.hoon:249`) inside `mole`.
- `boot` calls `catch-up` (`:230`) when the `/activity` subscription is acked. It checks
  `%activity` (`:1773`) and then reads `/activity/v6/all` (`:1777`). That read is behind
  the `%gu` check but not inside `mole`, so a crash in it fails the load.
- With the lens enabled and the hand online, `steward-lease` checks `%steward` (`:188`)
  and reads its gateway status (`:194`), both inside `mole`.

Scrying in `on-load` is discouraged: during a desk upgrade the agents being read may
be mid-upgrade themselves, and a crash that gets past the guards fails the load.
`/app/harness` defers its own peer refresh with a self-poke
(`desk/app/harness.hoon:186`).

`/app/harness` scries `%gu /harness-tlon` on load all the same. `on-load` clears the
schedule wake, so `finish-event` runs `poll-schedules` whenever a schedule is active, and
each Tlon job reaches `schedule-adapter-down` (`desk/app/harness.hoon:962`). With the
adapter running, `hand-source-live` then reads `/harness-tlon/authority/[sid]`
(`:955`) with no `mole`. Which of these printed the two lines seen in the original run
was not confirmed on a ship.

**Recommendation:** have `on-load` and `on-init` emit a self-poke or a zero-delay timer,
and run `refresh-peers`, `accept-granted-invitations` and `catch-up` when it arrives. The
`%load` cases in `desk/tests-integration/harness-tlon-invitations.hoon`,
`harness-tlon-subscription.hoon` and `harness-tlon-liveness.hoon` pin the cards a load
emits and would need updating.

## Test gaps

### 13. Test results and gaps

`just test` on fresh ships, with no credentials: 73 passed, 1 failed, 2 skipped, 1 incomplete.
That includes 935 native Harness, 27 native `mcp` and 139 integration tests. The failure was
a timing flaw in `tlon-tools`, since fixed in the test; a full run with that fix hasn't finished yet.
`conformance` and `hand` run against a local fake model, so they check protocol and hand
behaviour, not real models. This run predates the four CI shards of `just test-js`.

**Skipped:**
- `tlon-media`: needs `%storage`, which the pill lacks, and a real download.
- `openai-auth`: tests a real OpenAI login.

**Incomplete:** `tlon-completion` needs `%storage` for its upload checks.

**Not in `just test`:**
- Real inference: `work-goal-practical`, `compaction-provider-smoke`, the real-provider mode of
  `conformance` and `hand`, and the tlonbot fixtures.
- Benchmarks.
- `reliability-soak` with `SOAK_WORK=1`, which adds real work and fault recovery.
- `peer-rpc`'s owner branch, because `~lux` isn't `~zod`'s owner.

**Upgrades:** upgrading an existing ship is untested.

**Possibly worth a look, not confirmed bugs:**
- `harness/tlon/configure` accepts `owner: null`. Fresh installs have no owner, so the old test
  was treated as stale, but the error text points owner changes elsewhere. **Read:** the
  handler (`desk/app/harness-tlon.hoon:485`) checks `expectedOwner` only when it is
  supplied, so it can clear the owner or set any ship, and unlike `harness/tlon/owner/set`
  it does not turn `enabled` off when the owner becomes null.
- `/forget` on an already forgotten memory says "Memory forgotten" and adds another
  session event (`%memory-set`). No new memory revision is made.
- `%channels` prints `%unknown-scry-path` for `/x/v4/v-channels` around adapter restarts.
- A provider 504 didn't reach the peer as a message within 30 seconds, which could be a silent
  stall. **Read:** a failure is delivered to hands and peer asks (`settle-hands`,
  `settle-asks`), but with a fallback model configured `try-fallback` dispatches again
  first, which may be the silence. Not run.

### 14. Fixed: `local-mcp` had never run against the real proxy

It now passes on a ship set up by `just fake-dev`, which installs the `%mcp` desk from
`mcp/`: discovery, a real tool call and an unchanged registry. No upstream was
configured, so the upstream catalog check didn't run.

### 15. `tlon-completion` can't fully pass on this pill

The pill has no `%storage`, so the script prints INCOMPLETE and exits 1. A full pass
needs a real `%storage`.

### 16. Weak or missing checks

- **Corpus grant:** the new `lcm` isolation check uses a session that is both ungranted
  and social, so removing only the `%corpus` grant clause
  (`desk/app/harness.hoon:2867`) would not fail it. No non-owner, non-social,
  non-delegated session was found reachable from a single-ship script (inferred).
- **Rehearsal:** a scoped parent can't be reached live. Only the native
  `test-rehearsal-keeps-only-inherited-reads` covers it.
- **Delegation:** the `task-notes` "Delegation retains granted" assertions pass whatever
  the grants are, because of issue 1. They only prove the tools exist.
- **`irreducible`:** this compaction case uses `max-context: 1000`, which the catalog
  alone exceeds, so the oversized prompt probably isn't what triggers the failure
  (inferred).
- **Avoided, not fixed:** `task-notes` and `work-control` use a larger window, set to
  avoid compaction. With the double count gone they may no longer need it. Their
  comments give the ship's default summary route as the reason, which issue 4 removed.

### 17. Test tooling

- **`Client.pokeAgent` ignores refusals** (`tests-js/lib/ship-client.mjs`), so a malformed
  native poke looks like a no-op. This hid the `conversations` bug. The other native
  pokes are `compact`, `send`, `timer-set`, `timer-cancel`, `discard-skill` and
  `skill-del`, and were not probed. It should fail on a refusal.
- **`harness-pages`:** five `expect`s in one test print only `%.y/%.n`, so a failure
  doesn't say which one.
- **Summary fixtures:** any fixture returning a plain summary needs JSON when memory
  evidence exists. The `cancellation-conformance.mjs:66` fixture was not inspected.
- **`hand-operations`** leaves `/tmp/harness-hand-archive-*` behind on success.
- **`work-control`:** its fixture system prompt says "No inference is expected", but it
  uses inference.
- **Credentials at startup:** `conformance.mjs`, `compaction-provider-smoke.mjs` and
  `hand-conformance.mjs` weren't run, and may not say up front that they need one.
- **`desk/lib/test-agent.hoon` is a patched copy** of tlon-apps' library. Upstream,
  `get-peek` and `got-peek` call `+on-peek` outside the mocked scry, so a peek that
  itself scries reaches the real ship and crashed the test thread (**Reproduced**). The
  copy runs peeks under the scry gate. Once the fix is merged in tlon-apps, delete the
  copy and list `lib/test-agent.hoon` in `desk-deps.yaml`.

## Small cleanups

- **`':prefix-index'`** is a sentinel key stored among the search postings. It could be a
  dedicated state field.
- **`.gitignore`** has `urbit-mcp/`, which looks dead.
- **`just heavy=true` and `HARNESS_HEAVY_TESTS`** have misleading names now that the docs
  no longer call the integration tests heavy. `just heavy=true` could become
  `integration=true`.
- **Browser-era docs:** mentions of Settings and the sidebar remain, including
  `desk/lib/harness-onboarding.hoon` linking to Settings. `harness/onboarding/ensure` may
  have a dead caller.

## Seen in ship output, not investigated

These appeared on a `~lux` running the Groups pill. They failed no test and look like
Groups rather than Harness.

- Repeated `%discipline dap=%chat %bad-fact-mark ... %chat-club-action-2` around club
  operations.
- `%bad-agent-wire` in `%notes` when deleting a notebook.
- `bail: 4` and `bail: 2`.
- Outbound `posthog request failed: status 504`, so these pill ships appear to attempt
  analytics calls.

## Resolved

**Tally: 9 desk bugs, 5 false comments or docs, and 38 broken tests.** All of these
predate this cleanup, except where noted under the tests. Add to this list and update
the tally as issues are fixed.

### Desk bugs (9)

| Bug | Fix |
| --- | --- |
| Conversations halted when compaction reached a ship default with no credential, with an error naming a login the user never chose | Summaries use the conversation's own route unless a summary model is chosen; the error names a chosen model |
| Conversation content went to the ship's default provider for summarizing, not the provider chosen for that conversation | Same change |
| A summary that wasn't bare JSON, such as one in a code fence, was thrown away and reported as empty, halting the conversation | Fenced, embedded and plain text replies are accepted; only cut-off JSON is refused |
| Recalled memory went ahead of all history, so a changed selection stopped the whole history matching a provider's prompt cache | Recall goes just before the latest user message |
| With Lens sync on, the owner was told "Your Tlon bot is offline" while the bot was working, because Harness never held Steward's gateway lease | The hand holds the lease while online, and it expires if the hand stops |
| The context estimate counted instructions, tools and memory twice, at one token per byte, overstating every conversation by about 27k tokens; 16k and 32k windows compacted every turn, each an extra paid call | The reported prompt is trusted for these; new items still count at one token per byte |
| A Tlon schedule was paused for good if a poll ran while the adapter was stopped, even though nothing about its authority had changed | Stopped adapter now means wait; `poll-schedules` checks authority once it's back, and the job runs once if it came due meanwhile |
| `/status` counted the conversation's saved tools, so an owner turn showed fewer tools than it had | It counts the tools the turn can use |
| A child's saved config listed `admin`, `cron`, `tlon-read` and `tlon-write`, copied from its parent's effective tools, though it could never use them | The spawn leaves them out of the child's config |

### False comments and docs (5)

| Where | What it wrongly said |
| --- | --- |
| `desk/lib/harness-defaults.hoon:7-8` | Delegated work retains its explicit grants |
| `++corpus-tool` in `desk/app/harness.hoon` | Cross-conversation recall is an explicit owner-conversation grant |
| `docs-refs/peers.md`, `docs-refs/integrations.md` | The local MCP agent is `%mcp-server`; the code uses `%mcp-proxy` |
| `docs-refs/development.md` | Integration tests fill the event log and need a dedicated ship, without any measurement behind it |
| `docs-refs/performance.md` | The same requirement for a dedicated ship and one named test at a time |

### Broken tests (38)

Failing on a fresh ship at `0c8bd3e` unless noted, so failures went unnoticed.

| Tests | What was wrong | Since |
| --- | --- | --- |
| `conformance`, `tlon`, `tlon-tools`, `tlon-continuity`, `tlon-memory` | Stale queue, owner, prompt and memory checks; `tlon-memory` called an undefined function, so could never pass | Never run here |
| `harness-pages` | `tlon` description over the limit; fixed by trimming it, the only one fixed in the desk | `3dce42c`, inferred |
| 7 native state tests | Fixtures weren't migrated stores | `5bde3d6`, inferred |
| `clay-scopes`, `tool-discovery`, `curl`, `searxng`, `mcp-scopes`, `js` | Expected grants to limit owner conversations; `js` also had a stale regex and `mcp-scopes` a stale config check | `18c56b8`; `js` regex `c10c1d0` |
| `rehearsal` | Tool list predates `memory`, and an owner parent dropped the child's Clay scope | `5bde3d6` |
| `compaction`, `lcm` | Fixtures replied in plain text where the desk asks for JSON; `compaction` also assumed sizes the catalog has outgrown; `lcm` also expected owner grants to hold | `5bde3d6`, `18c56b8` |
| `modules` | Looked for a function renamed in `5bde3d6` | `5bde3d6`, inferred |
| `conversations` | Sent a malformed poke, and the client hides refusals | Not traced |
| `hand-operations`, `task-notes`, `work-control` | Depended on a ship credential or on a window that compaction overruns | Not traced |
| `browser-identity` | Timing flake on channel `ack` | Not traced; passed on `0c8bd3e` in most runs |
| `command`, `cron`, `social-workflow` | Asserted wording the desk no longer uses | Not traced |
| `tlon-groups` | Expected an error replaced by a clearer one | `3dce42c` |
| `tlon-actions` | Expected grants to limit owner conversations, and took its profile snapshot before disabling the hand changed the profile | `18c56b8` |
| `tlon-denial` | Treated a DM with no messages yet as a failure, and counted older messages as new | Not traced |
| `tlon-presence` | Assumed no DM session existed, so an earlier script's dead fixture URL stalled it | Not traced |
| `reliability-soak` | Waited for a stream on every client, though the client allows two | Not traced |
| `test-active-peer-work-rejects-overlap...`, `memory-benchmark` | Fixture had no credential so work never stayed active; benchmark expected `click` on PATH | Not traced |

`tlon-completion` and `local-mcp` now fail with a clear reason, but they still fail, so
they aren't counted.
| `tlon-tools` (second fault, not counted again) | A schedule firing right after creation ran before the fixture knew its conversation, so it finished early and clearing it succeeded. Intermittent | Not traced |
