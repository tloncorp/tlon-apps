# notes: notes-managed write permissions

Working notes for `m/notes-perms`. Context, decisions and tasklist for moving
group-mode notebooks off "the group decides everything" and onto "the group
decides reads, `%notes` decides writes".

## Why

Today a group-mode notebook defers both read _and_ write access to the group:
`+se-can-edit` bottoms out in `+group-can-read`, so anyone who can see the
notebook can edit every note in it. We want the write decision to be ours, keyed
on group roles the way `%channels` keys its `writers` set, plus a second tier for
commenting.

The north star is to behave like `%channels` / `%channels-server` wherever the two
agents are solving the same problem. See "Alignment with %channels" for where we
match, where we deliberately differ, and what we had to add to keep up.

## Existing behavior

`members=(map ship role)`, `role=?(%owner %editor %viewer)`, is the entire
authority in solo mode and a vestigial roster in group mode.

**Solo (`group=~`)**

- read / subscribe: `+se-can-view` = has a `members` entry. `visibility` does
  _not_ enter here.
- write: `+se-can-edit` = role in `{%owner %editor}`.
- rename / delete / visibility / invite: `+se-is-owner` = role `%owner`, which is
  only ever the creator, who is always `ship.flag`.
- join: `+se-member-join` allows `%public` or already-a-member, and records the
  joiner as `%editor`. So "public" currently means "anyone may join, and joining
  makes you an editor". `%viewer` is defined and never assigned anywhere.
- `+give-said` previews: public or member, failing closed.

**Group (`group=^`)**

- read: `+se-can-view` = `+group-can-read`, the group's `can-read` gate scried out
  of our local `%groups` replica.
- write: `+se-can-edit` = an `%owner`/`%editor` entry _and_ live can-read. Since
  every joiner is recorded `%editor` and joining requires can-read, this reduces
  to "can-read implies can-write".
- `+recheck-group-access` kicks remote subscribers who lost can-read. The
  `members` map is deliberately not pruned, which is why `+se-can-edit` re-checks
  the group rather than trusting the map.
- subscriber side: a nacked resubscribe plus our own local replica agreeing we
  can't read is treated as a real revocation, and drops the book.

**Everywhere `members` is read**, so we know the blast radius: `+se-can-view`,
`+se-can-edit`, `+se-is-owner`, `+se-invite`, `+se-member-join`,
`+se-member-leave`, `+can-view-flag`, `+give-said`, `+no-watch`, `+no-read-json`,
`+no-peek` (`%members`), `+no-apply-update` (`%member-joined` / `%member-left`).

**Everywhere `group.notebook-state` is read**: `+can-view-flag`, `+give-said`,
`+recheck-group-access`, `+se-can-view`, `+se-can-edit`, `+se-member-join`,
`+se-create-notebook`, `+se-delete-notebook`, `+no-agent` (`%watch-ack`),
`+no-report-active`.

## Target

`perms` is a two-case union, so the case _is_ the mode discriminator that
`group=(unit flag)` used to be:

```hoon
+$  perms
  $%  [%group group-perms]
      [%notes note-perms]
  ==
+$  note-perms
  $:  =visibility
      default=access
      members=(set ship)
      writers=(set ship)
      commenters=(set ship)
  ==
+$  group-perms
  $:  =flag
      writers=(set role-id)
      commenters=(set role-id)
  ==
+$  access  ?(%editor %commenter %viewer)
```

**`%notes` (solo)** keeps everything in-agent, but per-ship and three-tiered.
`members` is the read set; `writers` and `commenters` are per-ship grants;
`default=access` is the tier a joiner is seeded into.

**`%group`** keeps deferring read and join to the group's `can-read`. Write and
comment become ours, checked by intersecting the actor's live group roles against
`writers` / `commenters`.

### The scries

Read, as today, in `+group-can-read`:

```
%gx /(scot %p our)/groups/(scot %da now)/v2/groups/{grp-ship}/{grp-name}
    /channels/can-read/noun
  -> $-([ship nest] ?)
```

Write, new, mirroring `+can-write:perms` in `/lib/channel-utils` verbatim:

