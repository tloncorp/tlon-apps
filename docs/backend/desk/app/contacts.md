# contacts

`%contacts` owns the public self profile, cached peer profiles, saved contact
pages, and explicit contact membership decisions. A cached peer profile does
not imply saved membership: membership is the presence of a page in `book`.
`%groups-ui` owns suggested and hidden contact lists.

## contact decisions

Own-ship contact pokes are authorized by `src.bowl = our.bowl`.

| Mark | JSON payload | Effect |
| --- | --- | --- |
| `contact-action-1` | Existing `page`, `edit`, `wipe`, and profile actions | An explicit `page` saves a contact and clears removed and declined intent. |
| `contact-remove` | `{ kip, suggest }` | Unsaves the page and records removal; `suggest: true` requests a suggestion once. |
| `contact-decline-1` | Ship string | Unsaves the page, records durable declined intent, and hides the suggestion. |
| `contact-discover` | Ship string | Attempts an automatic save without a custom name. |
| `contact-discover-1` | `{ kip, nickname }`, with `nickname` a string or `null` | Attempts an automatic save with an optional existing local custom name. |

Discovery checks declined intent first, then existing removal intent and saved
membership. A removed contact remains unsaved and may become a suggestion
once. For other unsaved contacts, discovery reads the authoritative hidden and
suggested lists before creating a page. A hidden or already suggested contact
is not automatically saved. Read failures fail the poke rather than allowing
a save with an empty suppression set.

A nonempty name supplied to `contact-discover-1` becomes the custom overlay
only when discovery creates a new page. An existing saved page is a no-op,
including its custom overlay. Empty and null names create no name override.

Decline and discovery execute in the same membership-owning agent. Decline
before discovery prevents the save; Decline after discovery removes that
save. Explicit Add after Decline clears suppression and saves again. Across
clients, these outcomes follow server processing order. Clients serialize
explicit decisions per contact to preserve their own request order.

Decline uses the existing explicit-unsave semantics: deleting a saved page
also deletes that page's custom overlay. Cached peer data is retained. This
is distinct from automatic discovery, which does not edit or replace an
existing saved page.

## authoritative reads

| Path | Response |
| --- | --- |
| `/v1/book` | Saved pages, unchanged. |
| `/v2/init` | `{ directory, book, removed }`, unchanged. |
| `/v3/init` | `{ directory, book, removed, declined }`. |
| `/v1/declined` | A ship set, also available to local agents. |

Clients establish the complete Decline and named-discovery capability by
successfully reading both `/contacts/v3/init` and the boolean
`/groups-ui/v1/contact-decline-protection` marker over HTTP. A missing marker
returns HTTP 404 and keeps conservative client behavior. The removal-only
desk version capability does not establish complete protection. Failed
authoritative reads remain errors, including during an incomplete agent
reload.

`%groups-ui` returns the union of stored hides and authoritative declined
intent at `/hidden-contact-suggestions`, preserving its ship-set shape. Stored
hides include contacts hidden automatically when saved, so this response is
not an explicit declined set. Discovery respects historical hides without
migrating or clearing them. Suggestion reads subtract authoritative declined
intent. Suggestion delivery stores its candidate without reading another
agent, so a partial reload cannot discard a one-time removal suggestion; late
delivery still cannot expose a declined person in either public read.

## persisted state and compatibility

State 6 adds a distinct `declined` ship set to state 5. Migration preserves
profiles, pages, peer subscriptions, removal decisions, timestamps and retry
state, initializing only the new set to empty. Historical hidden flags are
not interpreted as explicit declines.

Old paths and marks remain served. Older clients using a generic `page`
action for automatic saves retain that action's explicit-Add semantics;
the server cannot distinguish those legacy saves from manual Add. A rollback
to code without a state-6 reader requires a compatible state migration.
