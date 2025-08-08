::  channels-server: diary, heap & chat channel storage for groups
::
::    this is the server-side from which /app/channels gets its data.
::
/-  c=channels, g=groups, gv=groups-ver, h=hooks, m=meta
/+  utils=channel-utils, imp=import-aid
/+  default-agent, verb, dbug,
    neg=negotiate, discipline, logs
/+  hj=hooks-json
::
/%  m-channel-checkpoint    %channel-checkpoint
/%  m-channel-denied        %channel-denied
/%  m-channel-logs          %channel-logs
/%  m-channel-said-1        %channel-said-1
/%  m-channel-update        %channel-update
/%  m-hook-channel-preview  %hook-channel-preview
/%  m-hook-full             %hook-full
/%  m-hook-response-0       %hook-response-0
/%  m-hook-template         %hook-template
::
%-  %-  discipline
    :+  ::  marks
        ::
        :~  :+  %channel-checkpoint    |  -:!>(*vale:m-channel-checkpoint)
            :+  %channel-denied        |  -:!>(*vale:m-channel-denied)
            :+  %channel-logs          |  -:!>(*vale:m-channel-logs)
            :+  %channel-said-1        |  -:!>(*vale:m-channel-said-1)
            :+  %channel-update        |  -:!>(*vale:m-channel-update)
            :+  %hook-channel-preview  |  -:!>(*vale:m-hook-channel-preview)
            :+  %hook-full             |  -:!>(*vale:m-hook-full)
            :+  %hook-response-0       |  -:!>(*vale:m-hook-response-0)
            :+  %hook-template         |  -:!>(*vale:m-hook-template)
        ==
      ::  facts
      ::
      :~  [/$/$/checkpoint %channel-checkpoint ~]
          [/$/$/create %channel-update ~]
          [/$/$/updates %channel-update %channel-logs ~]
          [/said %channel-said-1 %channel-denied ~]
        ::
          [/v0/hooks %hook-response-0 ~]
          [/v0/hooks/full %hook-full ~]
          [/v0/hooks/preview %hook-channel-preview ~]
          [/v0/hooks/template %hook-template ~]
      ==
    ::  scries
    ::
    :~  [/x/v0/hooks %hook-full]
    ==
::
%-  %-  agent:neg
    :+  notify=|
      [~.channels^%2 ~ ~]
    (my %groups^[~.groups^%1 ~ ~] ~)