```
%gx /(scot %p our)/groups/(scot %da now)/v2/groups/{grp-ship}/{grp-name}
    /channels/notes/{host}/{name}/can-write/{who}/noun
  -> (unit [admin=? roles=(set role-id)])
```

`~` means no seat or banned, so deny. `admin=&` is an unconditional yes. An empty
`writers` set is an unconditional yes. Otherwise the answer is
`!=(~ (~(int in writers) roles))`. `+group-can-comment` is the same call against
`commenters`. The notebook's own host short-circuits to yes, as `+can-write` does
for `ship.nest`.

Admin, for the eventual convergence on `%channels` (see below), is one more scry
on the same prefix: `/seats/{who}/is-admin/noun -> ?`.

## Decisions

1. **`default=access` is a join-time seed, not a live fallback.** On join we
   always add the ship to `members`; `%editor` also adds to `writers` and
   `commenters`, `%commenter` adds to `commenters` only, `%viewer` adds to
   neither. New notebooks get `default=%editor`, which preserves today's
   "everyone who joins can write".

2. **An empty set means anyone.** Adding the first role (or ship) restricts
   globally; adding further ones widens. This matches `+can-write` and makes the
   migration behavior-preserving without inventing a sentinel: every existing
   group notebook becomes `writers=~ commenters=~`.

3. **Perms mutation is host-only for now.** `?> =(src.bowl ship.flag)`, a straight
   port of today's `+se-is-owner`. `%channels` lets group admins do this and we
   want to converge, so leave a `::TODO` at the check.

4. **`commenters` is forward-looking.** `%notes` has no comment feature at all: no
   action, no type, nothing to gate. We manage and expose the configuration, and
   write a small `+se-can-comment` with no call sites yet.

5. **No new subscriber-facing stream in this branch.** Every existing endpoint,
   fact and mark keeps emitting its current shape, from `/-  notes-1`. New state
   shapes get down-converted on the way out, or dropped when they have no old
   equivalent. The versioning/transition story for a `/v1` stream is still being
   discussed and is deliberately out of scope.

6. **Group mode reports no members.** `/v0/members`, `/v1/.../members` and the
   `members` map in the down-converted `%snapshot` are all `~` for a group
   notebook, with a `::TODO  scry members out of groups?`. Solo mode derives the
   list from perms: host is `%owner`, a ship in `writers` is `%editor`, anything
   else is `%viewer`.

7. **`%visibility` and `%invite` crash on a group-mode notebook.** Both are
   meaningless there. `?>` that perms is `%notes` at the top of each handler.
   (Today `%visibility` silently writes a field nothing reads.)

8. **The owner gate becomes `=(who ship.flag)`.** With `%owner` gone from
   `access`, that is exactly what `+se-is-owner` already means in practice, since
   only the creator ever held `%owner` and the creator is always the host.

9. **Take the `%groups` sur dependency for role pruning.** We already depend on
   `%groups` by talking to it, so decoding its facts properly is no new coupling.
   `/-  gv=groups-ver` and decode the `/v1/groups` fact (mark
   `%group-response-1`) as `r-groups:v9:gv`, replacing the current
   "extract just the flag" hack in `+agent`. Details in step 4.

10. **`[%perms =perms]` joins `u-notebook:n`**, logged like any other update and
    dropped by the down-converter. The log stays a complete history of the
    notebook, which is what a log is for, and the future `/v1` stream gets it for
    free. Lands with step 5.

11. **Pruning to empty means the notebook opens up.** If a group deletes the last
    role in `writers`, the prune empties the set and per decision 2 the notebook
    goes from "restricted to role X" to "anyone can write". `%channels` has the
    same hazard and accepts it; we match, and say so in a `::NOTE` at the prune.
    (Not pruning fails the other way: a set of only-dead roles silently locks out
    everyone but the host, with nothing in the UI to explain it.)

## Alignment with %channels

Where we match, by construction:

- write check semantics, including the admin bypass, the host bypass and
  empty-means-anyone. Same scry, same shape, same order of tests.
- read permission stays with the group, write permission stays with the channel
  agent. That is the split `$create-channel`'s own comment describes.
