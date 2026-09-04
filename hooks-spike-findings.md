# Spike: do Tlon channel hooks work today? — findings

**Verdict: yes, hooks compile and fire against the current `develop` desk.** All four ladder rungs pass on the runtime path (`tlon hooks add/order/cron` → `%channels-server`), and all three capability questions are answered positively or precisely. The one thing that is broken is the **dojo test runner** (`desk/ted/hook/run.hoon`): it does not build, and the documented command name for it does not exist. That is a tooling failure, not a hooks failure; a candidate patch is attached and was verified on the spike pier after all measurements were taken.

## Desk pin (the expiry label on every claim below)

| | |
|---|---|
| repo / branch | `tloncorp/tlon-apps` `develop`, fresh clone |
| commit | `78f3a6b43bf534bc2514ff0de1a68fbc6eae11bb` (2026-09-01 18:11 UTC, "update glob") |
| `desk/` tree hash | `916d0aa9288160deb035c32fda7b38fbbd47d8f2` (`git rev-parse HEAD:desk`) |
| assembled with | `scripts/assemble-desk.sh` (peru: urbit `408k-rc2`, landscape `5193635`, mcp `03630c7`) |
| ship-side check | `+vats %groups` after commit: `/sys/kelvin [%zuse 408]`, `%cz hash ends in 233bj` (both piers) |

The verdict transfers to any other branch exactly when `git rev-parse <ref>:desk` prints `916d0aa9288160deb035c32fda7b38fbbd47d8f2`.

**Expected pin movement**: ted/hook/run.hoon is on this list and is the subject of the attached patch. When that patch merges into develop, the runner's hash will change while the runtime path (channels-server.hoon, sur/hooks.hoon, sur/channels.hoon, channel-utils.hoon) does not; that movement does not expire the verdict, since the runner is dev tooling and was never on the path any rung measured. The verdict expires only when one of the four runtime files changes.

## Environment

- Runtime: vere **4.6** (same binary rube uses), booted from `https://bootstrap.urbit.org/urbit-v4.6.pill` (brass pill, `%base` at `[%zuse 408]`).
- Piers: dedicated fake galaxies **~nec (host)** and **~bud (poster)** created in the session scratchpad (`…/scratchpad/piers/{nec,bud}`), HTTP 48481/48482, fake-ames UDP 31338/31339. The repo's rube ships (~zod/~ten) were running on this machine and were not touched (a second ~zod would have collided with them on UDP 31337).
- Desk: the pill's stock `%groups` was mounted, replaced by the assembled develop desk (`rsync --delete`), committed on both piers. Bill diff vs stock: stock had `%gateway-status`, develop does not.
- CLI: `tlon` run from source at the pinned commit (`bun run packages/tlon-skill/scripts/main.ts --config <ship>.json …`, reports `tlon vdev`). Every documented subcommand used here exists: `hooks list|add|order|config|cron|rest|get|edit|delete|init`, `groups create|set-privacy|join`, `channels create`, `posts send`.
- Hook sources are verbatim: auto-react from `packages/tlon-skill/references/hooks.md`, disappearing from `tloncorp/hooks` `hooks/disappearing.hoon` at `6e142bd`. Deny / wait / meta hooks were written for this spike (sources in the appendix).

## The ladder

### Rung 1 — compile via the dojo runner: **FAIL (the runner, not the hook)**

The documented command does not exist:

```
~nec:dojo> -groups!hooks-run [%cron ~] [%origin ~ ~ ~] src
[%no-file-for-thread %hooks-run]
/app/spider/hoon:<[466 7].[466 52]>
dojo: thread poke failed
```

The thread file that does exist (`desk/ted/hook/run.hoon`, invoked as `-groups!hook-run`) fails to build:

```
~nec:dojo> -groups!hook-run [%cron ~] [%origin ~ ~ ~] src
clay: read-at-tako fail [desk=%groups care=%a case=[%da p=~2026.09.01..18.55.29..3d01] path=/ted/hook/run/hoon]
clay: %a build failed [%groups 0v1t.gurqe.4b7qa.d1lt4.bl5vo.5kenj.jr6bm.g98d7.sm3fo.hsbqo.p5st9 /ted/hook/run/hoon]
/ted/hook/run/hoon::[35 38].[35 69]>
/ted/hook/run/hoon::[35 46].[35 68]>
-find.context.context-option
thread failed: %build-thread-error
```

Diagnosis (line 35 is the first error; the compiler stops there, the rest were found by reading and are fixed in the patch):

