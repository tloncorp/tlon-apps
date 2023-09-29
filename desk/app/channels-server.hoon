::  channels-server: diary, heap & chat channel storage for groups
::
::    this is the server-side from which /app/channels gets its data.
::
::  TODO: import state from diary
::
/-  c=channel, g=groups
/+  utils=channel-utils
/+  default-agent, verb, dbug, neg=negotiate
%-  %-  agent:neg
    [| [~.channels^%0 ~ ~] ~]
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  current-state
    $:  %0
        =v-channels:c
    ==
  --
=|  current-state
=*  state  -
=<
  %+  verb  |
  %-  agent:dbug
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
  |=  =vase
  |^  ^+  cor
  =+  !<(old=versioned-state vase)
  ?>  ?=(%0 -.old)
  =.  state  old
  inflate-io
  ::
  +$  versioned-state  $%(current-state)
  --
::
++  init
  ^+  cor
  =.  cor
    %-  emil
    %-  turn  :_  |=(=note:agent:gall [%pass /migrate note])
    ^-  (list note:agent:gall)
    :~  [%agent [our.bowl %diary] %poke %diary-migrate-server !>(~)]
        [%agent [our.bowl %heap] %poke %heap-migrate-server !>(~)]
        [%agent [our.bowl %chat] %poke %chat-migrate-server !>(~)]
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
      %channel-command
    =+  !<(=c-channels:c vase)
    ?-    -.c-channels
        %create
      =<  di-abet
      =/  =nest:c  [kind.create-channel.c-channels our.bowl name.create-channel.c-channels]
      (di-create:di-core nest create-channel.c-channels)
    ::
        %channel
      =/  channel-core  (di-abed:di-core nest.c-channels)
      di-abet:(di-c-channel:channel-core c-channel.c-channels)
    ==
  ::
      %channel-migration
    ?>  =(our src):bowl
    =+  !<(new-channels=v-channels:c vase)
    =.  v-channels  (~(uni by new-channels) v-channels)  ::  existing overrides migration
    %+  roll  ~(tap by v-channels)
    |=  [[=nest:c =v-channel:c] cr=_cor]
    di-abet:di-migrate:(di-abed:di-core:cr nest)
  ==
