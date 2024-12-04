::  channels-server: diary, heap & chat channel storage for groups
::
::    this is the server-side from which /app/channels gets its data.
::
/-  c=channels, g=groups, h=hooks, m=meta
/+  utils=channel-utils, imp=import-aid
/+  default-agent, verb, dbug, neg=negotiate, logs
/+  hj=hooks-json
::
%-  %-  agent:neg
    [| [~.channels^%1 ~ ~] ~]
%-  agent:dbug
%+  verb  |
::
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  current-state
    $:  %7
        =v-channels:c
        =hooks:h
        =pimp:imp
    ==
  --
=|  current-state
=*  state  -
=<
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %|) bowl)
      cor   ~(. +> [bowl ~])
  ++  on-init
    ^-  (quip card _this)
    =^  cards  state
      abet:init:cor
    [cards this]
  ::
  ++  on-save  !>(state)
  ++  on-load
    |=  =vase
    ^-  (quip card _this)
    =^  cards  state
      abet:(load:cor vase)
    [cards this]
  ::
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state
      abet:(poke:cor mark vase)
    [cards this]
  ::
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    =^  cards  state
      abet:(watch:cor path)
    [cards this]
  ::
  ++  on-peek    peek:cor
  ++  on-leave   on-leave:def
  ++  on-fail
    |=  [=term =tang]
    ^-  (quip card _this)
    :_  this
    [(log-fail:logs /logs our.bowl (fail-event:logs term tang))]~
  ::
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state
      abet:(agent:cor wire sign)
    [cards this]
  ::
  ++  on-arvo
    |=  [=wire sign=sign-arvo]
    ^-  (quip card _this)
    =^  cards  state
      abet:(arvo:cor wire sign)
    [cards this]
  --
::
|_  [=bowl:gall cards=(list card)]
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  safe-watch
  |=  [=wire =dock =path]
  ^+  cor
  ?:  (~(has by wex.bowl) wire dock)  cor
  (emit %pass wire %agent dock %watch path)
::
++  load
  |^  |=  =vase
  ^+  cor
  =+  !<(old=versioned-state vase)
  =?  old  ?=(%0 -.old)  (state-0-to-1 old)
  =?  old  ?=(%1 -.old)  (state-1-to-2 old)
  =?  cor  ?=(%2 -.old)  (emit %pass /trim %agent [our.bowl %chat] %poke %chat-trim !>(~))
  =?  old  ?=(%2 -.old)  (state-2-to-3 old)
  =?  old  ?=(%3 -.old)  (state-3-to-4 old)
  =?  old  ?=(%4 -.old)  (state-4-to-5 old)
  =?  old  ?=(%5 -.old)  (state-5-to-6 old)
  =?  old  ?=(%6 -.old)  (state-6-to-7 old)
  ?>  ?=(%7 -.old)
  =.  state  old
  inflate-io
  ::
  +$  versioned-state  $%(state-7 state-6 state-5 state-4 state-3 state-2 state-1 state-0)
  +$  state-7  current-state
  +$  state-6
    $:  %6
        =v-channels:c
        =pimp:imp
    ==
  ++  state-6-to-7
    |=  state-6
    ^-  state-7
    [%7 v-channels *hooks:h pimp]
  +$  state-5
    $:  %5
        =v-channels:v6:old:c
        =pimp:imp
    ==
  ++  state-5-to-6
    |=  state-5
    ^-  state-6
    [%6 (v-channels-5-to-6 v-channels) pimp]
  ++  v-channels-5-to-6
    |=  vc=v-channels:v6:old:c
    ^-  v-channels:c
    %-  ~(run by vc)
    |=  v=v-channel:v6:old:c
    ^-  v-channel:c
    v(pending [pending.v *last-updated:c])
  +$  state-4
    $:  %4
        =v-channels:v6:old:c
    ==
  ++  state-4-to-5
    |=  state-4
    ^-  state-5
    [%5 v-channels *pimp:imp]
  ::
  ++  state-3-to-4
    |=  s=state-3
    ^-  state-4
    s(- %4, v-channels (~(run by v-channels.s) v-channel-2-to-3))
  ::
  ++  v-channel-2-to-3
    |=  v=v-channel-2
    ^-  v-channel:v6:old:c
    v(future [future.v *pending-messages:c])
  ++  v-channels-2  (map nest:c v-channel-2)
  ++  v-channel-2
    |^  ,[global:v-channel:c local]
    +$  local
      $:  =net:c
          =log:c
          =remark:c
          =window:v-channel:c
          =future:v-channel:c
      ==
    --
  ::
  +$  state-3  [%3 v-channels=v-channels-2]
  +$  state-2  [%2 v-channels=v-channels-2]
  ++  state-2-to-3
    |=  old=state-2
    ^-  state-3
    [%3 +.old]
  ::
  ::  %1 to %2
  ::
  +$  state-1
    $:  %1
        v-channels=(map nest:c v-channel-1)
    ==
  ++  v-channel-1
    |^  ,[global local]
    +$  global
      $:  posts=v-posts-1
          order=(rev:c order=arranged-posts:c)
          view=(rev:c =view:c)
          sort=(rev:c =sort:c)
          perm=(rev:c =perm:c)
      ==
    +$  window    window:v-channel:c
    +$  future    [=window diffs=(jug id-post:c u-post-1)]
    +$  local     [=net:c log=log-1 =remark:c =window =future]
    --
  +$  log-1           ((mop time u-channel-1) lte)
  ++  log-on-1        ((on time u-channel-1) lte)
  +$  u-channel-1     $%  $<(%post u-channel:c)
                          [%post id=id-post:c u-post=u-post-1]
                      ==
  +$  u-post-1        $%  $<(?(%set %reply) u-post:c)
                          [%set post=(unit v-post-1)]
                          [%reply id=id-reply:c u-reply=u-reply-1]
                      ==
  +$  u-reply-1       $%  $<(%set u-reply:c)
                          [%set reply=(unit v-reply-1)]
                      ==
  +$  v-posts-1       ((mop id-post:c (unit v-post-1)) lte)
  ++  on-v-posts-1    ((on id-post:c (unit v-post-1)) lte)
  +$  v-post-1        [v-seal-1 (rev:c essay:c)]
  +$  v-seal-1        [id=id-post:c replies=v-replies-1 reacts=v-reacts:c]
  +$  v-replies-1     ((mop id-reply:c (unit v-reply-1)) lte)
  ++  on-v-replies-1  ((on id-reply:c (unit v-reply-1)) lte)
  +$  v-reply-1       [v-reply-seal:c memo:c]
  ++  state-1-to-2
    |=  s=state-1
    ^-  state-2
    s(- %2, v-channels (~(run by v-channels.s) v-channel-1-to-2))
  ++  v-channel-1-to-2
    |=  v=v-channel-1
    ^-  v-channel-2
    %=  v
      posts   (v-posts-1-to-2 posts.v)
      log     (log-1-to-2 log.v)
      future  (future-1-to-2 future.v)
    ==
  ++  log-1-to-2
    |=  l=log-1
    (run:log-on-1 l u-channel-1-to-2)
  ++  u-channel-1-to-2
    |=  u=u-channel-1
    ^-  u-channel:c
    ?.  ?=([%post *] u)  u
    u(u-post (u-post-1-to-2 u-post.u))
  ++  future-1-to-2
    |=  f=future:v-channel-1
    ^-  future:v-channel:c
    f(diffs (~(run by diffs.f) |=(s=(set u-post-1) (~(run in s) u-post-1-to-2))))
  ++  u-post-1-to-2
    |=  u=u-post-1
    ^-  u-post:c
    ?+  u  u
      [%set ~ *]           u(u.post (v-post-1-to-2 u.post.u))
      [%reply * %set ~ *]  u(u.reply.u-reply (v-reply-1-to-2 u.reply.u-reply.u))
    ==
  ++  v-posts-1-to-2
    |=  p=v-posts-1
    %+  run:on-v-posts-1  p
    |=(p=(unit v-post-1) ?~(p ~ `(v-post-1-to-2 u.p)))
  ++  v-post-1-to-2
    |=(p=v-post-1 p(replies (v-replies-1-to-2 replies.p)))
  ++  v-replies-1-to-2
    |=  r=v-replies-1
    %+  run:on-v-replies-1  r
    |=(r=(unit v-reply-1) ?~(r ~ `(v-reply-1-to-2 u.r)))
  ++  v-reply-1-to-2
    |=(r=v-reply-1 `v-reply:c`[-.r 0 +.r])
  ::
  ::  %0 to %1
  ::
  +$  state-0
    $:  %0
        v-channels=(map nest:c v-channel-0)
    ==
  ++  v-channel-0
    |^  ,[global:v-channel-1 local]
    +$  window    window:v-channel:c
    +$  future    [=window diffs=(jug id-post:c u-post-1)]
    +$  local     [=net:c log=log-1 remark=remark-0 =window =future]
    --
  +$  remark-0  [last-read=time watching=_| unread-threads=(set id-post:c)]
  ::
  ++  state-0-to-1
    |=  s=state-0
    ^-  state-1
    s(- %1, v-channels (~(run by v-channels.s) v-channel-0-to-1))
  ++  v-channel-0-to-1
    |=  v=v-channel-0
    ^-  v-channel-1
    =/  recency=time
      ?~(tim=(ram:on-v-posts-1 posts.v) *time key.u.tim)
    v(remark [recency remark.v])
  --
