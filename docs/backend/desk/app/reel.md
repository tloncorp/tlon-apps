# %reel: lure invites

`%reel` owns lure invite links end to end. Until TLON-6761 that was three agents — `%reel`, `%grouper` and `%bait` — talking to each other over a subscription and over Ames. They are now one agent with three roles. `%grouper` and `%bait` stay in the bill as stateless forwarders, because other ships and older clients address them by name.

This document is not a replacement for reading the source.

## roles

| role | was | runs on | does |
| --- | --- | --- | --- |
| create | `%reel` | every ship | registers links with the provider, keeps their metadata in sync with our profile and our groups |
| redeem | `%grouper` | every ship | when the provider reports a bite, DMs the joiner and, for group links, invites them if lure joins are enabled for the group |
| serve | `%bait` | the provider (`~loshut-lonreg`; `~mug` in e2e) | mints tokens, serves `/lure` landing pages and the redeem POST, routes bites to inviters, refreshes branch.io metadata |

Every ship runs all three roles; the serve state is only populated on a provider.

## flow

```
  inviter ship                       provider ship                 browser
  %reel ── bait-describe ─────────►  [civ %bait] ─forward─► %reel
        ◄── reel-confirmation ─────                         (serve)
                                                            /lure ◄── POST ship=~joiner
        ◄── reel-bite ─────────────
  (redeem) ── DM, group invite ──► %chat, %groups
```

The bite used to reach `%grouper` over `%reel`'s `/bites` subscription. Redeem is now a function call inside the `%reel-bite` handler. `/bites` still accepts subscribers and still gets the fact, but nothing in the desk subscribes.

## why %grouper and %bait still exist

Remote ships and clients address agents by name, at whatever desk version they run:

- `%reel` on every ship pokes `[civ %bait]` with `bait-describe`, `bait-undescribe`, `bait-update` and `bait-update-group`.
- Ships ask each other `grouper-ask-enabled` and answer with `grouper-answer-enabled` at `[ship %grouper]`.
- Clients poke `grouper-enable` at `%grouper`; `ted/pioneer` and the Aqua tests do too.

So new `%reel` keeps poking `[civ %bait]` and `[ship %grouper]`: those names answer on both old and new desks. Each forwarder:

- passes **local** pokes to `%reel` unchanged;
- wraps the **remote** protocol pokes as `%noun [%forward src cage]`, so `%reel` handles them with the original sender as `src.bowl`. `%reel` only accepts `%forward` from `our`, and only for the marks in `+forwardable`. Any other remote poke is refused at the forwarder;
- answers its old scry paths from `%reel` (`/grouper/enabled/<name>`, `/bait/metadata`, `/bait/<token>/metadata`, `/bait/branch-secret`);
- `%grouper` proxies its old watch paths (`/group-enabled/…`, `/check-link/…`) to the same path on `%reel`.

A forwarder acks a remote poke as soon as it has passed it on, so a failure inside `%reel` no longer nacks back to the remote ship. The forwarder logs it instead.

Dropping the forwarders is a later step. It needs `%reel` to poke `[civ %reel]` and `[ship %reel]` directly, and that can only happen once the provider and enough peers run a desk whose `%reel` accepts those marks.

## state

`%reel` is at `state-8`: `state-7` plus

- `enabled-groups` and `open-asks` (from `%grouper`);
- `served`, `served-ids` and `branch-secret` (from `%bait`).

On upgrade, `%reel` starts the new fields empty. Each forwarder's `on-load` runs its old migration chain and sends what it had to `%reel` as an `%import-grouper` or `%import-bait` `%noun` poke. It keeps that payload as `pending` until `%reel` acks it, and retries on the next load if `%reel` nacked. Imports are unions, so a retry is harmless.

`%bait` held the eyre bindings for `/lure` (and `/` on the provider, via `%bind-slash`). `%reel` rebinds `/lure` on load. In a `/takeover` timer event straight after, it connects every binding whose action is still `[%app %bait]` to itself. Eyre replaces a binding when another agent connects the same path. Until then the `%bait` forwarder answers HTTP with a 503.

## surface

Pokes: everything the three agents took, with their existing marks — `reel-*`, `grouper-*`, `bait-*`, `handle-http-request`, `%bind-slash`, `%unbind-slash`, and `%noun` for `[%branch-secret @t]`, `%forward` and the two imports.

Authorization tightened in the merge: `grouper-enable`, `grouper-disable`, `grouper-check-link`, `grouper-link-checked`, `%bind-slash` and `%unbind-slash` now require `src = our`. `%grouper` accepted enable and disable from anyone.

Scries, new under `/v1`: `/enabled/<name>` (json), `/served` and `/served/<token>` (noun), `/branch-secret` (noun). The existing `/v0` and `/v1` paths are unchanged.

Watches: `/http-response/*` (eyre, allowed for guest identities — public `/lure` pages are unauthenticated), `/group-enabled/<ship>/<name>`, `/check-link/…`, `/v1/check-link/<url>`, plus the existing `/bites`, `/token-link/…` and `/v1/id-link/…`.

## known issues carried over

- `GET /lure/<token>` 404s for `@uv` tokens: the token contains dots, `parse-request-line` splits the last one off as an extension, and only the POST handler joins it back.
- `grouper-answer-enabled` from any ship toggles our own `enabled-groups` entry for that group name.
