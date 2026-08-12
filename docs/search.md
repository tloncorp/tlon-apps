# %search

One global full-text index over this ship's own content. Producing agents submit references to what changed; `%search` does the tokenizing and index work later, on its own timer, so the producing agent's event never pays for indexing.

Prior art: [arthyn/sphinx](https://github.com/arthyn/sphinx), which built an inverted index with trigram and phonetic fallbacks for a public app directory. `%search` keeps the inverted-index-plus-trigrams shape and drops the rest: this index is local, private, and covers message-shaped content rather than directory listings.

## why an index

Today each agent answers search by scanning. `%channels` and `%chat` both expose `/search/text/…` scries that walk a channel's or DM's message store from newest to oldest, bounded by a "how many did you look at" cursor so a single scry can't run away. That is linear in the size of the conversation, per conversation, per keystroke — and it cannot answer "where did anyone say this" across the ship at all.

`%search` inverts it. One map from term to the documents containing it, built once as content arrives, so a query costs a handful of map lookups regardless of how much history the ship holds.

## deferral

This is the part worth being careful about. Indexing a message costs far more than writing one: tokenize the body, compute trigrams for every fresh term, then touch a posting list per term. A chat event should not pay for that.

So the protocol is split:

-   **producers** emit one poke naming what changed — a `$target` plus already-flattened text. Building that costs a `+flatten` over content the agent just parsed anyway, and one card. Nothing else.
-   **`%search`** does no work in `+on-poke` beyond pushing onto `queue` and arming a behn wake if one isn't already armed. All the real work happens in `+drain`, in a later arvo event.

`+drain` handles a bounded batch (`+batch-size`, 64) per wake and re-arms while the queue is non-empty. A large backfill therefore spreads across many small events instead of one enormous one, and the drain outpaces any realistic write rate because each batch gets its own event. `queue-cap` (50k) is a backstop against a pathological producer, not an expected condition.

The producer's poke carries flattened text rather than the agent's own content type on purpose: `%search` never learns what a `$story` or a `$reply-essay` is, so a kelvin bump in those types can't force an index migration.

## state model

```
state-0
  index         index    the inverted index (below)
  queue         (qeu job)  submitted-but-not-yet-indexed work
  pending       @ud      queue depth ($qeu has no size arm; counting per submission
                         would be the one expensive thing on the hot path)
  armed         ?        whether a drain wake is already scheduled
  last-indexed  @da      when the last batch drained
```

`index` (in `sur/search.hoon`):

```
terms  (map key postings)   term -> documents containing it, with each term's weight
grams  (jug gram key)       trigram -> terms containing it, for prefix and typo matching
trail  (map tid (set key))  document -> its terms, so a document can be fully retracted
docs   (map tid doc)        document -> its stored record
kids   (jug tid tid)        post/message -> its replies
```

`tid` is `(shaf %sear (jam target))` — a digest rather than the target itself, because a target appears in one posting list per term it uses.

The index is derived data. `+on-load` does not migrate it: an unreadable state resets and rebuilds from the producing agents.

## what is stored

No full text. A `$doc` keeps the target, the document's own title (a note or diary-post title; empty for a chat message), the container it lives in for display (`context`), a leading `snippet` capped at 256 bytes, the author, and the time. Clients resolve `target` against the owning agent for anything richer.

`+clip` truncates the snippet on a utf-8 character boundary, so a snippet never ends mid-sequence.

## targets

A `$target` is built only from identity fields that don't churn — restated in `sur/search.hoon` rather than imported, so the owners' types nest under them but a version bump in `$nest:channels` or `$whom:chat` doesn't reach the index:

```
[%channel =nest post=@da reply=(unit @da)]      post or reply in a %channels channel
[%chat =whom id=mid reply=(unit mid)]           message or reply in a DM or club
[%note =book id=@ud]                            note in a %notes notebook
```

`reply` is the reply's own id; the parent stays in `post`/`id`, so a client can route to the thread either way. The owning agent is derived from the target's head (`+owner`), which is what the `%source` scry filter and `%wipe` key on.

## scoring

Deliberately simple, and in this order:

1. **How many of the query's distinct terms the document matched.** `+term-bonus` (10,000) dominates every per-term weight, so a document matching two query terms always outranks one matching one. This gives AND-preference without excluding partial matches.
2. **Summed per-term score.** A term's weight in a document comes from where it appeared — `rank-title` 8, `rank-body` 2, summed per occurrence and capped at `rank-cap` 64 so a word repeated 500 times can't drown out everything else. A match's multiplier comes from how it matched: exact 4, substring 2, trigram-only 1.
3. **Recency.**

Fuzzy matching goes through the trigram index: a query term's trigrams pick out stored terms sharing at least 60% of them (capped at `fuzzy-cap` 32 candidates), which covers both prefixes as typed (`migrat` → `migration`) and transpositions (`chanel` → `channel`). Terms under three bytes have no trigrams and are reachable by exact match only.

Stopwords are dropped at both index and query time, so a stopword-only query matches nothing rather than everything, and a message of only stopwords is never stored — nothing could match it.

## poke surface

`%search-action-1`, `src == our` only. The index is local and covers only content this ship already holds, so there is no permission model beyond refusing foreign pokes: everything indexed is something our own client could already read.

| Action                            | Effect                                                   |
| --------------------------------- | -------------------------------------------------------- |
| `[%touch entries=(list entry)]`   | queue for indexing                                       |
| `[%erase targets=(list target)]`  | queue for retraction                                     |
| `[%rebuild sources=(set source)]` | purge each named source, then poke its owner to resubmit |
| `[%wipe =source]`                 | drop one source's documents                              |
| `[%reset ~]`                      | empty the index and the queue                            |

`%touch` replaces any earlier version of the same target rather than accumulating, so an edit is just another `%touch`.

Producing agents also **accept** `%search-action-1` and act on `%rebuild` alone; every other variant is ignored by them. `%channels` and `%chat` route through `/lib/guard`, so the mark arrives in their `%unsafe` rail branch (`%search-action-1` is not in `/lib/rail`'s mark table) and the outgoing pokes go out via `+unsafe:guard`.

## scry surface

| Path                                               | Returns                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| `/x/v1/hits/[skip]/[count]/[nedl]`                 | `%search-result-1` — a scored page across all sources                    |
| `/x/v1/hits/source/[source]/[skip]/[count]/[nedl]` | same, restricted to one source                                           |
| `/x/v1/status`                                     | `%search-status-1` — document count, term count, queue depth, last drain |

`nedl` is accepted knot-encoded or bare, matching the existing `%chat` and `%channels` search scries. Both marks carry a `json` grow arm, so a client can hit them with a `.json` scry.

## rebuild and backfill

Incremental submission only covers content written while `%search` is up. `%rebuild` covers the rest: it purges the named source (so content deleted while `%search` was absent doesn't survive as an orphaned result) and pokes that source's owner, which walks its own store and resubmits.

Producers batch by container — one poke per channel, DM, club, or notebook rather than one per message — so the rebuild event costs a card per container while the per-message indexing still spreads across `%search`'s drains.

`+on-init` schedules a rebuild of all three sources on a timer rather than doing it inline, since the producing agents may not have come up yet at install time. Each source is skipped if `.^(? %gu …)` says its agent isn't running.

## producer integration

| Agent       | Hook                                                                          | Rebuild source                                          |
| ----------- | ----------------------------------------------------------------------------- | ------------------------------------------------------- |
| `%channels` | `+ca-response` — every content change funnels through it                      | `+ca-index-all` per nest, driven from `+search-rebuild` |
| `%chat`     | `+di-give-writs-diff` and `+cu-give-writs-diff`                               | `+submit-writs` per DM and club                         |
| `%notes`    | `+se-update` on `%note` updates; `+notebook-search-gone` when a notebook goes | `+search-rebuild` per notebook                          |

Each guards on `+search-running` (`.^(? %gu …/search/…/$)`) so a ship without the agent installed stays quiet, the same way they guard their `%activity` pokes. Reactions and metadata-only changes carry no text and produce nothing.

Agent test harnesses must answer that liveness probe: the mocked scry gates in `tests/app/{channels,chat,notes}.hoon` return `|` for `[%gu @ %search @ %$ ~]`, which keeps existing card expectations intact.

## invariants

-   Submitting never indexes. `+on-poke` touches `queue`, `pending` and `armed` and nothing else.
-   A drain is scheduled at most once at a time; `+arm` is a no-op while `armed` is set or the queue is empty.
-   `+catalog` on an existing target fully retracts the old version first, so re-indexing is idempotent and posting lists never accumulate duplicates.
-   A term whose last posting is retracted is dropped from `terms` **and** `grams`, so vocabulary doesn't leak as content churns.
-   Deleting a post or message retracts its replies too — `+retract` cascades through `kids` — so a delete can't leave hits pointing at content that no longer exists. Re-indexing an edit uses `+strip`, which does not cascade, so an edited message keeps its replies.
-   The index holds nothing this ship can't already read, and refuses pokes from anyone but ourselves.
