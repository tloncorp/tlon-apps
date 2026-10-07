# %reel: lure invites

`%reel` owns lure invite links end to end. Until TLON-6761 that was three agents — `%reel`, `%grouper` and `%bait` — talking to each other over a subscription and over Ames. From the %tlon desk (13.0.0) on they are one agent with three roles, addressed as `%reel` everywhere. `%grouper` and `%bait` remain for one release only, to hand their old state to `%reel` (see [state](#state)).

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
  %reel ── bait-describe ─────────►  %reel (serve)
        ◄── reel-confirmation ─────
                                     /lure ◄────────────────────── POST ship=~joiner
        ◄── reel-bite ─────────────
  (redeem) ── DM, group invite ──► %chat, %groups
```

The marks are unchanged: the provider still takes `bait-*` and answers with `reel-*`, but at `[civ %reel]` rather than `[civ %bait]`. The bite used to reach `%grouper` over `%reel`'s `/bites` subscription; redeem is now a function call inside the `%reel-bite` handler. `/bites` still accepts subscribers and still gets the fact.

## version boundary

The %tlon desk (13.0.0) is a hard boundary for lure:

- **Provider first.** Ships on 13.0.0 poke `[civ %reel]` with `bait-*`, which only a 13.0.0 provider serves. Deploy `~loshut-lonreg` before the release reaches user ships, or their link creation nacks until it does.
- **Older ships.** A ship still on a %groups desk pokes `[civ %bait]`, which a 13.0.0 provider refuses. Those ships cannot create or refresh links until they upgrade. Existing links keep serving and redeeming: the provider's served registry moved into `%reel`, and bites still go to `[inviter %reel]`.
- **The cross-ship enabled-ask protocol is gone.** `grouper-ask-enabled` and `grouper-answer-enabled`, which only a client watching `/group-enabled` ever triggered, are not served by anyone on 13.0.0.
- **Clients** poke `grouper-enable` at `%reel` on 13.0.0 and at `%grouper` below it, guarded by `deskServesLureOnReel` (`TLON_DESK_MIN_VERSION`). While the desk version is unknown, `enableGroup` tries `%reel` and falls back to `%grouper`. Released mobile builds that predate this still poke `%grouper`, which refuses on 13.0.0: enabling a group's invites fails there until the user updates. Group invites created before the upgrade are unaffected, because the enabled set is imported.

## state

`%reel` is at `state-8`: `state-7` plus

- `enabled-groups` and `open-asks` (from `%grouper`);
- `served`, `served-ids` and `branch-secret` (from `%bait`).

On upgrade, `%reel` starts the new fields empty. `%grouper` and `%bait` are import-only shims for this release: each one's `on-load` runs its old migration chain and sends what it had to `%reel` as an `%import-grouper` or `%import-bait` `%noun` poke. It keeps that payload as `pending` until `%reel` acks it, and retries on the next load if `%reel` nacked. Imports are unions, so a retry is harmless. The shims refuse every poke, watch and scry.

They have to stay in the bill for this one release. An agent removed from the bill is only suspended: its new code never loads, and nothing else can read a suspended agent's state. **Delete both, and drop them from `desk.bill`, in the release after 13.0.0.**

`%bait` held the eyre bindings for `/lure` (and `/` on the provider, via `%bind-slash`). `%reel` rebinds `/lure` on load. In a `/takeover` timer event straight after, it connects every binding whose action is still `[%app %bait]` to itself; eyre replaces a binding when another agent connects the same path.

## surface

Pokes: the `reel-*`, `bait-*`, `grouper-enable`, `grouper-disable`, `grouper-check-link` and `grouper-link-checked` marks, `handle-http-request`, `%bind-slash`, `%unbind-slash`, and `%noun` for `[%branch-secret @t]` and the two imports.

Authorization tightened in the merge: `grouper-enable`, `grouper-disable`, `grouper-check-link`, `grouper-link-checked`, `%bind-slash`, `%unbind-slash` and the imports now require `src = our`. `%grouper` accepted enable and disable from anyone.

Scries, new under `/v1`: `/enabled/<name>` (json), `/served` and `/served/<token>` (noun), `/branch-secret` (noun). The existing `/v0` and `/v1` paths are unchanged. `ted/branch-update` reads the branch secret from `%reel`.

Watches: `/http-response/*` (eyre, allowed for guest identities — public `/lure` pages are unauthenticated), `/check-link/…`, `/v1/check-link/<url>`, plus the existing `/bites`, `/token-link/…` and `/v1/id-link/…`.

## known issues carried over

- `GET /lure/<token>` 404s for `@uv` tokens: the token contains dots, `parse-request-line` splits the last one off as an extension, and only the POST handler joins it back.
