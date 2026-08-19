# Interactive surfaces

A protocol for cards whose state survives being tapped. The bot's own message is the store: it carries the current state, a revision, and the set of actions already applied. A tap is a reply carrying a structured action. The agent validates the action, computes new state, and edits its own message. Every client then re-renders from the synchronized post.

This exists because the older A2UI model attached a surface to one post and never updated it, so any interaction had to live in React state — lost on restart, on virtualization, and never shared between devices or participants.

Wire shapes live in `packages/api/src/client/content-helpers.ts` (`interactive-surface` and `interactive-action` blob entries) and `packages/api/src/client/a2ui.ts` (the `tlon.surfaceAction` button action). This page is the behaviour those shapes imply.

## The round trip

```
bot post P     blob: [ a2ui(surfaceId=S, component tree)            ← the view
                     , interactive-surface(S, revision, state, …) ] ← the truth

tap        →   reply A  blob: [ interactive-action(target=P, S, actionId, expectedRevision, name, params) ]

agent      →   edit P   blob: [ a2ui(S, re-rendered tree)
                              , interactive-surface(S, revision+1, state', …) ]
```

Two entries on one post, joined by `surfaceId`. The split is deliberate: the `a2ui` entry keeps its existing renderer and validator untouched, and clients never read `state` — they render the tree the agent produced from it. That is why `state` is typed as an opaque JSON object here. Typing it would couple the protocol to whatever kit happens to own the card.

Everything rides transports that already carry a blob (`sendPost`, `editPost`), so no backend change is required. The backend stores and relays `blob` without inspecting it.

## Who may write what

The agent is the only writer of `interactive-surface`. Anyone who can post in the channel may write an `interactive-action`; the agent decides whether to honour it.

**The actor is the action post's author, never a field inside the payload.** An action carries no actor and must never be given one — a client that wrote its own would be asserting an identity the host already knows.

**Order actions by post id, not by any client clock.** Post ids are assigned by the host and totally ordered; `createdAt` and `sentAt` are client-supplied and can be anything. When a batch of actions arrives together, sort by the canonical post id.

## Revisions

`revision` starts at 0 and increases by exactly 1 each time an action is applied. An action carries the `expectedRevision` the tapping client was looking at.

-   **Match** → apply, bump, edit the post.
-   **Mismatch** → reject. Change nothing, bump nothing. This is a `conflict`, the same outcome `%notes` returns for a stale `expected-revision`.
-   **Omitted** → apply against whatever the current revision is. This is an explicit opt-in to last-write-wins, for callers that do not track revisions. `%notes` exposes the same affordance for the same reason.

There is no merge and no automatic retry. A rejected actor is already receiving the authoritative post, so their card re-renders at the current revision and they can tap again against what is actually there. That is what makes concurrent taps safe: for any given revision exactly one action wins, and the losers are told to look again.

**A no-change does not bump the revision.** If an action resolves to state identical to what is already stored, the agent should leave the revision alone. `stateHash` — sha-256 over canonical, sorted-key JSON of `state` — makes that comparison cheap and lets a reviewer verify that a given revision really corresponds to a given state. Clients tracking revisions must not advance theirs on a no-change.

## Idempotency

`actionId` is the idempotency key. It is minted by the client at tap time and **reused verbatim on retry** — a retried tap is the same action, not a new one. It plays the role `request-id` plays in `%notes`.

Before applying, the agent checks `processedActionIds`. If the id is already there, the action has been applied and the agent does nothing: no state change, no revision bump, no edit.

That has a consequence worth stating plainly, because it is easy to build the two halves separately and end up with a hang:

> A de-duplicated action produces **no edit**. A client sitting in optimistic state after a double tap will therefore receive no event at all. It must fall back to a timeout, drop its optimistic state, and re-render from the post it already has. Without that fallback the second tap spins forever.

`processedActionIds` is capped (see `INTERACTIVE_SURFACE_LIMITS`) and evicts oldest-first. Past the cap an id can be forgotten, so a very old retry could apply a second time. That is a deliberate trade: this list is replicated to every member on every render, and unbounded growth is the worse failure. The revision check catches most of what the cap lets through, since a stale retry usually carries a stale `expectedRevision` too.

## Surface ids

A `surfaceId` must be unique per message instance, and must match between the `interactive-surface` entry and the sibling `a2ui` entry on the same post.

Existing A2UI producers do not satisfy this. They pass semantic labels, and some are bare constants — `pending-approvals` and `migrate-action` in `packages/openclaw/src/monitor/` — so two different posts can carry the same surface id today. Those producers must move to per-instance ids before any of their cards can become stateful.

## Editing a card without destroying it

The `%edit` arm stores the submitted essay wholesale. An edit therefore replaces the entire blob, and **any entry not re-emitted is erased**.

So an agent updating a surface must rebuild the whole blob array — the `a2ui` entry included — not just the entry it changed. Omitting the blob entirely on an edit erases the card outright. This is the sharpest edge in the protocol.

The same rule is why human edit flows preserve the original blob rather than recomputing it (see `docs/tlon-apps/post-blobs.md`, design rule 5). That policy stays: only the agent's own tooling writes blobs on edit.

## Action replies

An action is a reply on the card's post. Replies are used rather than a lightweight poke because they come with a host-assigned id — giving ordering — and host-verified authorship — giving the actor. A poke would force both to be re-derived.

Clients hide a reply whose blob carries **exactly one** entry and that entry is an `interactive-action`. The "exactly one" guard is deliberate: a reply that also carries user content is a real message and stays visible.

The cost is that card posts spend their thread affordance on machinery, which is why a card's reply-count summary should be suppressed rather than showing a count of taps.

## Older clients

A client that does not know `tlon.surfaceAction` fails `validateButtonAction`, which fails the whole `a2ui` entry, which degrades to the standard `{ type: 'unknown' }` → "Upgrade your app to see this post" blockquote.

This is intended, not incidental. It means an old client does not render a new-protocol card **at all**, and therefore cannot tap a stale one into emitting an action against a revision it cannot understand. Degrading the view and disabling the interaction are the same act.

The `interactive-surface` and `interactive-action` entries degrade the same way, and neither produces a block of its own on a client that does understand them: the card is drawn by the `a2ui` entry, and an action is a record rather than something to display.

## Limits

`INTERACTIVE_SURFACE_LIMITS` in `content-helpers.ts` caps `state`, `params`, and the length of `processedActionIds`; `a2ui.ts` caps the surface id, the action name, and the params carried on a button.

All of these exist for one reason: a post's blob is replicated to every member of the channel and re-sent on every edit. State that would be unremarkable in a database is expensive here.

## Related

-   `docs/tlon-apps/post-blobs.md` — the blob wire format and entry registry.
-   `desk/sur/notes.hoon` and `packages/api/src/client/notesApi.ts` — the `expected-revision` / `conflict` / `no-change` semantics this protocol borrows, already shipping for notes.