- write perms are checked live at poke time, never cached, so a role change needs
  no bookkeeping on our side to take effect.
- dead roles get pruned out of `writers` when the group drops them (step 4),
  modelled on `+take-groups` / `+ca-recheck` / `+ca-full-recheck`.

Where we deliberately differ, with a `::TODO` at each site:

- **admin gating.** `+ca-c-channel` gates `%view %sort %order %meta %add-writers
  %del-writers` on `is-admin`, which is host-or-group-admin. We gate the
  equivalent ops on host-only. Converging later is one scry; per decision 3, not
  now.
- **`commenters`, `visibility`, `default` and solo mode have no `%channels`
  analogue.** Channels are always group channels and replies are posts, so there
  is nothing to copy. We are on our own there.
- **`create` carrying `writers`.** `$create-channel` carries `readers` (forwarded
  to `%groups`) _and_ `writers` (kept local). Our `%create-group-notebook` carries
  only `readers` and is frozen in `notes-1`, so a new group notebook starts
  `writers=~` (anyone) and the client follows up with a perms poke. Worth a
  `::TODO`.
- **mutation shape.** `c-channel` carries incremental `[%add-writers sects]` /
  `[%del-writers sects]` against a revisioned `perm`. We copy the incremental
  shape (step 5) but skip the `rev` wrapper: `%notes` has no revision machinery
  and this surface is host-local.
- **where the write check sits.** `%channels-server` checks once at the
  `+ca-c-post` entry; we check per-arm, because our arms want different gates
  (host vs writer vs nothing). Leave it per-arm.

## Tasklist

Each step is its own commit, smallest first, with type changes agreed before logic
changes.

Already done:
0. sur housekeeping
1. this document

### 2. permission checking against `perms`

Rewrite the gates to switch on the `perms` union:

- `+se-can-view`: `%notes` -> `(~(has in members) who)`; `%group` ->
  `+group-can-read`, unchanged.
- `+se-can-edit`: `%notes` -> member and `(~(has in writers) who)` or
  `writers=~`; `%group` -> `+group-can-write`. Host short-circuits yes in both.
- `+se-can-comment`: same shape against `commenters`. No call sites (decision 4).
- `+se-is-owner`: `=(who ship.flag)` (decision 8). Consider renaming to
  `+se-can-admin` in a separate commit, since the concept is now "admin", not
  "owner", and that's the name `%channels` uses.
- `+can-view-flag`, `+give-said`'s inline check: same union switch. Keep
  `+give-said` failing closed on an unsynced group and `+can-view-flag`
  tolerating one.
- `+no-watch` / `+no-read-json`: replace the "am I in the members map" gate with
  `+can-view-flag`, which handles both cases.

New arms `+group-can-write` and `+group-can-comment` next to `+group-can-read`,
mirroring `+can-write:perms:channel-utils` (scry shape above). Both need a
`+group-synced` guard on the paths that can't tolerate a crash, same as reads.

Also repoint the group lookups that read `group.notebook-state` today:
`+recheck-group-access`, `+no-report-active`, `+no-agent`'s `%watch-ack`
revocation check, `+se-delete-notebook`'s `%groups` `%del` poke.

### 3. creation and management

- `+se-create-notebook` builds the right case: `[%group [u.group ~ ~]]`, or
  `[%notes [%private %editor members={host} writers={host} commenters={host}]]`.
- `+join-remote-v1`'s placeholder `notebook-state` is built positionally
  (`[notebook ~ %private ~ ~ ~ ~]`) and needs the new shape. A subscriber
  placeholder has no authority, so `[%notes [%private %editor ~ ~ ~]]` is fine;
  the host's `%snapshot` overwrites it.
- `+se-member-join` seeds per decision 1: always into `members`, plus `writers` /
  `commenters` according to `default`. Group mode has nothing to record, so it
  stays an access check plus a `%member-joined` update.
- `+se-invite` asserts solo mode (decision 7) and seeds the same way.
- `+se-member-leave` drops the ship from all three sets.
- `+se-set-visibility` asserts solo mode (decision 7).

### 4. role pruning

