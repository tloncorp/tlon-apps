# Sessions, context and memory

Harness keeps full conversation history, summarizes older exchanges for the
model, and lets you pin notes that stay in context. Search and summaries link
back to the event log.

## Hierarchy and model settings

`harness-lcm` stores immutable nodes with either original event addresses or
ordered child-node addresses. Active roots form a chronological forest. Leaf
compaction summarizes older exchanges and completed tool batches without
re-summarizing prior roots. Four contiguous roots of equal depth become one parent before eligible
inference; an oversized group may shrink to two. Edges must point backward and
replace exactly the selected contiguous roots. Descendant lists are never
copied into every ancestor.

Settings → Memory has independent optional **Compaction model** (leaves) and
**LCM model** (parents and scheduled dreaming) routes. When unset, a conversation's
summaries use the conversation's own provider and model, so its content doesn't move to
another provider. Dreaming has no conversation, so it uses the global default. A chosen
summary model with no credential stops compaction with an error naming that model. Provider
credentials resolve through the shared credential boundary. Each request freezes its selected endpoint,
model, source coverage and budget before dispatch; editing settings does not
change an outstanding request's decoder. Neither setting changes the answer
model, instructions or grants of a conversation.

## Indexed corpus and explicit recall

Search content in the sidebar searches retained input, context, assistant text,
tool arguments/results, notes and summaries from every encountered hand. It
does not fetch unencountered Tlon history or another app's database. Provider
errors, configuration and credential state are excluded. Retrieved tool content
can itself contain sensitive data; it inherits its conversation's authority.

`harness-corpus-index` uses standard Hoon maps/sets, 4,096-document segments,
a term-to-segment directory, ordered `mop` postings and native `in`/`on`
operations. Matching requires all query terms (AND). Exact terms do not expand;
missing terms may use bounded two-byte prefix buckets and edit-distance-one candidates. Query
merging retains only one page, and fuzzy lookup does not materialize its entire
vocabulary bucket.

The head captures append deltas at its existing commit boundary. Backfill and
rebuild advance on paced Behn wakes, at most 32 events and a 65,536-byte target
per batch. A single oversized event is indexed alone rather than silently
truncated; this is not a hard maximum event latency. Queries never replay source
logs. Source records use immutable corpus scope IDs and one-based event
addresses, independent of mutable session names. Rename preserves coordinates;
deletion drops canonical records/authority immediately and recreation gets a
new scope. Inaccessible derived terms/snippets remain until an explicit rebuild
reclaims them. Rebuild exposes lag
and partial coverage while it runs, rather than pretending results are complete.

The GUI has owner-wide search and source inspection. The model tools
`lcm_search`, `lcm_read` and `lcm_expand` default to the current conversation.
The explicit `corpus` grant enables cross-conversation recall only for owner
conversations; social and delegated provenance keeps recall local even if that
grant is present. Forks index their retained prefix under their own scope.
Authorization filters matches before pagination and is rechecked for reads.
Cursors bind query, permitted scopes and index epoch; IDs/cursors grant no
authority. Read chunks preserve UTF-8 boundaries at 12,000 bytes; expansion
returns at most 16 immediate edges, not an unbounded recursive traversal.

Queries allow up to 512 bytes and 1–64 results per page. Common queries can
visit every candidate segment; status and synchronization visit the scope/session
directory. Search limits do not bound stored history, replay time, or backups.

## Compaction planning and acceptance

`lib/harness-context.hoon` owns pure budgeting, source selection and validation;
`harness-lcm-context` composes it with the hierarchy and source addresses.
Provider codecs supply estimates of the encoding actually dispatched; the head
records an `lcm-planned` event before emitting the request. The plan names
the source log boundary, active-prefix count/digest, original context length,
model/endpoint, estimated input, output reserve and optional command identity.
Replay recovers the exact source prefix or selected child summaries.

The request budget reserves `min(4096, window / 4)` output tokens and a 10%
margin. The latest successful turn's reported prompt usage anchors the next
turn's budget. Items added after that request reserve one token per encoded byte,
at least the reported completion usage. Current instructions, tools and memory are
already in that report, so they aren't counted again. If they grow before the next
request, only the budget's margin covers the difference, and a provider can reject a
request that no longer fits. The count comes from the matching request's route,
not cumulative session usage. A checkpoint or a different provider/model
invalidates the measurement. Without a matching report, the codec uses rounded
bytes/4, not exact tokenization. Summary requests use that encoding estimate for
their selected source spans. Chat Completions receives the output cap; the Codex
subscription route manages its own output. `/context` identifies measured versus
unmeasured budgeting and labels the window as catalog-or-fallback.

