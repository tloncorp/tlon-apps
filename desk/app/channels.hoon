::  channels: diary, heap & chat channels for groups
::
::    this is the client side that pulls data from the channels-server.
::
::  XX  chat thread entries can no longer be edited.  maybe fix before
::      release?
::
/-  c=channel, g=groups, ha=hark
/-  meta
/+  default-agent, verb, dbug, sparse, neg=negotiate
/+  utils=channel-utils, volume
::  performance, keep warm
/+  channel-json
%-  %-  agent:neg
    :+  |
      [~.channels^%0 ~ ~]
    [%channels-server^[~.channels^%0 ~ ~] ~ ~]
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  current-state
    $:  %0
        =v-channels:c
        voc=(map [nest:c plan:c] (unit said:c))
        pins=(list nest:c)
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
  ++  on-save  !>([state])
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
    ~&  strange-diary-arvo+wire
    `this
  --
|_  [=bowl:gall cards=(list card)]
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  server  (cat 3 dap.bowl '-server')
::
::  does not overwite if wire and dock exist.  maybe it should
::  leave/rewatch if the path differs?
::
++  safe-watch
  |=  [=wire =dock =path]
  ^+  cor
  ?:  (~(has by wex.bowl) wire dock)  cor
  (emit %pass wire %agent dock %watch path)
::
++  load
  |=  =vase
  |^  ^+  cor
  =+  !<([old=versioned-state] vase)
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
    :~  [%pass /migrate %agent [our.bowl %diary] %poke %diary-migrate !>(~)]
        [%pass /migrate %agent [our.bowl %heap] %poke %heap-migrate !>(~)]
        [%pass /migrate %agent [our.bowl %chat] %poke %chat-migrate !>(~)]
    ==
  inflate-io
::
++  inflate-io
  ::  initiate version negotiation with our own channels-server
  ::
  =.  cor  (emit (initiate:neg our.bowl server))
  ::  leave all subscriptions we don't recognize
  ::
  =.  cor
    %+  roll
      ~(tap by wex.bowl)
    |=  [[[=(pole knot) sub-ship=ship =dude:gall] acked=? =path] core=_cor]
    =.  cor  core
    =/  keep=?
      ?+    pole  |
          [%groups *]  &(=(%groups dude) =(our.bowl ship) =(/groups path))
          [=kind:c ship=@ name=@ %updates ~]
        ?.  =(server dude)  |
        ?.  =((scot %p sub-ship) ship.pole)  |
        ?~  diary=(~(get by v-channels) kind.pole sub-ship name.pole)  |
        ?.  ?=([kind:c @ %updates ?(~ [@ ~])] path)  |
        ?.  =(kind.pole i.path)  |
        =(name.pole i.t.path)
      ::
          [=kind:c ship=@ name=@ %checkpoint ~]
        ?.  =(server dude)  |
        ?.  =((scot %p sub-ship) ship.pole)  |
        ?~  diary=(~(get by v-channels) kind.pole sub-ship name.pole)  |
        ?.  ?=([kind:c @ %checkpoint %before @] path)  |
        ?.  =(kind.pole i.path)  |
        =(name.pole i.t.path)
      ::
          [%said =kind:c ship=@ name=@ %post time=@ reply=?(~ [@ ~])]
        ?.  =(server dude)  |
        ?.  =((scot %p sub-ship) ship.pole)  |
        ?~  pplan=(slaw %ud time.pole)  |
        =/  qplan=(unit (unit time))
          ?~  reply.pole  `~
          ?~  q=(slaw %ud -.reply.pole)  ~
          ``u.q
        ?~  qplan  |
        ?.  (~(has by voc) [kind.pole sub-ship name.pole] u.pplan u.qplan)  |
        =(wire path)
      ==
    ?:  keep  cor
    (emit %pass pole %agent [sub-ship dude] %leave ~)
  ::
  ::  watch all the subscriptions we expect to have
  ::
  =.  cor  watch-groups
  ::
  =.  cor
    %+  roll
      ~(tap by v-channels)
    |=  [[=nest:c *] core=_cor]
    di-abet:di-safe-sub:(di-abed:di-core:core nest)
  ::
  cor
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+    mark  ~|(bad-poke+mark !!)
    :: TODO: add transfer/import channels
      %channel-action
    =+  !<(=a-channels:c vase)
    ?:  ?=(%create -.a-channels)
      di-abet:(di-create:di-core create-channel.a-channels)
    ?:  ?=(%pin -.a-channels)
      ?>  from-self
      cor(pins pins.a-channels)
    ?:  ?=(%join -.a-channel.a-channels)
      di-abet:(di-join:di-core [nest group.a-channel]:a-channels)
    di-abet:(di-a-diary:(di-abed:di-core nest.a-channels) a-channel.a-channels)
  ::
      %channel-migration
    ?>  =(our src):bowl
    =+  !<(new-channels=v-channels:c vase)
    =.  v-channels  (~(uni by new-channels) v-channels)  ::  existing overrides migration
    cor
  ::
      %channel-migration-pins
    ?>  =(our src):bowl
    =+  !<(new-pins=(list nest:c) vase)
    =.  pins  (weld pins new-pins)
    cor
  ==