1. `context.context-option` — the `%context` case of `context-option` is `[%context =bowl:h]`; the face is `bowl`, not `context`.
2. `(get-bowl context-option)` — no such arm; the helper is named `get-context`.
3. `group=(unit group-ui:v2:g)` — `sur/groups.hoon` has no `v2` arm any more; the bowl type is `group=(unit group:v9:gv)` (`sur/hooks.hoon`). This is the type drift the spike suspected, but it lives only in the runner.
4. `group.perm.perm.u.channel` — `perm` is `(rev perm)`, one level, as `+get-hook-bowl` in `channels-server` uses it.
5. Runtime scry paths `/gx/groups/exists/…` and `/gx/groups/groups/…/v1/noun` no longer exist / return the old `group-ui`; `channels-server` uses `/gu/groups/groups/<ship>/<name>` and `/gx/groups/v2/groups/<ship>/<name>/noun`.
6. The `config` argument was computed and then ignored (`?~(origin ~ (~(gut by config.hook) origin ~))`).

The runner is not on the runtime path. `hook-add`, `hook-configure`, `hook-order`, `hook-schedule` threads and the CLI all go through `compile:utils` in `channels-server`, so the ladder was continued on that path.

### Rung 1′ — compile via the production path: **PASS**

```
$ tlon hooks add auto-react auto-react.hoon
[hooks update] { "set": { "name": "auto-react", "id": "0v7.vj62d.n9usc.1d8a3.1orge.askoc", "error": null, … } }
$ tlon hooks list
📎 auto-react   ID: 0v7.vj62d.n9usc.1d8a3.1orge.askoc   Compiled: ✓
```

Host dojo during the add: `parsed hoon: %.y` and no `compilation result:` tang. The same held for every hook added in this spike (five hooks, all `"error": null`, all `Compiled: ✓` per the server's `hooks` scry: `[0v3.m1arn… 'disappearing' %.y] [0v1.l3hfi… 'deny' %.y] [0v7.vj62d… 'auto-react' %.y] [0v7.ff9lt… 'wait-react' %.y] [0v1.g8vuv… 'meta-read' %.y]`).

Note: the CLI prints `⚠️ Update may contain an error/compile issue.` on every successful add because it substring-matches `"error": null`. Cosmetic false positive.

### Rung 2 — fire on-post, observed: **PASS**

Channel `chat/~nec/xzoujlr8` ("spike-chat") in public group `~nec/atyjn2xm`; ~bud joined via `tlon groups join`.

- `tlon hooks order chat/~nec/xzoujlr8 0v7.vj62d…` → server `order` map shows `[%chat ~nec %xzoujlr8] → ~[0v7.vj62d…]`.
- ~bud: `tlon posts send chat/~nec/xzoujlr8 "spike post 1 from bud"` → `✓ Message sent`.
- Host dojo: `running hook: 'auto-react' 0v7.vj62d…` / `on channel: [kind=%chat ship=~nec name=%xzoujlr8]` / outcome `%allowed`, `effects=~[[%channels … [%post c-post=[%add-react id=~2026.09.01..18.59.30..948a p=~nec q='👍']]]]`.
- **Scry, host** (`/~/scry/channels/v3/chat/~nec/xzoujlr8/posts/newest/10/post.json`, 2 s after the send): post `170.141.184.508.140.280.616.982.909.490.378.571.776`, author `~bud`, `reacts {'~nec': '👍'}`.
- **Scry, poster** (same path on ~bud): `reacts {'~nec': '👍'}`.
- **Authoritative** (`.^(v-channels:c %gx /=channels-server=/v0/v-channels/noun)` on ~nec, later, after the cron test): both posts on this channel are tombstones with `del-at` matching the cron firings below; at the time of rung 2 the JSON scry above is the record of the react.

The hook runs a second time per post, for the `%react` event its own effect causes; auto-react ignores non-`%add` events, so this is benign, but hook authors should know effects re-enter the hook pipeline.

### Rung 3 — cron, two consecutive firings: **PASS**

`tlon hooks add disappearing disappearing.hoon` (`0v3.m1arn.9n6o7.j2bjm.3704i.ki4be`, `"error": null`), then `tlon hooks cron 0v3.m1arn… ~m1 --nest chat/~nec/xzoujlr8` (default delay `~s30`). Response: `"schedule": {"repeat": "~m1", "next": "~2026.09.01..19.03.11..4993"}`. Observed (ship clock, UTC):

| firing | host dojo `cron job 0v3.m1arn… ran on [kind=%chat ship=~nec name=%xzoujlr8]` | effect observed by scry |
|---|---|---|
| 1 | 19:03:11 (immediately on scheduling — `+ho-cron` sets `next=now`) | post 1 (`…18.59.30..948a`) → `TOMBSTONE`, server `del-at=~2026.09.01..19.03.11..5bec` |
| 2 | 19:04:1x | nothing older than 30 s remained; no effect (correct) |
| 3 | 19:05:1x | post 2 (`…19.04.18..7407`, sent by ~bud at 19:04:18 between firings 2 and 3) → `TOMBSTONE`, `del-at=~2026.09.01..19.05.11..49ef` |

`hooks list` after scheduling showed `Next: ~2026.09.01..19.04.11..4993 / Repeat: ~m1`, i.e. the schedule advanced by exactly `~m1`. `tlon hooks rest 0v3.m1arn… --nest …` then cleared the job (`crons` scry: `{[p=0v3.m1arn… q={}]}`). Surprise worth knowing: `hooks cron <id> ~m1` fires once immediately, then every minute.

### Rung 4 — deny, proven by absence: **PASS**

Separate channel `chat/~nec/tw0gbyik` ("spike-deny"), hook `deny` (`0v1.l3hfi.4gfn5.p9lj8.9cs11.ud3tj`) bound via `hooks order`.

- ~bud: `tlon posts send chat/~nec/tw0gbyik "spike denied post from bud"` → `✓ Message sent`, exit 0, 0 s.
- Host dojo: `running hook: 'deny' …` / `[%.y p=[[result=[%denied msg=[~ 'spike: denied by hook']] effects=~] …]]` / `spike: denied by hook`.
- **Scry, host**: `{"posts":{},"total":0,…}`. **Authoritative** server scry of the channel: `~` (no posts). **Scry, poster**: `{"posts":{}}`; `tlon messages channel chat/~nec/tw0gbyik` → `No messages found.`

Repeated a second time with `verb` loud on ~bud's `%channels` (see C). This is the negative control: same harness, same writer, same observation method as rung 2, and the post is absent.

## Capability questions

**A. Can a hook read the channel's description / metadata from its bowl? Yes.** Channel `chat/~nec/dqm3drbb` was created with `--description "Meta channel description"`; hook `meta-read` (on `%on-post %add` by someone else) reads `title.meta.u.group.bowl`, `description.meta:(~(got by channels.u.group.bowl) nest.u.channel.bowl)` and `meta.u.channel.bowl` (the v-channel's own `(rev (unit @t))`), and posts them back. Server scry of the channel: `[~2026.09.01..19.07.32..48a4 ~bud 'cap-a trigger from bud']` followed by `[~2026.09.01..19.07.32..48a5 ~nec 'meta-read: group-title='Hooks Spike' channel-desc='Meta channel description' v-channel-meta='v-channel-meta-null'']`. So the human-visible description lives in `group.bowl` (`group:v9:gv` → `channels` → `meta=data:m`), and it is readable; the v-channel `meta` cord is `[rev=0 ~]` for a CLI-created channel and is not where the description is. Caveat: `group.bowl` is `*group:v9:gv` (bunt, empty title) when `%groups` is not running or the group is unknown — the hook must handle the empty case.