Model catalogs supply the selected route's capacity. `max_context_window` takes
precedence over a catalog's default `context_window`; the request budget still
reserves output and safety headroom. Saving a model selection waits for its
catalog lookup. Reloading the agent refreshes configured provider catalogs and
updates saved defaults, peer and summary models, and existing conversations.
Unavailable metadata preserves saved limits, and a new model with no reported
capacity uses 800,000 tokens. A capacity update does not retry failed work or
change an in-flight request's frozen route. The Codex subscription catalog
requires a concrete `client_version` in its URL.

Catalog capacities persist per authenticated provider route and include models
in fallback chains. Failover checks each candidate against its own reported
capacity, skips candidates that cannot fit the request, and uses the 800,000-token
default only when that candidate has no known capacity. A smaller reported limit
always takes precedence. Credential changes invalidate cached capacity until
metadata for the selected credentials arrives. A provider's refusal of a request
as too large for its model never fails over; a refused turn compacts instead
(below).

Before inference, compaction compares the usage-based context budget with
`window - output-budget - floor(window / 10)`. Requests above this threshold
are summarized first. The window follows the session's model configuration,
so switching models changes the next decision.

Selection aims to retain recent exchanges using one third of the input budget,
alongside summaries and other prompt material. The resulting request is measured
again. There is no separate fixed context cap or UI context-size control.

Selection first chooses complete historical exchanges while keeping the latest
completed exchange and unanswered input. If no older exchange is available, it
can summarize through a completed tool batch in the active turn, retaining that
turn's user input verbatim. A parallel tool batch is eligible only after every
call has a result. Tool calls and their results stay together. A recent-tail
budget target selects the prefix, which must fit the summary request's budget.
On already-short history, explicit compaction selects the older exchanges
together. An indivisible oversized tool batch fails locally; there is no
automatic large-artifact projection to make it fit.

`checkpoint-completed` records the replacement and reported usage. The reducer
checks outstanding identity and the frozen source digest before replacing the
prefix, preserving any new tail input. A manual command acknowledgement is
placed at its admission boundary in model context so later input still needs an
answer; the human transcript records completion in event order. Historical text
is labelled reference material, not system/developer instructions.

Empty, truncated, tool-producing or non-reducing summaries fail without replacing
context or retrying automatically. Summary usage is included in cumulative usage
and separately reported as `compactionUsage`, including rejected summaries when
the provider reports usage. Missing usage remains zero, not an estimated charge.
Four attempts per admitted input bound automatic chunking; each summary has a
three-minute watchdog. Cancellation fences late results. An in-flight summary
without a source plan cannot be accepted as a checkpoint after reload.

A provider refusing a turn as too large is recognized by its error wording
(`oversized` in `lib/harness-failure.hoon`), whether it arrives as an HTTP error
or inside a successful response. The failure is recorded and compaction starts
in the same event, so the prompt stays open: the checkpoint re-issues the turn on
the configured route, and the prompt settles once. A turn going back to the
route that refused it is sent only if Harness's estimate of the whole request is
strictly smaller than its estimate of the refused request. These compactions
share the four attempts per admitted input. A refusal relayed by a connected
runner, or one after text has streamed, is not compacted.

When a turn still cannot be sent, it fails once with a reason beginning
`context overflow: `. That covers: the attempt bound reached, no cut left or a
tool batch of the unanswered turn too large to summarize, Harness's own refusal
of the unanswered turn, a
compaction that did not make the request smaller, a summary request refused for
size, a recovery summary that is invalid or does not reduce, and a size refusal
that was not compacted. A typed `/compact` is never marked, and neither is a
planner refusal of the native compact action (it keeps its `context budget:`
reason), a missing summary credential or a summary timeout. If the native
compact action's summary request is refused for size, the failure is marked,
and a message still unanswered at that moment is left out at the next message.
Below the attempt bound, two planner refusals on a turn's path are not marked
either, because leaving the turn out would not remove what was refused: a
completed exchange before the unanswered turn too large for the summary model,
and a pending group of summary nodes too large for the LCM model. The turn halts
with a `context budget:` reason, the reply suggests a larger-context model, and
the message is kept.