::
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+    pole  ~|(bad-watch-path+pole !!)
      [%unreads ~]                   ?>(from-self cor)
      [%ui ~]                        ?>(from-self cor)
      [=kind:c ship=@ name=@ %ui ~]  ?>(from-self cor)
      [%said =kind:c host=@ name=@ %post time=@ reply=?(~ [@ ~])]
    =/  host=ship   (slav %p host.pole)
    =/  =nest:c     [kind.pole host name.pole]
    =/  =plan:c     =,(pole [(slav %ud time) ?~(reply ~ `(slav %ud -.reply))])
    (watch-said nest plan)
  ==
::
++  watch-said
  |=  [=nest:c =plan:c]
  ?.  (~(has by v-channels) nest)
    =/  wire  (said-wire nest plan)
    (safe-watch wire [ship.nest server] wire)
  di-abet:(di-said:(di-abed:di-core nest) plan)
::
++  said-wire
  |=  [=nest:c =plan:c]
  ^-  wire
  %+  welp
    /said/[kind.nest]/(scot %p ship.nest)/[name.nest]/(scot %ud p.plan)
  ?~(q.plan / /(scot %ud u.q.plan))
::
++  take-said
  |=  [=nest:c =plan:c =sign:agent:gall]
  =/  =wire  (said-wire nest plan)
  ^+  cor
  ?+    -.sign  !!
      %watch-ack
    %.  cor
    ?~  p.sign  same
    (slog leaf+"Preview failed" u.p.sign)
  ::
      %kick
    ?:  (~(has by voc) nest plan)
      cor  :: subscription ended politely
    (give %kick ~[wire] ~)
  ::
      %fact
    =.  cor  (give %fact ~[wire] cage.sign)
    =.  cor  (give %kick ~[wire] ~)
    ?+    p.cage.sign  ~|(funny-mark+p.cage.sign !!)
        %channel-denied  cor(voc (~(put by voc) [nest plan] ~))
        %channel-said
      =+  !<(=said:c q.cage.sign)
      cor(voc (~(put by voc) [nest plan] `said))
    ==
  ==
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+    pole  ~|(bad-agent-wire+pole !!)
      ~          cor
      [%hark ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  cor
    %-  (slog leaf+"Failed to hark" u.p.sign)
    cor
  ::
      [=kind:c ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    di-abet:(di-agent:(di-abed:di-core kind.pole ship name.pole) rest.pole sign)
  ::
      [%said =kind:c host=@ name=@ %post time=@ reply=?(~ [@ ~])]
    =/  host=ship   (slav %p host.pole)
    =/  =nest:c     [kind.pole host name.pole]
    =/  =plan:c     =,(pole [(slav %ud time) ?~(reply ~ `(slav %ud -.reply))])
    (take-said nest plan sign)
  ::
      [%groups ~]
    ?+    -.sign  !!
        %kick       watch-groups
        %watch-ack
      ?~  p.sign
        cor
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
      %-  (slog 'channels: migration poke failure' >wire< u.p.sign)
      cor
    ==
  ==
::
++  watch-groups  (safe-watch /groups [our.bowl %groups] /groups)
::
++  take-groups
  |=  =action:g
  =/  affected=(list nest:c)
    %+  murn  ~(tap by v-channels)
    |=  [=nest:c channel=v-channel:c]
    ?.  =(p.action group.perm.perm.channel)  ~
    `nest
  =/  diff  q.q.action
  ?+    diff  cor
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
  ~&  "%channel recheck permissions for {<affected>}"
  %+  roll  affected
  |=  [=nest:c co=_cor]
  =/  di  (di-abed:di-core:co nest)
  di-abet:(di-recheck:di sects)
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+    pole  [~ ~]
      [%x %channels ~]   ``channels+!>((uv-channels:utils v-channels))
      [%x %init ~]    ``noun+!>([unreads (uv-channels:utils v-channels)])
      [%x %pins ~]    ``channel-pins+!>(pins)
      [%x %unreads ~]  ``channel-unreads+!>(unreads)
      [%x =kind:c ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    (di-peek:(di-abed:di-core kind.pole ship name.pole) rest.pole)
  ::
      [%u =kind:c ship=@ name=@ ~]
    =/  =ship  (slav %p ship.pole)
    ``loob+!>((~(has by v-channels) kind.pole ship name.pole))
  ==
::
++  unreads
  ^-  unreads:c
  %-  ~(gas by *unreads:c)
  %+  turn  ~(tap in ~(key by v-channels))
  |=  =nest:c
  [nest di-unread:(di-abed:di-core nest)]
::
++  pass-hark
  |=  =new-yarn:ha
  ^-  card
  =/  =cage  hark-action-1+!>([%new-yarn new-yarn])
  [%pass /hark %agent [our.bowl %hark] %poke cage]
::
++  from-self  =(our src):bowl
::
++  di-core
  |_  [=nest:c channel=v-channel:c gone=_|]
  ++  di-core  .
  ++  emit  |=(=card di-core(cor (^emit card)))
  ++  emil  |=(caz=(list card) di-core(cor (^emil caz)))
  ++  give  |=(=gift:agent:gall di-core(cor (^give gift)))
  ++  safe-watch  |=([=wire =dock =path] di-core(cor (^safe-watch +<)))
  ++  di-perms  ~(. perms:utils our.bowl now.bowl nest group.perm.perm.channel)
  ++  di-abet
    %_    cor
        v-channels
      ?:(gone (~(del by v-channels) nest) (~(put by v-channels) nest channel))
    ==
  ++  di-abed
    |=  n=nest:c
    di-core(nest n, channel (~(got by v-channels) n))
  ::
  ++  di-area  `path`/[kind.nest]/(scot %p ship.nest)/[name.nest]
  ++  di-sub-wire  (weld di-area /updates)
  ++  di-give-unread
    (give %fact ~[/unreads] channel-unread-update+!>([nest di-unread]))
::
  ::
  ::  handle creating a channel
  ::
  ++  di-create
    |=  create=create-channel:c
    ?>  from-self
    =.  nest  [kind.create our.bowl name.create]
    ?<  (~(has by v-channels) nest)
    =.  channel  *v-channel:c
    =.  group.perm.perm.channel  group.create
    =.  last-read.remark.channel  now.bowl
    =/  =cage  [%channel-command !>([%create create])]
    (emit %pass (weld di-area /create) %agent [our.bowl server] %poke cage)
  ::
  ::  handle joining a channel
  ::
  ++  di-join
    |=  [n=nest:c group=flag:g]
    ?<  (~(has by v-channels) nest)
    ?>  |(=(p.group src.bowl) from-self)
    =.  nest  n
    =.  channel  *v-channel:c
    =.  group.perm.perm.channel  group
    =.  last-read.remark.channel  now.bowl
    =.  di-core  di-give-unread
    =.  di-core  (di-response %join group)
    di-safe-sub
  ::
  ::  handle an action from the client
  ::
  ::    typically this will either handle the action directly (for local
  ::    things like marking channels read) or proxy the request to the
  ::    host (for global things like posting a post).
  ::
  ++  di-a-diary
    |=  =a-channel:c
    ?>  from-self
    ?+  -.a-channel  (di-send-command [%channel nest a-channel])
      %join       !!  ::  handled elsewhere
      %leave      di-leave
      ?(%read %read-at %watch %unwatch)  (di-a-remark a-channel)
    ==
  ::
  ++  di-a-remark
    |=  =a-remark:c
    ^+  di-core
    =.  remark.channel
      ?-    -.a-remark
          %watch    remark.channel(watching &)
          %unwatch  remark.channel(watching |)
          %read-at  !!
          %read
        =/  [=time post=(unit v-post:c)]  (need (ram:on-v-posts:c posts.channel))
        remark.channel(last-read `@da`(add time (div ~s1 100)))
      ==
    =.  di-core  di-give-unread
    (di-response a-remark)
  ::
  ::  proxy command to host
  ::
  ++  di-send-command
    |=  command=c-channels:c
    ^+  di-core
    ?>  ?=(%channel -.command)
    ::  don't allow anyone else to proxy through us
    ?.  =(src.bowl our.bowl)
      ~|("%channel-action poke failed: only allowed from self" !!)
    =/  =cage  [%channel-command !>(command)]
    ::  NB: we must have already subscribed to something from this ship,
    ::  so that we have negotiated a matching version.  If we want to do
    ::  anything in particular on a mismatched version, we can call
    ::  +can-poke:neg.
    ::
    (emit %pass di-area %agent [ship.nest.command server] %poke cage)
  ::
  ::  handle a said (previews) request where we have the data to respond
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
  ::
  ++  di-has-sub
    ^-  ?
    (~(has by wex.bowl) [di-sub-wire ship.nest dap.bowl])
  ::
  ++  di-safe-sub
    ?:  di-has-sub  di-core
    ?^  posts.channel  di-start-updates
    =.  load.net.channel  |
    %^  safe-watch  (weld di-area /checkpoint)  [ship.nest server]
    ?.  =(our.bowl ship.nest)
      =/  count  ?:(=(%diary kind.nest) '20' '100')
      /[kind.nest]/[name.nest]/checkpoint/before/[count]
    /[kind.nest]/[name.nest]/checkpoint/time-range/(scot %da *@da)
  ::
  ++  di-start-updates
    ::  not most optimal time, should maintain last heard time instead
    =/  tim=(unit time)
      (bind (ram:on-v-posts:c posts.channel) head)
    %^  safe-watch  di-sub-wire  [ship.nest server]
    /[kind.nest]/[name.nest]/updates/(scot %da (fall tim *@da))
  ::
  ++  di-agent
    |=  [=wire =sign:agent:gall]
    ^+  di-core
    ?+    wire  ~|(channel-strange-agent-wire+wire !!)
      ~  di-core  :: noop wire, should only send pokes
      [%create ~]       (di-take-create sign)
      [%updates ~]      (di-take-update sign)
      [%backlog ~]      (di-take-backlog sign)
      [%checkpoint ~]   (di-take-checkpoint sign)
    ==
  ::
  ++  di-take-create
    |=  =sign:agent:gall
    ^+  di-core
    ?-    -.sign
        %poke-ack
      =+  ?~  p.sign  ~
          %-  (slog leaf+"{<dap.bowl>}: Failed creation (poke)" u.p.sign)
          ~
      =/  =path  /[kind.nest]/[name.nest]/create
      =/  =wire  (weld di-area /create)
      (emit %pass wire %agent [our.bowl server] %watch path)
    ::
        %kick       di-safe-sub
        %watch-ack
      ?~  p.sign  di-core
      %-  (slog leaf+"{<dap.bowl>}: Failed creation" u.p.sign)
      di-core
    ::
        %fact
      =*  cage  cage.sign
      ?.  =(%channel-update p.cage)
        ~|(diary-strange-fact+p.cage !!)
      =+  !<(=update:c q.cage)
      =.  di-core  (di-u-channels update)
      =.  di-core  di-give-unread
      =.  di-core
        (emit %pass (weld di-area /create) %agent [ship.nest server] %leave ~)
      di-safe-sub
    ==
  ::
  ++  di-take-update
    |=  =sign:agent:gall
    ^+  di-core
    ?+    -.sign  di-core
        %kick       di-safe-sub
        %watch-ack
      ?~  p.sign  di-core
      %-  (slog leaf+"{<dap.bowl>}: Failed subscription" u.p.sign)
      di-core
    ::
        %fact
      =*  cage  cage.sign
      ?+  p.cage  ~|(channel-strange-fact+p.cage !!)
        %channel-logs    (di-apply-logs !<(log:c q.cage))
        %channel-update  (di-u-channels !<(update:c q.cage))
      ==
    ==
  ::
  ++  di-take-checkpoint
    |=  =sign:agent:gall
    ^+  di-core
    ?+    -.sign  di-core
        :: only if kicked prematurely
        %kick       ?:(load.net.channel di-core di-safe-sub)
        %watch-ack
      ?~  p.sign  di-core
      %-  (slog leaf+"{<dap.bowl>}: Failed partial checkpoint" u.p.sign)
      di-core
    ::
        %fact
      =*  cage  cage.sign
      ?+    p.cage  ~|(diary-strange-fact+p.cage !!)
          %channel-checkpoint
        (di-ingest-checkpoint !<(u-checkpoint:c q.cage))
      ==
    ==
  ::
  ++  di-take-backlog
    |=  =sign:agent:gall
    ^+  di-core
    ?+    -.sign  di-core
        :: only if kicked prematurely
        %kick  di-sync-backlog
        %watch-ack
      ?~  p.sign  di-core
      %-  (slog leaf+"{<dap.bowl>}: Failed backlog" u.p.sign)
      di-core
    ::
        %fact
      =*  cage  cage.sign
      ?+    p.cage  ~|(diary-strange-fact+p.cage !!)
          %channel-checkpoint
        (di-ingest-backlog !<(u-checkpoint:c q.cage))
      ==
    ==
  ::
  ++  di-ingest-checkpoint
    |=  chk=u-checkpoint:c
    ^+  di-core
    =.  load.net.channel  &
    =.  di-core  (di-apply-checkpoint chk &)
    =.  di-core  di-start-updates
    =.  di-core  di-sync-backlog
    =/  wire  (weld di-area /checkpoint)
    (emit %pass wire %agent [ship.nest dap.bowl] %leave ~)
  ::
  ++  di-apply-checkpoint
    |=  [chk=u-checkpoint:c send=?]
    =^  changed  sort.channel  (apply-rev:c sort.channel sort.chk)
    =?  di-core  &(changed send)  (di-response %sort sort.sort.channel)
    =^  changed  view.channel  (apply-rev:c view.channel view.chk)
    =?  di-core  &(changed send)  (di-response %view view.view.channel)
    =^  changed  perm.channel  (apply-rev:c perm.channel perm.chk)
    =?  di-core  &(changed send)  (di-response %perm perm.perm.channel)
    =^  changed  order.channel  (apply-rev:c order.channel order.chk)
    =?  di-core  &(changed send)  (di-response %order order.order.channel)
    =/  old  posts.channel
    =.  posts.channel
      ((uno:mo-v-posts:c posts.channel posts.chk) di-apply-unit-post)
    =?  di-core  &(send !=(old posts.channel))
      %+  di-response  %posts
      %+  gas:on-posts:c  *posts:c
      %+  murn  (turn (tap:on-v-posts:c posts.chk) head)
      |=  id=id-post:c
      ^-  (unit [id-post:c (unit post:c)])
      =/  post  (got:on-v-posts:c posts.channel id)
      =/  old   (get:on-v-posts:c old id)
      ?:  =(old `post)  ~
      ?~  post  (some [id ~])
      (some [id `(uv-post:utils u.post)])
    di-core
  ::
  ++  di-sync-backlog
    =/  checkpoint-start  (pry:on-v-posts:c posts.channel)
    ?~  checkpoint-start  di-core
    %^  safe-watch  (weld di-area /backlog)  [ship.nest server]
    %+  welp
    /[kind.nest]/[name.nest]/checkpoint/time-range
    ~|  `*`key.u.checkpoint-start
    /(scot %da *@da)/(scot %da key.u.checkpoint-start)
  ::
  ++  di-ingest-backlog
    |=  chk=u-checkpoint:c
    =.  di-core  (di-apply-checkpoint chk |)
    =/  wire  (weld di-area /backlog)
    (emit %pass wire %agent [ship.nest dap.bowl] %leave ~)
  ::
  ++  di-apply-logs
    |=  =log:c
    ^+  di-core
    %+  roll  (tap:log-on:c log)
    |=  [[=time =u-channel:c] di=_di-core]
    (di-u-channels:di time u-channel)
  ::
  ::  +di-u-* functions ingest updates and execute them
  ::
  ::    often this will modify the state and emit a "response" to our
  ::    own subscribers.  it may also emit unreads and/or trigger hark
  ::    events.
  ::
  ++  di-u-channels
    |=  [=time =u-channel:c]
    ?>  di-from-host
    ^+  di-core
    ?-    -.u-channel
        %create
      ?.  =(0 rev.perm.channel)  di-core
      =.  perm.perm.channel  perm.u-channel
      (di-response %create perm.u-channel)
    ::
        %order
      =^  changed  order.channel  (apply-rev:c order.channel +.u-channel)
      ?.  changed  di-core
      (di-response %order order.order.channel)
    ::
        %view
      =^  changed  view.channel  (apply-rev:c view.channel +.u-channel)
      ?.  changed  di-core
      (di-response %view view.view.channel)
    ::
        %sort
      =^  changed  sort.channel  (apply-rev:c sort.channel +.u-channel)
      ?.  changed  di-core
      (di-response %sort sort.sort.channel)
    ::
        %perm
      =^  changed  perm.channel  (apply-rev:c perm.channel +.u-channel)
      ?.  changed  di-core
      (di-response %perm perm.perm.channel)
    ::
        %post
      =/  old  posts.channel
      =.  di-core  (di-u-post id.u-channel u-post.u-channel)
      =?  di-core  !=(old posts.channel)  di-give-unread
      di-core
    ==
  ::
  ++  di-u-post
    |=  [=id-post:c =u-post:c]
    ^+  di-core
    =/  post  (get:on-v-posts:c posts.channel id-post)
    ?:  ?=([~ ~] post)  di-core
    ?:  ?=(%set -.u-post)
      ?~  post
        =/  post=(unit post:c)  (bind post.u-post uv-post:utils)
        =?  di-core  ?=(^ post.u-post)
          ::TODO  what about the "mention was added during edit" case?
          (on-post:di-hark id-post u.post.u-post)
        =.  posts.channel  (put:on-v-posts:c posts.channel id-post post.u-post)
        (di-response %post id-post %set post)
      ::
      ?~  post.u-post
        =.  posts.channel  (put:on-v-posts:c posts.channel id-post ~)
        (di-response %post id-post %set ~)
      ::
      =*  old  u.u.post
      =*  new  u.post.u-post
      =/  merged  (di-apply-post id-post old new)
      ?:  =(merged old)  di-core
      =.  posts.channel  (put:on-v-posts:c posts.channel id-post `merged)
      (di-response %post id-post %set `(uv-post:utils merged))
    ::
    ?~  post
      =.  diffs.future.channel
        ::  if the item affected by the update is not in the window we
        ::  care about, ignore it. otherwise, put it in the pending
        ::  diffs set.
        ::
        ?.  (~(has as:sparse window.future.channel) id-post)
          diffs.future.channel
        (~(put ju diffs.future.channel) id-post u-post)
      di-core
    ::
    ?-    -.u-post
        %reply  (di-u-reply id-post u.u.post id.u-post u-reply.u-post)
        %reacts
      =/  merged  (di-apply-reacts reacts.u.u.post reacts.u-post)
      ?:  =(merged reacts.u.u.post)  di-core
      =.  posts.channel
        (put:on-v-posts:c posts.channel id-post `u.u.post(reacts merged))
      (di-response %post id-post %reacts (uv-reacts:utils merged))
    ::
        %essay
      =^  changed  +.u.u.post  (apply-rev:c +.u.u.post +.u-post)
      ?.  changed  di-core
      =.  posts.channel  (put:on-v-posts:c posts.channel id-post `u.u.post)
      (di-response %post id-post %essay +>.u.u.post)
    ==
  ::
  ++  di-u-reply
    |=  [=id-post:c post=v-post:c =id-reply:c =u-reply:c]
    ^+  di-core
    |^
    =/  reply  (get:on-v-replies:c replies.post id-reply)
    ?:  ?=([~ ~] reply)  di-core
    ?:  ?=(%set -.u-reply)
      ?~  reply
        =/  reply=(unit reply:c)
          ?~  reply.u-reply  ~
          `(uv-reply:utils id-post u.reply.u-reply)
        =?  di-core  ?=(^ reply.u-reply)
          (on-reply:di-hark id-post post u.reply.u-reply)
        (put-reply reply.u-reply %set reply)
      ::
      ?~  reply.u-reply  (put-reply ~ %set ~)
      ::
      =*  old  u.u.reply
      =*  new  u.reply.u-reply
      =/  merged  (need (di-apply-reply id-reply `old `new))
      ?:  =(merged old)  di-core
      (put-reply `merged %set `(uv-reply:utils id-post merged))
    ::
    ?~  reply  di-core
    ::
    =/  merged  (di-apply-reacts reacts.u.u.reply reacts.u-reply)
    ?:  =(merged reacts.u.u.reply)  di-core
    (put-reply `u.u.reply(reacts merged) %reacts (uv-reacts:utils merged))
    ::
    ::  put a reply into a post by id
    ::
    ++  put-reply
      |=  [reply=(unit v-reply:c) =r-reply:c]
      ^+  di-core
      =/  post  (get:on-v-posts:c posts.channel id-post)
      ?~  post  di-core
      ?~  u.post  di-core
      =.  replies.u.u.post  (put:on-v-replies:c replies.u.u.post id-reply reply)
      =.  posts.channel  (put:on-v-posts:c posts.channel id-post `u.u.post)
      =/  meta=reply-meta:c  (get-reply-meta:utils u.u.post)
      (di-response %post id-post %reply id-reply meta r-reply)
    --
  ::
  ::  +di-apply-* functions apply new copies of data to old copies,
  ::  keeping the most recent versions of each sub-piece of data
  ::
  ++  di-apply-unit-post
    |=  [=id-post:c old=(unit v-post:c) new=(unit v-post:c)]
    ^-  (unit v-post:c)
    ?~  old  ~
    ?~  new  ~
    `(di-apply-post id-post u.old u.new)
  ::
  ++  di-apply-post
    |=  [=id-post:c old=v-post:c new=v-post:c]
    ^-  v-post:c
    %_  old
      replies  (di-apply-replies replies.old replies.new)
      reacts   (di-apply-reacts reacts.old reacts.new)
      +        +:(apply-rev:c +.old +.new)
    ==
  ::
  ++  di-apply-reacts
    |=  [old=v-reacts:c new=v-reacts:c]
    ^-  v-reacts:c
    %-  (~(uno by old) new)
    |=  [* a=(rev:c (unit react:c)) b=(rev:c (unit react:c))]
    +:(apply-rev:c a b)
  ::
  ++  di-apply-replies
    |=  [old=v-replies:c new=v-replies:c]
    ((uno:mo-v-replies:c old new) di-apply-reply)
  ::
  ++  di-apply-reply
    |=  [=id-reply:c old=(unit v-reply:c) new=(unit v-reply:c)]
    ^-  (unit v-reply:c)
    ?~  old  ~
    ?~  new  ~
    :-  ~
    %=  u.old
      reacts  (di-apply-reacts reacts.u.old reacts.u.new)
      +      +.u.new
    ==
  ::
  ::  +di-hark: notification dispatch
  ::
  ::    entry-points are +on-post and +on-reply, who may implement distinct
  ::    notification behavior
  ::
  ++  di-hark
    |%
    ++  on-post
      |=  [=id-post:c post=v-post:c]
      ^+  di-core
      ?:  =(author.post our.bowl)
        di-core
      ::  we want to be notified if we were mentioned in the post
      ::
      ?:  (was-mentioned:utils content.post our.bowl)
        ?.  (want-hark %mention)
          di-core
        =/  cs=(list content:ha)
          ~[[%ship author.post] ' mentioned you: ' (flatten:utils content.post)]
        (emit (pass-hark (di-spin /post/(rsh 4 (scot %ui id-post)) cs ~)))
      ::
      ::TODO  if we (want-hark %any), notify
      di-core
    ::
    ++  on-reply
      |=  [=id-post:c post=v-post:c reply=v-reply:c]
      ^+  di-core
      ?:  =(author.reply our.bowl)
        di-core
      ::  preparation of common cases
      ::
      =*  diary-notification
        :~  [%ship author.reply]  ' commented on '
            [%emph title.kind-data.post]   ': '
            [%ship author.reply]  ': '
            (flatten:utils content.reply)
        ==
      =*  heap-notification
        =/  content  (flatten:utils content.reply)
        =/  title=@t
          ?^  title.kind-data.post  (need title.kind-data.post)
          ?:  (lte (met 3 content) 80)  content
          (cat 3 (end [3 77] content) '...')
        :~  [%ship author.reply]  ' commented on '
            [%emph title]   ': '
            [%ship author.reply]  ': '
            content
        ==
      ::  construct a notification message based on the reason to notify,
      ::  if we even need to notify at all
      ::
      =;  cs=(unit (list content:ha))
        ?~  cs  di-core
        =/  =path
          /post/(rsh 4 (scot %ui id-post))/(rsh 4 (scot %ui id.reply))
        (emit (pass-hark (di-spin path u.cs ~)))
      ::  notify because we wrote the post the reply responds to
      ::
      ?:  =(author.post our.bowl)
        ?.  (want-hark %ours)  ~
        ?-    -.kind-data.post
            %diary  `diary-notification
            %heap   `heap-notification
            %chat
          :-  ~
          :~  [%ship author.reply]
              ' replied to you: '
              (flatten:utils content.reply)
          ==
        ==
      ::  notify because we were mentioned in the reply
      ::
      ?:  (was-mentioned:utils content.reply our.bowl)
        ?.  (want-hark %mention)  ~
        `~[[%ship author.reply] ' mentioned you: ' (flatten:utils content.reply)]
      ::  notify because we ourselves responded to this post previously
      ::
      ?:  %+  lien  (tap:on-v-replies:c replies.post)
          |=  [=time reply=(unit v-reply:c)]
          ?~  reply  |
          =(author.u.reply our.bowl)
        ?.  (want-hark %ours)  ~
        ?-    -.kind-data.post
            %diary  `diary-notification
            %heap   `heap-notification
            %chat
          :-  ~
          :~  [%ship author.reply]
              ' replied to your message “'
              (flatten:utils content.post)
              '”: '
              [%ship author.reply]
              ': '
              (flatten:utils content.reply)
          ==
        ==
      ::  only notify if we want to be notified about everything
      ::
      ?.  (want-hark %any)
        ~
      ?-    -.kind-data.post
          %diary  ~
          %heap   ~
          %chat
        :-  ~
        :~  [%ship author.reply]
            ' sent a message: '
            (flatten:utils content.reply)
        ==
      ==
    ::
    ++  want-hark
      |=  kind=?(%mention %ours %any)
      %+  (fit-level:volume [our now]:bowl)
        [%channel nest]
      ?-  kind
        %mention  %soft  ::  mentioned us
        %ours     %soft  ::  replied to us or our context
        %any      %loud  ::  any message
      ==
    --
  ::
  ::  convert content into a full yarn suitable for hark
  ::
  ++  di-spin
    |=  [rest=path con=(list content:ha) but=(unit button:ha)]
    ^-  new-yarn:ha
    =*  group  group.perm.perm.channel
    =/  gn=nest:g  nest
    =/  thread  (welp /[kind.nest]/(scot %p ship.nest)/[name.nest] rest)
    =/  rope  [`group `gn q.byk.bowl thread]
    =/  link  (welp /groups/(scot %p p.group)/[q.group]/channels thread)
    [& & rope con link but]
  ::
  ::  give a "response" to our subscribers
  ::
  ++  di-response
    |=  =r-channel:c
    =/  =r-channels:c  [nest r-channel]
    (give %fact ~[/ui (snoc di-area %ui)] channel-response+!>(r-channels))
  ::
  ::  produce an up-to-date unread state
  ::
  ++  di-unread
    ^-  unread:c
    =/  =time
      ?~  tim=(ram:on-v-posts:c posts.channel)  *time
      key.u.tim
    =/  unreads
      (lot:on-v-posts:c posts.channel `last-read.remark.channel ~)
    =/  read-id=(unit ^time)
      =/  pried  (pry:on-v-posts:c unreads)
      ?~  pried  ~
      ?~  val.u.pried  ~
      `id.u.val.u.pried
    =/  count
      %-  lent
      %+  skim  ~(tap by unreads)
      |=  [tim=^time post=(unit v-post:c)]
      ?&  ?=(^ post)
          !=(author.u.post our.bowl)
      ==
    [time count read-id]
  ::
  ::  handle scries
  ::
  ++  di-peek
    |=  =(pole knot)
    ^-  (unit (unit cage))
    ?+    pole  [~ ~]
        [%posts rest=*]  (di-peek-posts rest.pole)
        [%perm ~]        ``channel-perm+!>(perm.perm.channel)
        [%search %text skip=@ count=@ nedl=@ ~]
      :^  ~  ~  %channel-scan  !>
      %^    text:di-search
          (slav %ud skip.pole)
        (slav %ud count.pole)
      nedl.pole
    ::
        [%search %mention skip=@ count=@ nedl=@ ~]
      :^  ~  ~  %channel-scan  !>
      %^    mention:di-search
          (slav %ud skip.pole)
        (slav %ud count.pole)
      (slav %p nedl.pole)
    ==
  ::
  ++  give-posts
    |=  [mode=?(%outline %post) ls=(list [time (unit v-post:c)])]
    ^-  (unit (unit cage))
    =/  posts=v-posts:c  (gas:on-v-posts:c *v-posts:c ls)
    =-  ``channel-posts+!>(-)
    ?:  =(0 (lent ls))  [*posts:c ~ ~ 0]
    =/  =posts:c
      ?:  =(%post mode)  (uv-posts:utils posts)
      (uv-posts-without-replies:utils posts)
    =/  newer=(unit time)
      =/  more  (tab:on-v-posts:c posts.channel `-:(rear ls) 1)
      ?~(more ~ `-:(head more))
    =/  older=(unit time)
      =/  more  (bat:mo-v-posts:c posts.channel `-:(head ls) 1)
      ?~(more ~ `-:(head more))
    :*  posts
        newer
        older
        (wyt:on-v-posts:c posts.channel)
    ==
  ::
  ++  di-peek-posts
    |=  =(pole knot)
    ^-  (unit (unit cage))
    =*  on   on-v-posts:c
    ?+    pole  [~ ~]
        [%newest count=@ mode=?(%outline %post) ~]
      =/  count  (slav %ud count.pole)
      =/  ls     (top:mo-v-posts:c posts.channel count)
      (give-posts mode.pole ls)
    ::
        [%older start=@ count=@ mode=?(%outline %post) ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      =/  ls     (bat:mo-v-posts:c posts.channel `start count)
      (give-posts mode.pole ls)
    ::
        [%newer start=@ count=@ mode=?(%outline %post) ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      =/  ls     (tab:on posts.channel `start count)
      (give-posts mode.pole ls)
    ::
        [%around time=@ count=@ mode=?(%outline %post) ~]
      =/  count  (slav %ud count.pole)
      =/  time  (slav %ud time.pole)
      =/  older  (bat:mo-v-posts:c posts.channel `time count)
      =/  newer  (tab:on posts.channel `time count)
      =/  post   (get:on posts.channel time)
      =/  posts
          ?~  post  (welp older newer)
          (welp (snoc older [time u.post]) newer)
      (give-posts mode.pole posts)
    ::
        [%post time=@ ~]
      =/  time  (slav %ud time.pole)
      =/  post  (get:on posts.channel time)
      ?~  post  ~
      ?~  u.post  `~
      ``channel-post+!>((uv-post:utils u.u.post))
    ::
        [%post %id time=@ %replies rest=*]
      =/  time  (slav %ud time.pole)
      =/  post  (get:on posts.channel `@da`time)
      ?~  post  ~
      ?~  u.post  `~
      (di-peek-replies replies.u.u.post rest.pole)
    ==
  ::
  ++  di-peek-replies
    |=  [replies=v-replies:c =(pole knot)]
    ^-  (unit (unit cage))
    =*  on   on-v-replies:c
    ?+    pole  [~ ~]
        [%all ~]  ``channel-replies+!>(replies)
        [%newest count=@ ~]
      =/  count  (slav %ud count.pole)
      ``channel-replies+!>((gas:on *v-replies:c (top:mo-v-replies:c replies count)))
    ::
        [%older start=@ count=@ ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      ``channel-replies+!>((gas:on *v-replies:c (bat:mo-v-replies:c replies `start count)))
    ::
        [%newer start=@ count=@ ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %ud start.pole)
      ``channel-replies+!>((gas:on *v-replies:c (tab:on replies `start count)))
    ::
        [%reply %id time=@ ~]
      =/  time  (slav %ud time.pole)
      =/  reply  (get:on-v-replies:c replies `@da`time)
      ?~  reply  ~
      ?~  u.reply  `~
      ``channel-reply+!>(u.u.reply)
    ==
  ::
  ++  di-search
    |^  |%
        ++  mention
          |=  [sip=@ud len=@ud nedl=ship]
          ^-  scan:c
          (scour sip len %mention nedl)
        ::
        ++  text
          |=  [sip=@ud len=@ud nedl=@t]
          ^-  scan:c
          (scour sip len %text nedl)
        --
    ::
    +$  match-type
      $%  [%mention nedl=ship]
          [%text nedl=@t]
      ==
    ::
    ++  scour
      |=  [skip=@ud len=@ud =match-type]
      =*  posts  posts.channel
      ?>  (gth len 0)
      =+  s=[skip=skip len=len *=scan:c]
      =-  (flop scan)
      |-  ^+  s
      ?~  posts  s
      ?:  =(0 len.s)  s
      =.  s  $(posts r.posts)
      ?:  =(0 len.s)  s
      ::
      =.  s
        ?~  val.n.posts  s
        ?.  (match u.val.n.posts match-type)  s
        ?:  (gth skip.s 0)
          s(skip (dec skip.s))
        =/  res  [%post (uv-post-without-replies:utils u.val.n.posts)]
        s(len (dec len.s), scan [res scan.s])
      ::
      =.  s
        ?~  val.n.posts  s
        (scour-replys s id.u.val.n.posts replies.u.val.n.posts match-type)
      ::
      $(posts l.posts)
    ::
    ++  scour-replys
      |=  [s=[skip=@ud len=@ud =scan:c] =id-post:c replies=v-replies:c =match-type]
      |-  ^+  s
      ?~  replies  s
      ?:  =(0 len.s)  s
      =.  s  $(replies r.replies)
      ?:  =(0 len.s)  s
      ::
      =.  s
        ?~  val.n.replies  s
        ?.  (match-reply u.val.n.replies match-type)  s
        ?:  (gth skip.s 0)
          s(skip (dec skip.s))
        =/  res  [%reply id-post (uv-reply:utils id-post u.val.n.replies)]
        s(len (dec len.s), scan [res scan.s])
      ::
      $(replies l.replies)
    ::
    ++  match
      |=  [post=v-post:c =match-type]
      ^-  ?
      ?-  -.match-type
        %mention  (match-post-mention nedl.match-type post)
        %text     (match-post-text nedl.match-type post)
      ==
    ::
    ++  match-reply
      |=  [reply=v-reply:c =match-type]
      ?-  -.match-type
        %mention  (match-story-mention nedl.match-type content.reply)
        %text     (match-story-text nedl.match-type content.reply)
      ==
    ::
    ++  match-post-mention
      |=  [nedl=ship post=v-post:c]
      ^-  ?
      ?:  ?=([%chat %notice ~] kind-data.post)  |
      (match-story-mention nedl content.post)
    ::
    ++  match-story-mention
      |=  [nedl=ship =story:c]
      %+  lien  story
      |=  =verse:c
      ?.  ?=(%inline -.verse)  |
      %+  lien  p.verse
      |=  =inline:c
      ?+  -.inline  |
        %ship                                  =(nedl p.inline)
        ?(%bold %italics %strike %blockquote)  ^$(p.verse p.inline)
      ==
    ::
    ++  match-post-text
      |=  [nedl=@t post=v-post:c]
      ^-  ?
      ?-    -.kind-data.post
          %diary
        (match-story-text nedl ~[%inline title.kind-data.post] content.post)
      ::
          %heap
        %+  match-story-text  nedl
        ?~  title.kind-data.post
          content.post
        [~[%inline u.title.kind-data.post] content.post]
      ::
          %chat
        ?:  =([%notice ~] kind.kind-data.post)  |
        (match-story-text nedl content.post)
      ==
    ::
    ++  match-story-text
      |=  [nedl=@t =story:c]
      %+  lien  story
      |=  =verse:c
      ?.  ?=(%inline -.verse)  |
      %+  lien  p.verse
      |=  =inline:c
      ?@  inline
        (find nedl inline |)
      ?.  ?=(?(%bold %italics %strike %blockquote) -.inline)  |
      ^$(p.verse p.inline)
    ::
    ++  find
      |=  [nedl=@t hay=@t case=?]
      ^-  ?
      =/  nlen  (met 3 nedl)
      =/  hlen  (met 3 hay)
      ?:  (lth hlen nlen)
        |
      =?  nedl  !case
        (cass nedl)
      =/  pos  0
      =/  lim  (sub hlen nlen)
      |-
      ?:  (gth pos lim)
        |
      ?:  .=  nedl
          ?:  case
            (cut 3 [pos nlen] hay)
          (cass (cut 3 [pos nlen] hay))
        &
      $(pos +(pos))
    ::
    ++  cass
      |=  text=@t
      ^-  @t
      %^    run
          3
        text
      |=  dat=@
      ^-  @
      ?.  &((gth dat 64) (lth dat 91))
        dat
      (add dat 32)
    --
  ::
  ::  when we receive an update from the group we're in, check if we
  ::  need to change anything
  ::
  ++  di-recheck
    |=  sects=(set sect:g)
    ::  if our read permissions restored, re-subscribe
    ?:  (can-read:di-perms our.bowl)  di-safe-sub
    di-core
  ::
  ::  assorted helpers
  ::
  ++  di-from-host  |(=(ship.nest src.bowl) =(p.group.perm.perm.channel src.bowl))
  ::
  ::  leave the subscription only
  ::
  ++  di-simple-leave
    (emit %pass di-sub-wire %agent [ship.nest server] %leave ~)
  ::
  ::  Leave the subscription, tell people about it, and delete our local
  ::  state for the channel
  ::
  ++  di-leave
    =.  di-core  di-simple-leave
    =.  di-core  (di-response %leave ~)
    =.  gone  &
    di-core
  --
--