%-  agent:dbug
%+  verb  |
::
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  current-state
    $:  %9
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
      log   ~(. logs [our.bowl /logs])
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
    %-  (slog term tang)
    :_  this
    [(fail:log term tang ~)]~
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
  =?  old  ?=(%7 -.old)  (state-7-to-8 old)
  =?  old  ?=(%8 -.old)  (state-8-to-9 old)
  ?>  ?=(%9 -.old)
  =.  state  old
  inflate-io
  ::
  +$  versioned-state
    $%  state-9
        state-8
        state-7
        state-6
        state-5
        state-4
        state-3
        state-2
        state-1
        state-0
    ==
  +$  state-9  current-state
  +$  state-8
    $:  %8
        =v-channels:c
        =hooks:h
        =pimp:imp
    ==
  +$  state-7
    $:  %7
        =v-channels:v7:old:c
        =hooks:h
        =pimp:imp
    ==
  +$  state-6
    $:  %6
      =v-channels:v7:old:c
      =pimp:imp
    ==
  ++  state-8-to-9
    |=  s=state-8
    ^-  state-9
    =-  s(- %9, v-channels -)
    %-  ~(run by v-channels.s)
    |=  v=v-channel:c
    ^+  v
    %+  roll  (tap:log-on:c log.v)
    |=  $:  [t=time u=u-channel:c]
            chan=_v
        ==
    ?.  ?=([%post * %set ~] u)  chan
    ~?  ?=([~ ~ *] (get:on-v-posts:c posts.chan id.u))
      %strange-existing-deleted-posts
    =-  chan(posts -)
    (put:on-v-posts:c posts.chan id.u ~)
  ++  state-7-to-8
    |=  s=state-7
    ^-  state-8
    s(- %8, v-channels (v-channels-7-to-8:utils v-channels.s))
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
    ^-  v-channels:v7:old:c
    %-  ~(run by vc)
    |=  v=v-channel:v6:old:c
    ^-  v-channel:v7:old:c
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
    v(future [future.v *pending-messages:v7:old:c])
  ++  v-channels-2  (map nest:c v-channel-2)
  ++  v-channel-2
    |^  ,[global:v-channel:v7:old:c local]
    +$  local
      $:  =net:c
          =log:v7:old:c
          =remark:c
          =window:v-channel:c
          =future:v-channel:v7:old:c
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
  +$  u-channel-1     $%  $<(%post u-channel:v7:old:c)
                          [%post id=id-post:c u-post=u-post-1]
                      ==
  +$  u-post-1        $%  $<(?(%set %reply) u-post:v7:old:c)
                          [%set post=(unit v-post-1)]
                          [%reply id=id-reply:c u-reply=u-reply-1]
                      ==
  +$  u-reply-1       $%  $<(%set u-reply:v7:old:c)
                          [%set reply=(unit v-reply-1)]
                      ==
  +$  v-posts-1       ((mop id-post:c (unit v-post-1)) lte)
  ++  on-v-posts-1    ((on id-post:c (unit v-post-1)) lte)
  +$  v-post-1        [v-seal-1 (rev:c essay:v7:old:c)]
  +$  v-seal-1        [id=id-post:c replies=v-replies-1 reacts=v-reacts:v7:old:c]
  +$  v-replies-1     ((mop id-reply:c (unit v-reply-1)) lte)
  ++  on-v-replies-1  ((on id-reply:c (unit v-reply-1)) lte)
  +$  v-reply-1       [v-reply-seal:v7:old:c memo:v7:old:c]
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
    ^-  u-channel:v7:old:c
    ?.  ?=([%post *] u)  u
    u(u-post (u-post-1-to-2 u-post.u))
  ++  future-1-to-2
    |=  f=future:v-channel-1
    ^-  future:v-channel:v7:old:c
    f(diffs (~(run by diffs.f) |=(s=(set u-post-1) (~(run in s) u-post-1-to-2))))
  ++  u-post-1-to-2
    |=  u=u-post-1
    ^-  u-post:v7:old:c
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
    |=(r=v-reply-1 `v-reply:v7:old:c`[-.r 0 +.r])
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
  watch-groups
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+    mark  ~|(bad-poke+mark !!)
      %noun
    ?+  q.vase  !!
        %pimp-ready
      ?>  =(our src):bowl
      ?-  pimp
        ~         cor(pimp `&+~)
        [~ %& *]  cor
        [~ %| *]  (run-import p.u.pimp)
      ==
    ::
        [%send-sequence-numbers *]
      =+  ;;([%send-sequence-numbers =nest:c] q.vase)
      ?~  can=(~(get by v-channels) nest)  cor
      =;  =cage
        (emit [%pass /numbers %agent [src.bowl %channels] %poke cage])
      :-  %noun
      !>  :^  %sequence-numbers  nest
        count.u.can
      ^-  (list [id-post:c (unit @ud)])
      %+  turn  (tap:on-v-posts:c posts.u.can)
      |=  [i=id-post:c p=(unit v-post:c)]
      [i ?~(p ~ `seq.u.p)]
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
      %hook-setup-template
    ?>  =(src our):bowl
    =+  !<([=nest:c =template:h] vase)
    (setup-hook-template nest template)
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
        ~(has by hooks.hooks)
      =.  order.hooks  (~(put by order.hooks) nest.action seq)
      =/  =response:h  [%order nest.action seq]
      (give %fact ~[/v0/hooks] hook-response-0+!>(response))
    ::
        %config
      ho-abet:(ho-configure:(ho-abed:ho-core id.action) +>.action)
    ::
        %cron
      ho-abet:(ho-cron:(ho-abed:ho-core id.action) +>.action)
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
      [%v0 %hooks %preview =kind:c name=@ ~]
    =/  cp=channel-preview:h
      (get-channel-hooks-preview kind.pole our.bowl name.pole)
    =.  cor  (give %fact ~ hook-channel-preview+!>(cp))
    (give %kick ~ ~)
  ::
      [%v0 %hooks %template =kind:c name=@ ~]
    =/  =template:h
      (get-hook-template kind.pole our.bowl name.pole)
    =.  cor  (give %fact ~ hook-template+!>(template))
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
    [%logs ~]     cor
    [%pimp ~]     cor
    [%wake ~]     cor
    [%numbers ~]  cor
  ::
      [=kind:c *]
    ?+    -.sign  !!
        %poke-ack
      ?~  p.sign  cor
      %-  (slog '%channels-server: poke failure' >wire< u.p.sign)
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
      (take-groups !<(r-groups:v7:gv q.cage.sign))
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
    (wake-hook rest.pole)
  ==