::
++  init
  ^+  cor
  =.  cor
    %-  emil
    :~  [%pass /migrate %agent [our.bowl %diary] %poke %diary-migrate-server !>(~)]
        [%pass /migrate %agent [our.bowl %heap] %poke %heap-migrate-server !>(~)]
        [%pass /migrate %agent [our.bowl %chat] %poke %chat-migrate-server !>(~)]
        ::NOTE  we do these here and not in /app/channels, because it's
        ::      important that the server migration happens first, so that
        ::      the client migration may successfully establish subscriptions.
        [%pass /migrate %agent [our.bowl %diary] %poke %diary-migrate !>(~)]
        [%pass /migrate %agent [our.bowl %heap] %poke %heap-migrate !>(~)]
        [%pass /migrate/final %agent [our.bowl %chat] %poke %chat-migrate !>(~)]
    ==
  inflate-io
::
++  inflate-io
  (safe-watch /groups [our.bowl %groups] /groups)
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+    mark  ~|(bad-poke+mark !!)
      %noun
    ?+  q.vase  !!
        %pimp-ready
      ?-  pimp
        ~         cor(pimp `&+~)
        [~ %& *]  cor
        [~ %| *]  (run-import p.u.pimp)
      ==
    ==
  ::
      %channel-command
    =+  !<(=c-channels:c vase)
    ?-    -.c-channels
        %create
      =<  ca-abet
      =/  =nest:c  [kind.create-channel.c-channels our.bowl name.create-channel.c-channels]
      (ca-create:ca-core nest create-channel.c-channels)
    ::
        %channel
      =/  channel-core  (ca-abed:ca-core nest.c-channels)
      ca-abet:(ca-c-channel:channel-core c-channel.c-channels)
    ==
  ::
      %channel-migration
    ?>  =(our src):bowl
    =+  !<(new-channels=v-channels:c vase)
    =.  v-channels  (~(uni by new-channels) v-channels)  ::  existing overrides migration
    %+  roll  ~(tap by v-channels)
    |=  [[=nest:c =v-channel:c] cr=_cor]
    ca-abet:ca-migrate:(ca-abed:ca-core:cr nest)
  ::
      %egg-any
    =+  !<(=egg-any:gall vase)
    ?-  pimp
      ~         cor(pimp `|+egg-any)
      [~ %& *]  (run-import egg-any)
      [~ %| *]  ~&  [dap.bowl %overwriting-pending-import]
                cor(pimp `|+egg-any)
    ==
  ::
      %hook-action-0
    =+  !<(=action:h vase)
    ?>  =(our src):bowl
    ?-  -.action
        %add
      ho-abet:(ho-add:ho-core [name src]:action)
    ::
        %edit
      ho-abet:(ho-edit:(ho-abed:ho-core id.action) +>.action)
    ::
        %del
      ho-abet:ho-del:(ho-abed:ho-core id.action)
    ::
        %order
      =/  seq
        %+  skim
          seq.action
        |=  =id:h
        (~(has by hooks.hooks) id)
      =.  order.hooks  (~(put by order.hooks) nest.action seq)
      (give-hook-response %order nest.action seq)
    ::
        %config
      ho-abet:(ho-configure:(ho-abed:ho-core id.action) +>.action)
    ::
        %wait
      ho-abet:(ho-wait:(ho-abed:ho-core id.action) +>.action)
    ::
        %rest
      ho-abet:(ho-rest:(ho-abed:ho-core id.action) origin.action)
    ==
  ==
::
++  run-import
  |=  =egg-any:gall
  =.  pimp  ~
  ?-  -.egg-any
      ?(%15 %16)
    ?.  ?=(%live +<.egg-any)
      ~&  [dap.bowl %egg-any-not-live]
      cor
    =/  bak
      (load -:!>(*versioned-state:load) +>.old-state.egg-any)
    ::  for channels that we're gonna restore, tell previous subscribers to
    ::  try again
    ::
    =.  cor
      =/  ded=(list [=ship =path])
        ~(val by bitt.egg-any)
      |-  ^+  cor
      ?~  ded                                   cor
      ?:  =(our.bowl ship.i.ded)                $(ded t.ded)
      ?.  ?=([kind:c @ %updates *] path.i.ded)  $(ded t.ded)
      =/  =nest:c  [i.path.i.ded our.bowl i.t.path.i.ded]
      ?.  &((~(has by v-channels:bak) nest) !(~(has by v-channels) nest))
        $(ded t.ded)
      =/  =cage  noun+!>([%channel-wake [i i.t]:path.i.ded])
      ::NOTE  this assumes it was their %channels agent subscribing to us,
      ::      which we actually cannot know. but a false positive here should
      ::      be harmless.
      =.  cor  (emit %pass /wake %agent [ship.i.ded %channels] %poke cage)
      $(ded t.ded)
    ::  if both the backup and our latest have a channel, keep only our
    ::  version. we could do a "deep merge" but presently unclear how that
    ::  would affect existing subscribers/what would be the correct behavior
    ::  wrt them.
    ::
    =.  v-channels  (~(uni by v-channels:bak) v-channels)
    (emil (prod-next:imp [our dap]:bowl))
  ==
::
++  watch
  |=  =(pole knot)
  ^+  cor
  ~|  watch-path=`path`pole
  ?+    pole  ~|(%bad-watch-path !!)
      [%v0 %hooks ~]  cor
  ::
      [%v0 %hooks %full ~]
    =.  cor  (give %fact ~ hook-full+!>(hooks))
    (give %kick ~ ~)
  ::
      [=kind:c name=@ %create ~]
    ?>  =(our src):bowl
    =*  nest  [kind.pole our.bowl name.pole]
    ?.  (~(has by v-channels) nest)  cor
    ca-abet:ca-watch-create:(ca-abed:ca-core nest)
  ::
      [=kind:c name=@ %updates ~]
    =/  ca  (ca-abed:ca-core kind.pole our.bowl name.pole)
    ?.  (can-read:ca-perms:ca src.bowl)
      ~|(%permission-denied !!)
    cor
  ::
      [=kind:c name=@ %updates after=@ ~]
    =<  ca-abet
    %-  ca-watch-updates:(ca-abed:ca-core kind.pole our.bowl name.pole)
    (slav %da after.pole)
  ::
      [=kind:c name=@ %checkpoint %time-range from=@ ~]
    =<  ca-abet
    %-  ca-watch-checkpoint:(ca-abed:ca-core kind.pole our.bowl name.pole)
    [(slav %da from.pole) ~]
  ::
      [=kind:c name=@ %checkpoint %time-range from=@ to=@ ~]
    =<  ca-abet
    %^    ca-watch-checkpoint:(ca-abed:ca-core kind.pole our.bowl name.pole)
        (slav %da from.pole)
      ~
    (slav %da to.pole)
  ::
      [=kind:c name=@ %checkpoint %before n=@ud ~]
    =<  ca-abet
    %-  ca-watch-checkpoint-page:(ca-abed:ca-core kind.pole our.bowl name.pole)
    (slav %ud n.pole)
  ::
      [%said =kind:c host=@ name=@ %post time=@ reply=?(~ [@ ~])]
    =/  host=ship   (slav %p host.pole)
    =/  =nest:c     [kind.pole host name.pole]
    =/  =plan:c     =,(pole [(slav %ud time) ?~(reply ~ `(slav %ud -.reply))])
    ?>  =(our.bowl host)
    ca-abet:(ca-said:(ca-abed:ca-core nest) plan)
  ==
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+    pole  ~|(bad-agent-wire+pole !!)
    [%logs ~]  cor
    [%pimp ~]  cor
    [%wake ~]  cor
  ::
      [=kind:c *]
    ?+    -.sign  !!
        %poke-ack
      ?~  p.sign  cor
      %-  (slog 'diary-server: poke failure' >wire< u.p.sign)
      cor
    ==
  ::
      [%hooks %effect ~]
    ?+    -.sign  !!
        %poke-ack
      ?~  p.sign  cor
      %-  (slog 'hook effect: poke failure' >wire< u.p.sign)
      cor
    ==
  ::
      [%groups ~]
    ?+    -.sign  !!
        %kick       watch-groups
        %watch-ack
      ?~  p.sign  cor
      =/  =tank
        leaf+"Failed groups subscription in {<dap.bowl>}, unexpected"
      ((slog tank u.p.sign) cor)
    ::
        %fact
      ?.  =(act:mar:g p.cage.sign)  cor
      (take-groups !<(=action:g q.cage.sign))
    ==
  ::
      [%migrate ~]
    ?+  -.sign  !!
        %poke-ack
      ?~  p.sign  cor
      %-  (slog 'channels-server: migration poke failure' >wire< u.p.sign)
      cor
    ==
      [%migrate %final ~]
    ?+  -.sign  !!
        %poke-ack
      ?~  p.sign
      (emit %pass /trim %agent [our.bowl %chat] %poke %chat-trim !>(~))
      %-  (slog 'channels-server: migration poke failure' >wire< u.p.sign)
      cor
    ==
      [%trim ~]
    ?+  -.sign  !!
        %poke-ack
      cor
    ==
  ==
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  =?  +.pole  !?=([%v0 *] +.pole)
    [%v0 +.pole]
  ?+  pole  [~ ~]
      [%x %v0 %hooks ~]
    ``hook-full+!>(hooks)
  ==
