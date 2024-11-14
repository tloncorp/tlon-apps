::  channels-server: diary, heap & chat channel storage for groups
::
::    this is the server-side from which /app/channels gets its data.
::
/-  c=channels, g=groups, h=hooks
/+  utils=channel-utils, imp=import-aid
/+  default-agent, verb, dbug, neg=negotiate
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
        hooks=(map nest:c hooks:h)
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
  ++  on-peek    on-peek:def
  ++  on-leave   on-leave:def
  ++  on-fail    on-fail:def
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
    [%7 v-channels ~ pimp]
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
  =.  cor  (safe-watch /groups [our.bowl %groups] /groups)
  %+  roll  ~(tap by hooks)
  |=  [[=nest:c hks=hooks:h] cr=_cor]
  %+  roll  ~(tap by hooks.hks)
  |=  [[=id:h =hook:h] co=_cr]
  ?~  cron.hook  co
  ?~  compiled.hook  co
  ?.  enabled.hook  co
  ?^  delay=(~(get by delayed.hks) id)  co
  ::  only start timers for crons that haven't already been started
  =/  fires-at  (add now.bowl u.cron.hook)
  =-  ho-abet.-
  %-  ho-schedule:(ho-abed:ho-core:co nest)
  [%cron id id u.cron.hook !>(~) fires-at]
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
    =+  !<([=nest:c =action:h] vase)
    ho-abet:(ho-action:(ho-abed:ho-core nest) action)
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
++  arvo
  |=  [=(pole knot) sign=sign-arvo]
  ^+  cor
  ?+  pole  ~|(bad-arvo-take/pole !!)
      [%hooks =kind:c ship=@ name=@ rest=*]
    =/  ship  (slav %p ship.pole)
    =/  =nest:c  [kind.pole ship name.pole]
    ho-abet:(ho-arvo:(ho-abed:ho-core nest) rest.pole)
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
    =/  =dock    [our.bowl %groups]
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
    =/  =context:h  (get-context channel)
    =*  no-op  `ca-core
    ?-    -.c-post
        %add
      ?>  =(src.bowl author.essay.c-post)
      ?>  =(kind.nest -.kind-data.essay.c-post)
      =/  id=id-post:c
        |-
        =/  post  (get:on-v-posts:c posts.channel now.bowl)
        ?~  post  now.bowl
        $(now.bowl `@da`(add now.bowl ^~((div ~s1 (bex 16)))))
      =/  new=v-post:c  [[id ~ ~] 0 essay.c-post]
      =^  result=(each event:h tang)  cor
        =/  =event:h  [%on-post %add new]
        %-  ho-run:(ho-abed:ho-core nest)
        [event context 'post blocked']
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
      ?>  =(kind.nest -.kind-data.essay.c-post)
      =/  post  (get:on-v-posts:c posts.channel id.c-post)
      ?~  post  no-op
      ?~  u.post  no-op
      ?>  |(=(src.bowl author.u.u.post) (is-admin:ca-perms src.bowl))
      =^  result=(each event:h tang)  cor
        =/  =event:h  [%on-post %edit u.u.post essay.c-post]
        %-  ho-run:(ho-abed:ho-core nest)
        [event context 'edit blocked']
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
        %-  ho-run:(ho-abed:ho-core nest)
        [event context 'delete blocked']
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
        %-  ho-run:(ho-abed:ho-core nest)
        [event context 'react action blocked']
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
        (ca-c-reply u.u.post c-reply.c-post context)
      ?~  update  no-op
      :-  `[%post id.c-post u.update]
      %=  ca-core
          posts.channel
        (put:on-v-posts:c posts.channel id.c-post ~ u.u.post)
      ==
    ==
  ::
  ++  ca-c-reply
    |=  [parent=v-post:c =c-reply:c =context:h]
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
        %-  ho-run:(ho-abed:ho-core nest)
        [event context 'reply blocked']
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
        %-  ho-run:(ho-abed:ho-core nest)
        [event context 'edit blocked']
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
        %-  ho-run:(ho-abed:ho-core nest)
        [event context 'delete blocked']
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
        %-  ho-run:(ho-abed:ho-core nest)
        [event context 'delete blocked']
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
    ?>  =(src.bowl ship)
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
++  get-context
  |=  =v-channel:c
  ^-  context:h
  =*  flag  group.perm.perm.v-channel
  =/  =group-ui:g
    ?.  .^(? %gu (scry-path %groups /$))  *group-ui:g
    ?.  .^(? %gx (scry-path %groups /exists/(scot %p p.flag)/[q.flag]/noun))
      *group-ui:g
    .^(group-ui:g %gx (scry-path %groups /groups/(scot %p p.flag)/[q.flag]/v1/noun))
  :*  v-channel
      v-channels
      group-ui
      *hook:h  ::  we default this because each hook will replace with itself
      [now our src eny]:bowl
  ==