At the next admission (or at a Tlon context reference recorded just before it),
a marked failure makes the replayed context replace the unanswered turn, every
item after the last assistant reply without tool calls, with one user note (with
nothing unanswered, the mark is simply cleared):
`[This message was left out because the request containing it was too large for
the model. The original is kept in the conversation log.]` This is a replay rule
in the reducer; the log, the transcript, ACP history and the corpus records keep
the original. A marked failure also ends the reported usage that anchors the
budget estimate, as a checkpoint does, so the estimate uses the encoded request
until another turn is measured. A model change keeps the mark. An explicit Retry
clears the failure without an admission, so it sends the original again.

Limits. When retained history or summaries are too large on their own and the
new message is small, leaving the failed message out does not help, and the
conversation stays stuck. Harness's own 1 MiB request cap for connected runners
is not recognized as a size refusal, so that input is not left out. An invalid
automatic summary before any provider refusal is not marked: the oversized input
stays, the next message fails too (marked), and the message after it is
answered. A native compact whose summary is refused for size leaves out a
message that was still unanswered then, though that message never failed for
size. A message sent while a recovery is in progress, when that recovery's
summary then comes back invalid, keeps the first message in for one more round,
after which it clears as an invalid automatic summary does. Replaying a log
with substitutions on an older desk keeps the originals, so a later checkpoint
over them fails its source check; after a downgrade, cancel any session left
compacting with no request in flight.

`/context` and `/compact` share native, ACP and hand ingress. Only `/compact`
invokes inference. It requires no tools and publishes success only after the
checkpoint is accepted. Full source transcripts remain available. Full-log
replay, history reads and request construction are not constant-cost.

## Shared memory