::
++  arvo
  |=  [=(pole knot) sign=sign-arvo]
  ^+  cor
  ?+  pole  ~|(bad-arvo-take/pole !!)
      [%hooks rest=*]
    (wakeup-hook rest.pole)
  ==
::
++  watch-groups  (safe-watch /groups [our.bowl %groups] /groups)
++  take-groups
  |=  =action:g
  =/  affected=(list nest:c)
    %+  murn  ~(tap by v-channels)
    |=  [=nest:c channel=v-channel:c]
    ?.  =(p.action group.perm.perm.channel)  ~
    `nest
  =/  diff  q.q.action
  ?+    diff  cor
      [%fleet * %del ~]
    ~&  "%channel-server: revoke perms for {<affected>}"
    %+  roll  affected
    |=  [=nest:c co=_cor]
    ^+  cor
    %+  roll  ~(tap in p.diff)
    |=  [=ship ci=_co]
    ^+  cor
    =/  ca  (ca-abed:ca-core:ci nest)
    ca-abet:(ca-revoke:ca ship)
  ::
      [%fleet * %add-sects *]    (recheck-perms affected ~)
      [%fleet * %del-sects *]    (recheck-perms affected ~)
      [%channel * %edit *]       (recheck-perms affected ~)
      [%channel * %del-sects *]  (recheck-perms affected ~)
      [%channel * %add-sects *]  (recheck-perms affected ~)
      [%cabal * %del *]
    =/  =sect:g  (slav %tas p.diff)
    %+  recheck-perms  affected
    (~(gas in *(set sect:g)) ~[p.diff])
  ==
::
++  recheck-perms
  |=  [affected=(list nest:c) sects=(set sect:g)]
  ~&  "%channel-server recheck permissions for {<affected>}"
  %+  roll  affected
  |=  [=nest:c co=_cor]
  =/  ca  (ca-abed:ca-core:co nest)
  ca-abet:(ca-recheck:ca sects)
::
++  ca-core
  |_  [=nest:c channel=v-channel:c gone=_|]
  +*  ca-posts  ~(. not posts.channel)
  ++  ca-core  .
  ++  emit  |=(=card ca-core(cor (^emit card)))
  ++  emil  |=(caz=(list card) ca-core(cor (^emil caz)))
  ++  give  |=(=gift:agent:gall ca-core(cor (^give gift)))
  ++  ca-perms  ~(. perms:utils our.bowl now.bowl nest group.perm.perm.channel)
  ++  ca-abet
    %_  cor
        v-channels
      ?:(gone (~(del by v-channels) nest) (~(put by v-channels) nest channel))
    ==
  ::
  ++  ca-abed
    |=  n=nest:c
    ~|  nest=n
    ca-core(nest n, channel (~(got by v-channels) n))
  ::
  ++  ca-area  `path`/[kind.nest]/[name.nest]
  ++  ca-sub-path  `path`(weld ca-area /updates)
  ++  ca-watch-create
    =/  =cage  [%channel-update !>([now.bowl %create perm.perm.channel])]
    (give %fact ~[/[kind.nest]/[name.nest]/create] cage)
  ::
  ++  ca-watch-updates
    |=  =@da
    ^+  ca-core
    ?.  (can-read:ca-perms src.bowl)
      ~|(%permission-denied !!)
    =/  =log:c  (lot:log-on:c log.channel `da ~)
    =.  ca-core  (give %fact ~ %channel-logs !>(log))
    ca-core
  ::
  ++  ca-watch-checkpoint
    |=  [from=@da to=(unit @da)]
    ^+  ca-core
    ?.  (can-read:ca-perms src.bowl)
      ~|(%permission-denied !!)
    =/  posts=v-posts:c  (lot:on-v-posts:c posts.channel `from to)
    =/  chk=u-checkpoint:c  -.channel(posts posts)
    =.  ca-core  (give %fact ~ %channel-checkpoint !>(chk))
    (give %kick ~ ~)
  ::
  ++  ca-watch-checkpoint-page
    |=  n=@
    ^+  ca-core
    ?.  (can-read:ca-perms src.bowl)
      ~|(%permission-denied !!)
    =/  posts=v-posts:c  (gas:on-v-posts:c *v-posts:c (bat:mo-v-posts:c posts.channel ~ n))
    =/  chk=u-checkpoint:c  -.channel(posts posts)
    =.  ca-core  (give %fact ~ %channel-checkpoint !>(chk))
    (give %kick ~ ~)
  ::
  ++  ca-create
    |=  [n=nest:c new=create-channel:c]
    ^+  ca-core
    |^
    =.  nest  n
    ?:  (~(has by v-channels) n)
      %-  (slog leaf+"channel-server: create already exists: {<n>}" ~)
      ca-core
    ?>  can-nest
    ?>  am-host:ca-perms
    ?>  ((sane %tas) name.nest)
    =.  channel
      %*  .  *v-channel:c
        perm  [1 writers.new group.new]
      ==
    =.  ca-core
      =/  =cage  [%channel-update !>([now.bowl %create perm.perm.channel])]
      =/  =path  /[kind.nest]/[name.nest]/create
      =.  ca-core  (give %fact ~[path] cage)
      (give %kick ~[path] ~)
    =/  =channel:g
      :-  [title description '' '']:new
      [now.bowl %default | readers.new]
    =/  =action:g
      [group.new now.bowl %channel nest %add channel]
    =/  =dock    [p.group.new %groups]
    =/  =wire    (snoc ca-area %create)
    (emit %pass wire %agent dock %poke act:mar:g !>(action))
    ::
    ::  +can-nest: does group exist, are we allowed
    ::
    ++  can-nest
      ^-  ?
      =/  groups
        .^  groups:g
          %gx
          /(scot %p our.bowl)/groups/(scot %da now.bowl)/groups/noun
        ==
      =/  gop  (~(got by groups) group.new)
      %-  ~(any in bloc.gop)
      ~(has in sects:(~(got by fleet.gop) our.bowl))
    --
  ::
  ++  ca-c-channel
    |=  =c-channel:c
    ^+  ca-core
    ?>  am-host:ca-perms
    ?-    -.c-channel
        %view
      ?>  (is-admin:ca-perms src.bowl)
      =^  changed  view.channel  (next-rev:c view.channel view.c-channel)
      ?.  changed  ca-core
      (ca-update %view view.channel)
    ::
        %sort
      ?>  (is-admin:ca-perms src.bowl)
      =^  changed  sort.channel  (next-rev:c sort.channel sort.c-channel)
      ?.  changed  ca-core
      (ca-update %sort sort.channel)
    ::
        %order
      ?>  (is-admin:ca-perms src.bowl)
      =^  changed  order.channel  (next-rev:c order.channel order.c-channel)
      ?.  changed  ca-core
      (ca-update %order order.channel)
    ::
        %add-writers
      ?>  (is-admin:ca-perms src.bowl)
      =/  new-writers  (~(uni in writers.perm.perm.channel) sects.c-channel)
      =^  changed  perm.channel
        (next-rev:c perm.channel new-writers group.perm.perm.channel)
      ?.  changed  ca-core
      (ca-update %perm perm.channel)
    ::
        %del-writers
      ?>  (is-admin:ca-perms src.bowl)
      =/  new-writers  (~(dif in writers.perm.perm.channel) sects.c-channel)
      =^  changed  perm.channel
        (next-rev:c perm.channel new-writers group.perm.perm.channel)
      ?.  changed  ca-core
      (ca-update %perm perm.channel)
    ::
        %post
      =^  update=(unit u-channel:c)  ca-core
        (ca-c-post c-post.c-channel)
      ?~  update  ca-core
      (ca-update u.update)
    ==
  ::
  ++  ca-c-post
    |=  =c-post:c
    ^-  [(unit u-channel:c) _ca-core]
    ?>  (can-write:ca-perms src.bowl writers.perm.perm.channel)
    =*  no-op  `ca-core
    ?-    -.c-post
        %add
      ?>  |(=(src.bowl our.bowl) =(src.bowl author.essay.c-post))
      ?>  =(kind.nest -.kind-data.essay.c-post)
      =/  id=id-post:c
        |-
        =/  post  (get:on-v-posts:c posts.channel now.bowl)
        ?~  post  now.bowl
        $(now.bowl `@da`(add now.bowl ^~((div ~s1 (bex 16)))))
      =/  new=v-post:c  [[id ~ ~] 0 essay.c-post]
      =^  result=(each event:h tang)  cor
        =/  =event:h  [%on-post %add new]
        (run-hooks event nest 'post blocked')
      ?:  ?=(%.n -.result)
        ((slog p.result) [~ ca-core])
      =.  new
        ?>  ?=([%on-post %add *] p.result)
        post.p.result
      :-  `[%post id %set ~ new]
      ca-core(posts.channel (put:on-v-posts:c posts.channel id ~ new))
    ::
        %edit
      ?>  |(=(src.bowl author.essay.c-post) (is-admin:ca-perms src.bowl))
      =/  post  (get:on-v-posts:c posts.channel id.c-post)
      ?~  post  no-op
      ?~  u.post  no-op
      ?>  |(=(src.bowl author.u.u.post) (is-admin:ca-perms src.bowl))
      =^  result=(each event:h tang)  cor
        =/  =event:h  [%on-post %edit u.u.post essay.c-post]
        (run-hooks event nest 'edit blocked')
      ?:  ?=(%.n -.result)
        ((slog p.result) no-op)
      =/  =essay:c
        ?>  ?=([%on-post %edit *] p.result)
        essay.p.result
      ::TODO  could optimize and no-op if the edit is identical to current
      =/  new=v-post:c  [-.u.u.post +(rev.u.u.post) essay]
      :-  `[%post id.c-post %set ~ new]
      ca-core(posts.channel (put:on-v-posts:c posts.channel id.c-post ~ new))
    ::
        %del
      =/  post  (get:on-v-posts:c posts.channel id.c-post)
      ?~  post  `ca-core(posts.channel (put:on-v-posts:c posts.channel id.c-post ~))
      ?~  u.post  no-op
      ?>  |(=(src.bowl author.u.u.post) (is-admin:ca-perms src.bowl))
      =^  result=(each event:h tang)  cor
        =/  =event:h  [%on-post %del u.u.post]
        (run-hooks event nest 'delete blocked')
      ?>  =(& -.result)
      :-  `[%post id.c-post %set ~]
      ca-core(posts.channel (put:on-v-posts:c posts.channel id.c-post ~))
    ::
        ?(%add-react %del-react)
      =/  post  (get:on-v-posts:c posts.channel id.c-post)
      ?~  post  no-op
      ?~  u.post  no-op
      =^  result=(each event:h tang)  cor
        =/  =event:h
          :*  %on-post  %react  u.u.post
              ?:  ?=(%del-react -.c-post)  [p.c-post ~]
              [p `q]:c-post
          ==
        (run-hooks event nest 'react action blocked')
      ?:  ?=(%.n -.result)
        ((slog p.result) no-op)
      =/  new=c-post:c
        ?>  ?=([%on-post %react *] p.result)
        ?~  react.p.result  [%del-react id.c-post ship.p.result]
        [%add-react id.c-post [ship u.react]:p.result]
      =/  [update=? reacts=v-reacts:c]
        %+  ca-c-react  reacts.u.u.post
        ?>(?=(?(%add-react %del-react) -.new) new)
      ?.  update  no-op
      :-  `[%post id.c-post %reacts reacts]
      %=  ca-core
          posts.channel
        (put:on-v-posts:c posts.channel id.c-post ~ u.u.post(reacts reacts))
      ==
    ::
        %reply
      =/  post  (get:on-v-posts:c posts.channel id.c-post)
      ?~  post  no-op
      ?~  u.post  no-op
      =^  update=(unit u-post:c)  replies.u.u.post
        (ca-c-reply u.u.post c-reply.c-post)
      ?~  update  no-op
      :-  `[%post id.c-post u.update]
      %=  ca-core
          posts.channel
        (put:on-v-posts:c posts.channel id.c-post ~ u.u.post)
      ==
    ==
  ::
  ++  ca-c-reply
    |=  [parent=v-post:c =c-reply:c]
    ^-  [(unit u-post:c) v-replies:c]
    =*  replies  replies.parent
    ?-    -.c-reply
        %add
      ?>  =(src.bowl author.memo.c-reply)
      =/  id=id-reply:c
        |-
        =/  reply  (get:on-v-replies:c replies now.bowl)
        ?~  reply  now.bowl
        $(now.bowl `@da`(add now.bowl ^~((div ~s1 (bex 16)))))
      =/  reply-seal=v-reply-seal:c  [id ~]
      =/  new=v-reply:c  [reply-seal 0 memo.c-reply]
      =^  result=(each event:h tang)  cor
        =/  =event:h  [%on-reply %add parent new]
        (run-hooks event nest 'reply blocked')
      ?:  ?=(%.n -.result)
        ((slog p.result) [~ replies])
      =.  new
        ?>  ?=([%on-reply %add *] p.result)
        reply.p.result
      :-  `[%reply id %set ~ new]
      (put:on-v-replies:c replies id ~ new)
    ::
        %edit
      =/  reply  (get:on-v-replies:c replies id.c-reply)
      ?~  reply    `replies
      ?~  u.reply  `replies
      ?>  =(src.bowl author.u.u.reply)
      =^  result=(each event:h tang)  cor
        =/  =event:h  [%on-reply %edit parent u.u.reply memo.c-reply]
        (run-hooks event nest 'edit blocked')
      ?:  ?=(%.n -.result)
        ((slog p.result) [~ replies])
      =/  =memo:c
        ?>  ?=([%on-reply %edit *] p.result)
        memo.p.result
      ::TODO  could optimize and no-op if the edit is identical to current
      =/  new=v-reply:c  [-.u.u.reply +(rev.u.u.reply) memo]
      :-  `[%reply id.c-reply %set ~ new]
      (put:on-v-replies:c replies id.c-reply ~ new)
    ::
        %del
      =/  reply  (get:on-v-replies:c replies id.c-reply)
      ?~  reply  `(put:on-v-replies:c replies id.c-reply ~)
      ?~  u.reply  `replies
      ?>  |(=(src.bowl author.u.u.reply) (is-admin:ca-perms src.bowl))
      =^  result=(each event:h tang)  cor
        =/  =event:h  [%on-reply %del parent u.u.reply]
        (run-hooks event nest 'delete blocked')
      ?>  =(& -.result)
      :-  `[%reply id.c-reply %set ~]
      (put:on-v-replies:c replies id.c-reply ~)
    ::
        ?(%add-react %del-react)
      =/  reply  (get:on-v-replies:c replies id.c-reply)
      ?~  reply  `replies
      ?~  u.reply  `replies
      =^  result=(each event:h tang)  cor
        =/  =event:h
          :*  %on-reply  %react  parent  u.u.reply
              ?:  ?=(%del-react -.c-reply)  [p.c-reply ~]
              [p `q]:c-reply
          ==
        (run-hooks event nest 'delete blocked')
      ?:  ?=(%.n -.result)
        ((slog p.result) [~ replies])
      =/  new=c-reply:c
        ?>  ?=([%on-reply %react *] p.result)
        ?~  react.p.result  [%del-react id.c-reply ship.p.result]
        [%add-react id.c-reply [ship u.react]:p.result]
      =/  [update=? reacts=v-reacts:c]
        %+  ca-c-react  reacts.u.u.reply
        ?>(?=(?(%add-react %del-react) -.new) new)
      ?.  update  `replies
      :-  `[%reply id.c-reply %reacts reacts]
      (put:on-v-replies:c replies id.c-reply ~ u.u.reply(reacts reacts))
    ==
  ::
  ++  ca-c-react
    |=  [reacts=v-reacts:c =c-react:c]
    ^-  [changed=? v-reacts:c]
    =/  =ship     ?:(?=(%add-react -.c-react) p.c-react p.c-react)
    ?>  |(=(src.bowl our.bowl) =(src.bowl ship))
    =/  new-react  ?:(?=(%add-react -.c-react) `q.c-react ~)
    =/  [changed=? new-rev=@ud]
      =/  old-react  (~(get by reacts) ship)
      ?~  old-react  &+0
      ?:  =(new-react +.u.old-react)
        |+rev.u.old-react
      &++(rev.u.old-react)
    ?.  changed  [| reacts]
    &+(~(put by reacts) ship new-rev new-react)
  ::
  ++  ca-update
    |=  =u-channel:c
    ^+  ca-core
    =/  time
      |-
      =/  reply  (get:log-on:c log.channel now.bowl)
      ?~  reply  now.bowl
      $(now.bowl `@da`(add now.bowl ^~((div ~s1 (bex 16)))))
    =/  =update:c  [time u-channel]
    =.  log.channel  (put:log-on:c log.channel update)
    (ca-give-update update)
  ::
  ++  ca-subscription-paths
    ^-  (list path)
    %+  skim  ~(tap in (~(gas in *(set path)) (turn ~(val by sup.bowl) tail)))
    |=  =path
    =((scag 3 path) ca-sub-path)
  ::
  ++  ca-give-update
    |=  =update:c
    ^+  ca-core
    =/  paths  ca-subscription-paths
    ?:  =(~ paths)
      ca-core
    (give %fact paths %channel-update !>(update))
  ::
  ++  ca-subscriptions
    ^-  (set [ship path])
    %+  roll  ~(val by sup.bowl)
    |=  [[=ship =path] out=(set [ship path])]
    ?.  =((scag 3 path) ca-sub-path)
      out
    (~(put in out) [ship path])
  ::
  ++  ca-migrate
    ^+  ca-core
    =/  paths  ca-subscription-paths
    %-  emil
    %+  turn  paths
    |=  =path
    =/  =log:c
      ?.  ?=([@ @ @ @ ~] path)  log.channel
      =/  after  (slaw %da i.t.t.t.path)
      ?~  after  log.channel
      (lot:log-on:c log.channel after ~)
    [%give %fact ~[path] %channel-logs !>(log)]
  ::
  ++  ca-revoke
    |=  her=ship
    ^+  ca-core
    %+  roll  ~(tap in ca-subscriptions)
    |=  [[=ship =path] ca=_ca-core]
    ?.  =(ship her)  ca
    (emit:ca %give %kick ~[path] `ship)
  ::
  ++  ca-recheck
    |=  sects=(set sect:g)
    ::  if we have sects, we need to delete them from writers
    =?  ca-core  !=(sects ~)
      =/  =c-channels:c  [%channel nest %del-writers sects]
      =/  =cage  [%channel-command !>(c-channels)]
      (emit %pass ca-area %agent [our.bowl dap.bowl] %poke cage)
    ::  if subs read permissions removed, kick
    %+  roll  ~(tap in ca-subscriptions)
    |=  [[=ship =path] ca=_ca-core]
    ?:  (can-read:ca-perms:ca ship)  ca
    (emit:ca %give %kick ~[path] `ship)
  ::
  ++  ca-said
    |=  =plan:c
    ^+  ca-core
    =.  ca-core
      %^  give  %fact  ~
      ?.  (can-read:ca-perms src.bowl)
        channel-denied+!>(~)
      (said:utils nest plan posts.channel)
    (give %kick ~ ~)
  --
++  scry-path
  |=  [=dude:gall =path]
  %+  welp
  /(scot %p our.bowl)/[dude]/(scot %da now.bowl)
  path
++  get-hook-context
  |=  [channel=(unit [nest:c v-channel:c]) =config:h]
  ^-  context:h
  =/  group
    ?~  channel  ~
    =*  flag  group.perm.perm.+.u.channel
    %-  some
    ?.  .^(? %gu (scry-path %groups /$))  *group-ui:g
    ?.  .^(? %gx (scry-path %groups /exists/(scot %p p.flag)/[q.flag]/noun))
      *group-ui:g
    .^(group-ui:g %gx (scry-path %groups /groups/(scot %p p.flag)/[q.flag]/v1/noun))
  :*  channel
      group
      v-channels
      *hook:h  ::  we default this because each hook will replace with itself
      config
      [now our src eny]:bowl
  ==
::
++  give-hook-response
  |=  =response:h
  ^+  cor
  (give %fact ~[/v0/hooks] hook-response-0+!>(response))
++  ho-core
  |_  [=id:h =hook:h gone=_|]
  ++  ho-core  .
  ++  emit  |=(=card ho-core(cor (^emit card)))
  ++  emil  |=(caz=(list card) ho-core(cor (^emil caz)))
  ++  give  |=(=gift:agent:gall ho-core(cor (^give gift)))
  ++  ho-abet
    %_  cor
        hooks.hooks
      ?:(gone (~(del by hooks.hooks) id) (~(put by hooks.hooks) id hook))
    ==
  ::
  ++  ho-abed
    |=  i=id:h
    ho-core(id i, hook (~(got by hooks.hooks) i))
  ::
  ++  ho-add
    |=  [name=@t src=@t]
    ^+  ho-core
    =.  id
      =+  i=(end 7 eny.bowl)
      |-(?:((~(has by hooks.hooks) i) $(i +(i)) i))
    =/  result=(each vase tang)
      (compile:utils src)
    =/  compiled
      ?:  ?=(%| -.result)
        ((slog 'compilation result:' p.result) ~)
      `p.result
    =.  hook  [id %0 name *data:m src compiled !>(~) ~]
    =.  cor
      =/  error=(unit tang)
        ?:(?=(%& -.result) ~ `p.result)
      (give-hook-response [%set id name src meta.hook error])
    ho-core
  ++  ho-edit
    |=  [name=(unit @t) src=(unit @t) meta=(unit data:m)]
    =?  src.hook  ?=(^ src)  u.src
    =/  result=(each vase tang)
      (compile:utils src.hook)
    ?:  ?=(%| -.result)
      =.  cor
        %-  give-hook-response
        [%set id name.hook src.hook meta.hook `p.result]
      ho-core
    =?  name.hook  ?=(^ name)  u.name
    =?  meta.hook  ?=(^ meta)  u.meta
    =.  compiled.hook  `p.result
    =.  cor
      %-  give-hook-response
      [%set id name.hook src.hook meta.hook ~]
    ho-core
  ::
  ++  ho-del
    =.  gone  &
    =.  cor
      %+  roll
        ~(tap by (~(gut by crons.hooks) id *(map origin:h cron:h)))
      |=  [[=origin:h =cron:h] cr=_cor]
      (unschedule-cron:cr origin cron)
    =.  crons.hooks  (~(del by crons.hooks) id)
    =.  order.hooks
      %+  roll
        ~(tap by order.hooks)
      |=  [[=nest:c ids=(list id:h)] or=(map nest:c (list id:h))]
      =-  (~(put by or) nest -)
      (skip ids |=(i=id:h =(id i)))
    =.  delayed.hooks
      %+  roll
        ~(tap by delayed.hooks)
      |=  [[=delay-id:h d=[* delayed-hook:h]] dh=_delayed.hooks]
      ?.  =(id hook.d)  dh
      (~(del by dh) delay-id)
    =.  cor  (give-hook-response [%gone id])
    ho-core
  ++  ho-configure
    |=  [=nest:c =config:h]
    ^+  ho-core
    =.  config.hook  (~(put by config.hook) nest config)
    =.  cor  (give-hook-response [%config id nest config])
    ho-core
  ++  ho-wait
    |=  [=origin:h schedule=$@(@dr schedule:h) =config:h]
    ^+  ho-core
    =/  schedule
      ?:  ?=(@ schedule)  [now.bowl schedule]
      schedule
    =/  crons  (~(gut by crons.hooks) id *(map origin:h cron:h))
    =/  =cron:h  [id schedule config]
    =.  crons.hooks
      =-  (~(put by crons.hooks) id.hook -)
      (~(put by crons) origin cron)
    =.  cor  (schedule-cron origin cron)
    =.  cor  (give-hook-response [%wait id origin schedule config])
    ho-core
  ++  ho-rest
    |=  =origin:h
    ^+  ho-core
    =/  crons  (~(got by crons.hooks) id)
    =/  cron  (~(got by crons) origin)
    =.  crons.hooks
      (~(put by crons.hooks) id (~(del by crons) origin))
    =.  cor  (unschedule-cron origin cron)
    =.  cor  (give-hook-response [%rest id origin])
    ho-core
  ++  ho-run-single
    |=  [=event:h prefix=tape =origin:h =config:h]
    =/  channel
      ?@  origin  ~
      ?~  ch=(~(get by v-channels) origin)  ~
      `[origin u.ch]
    =/  =context:h  (get-hook-context channel config)
    =/  return=(unit return:h)
      (run-hook:utils [event context(hook hook)] hook)
    ?~  return
      %-  (slog (crip "{prefix} {<id>} failed, running on {<origin>}") ~)
      ho-core
    %-  (slog (crip "{prefix} {<id>} ran on {<origin>}") ~)
    =.  hook  hook(state new-state.u.return)
    =.  cor  (run-hook-effects effects.u.return origin)
    ho-core
  --
++  run-hooks
  |=  [=event:h =nest:c default=cord]
  ^-  [(each event:h tang) _cor]
  =;  [result=(each event:h tang) effects=(list effect:h)]
    [result (run-hook-effects effects nest)]
  =/  current-event  event
  =|  effects=(list effect:h)
  =/  order  (~(gut by order.hooks) nest ~)
  =/  channel  `[nest (~(got by v-channels) nest)]
  =/  =context:h  (get-hook-context channel *config:h)
  |-
  ?~  order
    [&+current-event effects]
  =*  next  $(order t.order)
  =/  hook  (~(got by hooks.hooks) i.order)
  =/  ctx  context(hook hook, config (~(gut by config.hook) nest ~))
  =/  return=(unit return:h)
    (run-hook:utils [current-event ctx] hook)
  ?~  return  next
  =*  result  result.u.return
  =.  effects  (weld effects effects.u.return)
  =.  hooks.hooks  (~(put by hooks.hooks) i.order hook(state new-state.u.return))
  ?:  ?=(%denied -.result)
    [|+~[(fall msg.result default)] effects]
  =.  current-event  new.result
  next
++  wakeup-hook
  |=  =(pole knot)
  ^+  cor
  ?+  pole  ~|(bad-arvo-take/pole !!)
      [%delayed id=@ ~]
    =/  =id:h  (slav %uv id.pole)
    ?~  delay=(~(get by delayed.hooks) id)  cor
    ::  make sure we clean up
    =.  delayed.hooks  (~(del by delayed.hooks) id)
    ::  ignore premature fires
    ?:  (lth now.bowl fires-at.u.delay)  cor
    =*  origin  origin.u.delay
    =/  hook  (~(got by hooks.hooks) hook.u.delay)
    =/  config  ?@(origin ~ (~(gut by config.hook) origin ~))
    =/  args  [[%wake +.u.delay] "delayed hook" origin config]
    ho-abet:(ho-run-single:(ho-abed:ho-core hook.u.delay) args)
  ::
      [%cron id=@ kind=?(%chat %diary %heap) ship=@ name=@ ~]
    =/  =id:h  (slav %uv id.pole)
    =/  =origin:h  [kind.pole (slav %p ship.pole) name.pole]
    ::  if unscheduled, ignore
    ?~  crons=(~(get by crons.hooks) id)  cor
    ?~  cron=(~(get by u.crons) origin)  cor
    ::  ignore premature fires
    ?:  (lth now.bowl next.schedule.u.cron)  cor
    =.  next.schedule.u.cron
      ::  we don't want to run the cron for every iteration it would
      ::  have run 'offline', so we check here to make sure that the
      ::  next fire time is in the future
      =/  next  (add [next repeat]:schedule.u.cron)
      |-
      ?:  (gte next now.bowl)  next
      $(next (add next repeat.schedule.u.cron))
    =.  crons.hooks
      %+  ~(put by crons.hooks)  id
      (~(put by u.crons) origin u.cron)
    =.  cor
      (schedule-cron origin u.cron)
    =/  args  [[%cron ~] "cron job" origin config.u.cron]
    ho-abet:(ho-run-single:(ho-abed:ho-core hook.u.cron) args)
  ==
++  schedule-cron
  |=  [=origin:h =cron:h]
  ^+  cor
  =/  wire
    %+  welp  /hooks/cron/(scot %uv hook.cron)
    ?@  origin  ~
    /[kind.origin]/(scot %p ship.origin)/[name.origin]
  (emit [%pass wire %arvo %b %wait next.schedule.cron])
++  unschedule-cron
  |=  [=origin:h =cron:h]
  =/  wire
    %+  welp  /hooks/cron/(scot %uv hook.cron)
    ?@  origin  ~
    /[kind.origin]/(scot %p ship.origin)/[name.origin]
  (emit [%pass wire %arvo %b %rest next.schedule.cron])
++  schedule-delay
  |=  dh=delayed-hook:h
  =/  =wire  /hooks/delayed/(scot %uv id.dh)
  (emit [%pass wire %arvo %b %wait fires-at.dh])
++  unschedule-delay
  |=  =id:h
  ^+  cor
  ?~  previous=(~(get by delayed.hooks) id)  cor
  =/  =wire  /hooks/delayed/(scot %uv id.u.previous)
  (emit [%pass wire %arvo %b %rest fires-at.u.previous])
++  run-hook-effects
  |=  [effects=(list effect:h) =origin:h]
  ^+  cor
  |-
  ?~  effects
    cor
  =/  =effect:h  i.effects
  =;  new-cor=_cor
    =.  cor  new-cor
    $(effects t.effects)
  ?-  -.effect
      %channels
    =/  =cage  channel-action+!>(a-channels.effect)
    (emit [%pass /hooks/effect %agent [our.bowl %channels] %poke cage])
  ::
      %groups
    =/  =cage  group-action-3+!>(action.effect)
    (emit [%pass /hooks/effect %agent [our.bowl %groups] %poke cage])
  ::
      %activity
    =/  =cage  activity-action+!>(action.effect)
    (emit [%pass /hooks/effect %agent [our.bowl %activity] %poke cage])
  ::
      %dm
    =/  =cage  chat-dm-action+!>(action.effect)
    (emit [%pass /hooks/effect %agent [our.bowl %chat] %poke cage])
  ::
      %club
    =/  =cage  chat-club-action+!>(action.effect)
    (emit [%pass /hooks/effect %agent [our.bowl %chat] %poke cage])
  ::
      %contacts
    =/  =cage  contacts-action-1+!>(action.effect)
    (emit [%pass /hooks/effect %agent [our.bowl %contacts] %poke cage])
  ::
      %wait
    =/  =wire  /hooks/delayed/(scot %uv id.effect)
    =.  cor  (unschedule-delay id.effect)
    =.  delayed.hooks
      (~(put by delayed.hooks) id.effect [origin +.effect])
    (schedule-delay +.effect)
  ==
--