::
++  watch-groups  (safe-watch /groups [our.bowl %groups] /v1/groups)
::  +take-groups: process group update
::
++  take-groups
  |=  =r-groups:v7:gv
  =/  affected=(list nest:c)
    %+  murn  ~(tap by v-channels)
    |=  [=nest:c channel=v-channel:c]
    ?.  =(flag.r-groups group.perm.perm.channel)  ~
    `nest
  =*  r-group  r-group.r-groups
  ?+    r-group  cor
        [%seat * %add *]
      (request-join flag.r-groups affected ships.r-group)
    ::
      [%seat * %add-roles *]    (recheck-perms affected ~)
      [%seat * %del-roles *]     (recheck-perms affected ~)
      [%channel * %edit *]       (recheck-perms affected ~)
      [%channel * %add-readers *]  (recheck-perms affected ~)
      [%channel * %del-readers *]  (recheck-perms affected ~)
  ::
      [%role * %del *]
    (recheck-perms affected roles.r-group)
  ::
      [%seat * %del ~]
    ~&  "%channel-server: revoke perms for {<affected>}"
    %+  roll  affected
    |=  [=nest:c =_cor]
    %-  ~(rep in ships.r-group)
    |=  [=ship =_cor]
    =/  ca  (ca-abed:ca-core:cor nest)
    ca-abet:(ca-revoke:ca ship)
  ==
::
++  recheck-perms
  |=  [affected=(list nest:c) sects=(set role-id:v7:gv)]
  ~&  "%channel-server recheck permissions for {<affected>}"
  %+  roll  affected
  |=  [=nest:c co=_cor]
  =/  ca  (ca-abed:ca-core:co nest)
  ca-abet:(ca-recheck:ca sects)
::
++  request-join
  |=  [=flag:g affected=(list nest:c) ships=(set ship)]
  %-  emil
  %-  zing
  %+  murn  affected
  |=  =nest:c
  ?.  =(ship.nest our.bowl)  ~
  :-  ~
  %+  turn  ~(tap in ships)
  |=  =ship
  =/  request=[nest:c flag:g]  [nest flag]
  =/  =cage  [%channel-request-join !>(request)]
  [%pass /request-join %agent [ship %channels] %poke cage]
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
    =/  =update:c  [now.bowl %create perm.perm.channel meta.meta.channel]
    =/  =path  /[kind.nest]/[name.nest]/create
    =/  =cage  [%channel-update !>(update)]
    (give %fact ~[path] cage)
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
      ~&  (~(got by v-channels) n)
      ca-core
    ?>  can-nest
    ?>  our-host:ca-perms
    ?>  ((sane %tas) name.nest)
    =.  channel
      %*  .  *v-channel:c
        meta  [0 meta.new]
        perm  [1 writers.new group.new]
      ==
    =.  ca-core
      =/  =update:c  [now.bowl %create perm.perm.channel meta.meta.channel]
      =/  =cage  [%channel-update !>(update)]
      =/  =path  /[kind.nest]/[name.nest]/create
      =.  ca-core  (give %fact ~[path] cage)
      (give %kick ~[path] ~)
    =/  =channel:v2:gv
      :-  [title description '' '']:new
      [now.bowl %default | readers.new]
    =/  =action:v2:gv
      [group.new now.bowl %channel nest %add channel]
    =/  =dock    [our.bowl %groups]
    =/  =wire    (snoc ca-area %create)
    (emit %pass wire %agent dock %poke group-action-3+!>(action))
    ::
    ::  +can-nest: does the group exist, are we an admin
    ::
    ++  can-nest
      ^-  ?
      =/  groups
        .^  groups:v7:gv
          %gx
          /(scot %p our.bowl)/groups/(scot %da now.bowl)/v2/groups/noun
        ==
      =+  group=(~(get by groups) group.new)
      ?~  group  |
      =+  seat=(~(got by seats.u.group) our.bowl)
      !=(~ (~(int in admins.u.group) roles.seat))
    --
  ::
  ++  ca-c-channel
    |=  =c-channel:c
    ^+  ca-core
    ?>  our-host:ca-perms
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
        %meta
      ?>  (is-admin:ca-perms src.bowl)
      =^  changed  meta.channel  (next-rev:c meta.channel meta.c-channel)
      ?.  changed  ca-core
      (ca-update %meta meta.channel)
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
      ?>  =(kind.nest -.kind.essay.c-post)
      =/  id=id-post:c
        |-
        =/  post  (get:on-v-posts:c posts.channel now.bowl)
        ?~  post  now.bowl
        $(now.bowl `@da`(add now.bowl ^~((div ~s1 (bex 16)))))
      =.  count.channel  +(count.channel)
      =/  new=v-post:c  [[id count.channel id ~ ~] 0 essay.c-post]
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
      =/  new=v-post:c  [-.u.u.post(mod-at now.bowl) +(rev.u.u.post) essay]
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
          =*  post-author  (get-author-ship:utils p.c-post)
          :*  %on-post  %react  u.u.post
              ?:  ?=(%del-react -.c-post)  [post-author ~]
              [post-author `q.c-post]
          ==
        (run-hooks event nest 'react action blocked')
      ?:  ?=(%.n -.result)
        ((slog p.result) no-op)
      =/  new=$>(?(%add-react %del-react) c-post:c)
        ?>  ?=([%on-post %react *] p.result)
        ?~  react.p.result
          [%del-react id.c-post ship.p.result]
        [%add-react id.c-post [ship u.react]:p.result]
      =/  [update=? reacts=v-reacts:c]
        (ca-c-react reacts.u.u.post new)
      ?.  update  no-op
      :-  `[%post id.c-post %reacts reacts]
      %=  ca-core
          posts.channel
        %+  put:on-v-posts:c
          posts.channel
        [id.c-post ~ u.u.post(reacts reacts, mod-at now.bowl)]
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
        %+  put:on-v-posts:c
          posts.channel
        [id.c-post ~ u.u.post(mod-at now.bowl)]
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
              ?:  ?=(%del-react -.c-reply)  [(get-author-ship:utils p.c-reply) ~]
              [(get-author-ship:utils p.c-reply) `q.c-reply]
          ==
        (run-hooks event nest 'delete blocked')
      ?:  ?=(%.n -.result)
        ((slog p.result) [~ replies])
      =/  new=$>(?(%add-react %del-react) c-reply:c)
        ?>  ?=([%on-reply %react *] p.result)
        ?~  react.p.result  [%del-react id.c-reply ship.p.result]
        [%add-react id.c-reply [ship u.react]:p.result]
      =/  [update=? reacts=v-reacts:c]
        (ca-c-react reacts.u.u.reply new)
      ?.  update  `replies
      :-  `[%reply id.c-reply %reacts reacts]
      (put:on-v-replies:c replies id.c-reply ~ u.u.reply(reacts reacts))
    ==
  ::
  ++  ca-c-react
    |=  [reacts=v-reacts:c =c-react:c]
    ^-  [changed=? v-reacts:c]
    =/  =author:c
      ?:  ?=(%add-react -.c-react)
        p.c-react
      p.c-react
    ?>  ?|  =(src.bowl our.bowl)
            =(src.bowl (get-author-ship:utils author))
        ==
    =/  new-react  ?:(?=(%add-react -.c-react) `q.c-react ~)
    =/  [changed=? new-rev=@ud]
      =/  old-react  (~(get by reacts) author)
      ?~  old-react  &+0
      ?:  =(new-react old-react)
        |+rev.u.old-react
      &++(rev.u.old-react)
    ?.  changed  [| reacts]
    &+(~(put by reacts) author new-rev new-react)
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
    ::
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
    |=  sects=(set sect:v0:gv)
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
      (said-2:utils nest plan posts.channel)
    (give %kick ~ ~)
  --
++  scry-path
  |=  [=dude:gall =path]
  %+  welp
  /(scot %p our.bowl)/[dude]/(scot %da now.bowl)
  path
++  get-hook-bowl
  |=  [channel=(unit [nest:c v-channel:c]) =config:h]
  ^-  bowl:h
  =/  group=(unit group:v7:gv)
    ?~  channel  ~
    =*  flag  group.perm.perm.+.u.channel
    %-  some
    ?.  .^(? %gu (scry-path %groups /$))  *group:v7:gv
    ?.  .^(? %gu (scry-path %groups /groups/(scot %p p.flag)/[q.flag]))
      *group:v7:gv
    .^(group:v7:gv %gx (scry-path %groups /v2/groups/(scot %p p.flag)/[q.flag]/noun))
  :*  channel
      group
      v-channels
      *hook:h  ::  we default this because each hook will replace with itself
      config
      [now our src eny]:bowl
  ==
::
++  ho-core
  |_  [id=id-hook:h =hook:h gone=_|]
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
    |=  i=id-hook:h
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
    =/  error=(unit tang)
      ?:(?=(%& -.result) ~ `p.result)
    (ho-give-response [%set id name src meta.hook error])
  ++  ho-edit
    |=  [name=(unit @t) src=(unit @t) meta=(unit data:m)]
    =?  src.hook  ?=(^ src)  u.src
    =/  result=(each vase tang)
      (compile:utils src.hook)
    ?:  ?=(%| -.result)
      %-  ho-give-response
      [%set id name.hook src.hook meta.hook `p.result]
    =?  name.hook  ?=(^ name)  u.name
    =?  meta.hook  ?=(^ meta)  u.meta
    =.  compiled.hook  `p.result
    %-  ho-give-response
    [%set id name.hook src.hook meta.hook ~]
  ::
  ++  ho-del
    =.  gone  &
    =.  cor
      %+  roll
        ~(tap by (~(gut by crons.hooks) id *cron:h))
      |=  [[=origin:h =job:h] cr=_cor]
      (unschedule-cron:cr origin job)
    =.  crons.hooks  (~(del by crons.hooks) id)
    =.  order.hooks
      %+  roll
        ~(tap by order.hooks)
      |=  [[=nest:c ids=(list id-hook:h)] or=(map nest:c (list id-hook:h))]
      =-  (~(put by or) nest -)
      (skip ids |=(i=id-hook:h =(id i)))
    =.  waiting.hooks
      %+  roll
        ~(tap by waiting.hooks)
      |=  [[=id-wait:h w=[* waiting-hook:h]] wh=_waiting.hooks]
      ?.  =(id hook.w)  wh
      (~(del by wh) id-wait)
    (ho-give-response [%gone id])
  ++  ho-configure
    |=  [=nest:c =config:h]
    ^+  ho-core
    =.  config.hook  (~(put by config.hook) nest config)
    (ho-give-response [%config id nest config])
  ++  ho-cron
    |=  [=origin:h schedule=$@(@dr schedule:h) =config:h]
    ^+  ho-core
    =?  schedule  ?=(@ schedule)
      [now.bowl schedule]
    ?>  ?=(^ schedule)
    =/  =cron:h  (~(gut by crons.hooks) id *cron:h)
    =/  =job:h  [id schedule config]
    =.  crons.hooks
      =-  (~(put by crons.hooks) id.hook -)
      (~(put by cron) origin job)
    =.  cor  (schedule-cron origin job)
    (ho-give-response [%cron id origin schedule config])
  ++  ho-rest
    |=  =origin:h
    ^+  ho-core
    =/  crons  (~(got by crons.hooks) id)
    =/  cron  (~(got by crons) origin)
    =.  crons.hooks
      (~(put by crons.hooks) id (~(del by crons) origin))
    =.  cor  (unschedule-cron origin cron)
    (ho-give-response [%rest id origin])
  ++  ho-run-single
    |=  [=event:h prefix=tape =origin:h =config:h]
    =/  channel
      ?@  origin  ~
      ?~  ch=(~(get by v-channels) origin)  ~
      `[origin u.ch]
    =/  =bowl:h  (get-hook-bowl channel config)
    =/  return=(unit return:h)
      (run-hook:utils [event bowl(hook hook)] hook)
    ?~  return
      %-  (slog (crip "{prefix} {<id>} failed, running on {<origin>}") ~)
      ho-core
    %-  (slog (crip "{prefix} {<id>} ran on {<origin>}") ~)
    =.  hook  hook(state new-state.u.return)
    =.  cor  (run-hook-effects effects.u.return origin)
    ho-core
  ++  ho-give-response
    |=  =response:h
    (give %fact ~[/v0/hooks] hook-response-0+!>(response))
  --
++  run-hooks
  |=  [=event:h =nest:c default=cord]
  ^-  [(each event:h tang) _cor]
  =|  effects=(list effect:h)
  =/  order  (~(gut by order.hooks) nest ~)
  =/  channel  `[nest (~(got by v-channels) nest)]
  =/  =bowl:h  (get-hook-bowl channel *config:h)
  |-
  ?~  order
    [&+event (run-hook-effects effects nest)]
  =*  next  $(order t.order)
  =/  hook  (~(got by hooks.hooks) i.order)
  =.  bowl  bowl(hook hook, config (~(gut by config.hook) nest ~))
  =/  return=(unit return:h)
    (run-hook:utils [event bowl] hook)
  ?~  return  next
  =*  result  result.u.return
  =.  effects  (weld effects effects.u.return)
  =.  hooks.hooks  (~(put by hooks.hooks) i.order hook(state new-state.u.return))
  ?:  ?=(%denied -.result)
    [|+~[(fall msg.result default)] (run-hook-effects effects nest)]
  =.  event  event.result
  next
++  wake-hook
  |=  =(pole knot)
  ^+  cor
  ?+  pole  ~|(bad-arvo-take+pole !!)
      [%waiting id=@ ~]
    =/  id=id-hook:h  (slav %uv id.pole)
    ?~  wh=(~(get by waiting.hooks) id)  cor
    ::  make sure we clean up
    =.  waiting.hooks  (~(del by waiting.hooks) id)
    ::  ignore premature fires
    ?:  (lth now.bowl fires-at.u.wh)  cor
    =*  origin  origin.u.wh
    =/  hook  (~(got by hooks.hooks) hook.u.wh)
    =/  config  ?@(origin ~ (~(gut by config.hook) origin ~))
    =/  args  [[%wake +.u.wh] "waiting hook" origin config]
    ho-abet:(ho-run-single:(ho-abed:ho-core hook.u.wh) args)
  ::
      [%cron id=@ kind=?(%chat %diary %heap) ship=@ name=@ ~]
    =/  id=id-hook:h  (slav %uv id.pole)
    =/  =origin:h  [kind.pole (slav %p ship.pole) name.pole]
    ::  if unscheduled, ignore
    ?~  cron=(~(get by crons.hooks) id)  cor
    ?~  job=(~(get by u.cron) origin)  cor
    ::  ignore premature fires
    ?:  (lth now.bowl next.schedule.u.job)  cor
    =.  next.schedule.u.job
      ::  we don't want to run the cron for every iteration it would
      ::  have run 'offline', so we check here to make sure that the
      ::  next fire time is in the future
      ::
      =/  next  (add [next repeat]:schedule.u.job)
      |-
      ?:  (gte next now.bowl)  next
      $(next (add next repeat.schedule.u.job))
    =.  crons.hooks
      %+  ~(put by crons.hooks)  id
      (~(put by u.cron) origin u.job)
    =.  cor
      (schedule-cron origin u.job)
    =/  args  [[%cron ~] "cron job" origin config.u.job]
    ho-abet:(ho-run-single:(ho-abed:ho-core id-hook.u.job) args)
  ==
++  schedule-cron
  |=  [=origin:h =job:h]
  ^+  cor
  =/  wire
    %+  welp  /hooks/cron/(scot %uv id-hook.job)
    ?@  origin  ~
    /[kind.origin]/(scot %p ship.origin)/[name.origin]
  (emit [%pass wire %arvo %b %wait next.schedule.job])
++  unschedule-cron
  |=  [=origin:h =job:h]
  =/  wire
    %+  welp  /hooks/cron/(scot %uv id-hook.job)
    ?@  origin  ~
    /[kind.origin]/(scot %p ship.origin)/[name.origin]
  (emit [%pass wire %arvo %b %rest next.schedule.job])
++  schedule-waiting
  |=  wh=waiting-hook:h
  =/  =wire  /hooks/waiting/(scot %uv id.wh)
  (emit [%pass wire %arvo %b %wait fires-at.wh])
++  unschedule-waiting
  |=  id=id-hook:h
  ^+  cor
  ?~  previous=(~(get by waiting.hooks) id)  cor
  =/  =wire  /hooks/waiting/(scot %uv id.u.previous)
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
    =/  =cage  group-action-4+!>(`a-groups:v7:gv`a-groups.effect)
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
    =/  =wire  /hooks/waiting/(scot %uv id.effect)
    =.  cor  (unschedule-waiting id.effect)
    =.  waiting.hooks
      (~(put by waiting.hooks) id.effect [origin +.effect])
    (schedule-waiting +.effect)
  ==
++  get-hook-template
  |=  =nest:c
  ^-  template:h
  =/  order=(list id-hook:h)  (~(got by order.hooks) nest)
  =/  crons=(list [id-hook:h job:h])
    %+  murn  ~(tap by crons.hooks)
    |=  [=id-hook:h =cron:h]
    ?~  job=(~(get by cron) nest)  ~
    `[id-hook u.job]
  =/  ids=(list id-hook:h)  (welp order (turn crons head))
  =/  hooks=(map id-hook:h hook:h)
    %-  ~(gas by *(map id-hook:h hook:h))
    ^-  (list [id-hook:h hook:h])
    %+  turn  ids
    |=  =id-hook:h
    ^-  [id-hook:h hook:h]
    =/  hook  (~(got by hooks.hooks) id-hook)
    =/  config  (~(gut by config.hook) nest ~)
    =/  config-map  (~(put by *(map nest:c config:h)) nest config)
    :-  id-hook
    hook(compiled ~, state !>(~), config config-map)
  :*  nest
      hooks
      order
      crons
  ==
++  setup-hook-template
  |=  [=nest:c =template:h]
  ^+  cor
  =.  order.hooks
    (~(put by order.hooks) nest order.template)
  =.  crons.hooks
    %-  ~(gas by crons.hooks)
    %+  turn  crons.template
    |=  [=id-hook:h =job:h]
    :-  id-hook
    (~(put by *cron:h) nest job)
  =.  hooks.hooks
    %-  ~(gas by hooks.hooks)
    %+  turn
      ~(tap by hooks.template)
    |=  [=id-hook:h =hook:h]
    =/  result=(each vase tang)
      (compile:utils src.hook)
    =/  compiled
      ?:  ?=(%| -.result)
        ((slog 'compilation result:' p.result) ~)
      `p.result
    ?~  old-config=(~(get by config.hook) from.template)
      [id-hook hook(config ~, compiled compiled)]
    [id-hook hook(config (my [nest u.old-config] ~), compiled compiled)]
  =/  crons  crons.template
  |-
  ?~  crons  cor
  =*  cron  +.i.crons
  =/  fires-at
    ?:  (gth next.schedule.cron now.bowl)
      next.schedule.cron
    (add now.bowl repeat.schedule.cron)
  =.  cor  (schedule-cron nest cron(next.schedule fires-at))
  $(crons t.crons)
++  get-channel-hooks-preview
  |=  =nest:c
  ^-  channel-preview:h
  =/  =template:h  (get-hook-template nest)
  %+  turn
    ~(tap by hooks.template)
  |=  [=id-hook:h =hook:h]
  [name.hook meta.hook]
--