The head owns one durable fact store across conversations and local subagents.
Each conversation sees part of it; see [who sees a fact](#who-sees-a-fact).
Admission automatically selects relevant facts; ordinary recall needs no memory
tool call. The default prompt asks the agent to save important durable facts
and corrections as it works, updating existing records instead of duplicating
them. Workspace tasks remain the authority for live work status; the full
transcript and LCM remain the source history.

Leaf compaction can capture durable facts in the same model request as its
checkpoint. Its evidence comes only from original events covered by the plan,
not from summaries. A valid checkpoint survives rejected memory proposals.
A summary whose request carried related facts is discarded, and the conversation
compacts again when next needed, if the capture barrier moved while it was in
flight: on reload, forgetting, opting out, fencing a conversation or deleting
a session.
The summary request asks for JSON without a provider-enforced format. Fenced or embedded
JSON is accepted, and plain text becomes a summary with no memories. A reply starting
with `{` that doesn't parse is refused as probably cut off.
Summary-node merges do not capture memories. When the extra evidence would
exceed the model's input budget, the request contains only the checkpoint task.

Scheduled dreaming is an optional daily review of fresh conversation evidence.
It is off by default. Settings → Memory contains the global toggle, last-run
time, result and number of memory changes. Enabling it schedules the first
review in a day; reloads retain the schedule and coalesce missed days into one
pass. Each pass selects at most eight conversations, oldest pending first.
Completed replies buffer source boundaries without starting inference.
Disabling dreaming cancels its outstanding request and queued work; recall,
explicit saves and capture during compaction remain available. Conversation
opt-outs apply to both capture paths.

- `/memory [query]` inspects a bounded sample or searches the facts this
  conversation sees.
- `/remember project Keep the deployment read-only.` saves or corrects a fact.
- `/forget project` removes a fact from recall and fences older capture jobs.
- `/memory off` disables recall and capture for this conversation and its
  descendants; `/memory on` removes this conversation's opt-out.
- The `memory` tool supports search, read, save and forget. Changes require the
  current revision, so delayed updates cannot overwrite a correction.
- Only the owner changes memory. In a Tlon conversation, a DM or a channel,
  anyone else's `/remember`, `/forget` and `/memory on` or `off` get `Only
  the owner can change this conversation's settings.` The `memory` tool
  saves and forgets only in a turn that answers the owner: a Tlon speaker
  who may change the conversation, a peer call from the owner's ship, the
  owner's local ACP or poke prompt or a timer, a run of the owner's
  schedule, or a subagent of one of these. Any other turn, a webhook's
  included, gets `error: Only the owner can change shared memory.` Both
  refusals change nothing. A save or forget the place rule below refuses
  gets that refusal instead.

Settings → Memory shows 25 compact rows per page, word-prefix search, source
attribution and recent revisions. Previous and Next replace the visible page.
Collapsing an edited memory preserves its draft; expand to save or discard it
before moving elsewhere. Owner edits use the current revision and preserve
search aliases. Lists use bounded pages of the live lexical index. Dreaming uses
the LCM model override, or the global default when unset. Compaction capture
uses the compaction route. Both retain the conversation's provider privacy
requirements. The dreaming toggle saves immediately and independently of the
model settings. Its owner-only ACP methods are `harness/memory/dreaming` and
`harness/memory/dreaming/configure`, with a boolean `enabled` parameter.

Each fact has a stable name, current revision, attributed source and revision
history. Names use 1–64 lowercase letters, digits, hyphens or underscores;
bodies fit in 1,024 UTF-8 bytes. Explicit edits are protected from automatic
replacement. Forgetting leaves a tombstone and retained history; it does not
erase source messages, checkpoints or backups.

Recall selects at most six facts once per admitted input. The pack goes just before
the latest user message, so a changed selection doesn't invalidate the history before
it in a provider's prompt cache. It fits within
4,096 UTF-8 bytes and a smaller model's context allowance. Two of the six
slots go to general communication preferences, with no topic match: first the
owner's, in every conversation whoever speaks, then the identified speaker's
own that the conversation sees. A preference is the owner's when its source is
the owner's ACP methods or editor (no conversation), the configured owner
speaking in a Tlon conversation, or the bot's own ship in an unbound session
whose every input is the owner's own; a fork of a social conversation does not count,
nor do other hands' actors or sibling-moon owners. The two newest of those
are chosen at admission. Rendering gives the exception only to the names
admitted to those slots, drops one that stops qualifying, and shows an owner's
preference the conversation could not otherwise see without its source line. This priority gives no other access: `/memory`, the `memory`
tool, capture and writes treat such a preference by the place rule. A model can
save a general preference during the owner's own turn, so text the owner did
not mean, such as a quoted message, can become a preference that now reaches
every conversation. The editor labels this priority “Use across topics”; it
stays off for ordinary facts. Models with the memory tool can set it, and
automatic capture requires a supporting user event. Other facts require query
relevance. Corrections and forgetting apply when a selected identity is
rendered on a subsequent tool round. Memory is user-level reference material,
counts toward request estimates, and is excluded from the checkpoint source.
Compaction capture receives a separate bounded selection of related facts for
revision-aware deduplication; these are references, not fresh evidence.

The lexical index uses native maps and ordered maps, removes superseded
postings, and caps query terms, visited posting nodes and candidate scoring.
Each fact stores its normalized search terms, so scoring reads a bounded term
set instead of tokenizing the body. The owner browser uses the corpus search's
prefix helpers, with one shared prefix bucket per term. It checks every full
query prefix against cached terms, visits at most 128 candidate records per
page, and resumes through a cursor. Automatic recall keeps exact-term scoring.
Recall never scans the full fact store. Dreaming copies source excerpts on
separate timer events, inspecting at most sixteen event cells per wake. It has
independent request IDs, one retry, a two-minute timeout and token accounting.
Each selected conversation makes one bounded extraction using at most twelve
excerpts and 8 KiB of evidence, plus related facts and instructions. It does not
drain the remaining transcript into extra requests. Buffered source boundaries
coalesce per conversation; a reload discards them. Dreaming output is capped at
1,024 tokens; an empty result still uses model tokens. Recall and explicit
`/remember` writes do not make an extraction call.

Compaction collection inspects at most 256 event cells, with the same excerpt
and byte bounds. It stops at recorded memory-control or forgetting boundaries.
Both capture paths accept at most three facts and require an exact supporting
quote from a supplied user or tool event. Assistant assertions and recalled
history cannot support a fact. Requests are fenced against opting out,
forgetting, reloads and newer record revisions; explicit corrections remain
protected.
Opting out discards buffered work without removing memories. Capture uses
stateless summary providers and never sends a conversation reply.

Sources retain their actor and conversation identity. Skills remain a separate
instruction library. Snapshots expose the selected pack as
`memory: [{name, body}]`; explicit command edits also record `memory-set` audit
events. The read-only `/memory/<name>` JSON scry returns one fact with its
revision and provenance, including tombstones. Source authorization still governs admission and live tool access.

### Who sees a fact

A conversation sees a fact when it is the owner's private conversation, when
the fact was learned in a channel, or when the fact was learned in the same
place. Where a fact was learned comes from its source conversation's Tlon
bindings: a channel address, thread included, is that channel, and a `dm/`
address is its DM partner, thread and route reset included. A source with no
Tlon binding, with bindings that disagree or with another hand's binding beside
a Tlon one is unknown, and only the owner's private conversation sees it. So
are facts with no source conversation: owner ACP saves, browser edits and the
import. Two unknown sources are the same place only when they name the same
conversation.

The owner's private conversation is their Tlon DM and its threads, as the Tlon
hand's `/x/admin/<sid>` answers when the session's bindings resolve to that one
DM, or an unbound session in which every input is the owner's own: a local ACP
or poke prompt, or a timer. A subagent takes its root parent's answer and
place. Channels, other ships' DMs, scheduled runs, forks with social history,
peer and webhook sessions, other hands, a session with another hand's binding
or bindings that disagree, and any Tlon conversation while the adapter is not
running are not private. The reach is worked out from the session as it is
with the input being admitted. The answer is worked out again
at every read and write; nothing about it is saved.

Recall, the rendered pack (snapshots and `/context` included), `/memory` in
every form, the `memory` tool's search and read, and capture and dreaming,
both their related facts and the text sent to the summary model, return only
facts the conversation sees. Recall's preference slots are the one exception, above.
A read of an unseen name answers as if it did not
exist. A save or forget of an unseen name is refused with `That memory name is
not available.`, whatever the fact's revision or state. A conversation
changes and forgets only the facts its own place learned; a save or forget of
a fact learned elsewhere is refused with `This conversation cannot change a
memory learned in another place.`, and automatic capture is refused the same
way. The owner's private conversation is the exception: its save of a channel
fact moves the fact there, and the reply says it is now private and that
channels can no longer use the name. A save that repeats the fact's text changes nothing, where it was
learned included, so it stays in its channels. For a conversation that does not see everything, recall's index walk
skips unseen rows, examines at most 512, and judges a term's commonness by the
seen rows it found; past that bound results are best effort.

This applies from the release that introduced it. A channel fact built from
private text before then stays shared, and text already quoted in a
transcript stays there.

## Importing an OpenClaw MEMORY.md

When Harness replaces an OpenClaw bot on the same moon,
`acp/import-openclaw-memory.mjs` copies the bot's `MEMORY.md` into shared
memory once. It reads the copy the OpenClaw Tlon plugin keeps in `%steward`
(`/~/scry/steward/v1/prompts/files.json`), so it needs the moon's URL and a
login cookie, not its disk. `SHIP_COOKIE` names a Netscape cookie file holding
the moon's `urbauth-` cookie, as for the conformance scripts. `--dry-run`
saves nothing; when nothing stops the import, it prints every fact and what
would happen to it.

```sh
SHIP_URL=https://moon.example SHIP_COOKIE=/path/to/cookie.txt \
  node acp/import-openclaw-memory.mjs --dry-run
SHIP_URL=https://moon.example SHIP_COOKIE=/path/to/cookie.txt \
  node acp/import-openclaw-memory.mjs
```

The script removes tlonbot's managed blocks. A block runs from
`<!-- idempotency-marker:` through the next `<!-- /idempotency-marker -->`;
text before the opening marker and after the closing one on their lines is
kept, and an unclosed block stops the script. It cuts the rest into facts of at
most 1,024 bytes, section by section. Each fact starts with its heading path,
such as `Projects > Launch`, on its own line; a list item keeps its nested items
and continuation lines. Code fences, of backticks or tildes and indented or
not, stay literal; an unclosed fence runs to the end of the file. A heading
with no text and no deeper heading under it becomes a fact of its own title,
under the path above it. A path over 120 bytes drops its outermost titles
until it fits, and a deepest title over 120 bytes on its own is cut. That
shortening is the only place text can be lost: a unit too long for one fact is
cut at whitespace where it can be and carried on in the next. Facts are named
`imported-<snapshot>-<number>`: the snapshot is the first eight hex digits of
the SHA-256 of the cleaned file, the number the fact's position in it.

It lists every memory before it saves anything, and never changes or forgets
an existing one. Its saves are explicit, like an owner's edit, so automatic
capture cannot replace them.

- A rerun on the same file saves only the facts that are missing. A fact
  changed since the import is left alone, and a forgotten one stays forgotten;
  both are reported.
- If Harness holds facts imported from another snapshot, the file has changed
  since that import, and the script saves nothing: importing it on top would
  duplicate most of it under new names.
- If Steward holds no `MEMORY.md`, the script says so and imports nothing. The
  file may be over 65,536 bytes, the desk or plugin may be older than the
  copy, or the plugin never published it; Steward does not say which.

It prints what it saved, what was already there and what it left alone, with
counts at the end, and exits non-zero when it refuses or fails. Steward's copy
is replaced by whichever runtime next publishes prompts there, so the import
runs before that. Only `MEMORY.md` is imported, not the dated notes in
`memory/`. Imported facts are recorded as written by the bot, with no source
conversation. OpenClaw gave `MEMORY.md` only to private chats; Harness gives imported
facts only to the owner's private conversations.

## Verification

`tests/harness-shared-memory.hoon`, `harness-memory-capture.hoon`,
`harness-memory-dreaming.hoon`, `harness-memory.hoon`, and
`harness-memory-migration.hoon` cover bounded recall, capture scheduling,
corrections, opt-out, source validation, persistence and who sees a fact.
`tests-integration/harness-hand.hoon` checks that rule through the head for an
owner's DM, a channel, a subagent, a fork and a peer session, and that only
the owner's turns save and forget, a webhook's and another ship's scheduled
run's not; `tests-integration/harness-peer-work.hoon` checks it for peer
calls; and
`tests-js/tlon-memory-conformance.mjs` checks it through native Tlon. The native integration
suite `harness-memory-worker.hoon` drives dreaming alongside an active reply
and checks compaction capture, model routing, reloads, timeouts and late responses.
`tests/harness-memory-browser.hoon` covers complete bounded pagination, sparse
search, precise revisions and retained sources. The native integration suite
`harness-memory-browser.hoon` verifies owner-only management, attribution and
read-only access through ACP. `tests-js/memory-benchmark.mjs`
measures recall and rendering on a disposable Vere ship at 1,024, 8,192 and
32,768 records; seeding occurs outside the measured events.
`acp/import-openclaw-memory.test.mjs` covers the import's cleaning, cutting,
naming and comparing offline. `tests-js/import-openclaw-memory-conformance.mjs`
publishes a `MEMORY.md` through Steward's projection route on a fake ship, then
checks a dry run, an import of more than one list page, a rerun that sends no
save, a changed and a forgotten fact, and a changed file.


Native tests exercise production hierarchy, index, corpus, JSON and persistence
helpers. `tests-js/lcm-conformance.mjs` uses a local model server through real
ACP/Iris to create leaves and parents, expand evidence, paginate search, check
model recall grants, and test rename/delete/recreation.
It also verifies generic hand indexing and prevents a hand conversation's
`corpus` grant from exposing owner conversation evidence.
`tests-js/compaction-conformance.mjs` covers frozen spans, cancellation, failures,
model-window changes and concurrent input.
Both temporarily select local summary overrides and restore the saved values;
run them alone on a development ship, never concurrently with each other.
Neither requires a paid provider request.
Cleanup verifies the restored settings and reports failures to remove unbound
fixture sessions or disable retained hand-bound audit fixtures.

`desk/tests-integration/harness-corpus-benchmark.hoon` builds 32,768 fixture documents and
times production rare-AND, common, scoped and prefix queries independently of
construction using native `%bout` hints. Its synthetic results are not a
production latency guarantee.

Run conformance on a disposable development ship:

```sh
SHIP_URL=http://test-ship.example SHIP_COOKIE=/path/to/auth-cookie.txt \
  node tests-js/compaction-conformance.mjs
```

Set `COMPACTION_WATCHDOG_TEST=1` to include the three-minute hung-summary
deadline. The fixture removes unbound test sessions; disabled hand-bound
fixtures retain audit records.

`tests-js/compaction-provider-smoke.mjs` uses saved provider credentials in a
temporary, tools-disabled session and makes four real requests, including a
summary. Optional `SMOKE_URL` and `SMOKE_MODEL` select that session's provider.
It does not change global defaults or credentials.

Measure index construction separately from queries, recording workload,
hardware, and runtime. See [development](development.md) for test safety.