Replace the `=+  !<([=flag:n *] q.cage.sign)` hack in `+agent`'s `[%groups ~]`
arm with a real `r-groups:v9:gv` decode (decision 9), and mirror
`+take-groups`:

- `[%role roles=(set role-id) %del ~]` -> for every hosted notebook whose
  `group-perms.flag` is `flag.r-groups`, `~(dif in writers) roles` and the same
  for `commenters`.
- `[%create =group]` -> full sync: drop every writer / commenter role missing
  from `~(key by roles.group)`. This is `+ca-full-recheck`'s reason for existing,
  a group state reset.
- everything else -> keep today's behavior, which is to re-run
  `+recheck-group-access` and kick readers who lost access. Note this is already
  broader than `%channels`, which only rechecks on an enumerated set of cases.

`::NOTE` the decision-11 hazard at the prune.

### 5. new actions, commands and updates for perms

New sur only, new marks, nothing existing touched.

- `a-notebook` / `c-notebook` gain incremental perms ops, host-only per decision
  3. Group mode takes `(set role-id)`, solo mode takes `(set ship)`; the union
  case decides which is meaningful, so a mismatched poke should `?>` fail rather
  than be silently coerced.
- `u-notebook` gains `[%perms =perms]` (decision 10).
- `default` and `visibility` need setters too, or the solo-mode config is
  write-once at create.
- `/lib/notes/json` becomes `/-  n=notes, n1=notes-1`, keeping every existing
  encoder on `n1` and adding `n` encode/decode for the new actions and for
  `perms` itself.

### 6. down-convert existing endpoints and facts

- `u-notebook:n -> (unit u-notebook:n1)`: `%member-joined` maps `access` to
  `role` (`%editor` to `%editor`, `%commenter` and `%viewer` to `%viewer`); the
  new `%perms` arm returns `~`. `+se-update` drops on `~` rather than emitting.
  This also covers `last-update`, hence the v1 `response-update`, which finalizes
  as `%no-change` for a dropped update.
- `notebook-state:n -> notebook-state:n1` for `%snapshot`: reconstruct `members`
  per decision 6, `visibility` from `note-perms` or `%private` in group mode
  (as today), and `group` from the union case.
- `/v0/members`, `/v1/.../members` per decision 6.
- `notebook-summary` / `notebook-detail` carry `visibility`: same rule.

### 7. state migration

`state-15` to `state-16`, per notebook:

- `group=~` becomes `[%notes [visibility %editor (~(key by members)) ~ ~]]`.
  `writers=~ commenters=~` read as "anyone", which preserves today's "every
  member is an editor". A `%viewer` entry would be lost, but the role was never
  assigned, so there are none.
- `group=^` becomes `[%group [u.group ~ ~]]`, dropping the now-meaningless
  `members` map and `visibility`.

Keep the existing `state-14` to `state-15` step and chain `14 -> 15 -> 16`; ships
that took the 14 transition are still out there.

### 8. tests

`desk/tests/app/notes.hoon` needs a pass: the `state-15` literals, the membership
assertions, the `%notes-members` mark expectations, and new coverage for the write
gate and the migration, which are the parts that were actually hard. Mocked scries
need to answer the new `can-write` path.

## Files

- `desk/sur/notes.hoon` — new types. Mostly done already.
- `desk/sur/notes-1.hoon` — frozen. Every existing mark and endpoint reads from
  here. Do not touch.
- `desk/app/notes.hoon` — the work.
- `desk/lib/notes/json.hoon` — currently all `n1`. Gains `n` encoders in step 5.
- `desk/mar/notes/*` — all pinned to `notes-1`. New marks only.
- `desk/tests/app/notes.hoon` — step 8.

## Reference

- `+can-write:perms`, `/lib/channel-utils` — the write check we mirror.
- `+ca-c-channel`, `+take-groups`, `+ca-recheck`, `+ca-full-recheck`,
  `/app/channels-server` — admin gating, incremental writer ops, role pruning.
- `+go-can-read`, `+go-peek` (`%channels ... %can-write`, `%seats ... %is-admin`),
  `/app/groups` — the other side of every scry above.
- `r-groups:v9`, `u-role`, `/sur/groups-ver` — the fact we start decoding in
  step 4.