::
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+    pole  ~|(bad-watch-path+pole !!)
      [=kind:c name=@ %create ~]
    ?>  =(our src):bowl
    =*  nest  [kind.pole our.bowl name.pole]
    ?.  (~(has by v-channels) nest)  cor
    di-abet:di-watch-create:(di-abed:di-core nest)
  ::
      [=kind:c name=@ %updates ~]
    =/  di  (di-abed:di-core kind.pole our.bowl name.pole)
    ?>  (can-read:di-perms:di src.bowl)
    cor
  ::
      [=kind:c name=@ %updates after=@ ~]
    =<  di-abet
    %-  di-watch-updates:(di-abed:di-core kind.pole our.bowl name.pole)
    (slav %da after.pole)
  ::
      [=kind:c name=@ %checkpoint %time-range from=@ ~]
    =<  di-abet
    %-  di-watch-checkpoint:(di-abed:di-core kind.pole our.bowl name.pole)
    [(slav %da from.pole) ~]
  ::
      [=kind:c name=@ %checkpoint %time-range from=@ to=@ ~]
    =<  di-abet
    %^    di-watch-checkpoint:(di-abed:di-core kind.pole our.bowl name.pole)
        (slav %da from.pole)
      ~
    (slav %da to.pole)
  ::
      [=kind:c name=@ %checkpoint %before n=@ud ~]
    =<  di-abet
    %-  di-watch-checkpoint-page:(di-abed:di-core kind.pole our.bowl name.pole)
    (slav %ud n.pole)
  ::
      [%said =kind:c host=@ name=@ %post time=@ reply=?(~ [@ ~])]
    =/  host=ship   (slav %p host.pole)
    =/  =nest:c     [kind.pole host name.pole]
    =/  =plan:c     =,(pole [(slav %ud time) ?~(reply ~ `(slav %ud -.reply))])
    ?>  =(our.bowl host)
    di-abet:(di-said:(di-abed:di-core nest) plan)
  ==
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+    pole  ~|(bad-agent-wire+pole !!)
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
    |=  [=ship ci=_cor]
    ^+  cor
    =/  di  (di-abed:di-core:ci nest)
    di-abet:(di-revoke:di ship)
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
  =/  di  (di-abed:di-core:co nest)
  di-abet:(di-recheck:di sects)
::
++  di-core
  |_  [=nest:c channel=v-channel:c gone=_|]
  +*  di-posts  ~(. not posts.channel)
  ++  di-core  .
  ++  emit  |=(=card di-core(cor (^emit card)))
  ++  emil  |=(caz=(list card) di-core(cor (^emil caz)))
  ++  give  |=(=gift:agent:gall di-core(cor (^give gift)))
  ++  di-perms  ~(. perms:utils our.bowl now.bowl nest group.perm.perm.channel)
  ++  di-abet
    %_  cor
        v-channels
      ?:(gone (~(del by v-channels) nest) (~(put by v-channels) nest channel))
    ==
  ::
  ++  di-abed
    |=  n=nest:c
    di-core(nest n, channel (~(got by v-channels) n))
  ::
  ++  di-area  `path`/[kind.nest]/[name.nest]
  ++  di-sub-path  `path`(weld di-area /updates)
  ++  di-watch-create
    =/  =cage  [%channel-update !>([now.bowl %create perm.perm.channel])]
    (give %fact ~[/[kind.nest]/[name.nest]/create] cage)
  ::
  ++  di-watch-updates
    |=  =@da
    ^+  di-core
    ?>  (can-read:di-perms src.bowl)
    =/  =log:c  (lot:log-on:c log.channel `da ~)
    =.  di-core  (give %fact ~ %channel-logs !>(log))
    di-core
  ::
  ++  di-watch-checkpoint
    |=  [from=@da to=(unit @da)]
    ^+  di-core
    ?>  (can-read:di-perms src.bowl)
    =/  posts=v-posts:c  (lot:on-v-posts:c posts.channel `from to)
    =/  chk=u-checkpoint:c  -.channel(posts posts)
    =.  di-core  (give %fact ~ %channel-checkpoint !>(chk))
    (give %kick ~ ~)
  ::
  ++  di-watch-checkpoint-page
    |=  n=@
    ^+  di-core
    ?>  (can-read:di-perms src.bowl)
    =/  posts=v-posts:c  (gas:on-v-posts:c *v-posts:c (bat:mo-v-posts:c posts.channel ~ n))
    =/  chk=u-checkpoint:c  -.channel(posts posts)
    =.  di-core  (give %fact ~ %channel-checkpoint !>(chk))
    (give %kick ~ ~)
  ::
  ++  di-create
    |=  [n=nest:c new=create-channel:c]
    ^+  di-core
    |^
    =.  nest  n
    ?:  (~(has by v-channels) n)
      %-  (slog leaf+"channel-server: create already exists: {<n>}" ~)
      di-core
    ?>  can-nest
    ?>  am-host:di-perms
    ?>  ((sane %tas) name.nest)
    =.  channel
      %*  .  *v-channel:c
        perm  [0 writers.new group.new]
      ==
    =.  di-core
      =/  =cage  [%channel-update !>([now.bowl %create perm.perm.channel])]
      =/  =path  /[kind.nest]/[name.nest]/create
      =.  di-core  (give %fact ~[path] cage)
      (give %kick ~[path] ~)
    =/  =channel:g
      :-  [title description '' '']:new
      [now.bowl %default | readers.new]
    =/  =action:g
      [group.new now.bowl %channel nest %add channel]
    =/  =dock    [our.bowl %groups]
    =/  =wire    (snoc di-area %create)
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
  ++  di-c-channel
    |=  =c-channel:c
    ^+  di-core
    ?>  am-host:di-perms
    ?-    -.c-channel
        %view
      ?>  (is-admin:di-perms src.bowl)
      =^  changed  view.channel  (next-rev:c view.channel view.c-channel)
      ?.  changed  di-core
      (di-update %view view.channel)
    ::
        %sort
      ?>  (is-admin:di-perms src.bowl)
      =^  changed  sort.channel  (next-rev:c sort.channel sort.c-channel)
      ?.  changed  di-core
      (di-update %sort sort.channel)
    ::
        %order
      ?>  (is-admin:di-perms src.bowl)
      =^  changed  order.channel  (next-rev:c order.channel order.c-channel)
      ?.  changed  di-core
      (di-update %order order.channel)
    ::
        %add-writers
      ?>  (is-admin:di-perms src.bowl)
      =/  new-writers  (~(uni in writers.perm.perm.channel) sects.c-channel)
      =^  changed  perm.channel
        (next-rev:c perm.channel new-writers group.perm.perm.channel)
      ?.  changed  di-core
      (di-update %perm perm.channel)
    ::
        %del-writers
      ?>  (is-admin:di-perms src.bowl)
      =/  new-writers  (~(dif in writers.perm.perm.channel) sects.c-channel)
      =^  changed  perm.channel
        (next-rev:c perm.channel new-writers group.perm.perm.channel)
      ?.  changed  di-core
      (di-update %perm perm.channel)
    ::
        %post
      =^  update=(unit u-channel:c)  posts.channel
        (di-c-post c-post.c-channel)
      ?~  update  di-core
      (di-update u.update)
    ==
  ::
  ++  di-c-post
    |=  =c-post:c
    ^-  [(unit u-channel:c) _posts.channel]
    ?>  (can-write:di-perms src.bowl writers.perm.perm.channel)
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
      :-  `[%post id %set ~ new]
      (put:on-v-posts:c posts.channel id ~ new)
    ::
        %edit
      ?>  =(src.bowl author.essay.c-post)
      ?>  =(kind.nest -.kind-data.essay.c-post)
      =/  post  (get:on-v-posts:c posts.channel id.c-post)
      ?~  post  `posts.channel
      ?~  u.post  `posts.channel
      ?>  =(src.bowl author.u.u.post)
      =/  new=v-post:c  [-.u.u.post +(rev.u.u.post) essay.c-post]
      :-  `[%post id.c-post %set ~ new]
      (put:on-v-posts:c posts.channel id.c-post ~ new)
    ::
        %del
      =/  post  (get:on-v-posts:c posts.channel id.c-post)
      ?~  post  `(put:on-v-posts:c posts.channel id.c-post ~)
      ?~  u.post  `posts.channel
      ?>  =(src.bowl author.u.u.post)
      :-  `[%post id.c-post %set ~]
      (put:on-v-posts:c posts.channel id.c-post ~)
    ::
        ?(%add-react %del-react)
      =/  post  (get:on-v-posts:c posts.channel id.c-post)
      ?~  post  `posts.channel
      ?~  u.post  `posts.channel
      =/  [update=? reacts=v-reacts:c]  (di-c-react reacts.u.u.post c-post)
      ?.  update  `posts.channel
      :-  `[%post id.c-post %reacts reacts]
      (put:on-v-posts:c posts.channel id.c-post ~ u.u.post(reacts reacts))
    ::
        %reply
      =/  post  (get:on-v-posts:c posts.channel id.c-post)
      ?~  post  `posts.channel
      ?~  u.post  `posts.channel
      =^  update=(unit u-post:c)  replies.u.u.post
        (di-c-reply replies.u.u.post c-reply.c-post)
      ?~  update  `posts.channel
      :-  `[%post id.c-post u.update]
      (put:on-v-posts:c posts.channel id.c-post ~ u.u.post)
    ==
  ::
  ++  di-c-reply
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
      :-  `[%reply id %set ~ reply-seal memo.c-reply]
      (put:on-v-replies:c replies id ~ reply-seal memo.c-reply)
    ::
        %del
      =/  reply  (get:on-v-replies:c replies id.c-reply)
      ?~  reply  `(put:on-v-replies:c replies id.c-reply ~)
      ?~  u.reply  `replies
      ?>  =(src.bowl author.u.u.reply)
      :-  `[%reply id.c-reply %set ~]
      (put:on-v-replies:c replies id.c-reply ~)
    ::
        ?(%add-react %del-react)
      =/  reply  (get:on-v-replies:c replies id.c-reply)
      ?~  reply  `replies
      ?~  u.reply  `replies
      =/  [update=? reacts=v-reacts:c]  (di-c-react reacts.u.u.reply c-reply)
      ?.  update  `replies
      :-  `[%reply id.c-reply %reacts reacts]
      (put:on-v-replies:c replies id.c-reply ~ u.u.reply(reacts reacts))
    ==
  ::
  ++  di-c-react
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
  ++  di-update
    |=  =u-channel:c
    ^+  di-core
    =/  time
      |-
      =/  reply  (get:log-on:c log.channel now.bowl)
      ?~  reply  now.bowl
      $(now.bowl `@da`(add now.bowl ^~((div ~s1 (bex 16)))))
    =/  =update:c  [time u-channel]
    =.  log.channel  (put:log-on:c log.channel update)
    (di-give-update update)
  ::
  ++  di-subscription-paths
    ^-  (list path)
    %+  skim  ~(tap in (~(gas in *(set path)) (turn ~(val by sup.bowl) tail)))
    |=  =path
    =((scag 3 path) di-sub-path)
  ::
  ++  di-give-update
    |=  =update:c
    ^+  di-core
    =/  paths  di-subscription-paths
    ?:  =(~ paths)
      di-core
    (give %fact paths %channel-update !>(update))
  ::
  ++  di-subscriptions
    ^-  (set [ship path])
    %+  roll  ~(val by sup.bowl)
    |=  [[=ship =path] out=(set [ship path])]
    ?.  =((scag 3 path) di-sub-path)
      out
    (~(put in out) [ship path])
  ::
  ++  di-migrate
    ^+  di-core
    =/  paths  di-subscription-paths
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
  ++  di-revoke
    |=  her=ship
    ^+  di-core
    %+  roll  ~(tap in di-subscriptions)
    |=  [[=ship =path] di=_di-core]
    ?.  =(ship her)  di
    (emit:di %give %kick ~[path] `ship)
  ::
  ++  di-recheck
    |=  sects=(set sect:g)
    ::  if we have sects, we need to delete them from writers
    =?  di-core  !=(sects ~)
      =/  =c-channels:c  [%channel nest %del-writers sects]
      =/  =cage  [%channel-command !>(c-channels)]
      (emit %pass di-area %agent [our.bowl dap.bowl] %poke cage)
    ::  if subs read permissions removed, kick
    %+  roll  ~(tap in di-subscriptions)
    |=  [[=ship =path] di=_di-core]
    ?:  (can-read:di-perms:di ship)  di
    (emit:di %give %kick ~[path] `ship)
  ::
  ++  di-said
    |=  =plan:c
    ^+  di-core
    =.  di-core
      %^  give  %fact  ~
      ?.  (can-read:di-perms src.bowl)
        channel-denied+!>(~)
      (said:utils nest plan posts.channel)
    (give %kick ~ ~)
  --
--
