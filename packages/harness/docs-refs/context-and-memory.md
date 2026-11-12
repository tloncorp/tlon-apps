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
metadata for the selected credentials arrives.

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

`/context` and `/compact` share native, ACP and hand ingress. Only `/compact`
invokes inference. It requires no tools and publishes success only after the
checkpoint is accepted. Full source transcripts remain available. Full-log
replay, history reads and request construction are not constant-cost.

## Shared memory

The head owns one durable fact store across conversations and local subagents.
Admission automatically selects relevant facts; ordinary recall needs no memory
tool call. The default prompt asks the agent to save important durable facts
and corrections as it works, updating existing records instead of duplicating
them. Workspace tasks remain the authority for live work status; the full
transcript and LCM remain the source history.

Leaf compaction can capture durable facts in the same model request as its
checkpoint. Its evidence comes only from original events covered by the plan,
not from summaries. A valid checkpoint survives rejected memory proposals.
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

- `/memory [query]` inspects a bounded sample or searches shared facts.
- `/remember project Keep the deployment read-only.` saves or corrects a fact.
- `/forget project` removes a fact from recall and fences older capture jobs.
- `/memory off` disables recall and capture for this conversation and its
  descendants; `/memory on` removes this conversation's opt-out.
- The `memory` tool supports search, read, save and forget. Changes require the
  current revision, so delayed updates cannot overwrite a correction.

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
4,096 UTF-8 bytes and a smaller model's context allowance. At most two general
communication preferences follow the identified actor without a topic match.
The editor labels this priority “Use across topics”; it does not change access
and stays off for ordinary facts. Models with the memory tool can set it, and
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
coalesce per conversation and survive reloads. Dreaming output is capped at
1,024 tokens; an empty result still uses model tokens. Recall and explicit
`/remember` writes do not make an extraction call.

Compaction collection inspects at most 256 event cells, with the same excerpt
and byte bounds. It stops at recorded memory-control or forgetting boundaries.
Both capture paths accept at most three facts and require an exact supporting
quote from a supplied user or tool event. Assistant assertions and recalled
history cannot support a fact. Requests are fenced against opting out,
forgetting and newer record revisions; explicit corrections remain protected.
Opting out discards buffered work without removing memories. Capture uses
stateless summary providers and never sends a conversation reply.

Memory is shared by default; a conversation is not a private memory partition.
Sources retain their actor and conversation identity. Skills remain a separate
instruction library. Snapshots expose the selected pack as
`memory: [{name, body}]`; explicit command edits also record `memory-set` audit
events. The read-only `/memory/<name>` JSON scry returns one fact with its
revision and provenance, including tombstones. Source authorization still governs admission and live tool access.

## Verification

`tests/harness-shared-memory.hoon`, `harness-memory-capture.hoon`,
`harness-memory-dreaming.hoon`, `harness-memory.hoon`, and
`harness-memory-migration.hoon` cover bounded recall, capture scheduling,
corrections, opt-out, source validation and persistence. The native integration
suite `harness-memory-worker.hoon` drives dreaming alongside an active reply
and checks compaction capture, model routing, reloads, timeouts and late responses.
`tests/harness-memory-browser.hoon` covers complete bounded pagination, sparse
search, precise revisions and retained sources. The native integration suite
`harness-memory-browser.hoon` verifies owner-only management, attribution and
read-only access through ACP. `tests-js/memory-benchmark.mjs`
measures recall and rendering on a disposable Vere ship at 1,024, 8,192 and
32,768 records; seeding occurs outside the measured events.


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
