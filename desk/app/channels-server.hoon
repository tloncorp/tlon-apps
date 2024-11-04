::  channels-server: diary, heap & chat channel storage for groups
::
::    this is the server-side from which /app/channels gets its data.
::
/-  c=channels, g=groups
/+  utils=channel-utils, imp=import-aid, em=emojimart
/+  default-agent, verb, dbug, neg=negotiate
::
%-  %-  agent:neg
    [| [~.channels^%2 ~ ~] ~]
%-  agent:dbug
%+  verb  |
::
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  current-state
    $:  %8
        =v-channels:c
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
  ++  on-arvo    on-arvo:def
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
  ?>  ?=(%8 -.old)
  =.  state  old
  inflate-io
  ::
  +$  versioned-state
    $%  state-8
        state-7
        state-6
        state-5
        state-4
        state-3
        state-2
        state-1
        state-0
    ==
  +$  state-8  current-state
  +$  state-7
    $:  %7
        =v-channels:v8:old:c
        =pimp:imp
    ==
  ++  state-7-to-8
    |=  s=state-7
    ^-  state-8
    :*  %8
        (v-channels-7-to-8 v-channels.s)
        pimp.s
    ==
  ++  v-channels-7-to-8
    |=  v=v-channels:v8:old:c
    ^-  v-channels:c
    %-  ~(run by v)
    |=  v=v-channel:v8:old:c
    ^-  v-channel:c
    :*  :*  posts.v
            count.v
            order.v
            view.v
            sort.v
            perm.v
            [0 ~]
        ==
        :*  net.v
            log.v
            remark.v
            window.v
            future.v
            pending.v
            last-updated.v
            *hooks:c
        ==
    ==
  +$  state-6
    $:  %6
      =v-channels:v7:old:c
      =pimp:imp
    ==
  +$  state-5
    $:  %5
        =v-channels:v6:old:c
        =pimp:imp
    ==
  ++  state-6-to-7
    |=  s=state-6
    ^-  state-7
    s(- %7, v-channels (v-channels-7-to-8:utils v-channels.s))
  ::
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
    v(future [future.v *pending-messages:c])
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
  +$  v-post-1        [v-seal-1 (rev:c essay:c)]
  +$  v-seal-1        [id=id-post:c replies=v-replies-1 reacts=v-reacts:v7:old:c]
  +$  v-replies-1     ((mop id-reply:c (unit v-reply-1)) lte)
  ++  on-v-replies-1  ((on id-reply:c (unit v-reply-1)) lte)
  +$  v-reply-1       [v-reply-seal:v7:old:c memo:c]
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
      ~&  "receiving command: {<c-channels>}"
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
      %hook  (ca-c-hook +.c-channel)
    ::
        %meta
      ?>  (is-admin:ca-perms src.bowl)
      =^  changed  meta.channel  (next-rev:c meta.channel meta.c-channel)
      ?.  changed  ca-core
      (ca-update %meta meta.channel)
    ::
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
      =^  update=(unit u-channel:c)  channel
        (ca-c-post c-post.c-channel)
      ?~  update  ca-core
      (ca-update u.update)
    ==
  ::
  ++  ca-c-post
    |=  =c-post:c
    ^-  [(unit u-channel:c) _channel]
    ?>  (can-write:ca-perms src.bowl writers.perm.perm.channel)
    ?-    -.c-post
        %add
      ?>  =(src.bowl author.essay.c-post)
      ?>  =(kind.nest -.kind-data.essay.c-post)
      =/  id=id-post:c
        |-
        =/  post  (get:on-v-posts:c posts.channel now.bowl)
        ?~  post  now.bowl
        $(now.bowl `@da`(add now.bowl ^~((div ~s1 (bex 16)))))
      =.  count.channel  +(count.channel)
      =/  new=v-post:c  [[id count.channel id ~ ~] 0 essay.c-post]
      ?>  (check-validate-hooks:utils new validate.hooks.channel)
      =/  transformed
        (run-transform-hooks:utils new transform.hooks.channel)
      :-  `[%post id %set ~ transformed]
      channel(posts (put:on-v-posts:c posts.channel id ~ transformed))
    ::
        %edit
      ?>  |(=(src.bowl author.essay.c-post) (is-admin:ca-perms src.bowl))
      ?>  =(kind.nest -.kind-data.essay.c-post)
      =/  post  (get:on-v-posts:c posts.channel id.c-post)
      ?~  post  `channel
      ?~  u.post  `channel
      ?>  |(=(src.bowl author.u.u.post) (is-admin:ca-perms src.bowl))
      ::TODO  could optimize and no-op if the edit is identical to current
      =/  new=v-post:c
        [-.u.u.post(mod-at now.bowl) +(rev.u.u.post) essay.c-post]
      :-  `[%post id.c-post %set ~ new]
      channel(posts (put:on-v-posts:c posts.channel id.c-post ~ new))
    ::
        %del
      =/  post  (get:on-v-posts:c posts.channel id.c-post)
      ?~  post  `channel(posts (put:on-v-posts:c posts.channel id.c-post ~))
      ?~  u.post  `channel
      ?>  |(=(src.bowl author.u.u.post) (is-admin:ca-perms src.bowl))
      :-  `[%post id.c-post %set ~]
      channel(posts (put:on-v-posts:c posts.channel id.c-post ~))
    ::
        ?(%add-react %del-react)
      =/  post  (get:on-v-posts:c posts.channel id.c-post)
      ?~  post  `channel
      ?~  u.post  `channel
      =/  [update=? reacts=v-reacts:c]  (ca-c-react reacts.u.u.post c-post)
      ?.  update  `channel
      :-  `[%post id.c-post %reacts reacts]
      =*  new
        u.u.post(reacts reacts, mod-at now.bowl)
      channel(posts (put:on-v-posts:c posts.channel id.c-post ~ new))
    ::
        %reply
      =/  post  (get:on-v-posts:c posts.channel id.c-post)
      ?~  post  `channel
      ?~  u.post  `channel
      =^  update=(unit u-post:c)  replies.u.u.post
        (ca-c-reply replies.u.u.post c-reply.c-post)
      ?~  update  `channel
      :-  `[%post id.c-post u.update]
      =*  new
        u.u.post(mod-at now.bowl)
      channel(posts (put:on-v-posts:c posts.channel id.c-post ~ new))
    ==
  ::
  ++  ca-c-reply
    |=  [replies=v-replies:c =c-reply:c]
    ^-  [(unit u-post:c) _replies]
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
      :-  `[%reply id %set ~ new]
      (put:on-v-replies:c replies id ~ new)
    ::
        %edit
      =/  reply  (get:on-v-replies:c replies id.c-reply)
      ?~  reply    `replies
      ?~  u.reply  `replies
      ?>  =(src.bowl author.u.u.reply)
      ::TODO  could optimize and no-op if the edit is identical to current
      =/  new=v-reply:c  [-.u.u.reply +(rev.u.u.reply) memo.c-reply]
      :-  `[%reply id.c-reply %set ~ new]
      (put:on-v-replies:c replies id.c-reply ~ new)
    ::
        %del
      =/  reply  (get:on-v-replies:c replies id.c-reply)
      ?~  reply  `(put:on-v-replies:c replies id.c-reply ~)
      ?~  u.reply  `replies
      ?>  |(=(src.bowl author.u.u.reply) (is-admin:ca-perms src.bowl))
      :-  `[%reply id.c-reply %set ~]
      (put:on-v-replies:c replies id.c-reply ~)
    ::
        ?(%add-react %del-react)
      =/  reply  (get:on-v-replies:c replies id.c-reply)
      ?~  reply  `replies
      ?~  u.reply  `replies
      =/  [update=? reacts=v-reacts:c]  (ca-c-react reacts.u.u.reply c-reply)
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
  ++  ca-c-hook
    |=  [=hook-type:c global=? =c-hook:c]
    ^+  ca-core
    ?>  (is-admin:ca-perms src.bowl)
    =.  hooks.channel
      ?-  hook-type
          %validate
        =^  new-hook-set  ca-core
          ((ca-c-hook-inner post:c ?) validate.hooks.channel hook-type global c-hook)
        hooks.channel(validate new-hook-set)
          %transform
        =^  new-hook-set  ca-core
          ((ca-c-hook-inner post:c post:c) transform.hooks.channel hook-type global c-hook)
        hooks.channel(transform new-hook-set)
          %sort
        =^  new-hook-set  ca-core
          ((ca-c-hook-inner ,[post:c post:c] ?) sort.hooks.channel hook-type global c-hook)
        hooks.channel(sort new-hook-set)
      ==
    ~&  "new hooks: {<hooks.channel>}"
    ca-core
  ++  ca-c-hook-inner
    |*  [args=mold return=mold]
    |=  [hook-set:c =hook-type:c global=? =c-hook:c]
    ^-  [hook-set:c _ca-core]
    =*  no-op  [[hooks order] ca-core]
    ?-  -.c-hook
        %add
      ~&  "adding hook {<hook-type>} {<c-hook>}"
      =/  id=id-hook:c  (rsh [3 48] eny.bowl)
      =/  src=(rev:c (unit @t))  [0 `src.c-hook]
      =/  result=(each nock tang)
        ~&  "compiling hook"
        ((compile:utils args return) `src.c-hook)
      ~&  "compilation result: {<result>}"
      =/  compiled
        ?:  ?=(%| -.result)  ~
        `p.result
      :-  :_  +:(next-rev:c order (snoc +.order id))
        (~(put by hooks) id [id name.c-hook src compiled])
      ?.  global  ca-core
      (ca-update %hook hook-type %set id name.c-hook src ~)
    ::
        %edit
      ?~  old-hook=(~(get by hooks) id.c-hook)  no-op
      =/  hook  u.old-hook
      =^  changed  src.hook
        (next-rev:c src.hook src.c-hook)
      ?.  changed  no-op
      =.  compiled.hook
        ?~  +.src.hook  ~
        =/  result=(each nock tang)
          ((compile:utils args return) +.src.hook)
        ?:  ?=(%| -.result)  ~
        `p.result
      :-  :_  order
          (~(put by hooks) id.c-hook hook)
      ?.  global  ca-core
      (ca-update %hook hook-type %set id.c-hook name.hook src.hook ~)
    ::
        %del
      ::  TODO: make more CRDT
      :_  ca-core
      :-  (~(del by hooks) id.c-hook)
      =;  [* new-order=_order]
        new-order
      %+  next-rev:c  order
      %+  skim  +.order
      |=  id=id-hook:c
      !=(id id.c-hook)
    ::
        %order
      =^  changed  order
        (next-rev:c order seq.c-hook)
      ?.  changed  no-op
      :-  [hooks order]
      ?.(global ca-core (ca-update %hook hook-type %order order))
    ==
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
      (said-2:utils nest plan posts.channel)
    (give %kick ~ ~)
  --
::
:: ++  build  ::  and validate
::   |=  =make
::   ^-  (each nock tang)
::   ::  parse & mint the hoon
::   ::
::   =/  tonk=(each (pair type nock) hair)
::     =/  vex=(like hoon)
::       ?^  code.make  [*hair `[code.make *nail]]
::       ((full vest) [0 0] (trip code.make))
::     ?~  q.vex  |+p.vex
::     &+(~(mint ut -:(context make *self)) %noun p.u.q.vex)
::   ?:  ?=(%| -.tonk)
::     |+~[leaf+"\{{<p.p.tonk>} {<q.p.tonk>}}" 'syntax error']
::   ::  type-check the result
::   ::TODO  can we type-check to make sure it accepts a fact?
::   ::
::   =/  tout=type  (slit p.p.tonk -:!>(*fact))
::   ?:  (~(nest ut -:!>(*then)) | tout)
::     &+q.p.tonk
::   |+~['nest-fail']  ::TODO  we can't get the need & have out, can we?
:: ::
--