**B. Does `%wait` self-rescheduling work? Yes.** Hook `wait-react` on `chat/~nec/mach5833` emits `[%wait id=(end 7 eny) hook=id.hook data=!>(id.post) fires-at=(add now ~s15)]` on a new post, and on `%wake` reacts to the post id carried in `data`. ~bud posted at 19:07:40; host dojo: `waiting hook 0v7.ff9lt… ran on [kind=%chat ship=~nec name=%mach5833]`; the react appeared by HTTP scry 18 s after the send and is in the authoritative server scry: `[~2026.09.01..19.07.40..3911 ~bud ~[[p=~nec q=[rev=0 [~ '⏰']]]] 'cap-b trigger from bud']`. `waiting` in the server's hooks state is `{}` afterwards (entry cleaned up on fire). The `%wake` bowl carries the channel (origin) so effects can target it.

**C. What does the posting client observe when its post is `%denied`? Nothing — a silent, positively-acknowledged drop.** Observed on ~bud with `:channels &verb %loud`: `%channels: on-poke with mark %channel-action-2` (the CLI's poke, acked → `✓ Message sent`, exit 0), then `%channels: on-agent on wire /chat/~nec/tw0gbyik, %poke-ack` from the host with **no** `%ca-agent` slog — and `+ca-agent` slogs `%ca-agent` + trace on any nack, so the ack was positive. The reason is in `channels-server`: on `%denied` it does `((slog p.result) [~ ca-core])`, i.e. logs the denial message on the host and returns normally with no update, so the command poke is acked. Consequences for tooling that verifies writes by observation: (1) the CLI/HTTP poke succeeds; (2) the post never appears in any scry on host or writer; (3) the writer's `%channels` keeps the post in `pending.posts` indefinitely (both denied posts are still there: `sent=~2026.09.01..19.03.14…` and `…19.14.15…`), since it is only cleared when the host echoes the post back; (4) the `msg` in `%denied` is visible only in the host's dojo. Denial therefore looks exactly like a post that was never sent, except for the lingering pending entry on the writer.

## Other observations

- `packages/tlon-skill/references/hooks.md` and `tloncorp/hooks` README both document `-groups!hooks-run`; the file is `ted/hook/run.hoon` (`hook-run`). Even with the right name the thread does not build (rung 1).
- The `hooks.md` config guidance (CLI sends cords; use `;;(emoji=cord …)`) and the `tloncorp/hooks` README (`hook-configure … (my ['emoji' !>(…)] ~)`, i.e. vases) disagree; the CLI path is the one verified here (`config` values arrive as jammed nouns via `(cue ((se %uw) j))`).
- `+run-hook-effects` in `channels-server` has `%groups` and `%contacts` executors stubbed as `!!` (`=/ =rail !! ::group-action-4+…`). Read from code, **not exercised**: a hook emitting either effect would crash the event that runs it (for `%on-post` that means the post itself would nack). The effect type still advertises both. Worth a follow-up test or a guard.
- Every `run-hooks` call scries `%groups` (`+get-hook-bowl`) even when no hooks are ordered for the nest; fine functionally, noted for cost.
- The server's `/x/v0/v-channels` scry works but logs `[%discipline dap=%channels-server %unknown-scry-path path=/x/v0/v-channels mark=%noun]` each time (not in the guard's declared scry list).
- Driving the dojo's `'''` multi-line cord mode through scripted tmux input was not reliable in this harness (the dojo re-parses on every keystroke and moved the cursor on each line); sources were loaded verbatim from a scratch `%spike` desk via `(of-wain:format .^(wain %cx /=spike=/hooks/<name>/txt))` instead. A human typing `'''` may fare differently; not a hooks finding.

## Patch proposal (to arthyn) — `hooks-spike-hook-run.patch`

Two hunks, `git apply --check` clean against `78f3a6b43b`:

1. `desk/ted/hook/run.hoon`: fixes 1–6 above, building the bowl the way `+get-hook-bowl` does (v-channels from `%channels-server` `/v0/v-channels`; group as `group:v9:gv` via `/gu/groups/groups/…` + `/gx/groups/v2/groups/…/noun`), and honouring the passed `config`.
2. `packages/tlon-skill/references/hooks.md`: `hooks-run` → `hook-run`.

Verification (done **after** rungs 1–4 and A–C, on ~nec only, by committing the patched thread into the pier's `%groups`): `-groups!hook-run [%cron ~] [%origin [%chat ~nec %xzoujlr8] ~ ~] src` → `parsed hoon: %.y` / `hook ran successfully` / `[[result=[%allowed event=[%cron ~]] effects=~] new-state=[#t/%~ q=0]]` for auto-react and for disappearing (no effects because every post on that channel was already a tombstone), and the same for the global origin `[%origin ~ ~ ~]`. Not tested: `%context` and `%on-post` events through the runner (constructing a `v-post` literal in the dojo was out of scope). The `tloncorp/hooks` README needs the same one-word rename; it is a separate repo and is not in this patch.

## Recommendation

Patrick, arthyn: the hooks runtime is healthy at this desk pin — compile, `%on-post`, `%cron`, `%wait`, `%denied`, and effect delivery all work end to end from a second ship, with every claim above backed by a scry or a dojo line rather than an ack. The bitrot is confined to the developer tooling: `ted/hook/run.hoon` is dead (six independent drifts, the first being a face typo, the deepest being the `group-ui:v2` → `group:v9` move), and its documented name is wrong in two places. Suggest landing the attached patch (or arthyn's preferred variant) together with a smoke test that runs `hook-run` in CI so the runner cannot rot silently again; the runner is not built by a desk commit, which is why nobody noticed. Two product-level items deserve decisions rather than fixes: denials are invisible to the writer (positive ack, lingering pending entry), and `%groups`/`%contacts` effects are advertised but stubbed with `!!`. Re-run this ladder whenever `git rev-parse <ref>:desk` stops printing `916d0aa9…`.

## Appendix — artifacts and reproduction

Session scratchpad: `/private/tmp/claude-501/-Users-patrick-workspace-homestead-fix-flaky-openclaw-int-tests/917b1cb8-7cb8-4fee-8f8d-6a25b009ca41/scratchpad/`

- `tlon-apps/` fresh clone at the pin; `desk-assembled/` the assembled desk; `hooks-examples/` clone of `tloncorp/hooks`.
- `hooks/{auto-react,disappearing,deny,wait-react,meta-read}.hoon` — sources as installed (the first two verbatim from docs/examples).
- `piers/nec`, `piers/bud` — the piers, still running in tmux sessions `hooks-nec` / `hooks-bud` (`tmux attach -t hooks-nec`; stop with `tmux send-keys -t hooks-nec C-d`, same for bud). `piers/*.tty.log` are full dojo transcripts; `rung3.log` is the cron timeline; `rung4*-send.out`, `capA-add.out`, `capB-add.out` are CLI outputs.
- `bin/dojo.sh <ship> <timeout> <line>` and `bin/tlon <nec|bud> <args>` drive the piers; `nec.json`/`bud.json` hold the fake-ship codes (`+code`: ~nec `ropnys-batwyd-nossyt-mapwet`, ~bud `lathus-worsem-bortem-padmel`).
- `hooks-spike-hook-run.patch` — the proposal above; `patch/` holds the patched files.

Hook ids on ~nec: auto-react `0v7.vj62d.n9usc.1d8a3.1orge.askoc`, disappearing `0v3.m1arn.9n6o7.j2bjm.3704i.ki4be`, deny `0v1.l3hfi.4gfn5.p9lj8.9cs11.ud3tj`, meta-read `0v1.g8vuv.vosqh.jmhsf.re4it.4jt5g`, wait-react `0v7.ff9lt.a0tga.hjk7d.ci8fk.pmqd7`. Channels: `chat/~nec/xzoujlr8` (react + cron), `chat/~nec/tw0gbyik` (deny), `chat/~nec/dqm3drbb` (meta), `chat/~nec/mach5833` (wait), group `~nec/atyjn2xm`.

### Spike-authored hook sources

`deny.hoon`
```hoon
|=  [=event:h =bowl:h]
^-  outcome:h
?.  ?=([%on-post %add *] event)
  &+[[[%allowed event] ~] state.hook.bowl]
&+[[[%denied `'spike: denied by hook'] ~] state.hook.bowl]
```

`wait-react.hoon`
```hoon
|=  [=event:h =bowl:h]
^-  outcome:h
?~  channel.bowl
  &+[[[%allowed event] ~] state.hook.bowl]
?:  ?=([%on-post %add *] event)
  ?:  =(author.post.event our.bowl)
    &+[[[%allowed event] ~] state.hook.bowl]
  =/  wait-effect=effect:h
    :*  %wait
        id=`@uv`(end 7 eny.bowl)
        hook=id.hook.bowl
        data=!>(id.post.event)
        fires-at=(add now.bowl ~s15)
    ==
  &+[[[%allowed event] [wait-effect ~]] state.hook.bowl]
?.  ?=([%wake *] event)
  &+[[[%allowed event] ~] state.hook.bowl]
=/  target=id-post:c  !<(id-post:c data.event)
=/  react-effect=effect:h
  :*  %channels
      %channel
      nest.u.channel.bowl
      [%post [%add-react target our.bowl '⏰']]
  ==
&+[[[%allowed event] [react-effect ~]] state.hook.bowl]
```

`meta-read.hoon`
```hoon
|=  [=event:h =bowl:h]
^-  outcome:h
?.  ?=([%on-post %add *] event)
  &+[[[%allowed event] ~] state.hook.bowl]
?:  =(author.post.event our.bowl)
  &+[[[%allowed event] ~] state.hook.bowl]
?~  channel.bowl
  &+[[[%allowed event] ~] state.hook.bowl]
=/  group-title=@t
  ?~  group.bowl  'no-group'
  title.meta.u.group.bowl
=/  chan-desc=@t
  ?~  group.bowl  'no-group'
  ?~  chan=(~(get by channels.u.group.bowl) nest.u.channel.bowl)
    'no-channel-entry'
  description.meta.u.chan
=/  vm  +.meta.u.channel.bowl
=/  vmeta=@t  ?~(vm 'v-channel-meta-null' u.vm)
=/  text=@t
  %-  crip
  "meta-read: group-title='{(trip group-title)}' channel-desc='{(trip chan-desc)}' v-channel-meta='{(trip vmeta)}'"
=/  =essay:c
  [[~[[%inline ~[`inline:c`text]]] our.bowl now.bowl] /chat ~ ~]
=/  post-effect=effect:h
  [%channels %channel nest.u.channel.bowl %post %add essay]
&+[[[%allowed event] [post-effect ~]] state.hook.bowl]
```