::
++  ho-core
  |_  [=nest:c hks=hooks:h ctx=context:h gone=_|]
  ++  ho-core  .
  ++  emit  |=(=card ho-core(cor (^emit card)))
  ++  emil  |=(caz=(list card) ho-core(cor (^emil caz)))
  ++  give  |=(=gift:agent:gall ho-core(cor (^give gift)))
  ++  ho-abet
    %_  cor
        hooks
      ?:(gone (~(del by hooks) nest) (~(put by hooks) nest hks))
    ==
  ::
  ++  ho-abed
    |=  n=nest:c
    ho-core(nest n, hks (~(gut by hooks) n *hooks:h))
  ::
  ++  ho-action
    |=  =action:h
    ^+  ho-core
    ?>  (is-admin:ca-perms:(ca-abed:ca-core nest) src.bowl)
    ?-  -.action
        %add
      ~&  "adding hook {<action>}"
      =/  =id:h  (rsh [3 48] eny.bowl)
      =/  src=(rev:c (unit @t))  [0 `src.action]
      =/  result=(each nock tang)
        ~&  "compiling hook"
        ((compile:utils args:h outcome:h) `src.action)
      ~&  "compilation result: {<-.result>}"
      =/  compiled
        ?:  ?=(%| -.result)
          ((slog 'compilation result:' p.result) ~)
        `p.result
      =.  ho-core
        ?~  cron.action  ho-core
        =/  fires-at  (add now.bowl u.cron.action)
        =/  dh  [id id u.cron.action !>(~) fires-at]
        (ho-schedule %cron dh)
      =.  order.hks
        +:(next-rev:c order.hks (snoc +.order.hks id))
      =.  hooks.hks
        %+  ~(put by hooks.hks)  id
        [id name.action & src compiled cron.action !>(~)]
      ho-core
    ::
        %edit
      ?~  old-hook=(~(get by hooks.hks) id.action)  ho-core
      =/  hook  u.old-hook
      =^  src-changed  src.hook
        (next-rev:c src.hook `src.action)
      =/  name-changed  !=(name.action name.hook)
      =/  cron-changed  !=(cron.action cron.hook)
      ?.  |(src-changed name-changed cron-changed)  ho-core
      =.  name.hook  name.action
      =.  cron.hook  cron.action
      =.  compiled.hook
        ?~  +.src.hook  ~
        =/  result=(each nock tang)
          ((compile:utils args:h return:h) +.src.hook)
        ?:  ?=(%| -.result)  ~
        `p.result
      =.  hooks.hks  (~(put by hooks.hks) id.action hook)
      ?.  cron-changed  ho-core
      ?~  cron.action  ho-core
      =.  ho-core  (ho-unschedule id.action %cron)
      =/  fires-at  (add now.bowl u.cron.action)
      =/  dh  [id.action id.action u.cron.action !>(~) fires-at]
      (ho-schedule %cron dh)
    ::
        %del
      ::  TODO: make more CRDT
      ?~  hook=(~(get by hooks.hks) id.action)  ho-core
      =.  ho-core  (ho-unschedule id.action %cron)
      =.  hooks.hks  (~(del by hooks.hks) id.action)
      =/  [* new-order=_order.hks]
        %+  next-rev:c  order.hks
        %+  skim  +.order.hks
        |=  =id:h
        !=(id id.action)
      =.  order.hks  new-order
      ho-core
    ::
        %enable
      =/  hook  (~(got by hooks.hks) id.action)
      =.  hooks.hks  (~(put by hooks.hks) id.action hook(enabled &))
      ?~  cron.hook  ho-core
      =/  fires-at  (add now.bowl u.cron.hook)
      =/  dh  [id.action id.action u.cron.hook !>(~) fires-at]
      (ho-schedule %cron dh)
    ::
        %disable
      =/  hook  (~(got by hooks.hks) id.action)
      =.  hooks.hks  (~(put by hooks.hks) id.action hook(enabled |))
      (ho-unschedule id.action %cron)
    ::
        %order
      =^  changed  order.hks
        (next-rev:c order.hks seq.action)
      ho-core
    ==
  ++  ho-run
    |=  [=event:h =context:h default=cord]
    =^  [result=(each event:h tang) effects=(list effect:h)]  hks
      (run-hooks:utils event context default hks)
    [result ho-abet:(ho-run-effects effects)]
  ++  ho-run-single
    |=  [=event:h prefix=tape =hook:h]
    ?~  channel=(~(get by v-channels) nest)  ho-core
    =/  =context:h  (get-context u.channel)
    =/  return=(unit return:h)
      (run-hook:utils event context hook)
    ?~  return
      ~&  "{prefix} {<id.hook>} failed"
      ho-core
    ~&  "{prefix} {<id.hook>} ran"
    =.  hooks.hks
      (~(put by hooks.hks) id.hook hook(state new-state.u.return))
    (ho-run-effects effects.u.return)
  ++  ho-run-effects
    |=  effects=(list effect:h)
    ^+  ho-core
    |-
    ?~  effects
      ho-core
    =/  =effect:h  i.effects
    =;  new-cor=_ho-core
      =.  ho-core  new-cor
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
        %delay
      =/  fires-at  (add now.bowl wait.effect)
      =/  dh  +:effect(data [data.effect fires-at])
      =.  ho-core  (ho-unschedule id.effect %delayed)
      (ho-schedule %delayed dh)
    ==
  ++  ho-schedule
    |=  [type=@tas dh=delayed-hook:h]
    ^+  ho-core
    ~&  "scheduling hook"
    =.  delayed.hks  (~(put by delayed.hks) id.dh dh)
    =/  =wire  (welp ho-prefix /[type]/(scot %uv id.dh))
    (emit [%pass wire %arvo %b %wait fires-at.dh])
  ++  ho-unschedule
    |=  [=id:h type=@tas]
    ?~  previous=(~(get by delayed.hks) id)  ho-core
    =/  =wire  (welp ho-prefix /[type]/(scot %uv id))
    (emit [%pass wire %arvo %b %rest fires-at.u.previous])
  ++  ho-arvo
    |=  =(pole knot)
    ^+  ho-core
    ?+  pole  ~|(bad-arvo-take/pole !!)
        [%delayed id=@ ~]
      =/  =id:h  (slav %uv id.pole)
      ?~  delay=(~(get by delayed.hks) id)  ho-core
      ?~  hook=(~(get by hooks.hks) hook.u.delay)  ho-core
      (ho-run-single [%delay u.delay] "delayed hook" u.hook)
    ::
        [%cron id=@ ~]
      =/  =id:h  (slav %uv id.pole)
      ?~  delay=(~(get by delayed.hks) id)  ho-core
      ?~  hook=(~(get by hooks.hks) id)  ho-core
      ::  if unscheduled, ignore
      ?~  cron.u.hook  ho-core
      =/  next  (add now.bowl u.cron.u.hook)
      =.  ho-core  (ho-schedule %cron u.delay(fires-at next))
      (ho-run-single [%cron ~] "cron job" u.hook)
    ==
  ++  ho-prefix  /hooks/[kind.nest]/(scot %p ship.nest)/[name.nest]
  --
--
